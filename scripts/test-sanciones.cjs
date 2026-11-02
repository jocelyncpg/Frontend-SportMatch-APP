const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
const plano = (valor) => JSON.parse(JSON.stringify(valor));

/** services/api.ts con un fetch simulado: la respuesta cruda del backend. */
function cargarApi(respuesta) {
  const module = { exports: {} };
  vm.runInNewContext(compile('services/api.ts'), {
    module, exports: module.exports, Error, Promise, JSON, Set, setTimeout, clearTimeout, AbortController,
    fetch: async () => respuesta,
    require(name) {
      if (name === './config') return { API_BASE_URL: 'http://gateway/api/v1' };
      if (name === './suspension') return cargarSuspension();
      throw Error(name);
    },
  });
  return module.exports;
}

/** services/suspension.ts (sin dependencias). */
function cargarSuspension() {
  const module = { exports: {} };
  vm.runInNewContext(compile('services/suspension.ts'), { module, exports: module.exports, Date, Number, String, Promise });
  return module.exports;
}
const respuesta = (status, json) => ({ ok: status < 400, status, json: async () => json });

/** services/sanciones.ts con el backend simulado por `responder(ruta, opciones)`. */
function cargarSanciones(responder = async () => undefined) {
  const calls = [];
  const module = { exports: {} };
  class ApiError extends Error { constructor(m, status, detail = '') { super(m); this.status = status; this.detail = detail; } }
  vm.runInNewContext(compile('services/sanciones.ts'), {
    module, exports: module.exports, Error, Promise, JSON, URLSearchParams, Number,
    require(name) {
      if (name === './auth') return { getToken: async () => 'token-admin' };
      if (name === './api') return { ApiError, apiRequest: async (...args) => { calls.push(args); return responder(...args); } };
      throw Error(name);
    },
  });
  return { api: module.exports, calls };
}

const SANCION = {
  id: 's-1', usuario: { user_id: 'u-2', nombre: 'Ana', apellido_inicial: 'T.' }, tipo: 'temporal', motivo: 'Acoso reiterado',
  inicio: '2026-11-01T12:00:00Z', fin: '2026-11-08T12:00:00Z', estado: 'activa', reporte_id: 'r-1', motivo_levantamiento: null,
};

test('una cuenta suspendida llega como ApiError con código, motivo y duración, y avisa a la sesión abierta', async () => {
  const cuerpo = { detail: 'Tu cuenta está suspendida hasta el 08-11-2026. Motivo: Acoso reiterado', code: 'account_suspended',
    tipo: 'temporal', motivo: 'Acoso reiterado', fin: '2026-11-08T12:00:00Z' };
  const { apiRequest, alSuspenderse, ApiError } = cargarApi(respuesta(403, cuerpo));
  const avisos = [];
  const dejar = alSuspenderse((e) => avisos.push(e));

  await assert.rejects(() => apiRequest('/users/x', { token: 'token-a' }), (e) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 403);
    assert.equal(e.code, 'account_suspended');
    // El mensaje es el texto del backend de siempre (ya trae el motivo y la fecha de fin).
    assert.equal(e.message, cuerpo.detail);
    assert.equal(e.detail, cuerpo.detail);
    assert.deepEqual(plano(e.suspension), { tipo: 'temporal', motivo: 'Acoso reiterado', fin: '2026-11-08T12:00:00Z' });
    return true;
  });
  assert.equal(avisos.length, 1);

  // En el login no hay token: se muestra el mensaje en la pantalla, sin cerrar ninguna sesión.
  await assert.rejects(() => apiRequest('/users/auth/login', { method: 'POST', body: {} }), /suspendida/);
  assert.equal(avisos.length, 1);
  dejar();
  await assert.rejects(() => apiRequest('/users/x', { token: 'token-a' }));
  assert.equal(avisos.length, 1);
});

test('una suspensión permanente no trae fecha y otros 403 siguen siendo errores normales', async () => {
  const permanente = cargarApi(respuesta(403, { detail: 'Tu cuenta fue suspendida de forma permanente. Motivo: X', code: 'account_suspended',
    tipo: 'permanente', motivo: 'X', fin: null }));
  await assert.rejects(() => permanente.apiRequest('/users/x', { token: 't' }), (e) => e.suspension.fin === null && e.suspension.tipo === 'permanente');
  const comun = cargarApi(respuesta(403, { detail: 'Solo un administrador puede gestionar sanciones.' }));
  await assert.rejects(() => comun.apiRequest('/users/x', { token: 't' }), (e) => e.code === undefined && e.suspension === undefined);
});

test('aplicar una sanción temporal envía los días y el reporte', async () => {
  const { api, calls } = cargarSanciones(async () => SANCION);
  const s = await api.aplicarSancion({ usuarioId: 'u-2', tipo: 'temporal', dias: 7, motivo: '  Acoso reiterado ', reporteId: 'r-1' });
  const [ruta, opciones] = calls[0];
  assert.equal(ruta, '/users/admin/sanctions');
  assert.equal(opciones.method, 'POST');
  assert.equal(opciones.token, 'token-admin');
  assert.deepEqual(plano(opciones.body), { usuario_id: 'u-2', tipo: 'temporal', motivo: 'Acoso reiterado', dias: 7, reporte_id: 'r-1' });
  assert.equal(s.usuario, 'Ana T.');
  assert.equal(s.estado, 'activa');
});

test('una sanción permanente no envía duración y las reglas se revisan antes de enviar', async () => {
  const { api, calls } = cargarSanciones(async () => ({ ...SANCION, tipo: 'permanente', fin: null }));
  await api.aplicarSancion({ usuarioId: 'u-2', tipo: 'permanente', dias: 30, motivo: 'Conducta grave' });
  assert.deepEqual(plano(calls[0][1].body), { usuario_id: 'u-2', tipo: 'permanente', motivo: 'Conducta grave' });
  for (const [tipo, dias, motivo] of [['temporal', null, 'Motivo'], ['temporal', 0, 'Motivo'], ['temporal', 366, 'Motivo'],
    ['temporal', 1.5, 'Motivo'], ['permanente', null, 'ab'], ['permanente', null, '  '], ['permanente', null, 'x'.repeat(301)]]) {
    await assert.rejects(() => api.aplicarSancion({ usuarioId: 'u-2', tipo, dias, motivo }), Error, `${tipo} ${dias} ${motivo.length}`);
  }
  assert.equal(calls.length, 1);
});

test('levantar y listar sanciones', async () => {
  const { api, calls } = cargarSanciones(async (ruta) => (ruta.includes('/lift') ? { ...SANCION, estado: 'levantada', motivo_levantamiento: 'Apelación' } : [SANCION]));
  const levantada = await api.levantarSancion('s-1', ' Apelación ');
  assert.equal(calls[0][0], '/users/admin/sanctions/s-1/lift');
  assert.deepEqual(plano(calls[0][1].body), { motivo: 'Apelación' });
  assert.equal(levantada.estado, 'levantada');
  await assert.rejects(() => api.levantarSancion('s-1', 'ab'), Error);
  const [una] = await api.listarSanciones('activa', 'u-2');
  assert.equal(calls.at(-1)[0], '/users/admin/sanctions?limit=100&estado=activa&usuario_id=u-2');
  assert.equal(una.usuarioId, 'u-2');
});
