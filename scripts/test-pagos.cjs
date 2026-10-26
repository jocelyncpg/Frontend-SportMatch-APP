const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function cargar() {
  const calls = [];
  const storage = new Map();
  let user = 'athlete-a';
  let response;
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/planes.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Error, JSON, Map, Set,
    require(name) {
      if (name === 'react') return { useSyncExternalStore() {} };
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async (key) => storage.get(key) ?? null,
        setItem: async (key, value) => { storage.set(key, value); },
        removeItem: async (key) => { storage.delete(key); },
      };
      if (name === './auth') return { getToken: async () => 'access-token', getSession: async () => ({ id: user }) };
      if (name === './api') return { ApiError, apiRequest: async (url, options) => {
        calls.push({ url, options });
        if (response instanceof Error) throw response;
        if (typeof response === 'function') return response(url, options);
        return response;
      } };
      throw Error(name);
    },
  });
  return { api: module.exports, calls, storage, ApiError, respond(value) { response = value; }, user(value) { user = value; } };
}
const plan = { id: 'pro', nombre: 'Pro', precioMensual: 3990, paraCuenta: 'deportista', backendId: 1 };
const created = { token_ws: 'a'.repeat(64), checkout_url: 'https://api.test/api/v1/payments/webpay/checkout?ticket=signed' };

test('abre el formulario POST firmado del backend y guarda el pago para recuperar tras reiniciar', async () => {
  const c = cargar(); c.respond(created);
  const result = await c.api.iniciarPago('deportista', plan);
  assert.equal(result.urlPago, created.checkout_url);
  assert.equal(c.calls[0].url, '/payments/webpay/initiate');
  assert.equal(JSON.stringify(c.calls[0].options.body), JSON.stringify({ plan_id: 1 }));
  assert.equal((await c.api.leerPagoPendiente()).tokenWs, created.token_ws);
  c.user('athlete-b');
  assert.equal(await c.api.leerPagoPendiente(), null);
});

test('un error de conexión conserva el pago y no activa beneficios', async () => {
  const c = cargar(); c.respond(created); await c.api.iniciarPago('deportista', plan);
  c.respond(new c.ApiError('Sin respuesta', 502));
  const result = await c.api.confirmarPago('deportista', created.token_ws);
  assert.equal(result.ok, false); assert.equal(result.reintentable, true);
  assert.ok(await c.api.leerPagoPendiente());
  assert.equal(c.api.getPlanActual('deportista'), 'gratuito');
});

test('un enlace vencido o guardado por una versión anterior no bloquea un nuevo pago', async () => {
  const c = cargar();
  for (const creadoEn of [undefined, Date.now() - 16 * 60 * 1000]) {
    c.storage.set('sportmatch_pago:athlete-a', JSON.stringify({ tokenWs: created.token_ws, urlPago: created.checkout_url, creadoEn }));
    assert.equal(await c.api.leerPagoPendiente(), null);
    assert.equal(c.storage.has('sportmatch_pago:athlete-a'), false);
  }
});

test('la suscripción vencida devuelve al plan gratuito y permite contratar otra vez', async () => {
  const c = cargar();
  c.respond({ status: 'APPROVED', suscripcion: { estado: 'ACTIVE', plan: { tipo: 'USUARIO' } } });
  await c.api.confirmarPago('deportista', created.token_ws);
  assert.equal(c.api.getPlanActual('deportista'), 'pro');
  c.respond((url) => url.startsWith('/payments/plans') ? [] : {
    estado: 'EXPIRED', plan: { tipo: 'USUARIO' },
  });
  await c.api.cargarPlanes('deportista');
  assert.equal(c.api.getPlanActual('deportista'), 'gratuito');
  c.respond(created);
  assert.equal((await c.api.iniciarPago('deportista', plan)).tokenWs, created.token_ws);
});

test('envía los parámetros de cancelación sin convertirlos en una confirmación de cobro', async () => {
  const c = cargar(); c.respond(created); await c.api.iniciarPago('deportista', plan);
  c.respond(new c.ApiError('El pago fue cancelado.', 400));
  const body = { tbk_token: created.token_ws, tbk_orden_compra: 'order', tbk_id_sesion: 'session' };
  const result = await c.api.confirmarPago('deportista', body);
  assert.equal(JSON.stringify(c.calls.at(-1).options.body), JSON.stringify(body));
  assert.equal(result.ok, false); assert.equal(result.reintentable, false);
  assert.equal(await c.api.leerPagoPendiente(), null);
});

test('solo un pago aprobado actualiza el plan y elimina el pendiente', async () => {
  const c = cargar(); c.respond(created); await c.api.iniciarPago('deportista', plan);
  c.respond({ status: 'APPROVED', suscripcion: { estado: 'ACTIVE', plan: { tipo: 'USUARIO' } } });
  assert.equal((await c.api.confirmarPago('deportista', created.token_ws)).ok, true);
  assert.equal(c.api.getPlanActual('deportista'), 'pro');
  assert.equal(await c.api.leerPagoPendiente(), null);
});

test('volver a un comprobante antiguo no presenta una suscripción vencida como activa', async () => {
  const c = cargar();
  c.respond({ status: 'APPROVED', suscripcion: { estado: 'EXPIRED', plan: { tipo: 'USUARIO' } } });
  const result = await c.api.confirmarPago('deportista', created.token_ws);
  assert.equal(result.ok, false);
  assert.equal(result.reintentable, false);
  assert.equal(c.api.getPlanActual('deportista'), 'gratuito');
});
