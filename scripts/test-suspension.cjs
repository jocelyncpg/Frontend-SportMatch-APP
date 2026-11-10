const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// HU-45 en la app: una cuenta suspendida ve el motivo y la duración (al iniciar sesión y en cualquier
// llamada) y la sesión se cierra de forma limpia.

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function cargarSuspension() {
  const module = { exports: {} };
  vm.runInNewContext(compile('services/suspension.ts'), { module, exports: module.exports, Date, Number, String, Promise });
  return module.exports;
}
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
const respuesta = (status, json) => ({ ok: status < 400, status, json: async () => json });
const SUSP_TEMPORAL = { detail: 'Tu cuenta está suspendida hasta el 08-11-2026. Motivo: Acoso reiterado', code: 'account_suspended',
  tipo: 'temporal', motivo: 'Acoso reiterado', fin: '2026-11-08T12:30:00Z' };
const SUSP_PERMANENTE = { detail: 'Tu cuenta fue suspendida de forma permanente. Motivo: Conducta grave', code: 'account_suspended',
  tipo: 'permanente', motivo: 'Conducta grave', fin: null };

test('la app solo normaliza lo que manda el backend: tipo, motivo y fin, sin inventar fechas', () => {
  const { leerSuspension } = cargarSuspension();
  assert.deepEqual(JSON.parse(JSON.stringify(leerSuspension(SUSP_TEMPORAL))), { tipo: 'temporal', motivo: 'Acoso reiterado', fin: '2026-11-08T12:30:00Z' });
  assert.deepEqual(JSON.parse(JSON.stringify(leerSuspension(SUSP_PERMANENTE))), { tipo: 'permanente', motivo: 'Conducta grave', fin: null });
  // Sin fin se trata como permanente (nunca se inventa una fecha).
  assert.equal(leerSuspension({ tipo: 'temporal', motivo: 'x', fin: null }).tipo, 'permanente');
  assert.equal(leerSuspension({}).motivo, '');
  assert.equal(leerSuspension({ tipo: 'permanente', motivo: 42 }).motivo, '');
  // El motivo queda como texto tal cual: la app lo pinta con <Text>, nunca como HTML.
  const html = '<img src=x onerror=alert(1)> & "comillas"';
  assert.equal(leerSuspension({ tipo: 'permanente', motivo: html }).motivo, html);
});

test('al iniciar sesión, la cuenta suspendida recibe el texto completo y no se cierra ninguna sesión', async () => {
  const { apiRequest, alSuspenderse, ApiError } = cargarApi(respuesta(403, SUSP_TEMPORAL));
  const avisos = [];
  const dejar = alSuspenderse((e) => avisos.push(e));
  await assert.rejects(() => apiRequest('/users/auth/login', { method: 'POST', body: {} }), (e) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.code, 'account_suspended');
    // El mensaje es el del backend, sin textos nuevos en la app.
    assert.equal(e.message, SUSP_TEMPORAL.detail);
    return true;
  });
  assert.equal(avisos.length, 0);
  dejar();
});

test('en cualquier llamada con sesión, una cuenta suspendida avisa a la app con el tipo, el motivo y el fin', async () => {
  const { apiRequest, alSuspenderse } = cargarApi(respuesta(403, SUSP_PERMANENTE));
  const avisos = [];
  const dejar = alSuspenderse((e) => avisos.push(e));
  for (const ruta of ['/matching/state', '/activities', '/notifications', '/clubs/me', '/payments/subscription/me']) {
    await assert.rejects(() => apiRequest(ruta, { token: 'token-a' }), (e) => e.suspension.tipo === 'permanente' && e.suspension.fin === null);
  }
  assert.equal(avisos.length, 5);
  assert.match(avisos[0].message, /suspendida de forma permanente/);
  assert.match(avisos[0].message, /Motivo: Conducta grave/);
  dejar();
});

test('otros 403 siguen siendo errores normales y no cierran la sesión', async () => {
  const { apiRequest, alSuspenderse } = cargarApi(respuesta(403, { detail: 'Solo un administrador puede gestionar sanciones.' }));
  const avisos = [];
  alSuspenderse((e) => avisos.push(e));
  await assert.rejects(() => apiRequest('/users/admin/sanctions', { token: 't' }), (e) => e.code === undefined && e.suspension === undefined);
  assert.equal(avisos.length, 0);
});

function manejador(extra = {}) {
  const { crearManejadorSuspension } = cargarSuspension();
  const log = [];
  let sesion = true;
  const deps = {
    haySesion: async () => sesion,
    avisar: (t) => log.push(['aviso', t]),
    cerrarSesion: async () => { log.push(['cierra']); sesion = false; },
    irAlLogin: () => log.push(['login']),
    ...extra,
  };
  return { log, manejar: crearManejadorSuspension(deps), cerrar: () => { sesion = false; } };
}

test('avisa una sola vez, cierra la sesión y vuelve al login aunque fallen varias llamadas a la vez', async () => {
  const { log, manejar } = manejador();
  const e = { message: 'Tu cuenta fue suspendida' };
  await Promise.all([manejar(e), manejar(e), manejar(e), manejar(e)]);
  assert.deepEqual(log, [['aviso', 'Tu cuenta fue suspendida'], ['cierra'], ['login']]);
});

test('una respuesta tardía de una sesión que ya se cerró no vuelve a avisar', async () => {
  const { log, manejar } = manejador();
  await manejar({ message: 'x' });
  log.length = 0;
  await manejar({ message: 'x' });
  assert.deepEqual(log, []);
});

test('si cerrar la sesión falla a medias, igual vuelve al login', async () => {
  const { log, manejar } = manejador({ cerrarSesion: async () => { throw new Error('sin almacenamiento'); } });
  await manejar({ message: 'x' });
  assert.deepEqual(log.map((l) => l[0]), ['aviso', 'login']);
});

test('logout limpia la sesión local aunque revocar las alertas falle (403 de una cuenta suspendida)', async () => {
  const quitadas = [];
  const reinicios = [];
  class ApiError extends Error { constructor(m, status) { super(m); this.status = status; } }
  const module = { exports: {} };
  vm.runInNewContext(compile('services/auth.ts'), {
    module, exports: module.exports, Error, Promise, JSON,
    require(name) {
      if (name === '@react-native-async-storage/async-storage') return { default: { multiRemove: async (claves) => { quitadas.push(...claves); } } };
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name === './api') return { ApiError, urlFoto: (v) => v ?? undefined, apiRequest: async () => undefined };
      if (name === './deportes') return { codigoDeporte: (v) => v, nombreDeporte: (v) => v };
      if (name === './validators') return { MAX_REPRESENTANTES: 1 };
      if (name === './push') return { desactivarPush: async () => { throw new ApiError('suspendida', 403); } };
      if (['./notificaciones', './planes', './chat', './chatGrupal', './consultas'].includes(name)) {
        // Sin "then": un módulo que parece una promesa dejaría colgado el import() dinámico.
        return new Proxy({}, { get: (_, clave) => (clave === 'then' ? undefined : () => { reinicios.push(`${name}:${String(clave)}`); }) });
      }
      throw new Error(`import inesperado: ${name}`);
    },
  });
  await module.exports.logout();
  assert.ok(quitadas.length >= 2, 'se borraron la sesión y el token');
  assert.equal(reinicios.length, 5, reinicios.join(','));
});
