const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const card = (id = 'athlete-id') => ({
  user_id: id, nombre: 'Ana', apellido_inicial: 'T.', edad: null,
  foto_perfil: null, biografia: 'Busco compañeros para entrenar',
  deportes: [], compatibilidad: 0,
});

function loadStore(request, matchingRequest = async () => ({ incoming: [], outgoing: [], matches: [], hidden_user_ids: [] })) {
  const auth = { session: { id: 'my-id' }, token: 'real-token' };
  const calls = [];
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../services/matchStore.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Error,
    require(name) {
      if (name === 'react') return {};
      if (name === './auth') return {
        getSession: async () => auth.session,
        getToken: async () => auth.token,
      };
      if (name === './api') return {
        ApiError,
        apiRequest: async (...args) => {
          calls.push(args);
          if (args[0].startsWith('/matching/')) return matchingRequest(...args);
          return request(...args);
        },
      };
      if (name === './deportes') return { nombreDeporte: (code) => code };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { store: module.exports, auth, calls };
}

test('loads registered athletes with their IDs and has no demo matches', async () => {
  const { store, calls } = loadStore(async () => [card('my-id'), card()]);
  await store.cargarSugerencias();
  const state = store.getEstado();
  assert.equal(calls[0][0], '/users/suggestions?limit=50');
  assert.equal(calls[0][1].token, 'real-token');
  assert.equal(state.catalogo.length, 1);
  assert.equal(state.catalogo[0].id, 'athlete-id');
  assert.equal(state.catalogo[0].name, 'Ana T.');
  assert.equal(state.catalogo[0].sport, 'Sin deporte aún');
  assert.equal(state.catalogo[0].distance, undefined);
  assert.equal(state.solicitudes.length, 0);
  assert.equal(state.confirmados.length, 0);
  assert.equal(store.sugerencias(state).length, 1);
});

test('empty server results stay empty', async () => {
  const { store } = loadStore(async () => []);
  await store.cargarSugerencias();
  assert.equal(store.getEstado().catalogo.length, 0);
  assert.equal(store.getEstado().error, null);
});

test('requires a real session and token', async () => {
  const { store, auth, calls } = loadStore(async () => [card()]);
  auth.token = null;
  await store.cargarSugerencias();
  assert.equal(calls.length, 0);
  assert.equal(store.getEstado().sesionExpirada, true);
  assert.equal(store.getEstado().catalogo.length, 0);
});

test('expired token clears previously loaded cards', async () => {
  let expired = false;
  const { store } = loadStore(async () => {
    if (expired) throw new ApiError('Tu sesión expiró.', 401);
    return [card()];
  });
  await store.cargarSugerencias();
  expired = true;
  await store.cargarSugerencias();
  assert.equal(store.getEstado().sesionExpirada, true);
  assert.equal(store.getEstado().catalogo.length, 0);
});

test('an older response cannot overwrite the next account', async () => {
  let finishOld;
  const oldResponse = new Promise((resolve) => { finishOld = resolve; });
  const { store, auth } = loadStore(async (_path, { token }) =>
    token === 'real-token' ? oldResponse : [card('new-account-athlete')]
  );
  const oldLoad = store.cargarSugerencias();
  await new Promise((resolve) => setImmediate(resolve));
  auth.session = { id: 'next-account' };
  auth.token = 'next-token';
  await store.cargarSugerencias();
  finishOld([card('old-account-athlete')]);
  await oldLoad;
  assert.equal(store.getEstado().usuarioId, 'next-account');
  assert.equal(store.getEstado().catalogo[0].id, 'new-account-athlete');
});

test('logout while loading discards the response', async () => {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const { store, auth } = loadStore(async () => response);
  const pending = store.cargarSugerencias();
  await new Promise((resolve) => setImmediate(resolve));
  auth.session = null;
  auth.token = null;
  finish([card()]);
  await pending;
  assert.equal(store.getEstado().catalogo.length, 0);
  assert.equal(store.getEstado().usuarioId, null);
});

test('connection failure is visible and never inserts example profiles', async () => {
  const { store } = loadStore(async () => { throw new Error('Sin conexión'); });
  await store.cargarSugerencias();
  assert.equal(store.getEstado().error, 'Sin conexión');
  assert.equal(store.getEstado().catalogo.length, 0);
});

const connection = (status = 'pending') => ({ id: 'request-id', sender_id: 'my-id',
  recipient_id: 'athlete-id', athlete: card(), status, last_message: null, last_message_at: null });

test('a like is persisted before it disappears from discovery', async () => {
  let succeed;
  const response = new Promise((resolve) => { succeed = resolve; });
  const { store, calls } = loadStore(async () => [card()], async (path) =>
    path === '/matching/state' ? { incoming: [], outgoing: [], matches: [], hidden_user_ids: [] } : response);
  await store.cargarSugerencias();
  const pending = store.darLike(store.getEstado().catalogo[0]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.sugerencias(store.getEstado()).length, 1);
  assert.equal(store.getEstado().ocupados.length, 1);
  succeed(connection());
  await pending;
  assert.equal(store.sugerencias(store.getEstado()).length, 0);
  assert.equal(store.getEstado().confirmados.length, 0);
  const sendCall = calls.find(([path]) => path === '/matching/requests');
  assert.equal(sendCall[1].method, 'POST');
  assert.equal(sendCall[1].body.recipient_id, 'athlete-id');
});

test('failed like keeps the athlete available for retry', async () => {
  const { store } = loadStore(async () => [card()], async (path) => {
    if (path === '/matching/state') return { incoming: [], outgoing: [], matches: [], hidden_user_ids: [] };
    throw new ApiError('Sin conexión', 503);
  });
  await store.cargarSugerencias();
  await assert.rejects(store.darLike(store.getEstado().catalogo[0]));
  assert.equal(store.sugerencias(store.getEstado()).length, 1);
  assert.equal(store.getEstado().ocupados.length, 0);
});

test('acceptance exposes a server match ID and persists across reloads', async () => {
  let accepted = false;
  const received = { ...connection(), sender_id: 'athlete-id', recipient_id: 'my-id' };
  const { store } = loadStore(async () => [card()], async (path, options) => {
    if (path === '/matching/state') return { incoming: accepted ? [] : [received], outgoing: [],
      matches: accepted ? [{ ...received, status: 'accepted' }] : [], hidden_user_ids: [] };
    assert.equal(options.body.action, 'accept');
    accepted = true;
    return { ...received, status: 'accepted' };
  });
  await store.cargarSugerencias();
  assert.equal(store.getEstado().solicitudes.length, 1);
  const persona = await store.aceptarSolicitud('athlete-id');
  assert.equal(persona.matchId, 'request-id');
  await store.cargarMatching();
  assert.equal(store.getEstado().confirmados[0].matchId, 'request-id');
  assert.equal(store.getEstado().solicitudes.length, 0);
});

test('rejection removes the request without creating a chat', async () => {
  const received = { ...connection(), sender_id: 'athlete-id', recipient_id: 'my-id' };
  const { store } = loadStore(async () => [card()], async (path, options) => {
    if (path === '/matching/state') return { incoming: [received], outgoing: [], matches: [], hidden_user_ids: [] };
    assert.equal(options.body.action, 'reject');
    return { ...received, status: 'rejected' };
  });
  await store.cargarSugerencias();
  await store.rechazarSolicitud('athlete-id');
  assert.equal(store.getEstado().solicitudes.length, 0);
  assert.equal(store.getEstado().confirmados.length, 0);
  assert.equal(store.sugerencias(store.getEstado()).length, 0);
});

test('sent requests include cards and cancellation waits for server confirmation', async () => {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const { store, calls } = loadStore(async () => [card()], async (path) =>
    path === '/matching/state' ? { incoming: [], outgoing: [connection()], matches: [], hidden_user_ids: [] } : response);
  await store.cargarSugerencias();
  assert.equal(store.getEstado().solicitudesEnviadas[0].name, 'Ana T.');
  assert.equal(store.getEstado().solicitudesEnviadas[0].requestId, 'request-id');
  const pending = store.cancelarSolicitud('athlete-id');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.getEstado().solicitudesEnviadas.length, 1);
  assert.equal(store.getEstado().ocupados.length, 1);
  finish(undefined);
  await pending;
  assert.equal(store.getEstado().solicitudesEnviadas.length, 0);
  assert.equal(store.getEstado().enviadas.length, 0);
  assert.equal(store.getEstado().ocupados.length, 0);
  assert.equal(store.sugerencias(store.getEstado()).length, 1);
  assert.equal(calls.at(-1)[0], '/matching/requests/request-id');
  assert.equal(calls.at(-1)[1].method, 'DELETE');
});

test('a failed cancellation preserves the sent request for retry', async () => {
  const { store } = loadStore(async () => [card()], async (path) => {
    if (path === '/matching/state') return { incoming: [], outgoing: [connection()], matches: [], hidden_user_ids: [] };
    throw new ApiError('Sin conexión', 503);
  });
  await store.cargarSugerencias();
  await assert.rejects(store.cancelarSolicitud('athlete-id'));
  assert.equal(store.getEstado().solicitudesEnviadas.length, 1);
  assert.equal(store.getEstado().enviadas.length, 1);
  assert.equal(store.getEstado().ocupados.length, 0);
});

test('cancellation refreshes an already accepted match instead of removing it', async () => {
  let accepted = false;
  const { store } = loadStore(async () => [card()], async (path) => {
    if (path === '/matching/state') return { incoming: [], outgoing: accepted ? [] : [connection()],
      matches: accepted ? [connection('accepted')] : [], hidden_user_ids: [] };
    accepted = true;
    throw new ApiError('La solicitud ya fue respondida.', 409);
  });
  await store.cargarSugerencias();
  await assert.rejects(store.cancelarSolicitud('athlete-id'));
  assert.equal(store.getEstado().solicitudesEnviadas.length, 0);
  assert.equal(store.getEstado().confirmados[0].matchId, 'request-id');
});

test('a cancelled request response cannot modify a different account', async () => {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const { store, auth } = loadStore(async () => [card()], async (path) =>
    path === '/matching/state' ? { incoming: [], outgoing: [connection()], matches: [], hidden_user_ids: [] } : response);
  await store.cargarSugerencias();
  const pending = store.cancelarSolicitud('athlete-id');
  await new Promise((resolve) => setImmediate(resolve));
  auth.session = { id: 'next-account' }; auth.token = 'next-token';
  await store.cargarSugerencias();
  finish(undefined);
  await assert.rejects(pending);
  assert.equal(store.getEstado().usuarioId, 'next-account');
  assert.equal(store.getEstado().solicitudesEnviadas.length, 1);
});
