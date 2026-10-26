const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

class ApiError extends Error { constructor(message, status, detail = '') { super(message); this.status = status; this.detail = detail; } }

/** Carga services/reportes.ts con el backend simulado por `responder(ruta, opciones)`. */
function load(responder = async () => undefined) {
  const calls = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/reportes.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, Promise, JSON, Set,
    require(name) {
      if (name === 'react') return { useSyncExternalStore: () => undefined };
      if (name === './auth') return { getToken: async () => 'token-a' };
      if (name === './api') return { ApiError, apiRequest: async (...args) => { calls.push(args); return responder(...args); } };
      throw Error(name);
    },
  });
  return { api: module.exports, calls };
}
const plano = (valor) => JSON.parse(JSON.stringify(valor));

test('un reporte válido viaja a Ms_Users con el token', async () => {
  const { api, calls } = load();
  assert.deepEqual(plano(await api.reportar('usuario', 'u-2', 'Beto T.', 'Spam o publicidad', '  insiste mucho  ')), { ok: true });
  const [ruta, opciones] = calls[0];
  assert.equal(ruta, '/users/reports');
  assert.equal(opciones.method, 'POST');
  assert.equal(opciones.token, 'token-a');
  assert.deepEqual(plano(opciones.body), {
    tipo: 'usuario', objetivo_id: 'u-2', objetivo_nombre: 'Beto T.', motivo: 'Spam o publicidad', detalle: 'insiste mucho',
  });
});

test('las reglas se revisan antes de enviar y los errores del servidor se muestran', async () => {
  const { api, calls } = load(async () => { throw new ApiError('Ya enviaste este reporte. Lo estamos revisando.', 409); });
  assert.equal((await api.reportar('usuario', 'u-2', 'Beto', 'Lugar inseguro', '')).ok, false);
  assert.equal((await api.reportar('usuario', 'u-2', 'Beto', 'Spam o publicidad', '')).ok, false);
  assert.equal((await api.reportar('usuario', 'u-2', 'Beto', 'Spam o publicidad', 'corto')).ok, false);
  assert.equal((await api.reportar('mensaje', 'm:1', 'Hola', 'Otro', 'corto')).ok, false);
  assert.equal(calls.length, 0);
  assert.deepEqual(plano(await api.reportar('actividad', 'a-1', 'Trote', 'Lugar inseguro', 'Hay un tramo sin luz')),
    { ok: false, motivo: 'Ya enviaste este reporte. Lo estamos revisando.' });
});

test('bloquear y desbloquear actualizan la lista local solo si el servidor acepta', async () => {
  let falla = false;
  const { api, calls } = load(async (ruta, opciones) => {
    if (falla) throw new ApiError('Deportista no disponible.', 404);
    if (ruta === '/users/me/blocks') return [{ user_id: 'u-9', nombre: 'Carla', apellido_inicial: 'R.', foto_perfil: null }];
    return opciones;
  });
  await api.cargarBloqueados();
  assert.equal(calls[0][1].token, 'token-a');
  assert.equal((await api.bloquear('u-2')).ok, true);
  assert.deepEqual(plano(calls.at(-1)), ['/users/me/blocks/u-2', { method: 'PUT', token: 'token-a' }]);
  assert.equal((await api.desbloquear('u-9')).ok, true);
  assert.equal(calls.at(-1)[1].method, 'DELETE');
  falla = true;
  assert.deepEqual(plano(await api.bloquear('u-3')), { ok: false, motivo: 'Deportista no disponible.' });
});

test('el panel de moderación lista y resuelve reportes', async () => {
  const api_ = { id: 'r-1', tipo: 'mensaje', objetivo_id: 'm:1', objetivo_nombre: 'Mensaje de Beto', motivo: 'Spam o estafa',
    detalle: '', estado: 'pendiente', fecha_creacion: '2026-10-10T20:00:00Z',
    reportante: { user_id: 'u-1', nombre: 'Ana', apellido_inicial: 'T.', foto_perfil: null } };
  const { api, calls } = load(async (ruta, opciones) => (opciones.method === 'PATCH'
    ? { ...api_, estado: opciones.body.estado, reportante: null } : [api_]));
  const [r] = await api.listarReportes('pendiente');
  assert.equal(calls[0][0], '/users/admin/reports?estado=pendiente&limit=100');
  assert.equal(r.reportante, 'Ana T.');
  assert.equal(r.objetivoNombre, 'Mensaje de Beto');
  const revisado = await api.revisarReporte('r-1', 'descartado');
  assert.equal(calls[1][0], '/users/admin/reports/r-1');
  assert.equal(revisado.estado, 'descartado');
  assert.equal(revisado.reportante, null);
});
