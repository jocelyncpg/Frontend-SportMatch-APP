const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, Date, Error, Promise,
    require(name) { if (name in modules) return modules[name]; throw Error(`Missing mock: ${name}`); },
  });
  return module.exports;
}

function push() {
  const storage = new Map();
  const auth = { session: { id: 'user-a' }, token: 'token-a' };
  const apiCalls = []; let uuid = 0, prompts = 0;
  const permissions = { granted: false, canAskAgain: true };
  const constants = { executionEnvironment: 'standalone', expoConfig: { extra: { eas: { projectId: 'project' } } } };
  const notifications = {
    getPermissionsAsync: async () => permissions,
    requestPermissionsAsync: async () => { prompts++; return permissions; },
    getExpoPushTokenAsync: async () => ({ data: 'ExpoPushToken[test]' }),
    setNotificationChannelAsync: async () => {}, dismissAllNotificationsAsync: async () => {},
    AndroidImportance: { HIGH: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3 },
  };
  const backend = { fail: false };
  const api = load('push.ts', {
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, val) => { storage.set(key, val); },
    },
    'expo-constants': { __esModule: true, default: constants, ExecutionEnvironment: { StoreClient: 'storeClient' } },
    'expo-crypto': { randomUUID: () => `uuid-${++uuid}` }, 'expo-device': { isDevice: true },
    react: { useSyncExternalStore: (_subscribe, get) => get() }, 'react-native': { Platform: { OS: 'android' } },
    './api': { apiRequest: async (...args) => { apiCalls.push(args); if (backend.fail) throw Error('offline'); } },
    './auth': { getSession: async () => auth.session, getToken: async () => auth.token },
    'expo-notifications': notifications,
  });
  return { api, auth, apiCalls, permissions, constants, backend, storage, prompts: () => prompts };
}

test('sin consentimiento no se solicita permiso ni se registra el celular al iniciar', async () => {
  const p = push(); await p.api.sincronizarPush();
  assert.equal(p.prompts(), 0); assert.equal(p.apiCalls.length, 0);
  assert.equal(p.api.usePush().enabled, false);
});

test('rechazar el permiso no registra el celular y no vuelve a insistir al reanudar', async () => {
  const p = push(); await p.api.activarPush(); await p.api.sincronizarPush();
  assert.equal(p.prompts(), 1); assert.equal(p.apiCalls.length, 0);
  assert.equal(p.api.usePush().denied, true);
});

test('activar con permiso envía consentimiento y desactivar revoca sin depender del JWT', async () => {
  const p = push(); p.permissions.granted = true;
  await p.api.activarPush();
  assert.equal(p.apiCalls[0][0], '/notifications/devices');
  assert.equal(p.apiCalls[0][1].body.consent, true);
  assert.equal(p.api.usePush().enabled, true);
  p.auth.token = null;
  await p.api.desactivarPush();
  assert.equal(p.apiCalls[1][0], '/notifications/devices/revoke');
  assert.equal(p.apiCalls[1][1].token, undefined);
  assert.equal(p.api.usePush().enabled, false);
});

test('un fallo ambiguo de registro no dice activado y se revoca al cerrar sesión', async () => {
  const p = push(); p.permissions.granted = true; p.backend.fail = true;
  await p.api.activarPush();
  assert.equal(p.api.usePush().enabled, false);
  assert.equal(p.api.usePush().error, 'offline');
  p.backend.fail = false; await p.api.desactivarPush();
  assert.equal(p.apiCalls[1][0], '/notifications/devices/revoke');
});

test('cambiar de cuenta revoca la anterior y requiere nueva activación', async () => {
  const p = push(); p.permissions.granted = true;
  await p.api.activarPush(); p.auth.session = { id: 'user-b' };
  await p.api.sincronizarPush();
  assert.equal(p.apiCalls.length, 2);
  assert.equal(p.apiCalls[1][0], '/notifications/devices/revoke');
  assert.equal(await p.api.puedeMostrarPush('user-a'), false);
  assert.equal(p.api.usePush().enabled, false);
});

test('revocar permiso en ajustes desactiva el registro al volver sin pedir permiso', async () => {
  const p = push(); p.permissions.granted = true; await p.api.activarPush();
  p.permissions.granted = false; p.permissions.canAskAgain = false;
  await p.api.sincronizarPush();
  assert.equal(p.prompts(), 0); assert.equal(p.apiCalls[1][0], '/notifications/devices/revoke');
});

test('una activación concurrente no vuelve a registrar después de desactivar', async () => {
  const p = push(); p.permissions.granted = true;
  await Promise.all([p.api.activarPush(), p.api.desactivarPush()]);
  assert.equal(p.api.usePush().enabled, false);
  assert.deepEqual(p.apiCalls.map(([route]) => route), ['/notifications/devices', '/notifications/devices/revoke']);
});

test('Expo Go no intenta cargar ni registrar push', async () => {
  const p = push(); p.constants.executionEnvironment = 'storeClient';
  await p.api.activarPush(); assert.equal(p.apiCalls.length, 0); assert.equal(p.prompts(), 0);
});

const notification = (id, read = false) => ({ id, kind: 'match', title: 'Match', body: 'Nuevo match',
  data: { screen: 'matches' }, created_at: new Date().toISOString(), read_at: read ? new Date().toISOString() : null });
function inbox(responder) {
  const auth = { session: { id: 'user-a' }, token: 'a' };
  const avisos = [];
  const api = load('notificaciones.ts', {
    react: { useSyncExternalStore: (_subscribe, get) => get() },
    './auth': { getSession: async () => auth.session, getToken: async () => auth.token },
    './api': { apiRequest: responder },
    './sondeo': { avisarCambio: (tipo, id) => avisos.push({ tipo, id }) },
  });
  return { auth, api, avisos };
}

test('un aviso nuevo sin leer despierta la sala correspondiente', async () => {
  let pagina = 0;
  const { api, avisos } = inbox(async () => ({
    items: pagina++ === 0 ? [] : [{ ...notification('chat-1'), kind: 'mensaje',
      data: { screen: 'activity_chat', activityId: 'actividad-1' } }],
    unread: 1,
    next_cursor: null,
  }));
  await api.cargarNotificaciones();
  await api.cargarNotificaciones();
  assert.deepEqual(avisos, [{ tipo: 'activity_chat', id: 'actividad-1' }]);
});

test('el contador y el estado de lectura vienen del servidor', async () => {
  const calls = [];
  const { api } = inbox(async (...args) => {
    calls.push(args); return { items: [notification('1'), notification('2', true)], unread: 1, next_cursor: null };
  });
  await api.cargarNotificaciones(); assert.equal(api.useNotificaciones().noLeidas, 1);
  await api.marcarLeida('1'); assert.equal(api.useNotificaciones().noLeidas, 0);
  assert.equal(calls[1][0], '/notifications/read'); assert.equal(calls[1][1].body.ids[0], '1');
});

test('una respuesta atrasada no mezcla avisos entre cuentas', async () => {
  let resolve;
  const { api, auth } = inbox((_path, { token }) => token === 'a' ? new Promise((r) => { resolve = r; })
    : Promise.resolve({ items: [notification('b')], unread: 1, next_cursor: null }));
  const pending = api.cargarNotificaciones(); await new Promise((r) => setImmediate(r));
  auth.session = { id: 'user-b' }; auth.token = 'b'; await api.cargarNotificaciones();
  resolve({ items: [notification('a')], unread: 1, next_cursor: null }); await pending;
  assert.equal(api.useNotificaciones().lista[0].id, 'b');
});

test('los destinos de push aceptan solo rutas conocidas e identificadores UUID', () => {
  const calls = [];
  const api = load('notificationNavigation.ts', {
    'expo-router': { router: { push: (dest) => calls.push(dest) } },
  });
  const valid = '10000000-0000-4000-8000-000000000001';
  api.abrirDestino({ screen: 'https://evil.test', activityId: '../../admin' });
  api.abrirDestino({ screen: 'chat', matchId: valid });
  api.abrirDestino({ screen: 'activity_chat', activityId: valid });
  api.abrirDestino({ screen: 'consulta', clubId: valid, hiloId: valid });
  api.abrirDestino({ screen: 'consulta_club', clubId: valid, hiloId: valid });
  api.abrirDestino({ screen: 'activity_chat', activityId: '../../admin' });
  api.abrirDestino({ screen: 'consulta', clubId: '../../admin' });
  api.abrirDestino({ screen: 'consulta', clubId: valid, hiloId: '../../admin' });
  api.abrirDestino({ screen: 'consulta_club', clubId: valid, hiloId: '../../admin' });
  assert.equal(calls[0], '/(deportista)/notificaciones');
  assert.equal(calls[1].pathname, '/(deportista)/chat/[id]');
  assert.equal(calls[2].pathname, '/(deportista)/chat-grupo/[id]');
  assert.equal(calls[2].params.id, valid);
  assert.equal(calls[3].pathname, '/(deportista)/chat-club/[id]');
  assert.equal(calls[4].pathname, '/(club)/consulta/[id]');
  assert.equal(calls[4].params.id, valid);
  assert.equal(calls[4].params.clubId, valid);
  assert.deepEqual(calls.slice(5), Array(4).fill('/(deportista)/notificaciones'));
});

test('los avisos de club y canales abren su pantalla real con el id correcto', () => {
  const calls = [];
  const api = load('notificationNavigation.ts', {
    'expo-router': { router: { push: (dest) => calls.push(dest) } },
  });
  const valid = '10000000-0000-4000-8000-000000000001';
  api.abrirDestino({ screen: 'comunicado', clubId: valid, comunicadoId: valid });
  api.abrirDestino({ screen: 'canal', clubId: valid, canalId: valid });
  api.abrirDestino({ screen: 'canal_inactivo', clubId: valid, canalId: valid });
  api.abrirDestino({ screen: 'comunicado', clubId: '../../admin' });
  api.abrirDestino({ screen: 'canal', canalId: '../../admin' });
  const plano = (value) => JSON.parse(JSON.stringify(value)); // objetos creados en otro contexto de vm
  assert.deepEqual(plano(calls[0]), { pathname: '/(deportista)/club/[id]', params: { id: valid } });
  assert.deepEqual(plano(calls[1]), { pathname: '/(deportista)/canal/[id]', params: { id: valid } });
  assert.deepEqual(plano(calls[2]), { pathname: '/(club)/canal/[id]', params: { id: valid, clubId: valid } });
  assert.deepEqual(plano(calls.slice(3)), Array(2).fill('/(deportista)/notificaciones'));
});
