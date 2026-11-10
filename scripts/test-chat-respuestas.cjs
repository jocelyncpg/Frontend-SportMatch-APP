const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// HU-64 en la app (solo capa de datos): responder a un mensaje y cargar los que rodean a un mensaje citado.

function cargar(archivo, servidor, llamadas) {
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/' + archivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, URLSearchParams, Error, Promise, Array, Math, String, Set, Map, Number,
    Object, Date, encodeURIComponent, setTimeout, clearTimeout,
    require(nombre) {
      if (nombre === 'react') return { useSyncExternalStore: () => [] };
      if (nombre === 'expo-crypto') return { randomUUID: () => 'uuid-fijo' };
      if (nombre === './sondeo') return { crearSondeo: () => ({ iniciar() {}, detener() {}, ahora() {} }), alCambiar: () => () => {} };
      if (nombre === './auth') return { getSession: async () => ({ id: 'yo' }), getToken: async () => 'token' };
      if (nombre === './matchStore') return { personaConexion: (c) => c, ConexionApi: {} };
      if (nombre === './api') {
        return {
          ApiError: class ApiError extends Error {},
          urlFoto: (v) => (v && v.startsWith('/api/') ? `http://gw${v}` : undefined),
          apiRequest: async (ruta, opciones = {}) => { llamadas.push({ ruta, opciones }); return servidor(ruta, opciones); },
        };
      }
      throw Error(nombre);
    },
  });
  return modulo.exports;
}

const plano = (v) => JSON.parse(JSON.stringify(v));

test('chat individual: responder envía replyTo con el id del mensaje citado y sin él no envía nada extra', async () => {
  const llamadas = [];
  const api = cargar('chat.ts', async () => ({ id: '9' }), llamadas);
  await api.enviarMensaje('m1', 'Sí, a las 7', 'cid-1', '4');
  await api.enviarMensaje('m1', 'Hola', 'cid-2');
  assert.equal(llamadas[0].ruta, '/chats/m1/messages');
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.deepEqual(plano(llamadas[0].opciones.body), { type: 'TEXT', content: 'Sí, a las 7', clientMessageId: 'cid-1', replyTo: '4' });
  assert.deepEqual(plano(llamadas[1].opciones.body), { type: 'TEXT', content: 'Hola', clientMessageId: 'cid-2' });
});

test('chat individual: la página de mensajes admite after, before y around (alrededor del citado)', async () => {
  const llamadas = [];
  const api = cargar('chat.ts', async () => [], llamadas);
  await api.getMensajes('m1');
  await api.getMensajes('m1', { after: '7' });
  await api.getMensajes('m1', { before: '7' });
  await api.getMensajes('m1', { around: '4' });
  assert.deepEqual(llamadas.map((l) => l.ruta), [
    '/chats/m1/messages?limit=50', '/chats/m1/messages?limit=50&after_id=7',
    '/chats/m1/messages?limit=50&before_id=7', '/chats/m1/messages?limit=50&around_id=4',
  ]);
});

test('chat grupal: un mensaje que responde trae la cita, el autor con su foto y el id del original', async () => {
  const llamadas = [];
  const fecha = '2026-11-10T12:00:00Z';
  const original = { id: 4, author_id: 'otra', author_name: 'Ana P.', author_photo: '/api/v1/users/photos/abc.jpg', text: '¿Quién lleva balones?', created_at: fecha, own: false };
  const respuesta = { id: 5, author_id: 'yo', author_name: 'Beto T.', author_photo: null, text: 'Yo llevo', created_at: fecha, own: true,
    reply_to_id: 4, reply_to: { id: 4, author_id: 'otra', author_name: 'Ana P.', text: '¿Quién lleva balones?', available: true } };
  const eliminada = { id: 6, author_id: 'yo', author_name: 'Beto T.', text: 'ok', created_at: fecha, own: true, reply_to_id: null,
    reply_to: { id: null, author_id: null, author_name: null, text: null, available: false } };
  const api = cargar('chatGrupal.ts', async (ruta) => {
    if (ruta.includes('around_id=4')) return { acceso: 'escribir', participantes: 2, silenciado: false, mensajes: [original, respuesta, eliminada] };
    return {};
  }, llamadas);
  const [a, b, c] = await api.cargarAlrededorDe('a1', '4');
  assert.equal(llamadas[0].ruta, '/activities/a1/chat/messages?around_id=4&limit=50');
  assert.equal(a.autorFoto, 'http://gw/api/v1/users/photos/abc.jpg');
  assert.equal(a.respondeA, null);
  assert.equal(a.cita, null);
  assert.equal(b.respondeA, '4');
  assert.deepEqual(plano(b.cita), { id: '4', autorId: 'otra', autorNombre: 'Ana P.', texto: '¿Quién lleva balones?', disponible: true });
  assert.equal(b.autorFoto, undefined);
  assert.deepEqual(plano(c.cita), { id: null, autorId: null, autorNombre: null, texto: null, disponible: false });
  assert.equal(c.respondeA, null);
});

test('chat grupal: responder envía reply_to numérico y el reintento reutiliza el mismo UUID', async () => {
  const llamadas = [];
  let fallos = 0;
  const api = cargar('chatGrupal.ts', async (ruta) => {
    if (ruta === '/activities/a1/chat/messages') {
      if (fallos++ === 0) throw Error('sin conexión');
      return { id: 9 };
    }
    return { acceso: 'escribir', participantes: 2, silenciado: false, mensajes: [] };
  }, llamadas);
  assert.equal((await api.enviarMensajeGrupal('a1', 'Yo llevo', '4')).ok, false);
  assert.equal((await api.enviarMensajeGrupal('a1', 'Yo llevo', '4')).ok, true);
  const envios = llamadas.filter((l) => l.ruta === '/activities/a1/chat/messages');
  assert.equal(envios.length, 2);
  assert.deepEqual(plano(envios[1].opciones.body), { text: 'Yo llevo', client_message_id: 'uuid-fijo', reply_to: 4 });
  assert.equal(envios[0].opciones.body.client_message_id, envios[1].opciones.body.client_message_id);
});

test('chat grupal: un mensaje sin respuesta no envía reply_to', async () => {
  const llamadas = [];
  const api = cargar('chatGrupal.ts', async (ruta) => (ruta.endsWith('/chat/messages') ? { id: 1 } : { acceso: 'escribir', participantes: 2, silenciado: false, mensajes: [] }), llamadas);
  await api.enviarMensajeGrupal('a1', 'Hola');
  assert.equal('reply_to' in llamadas[0].opciones.body, false);
});
