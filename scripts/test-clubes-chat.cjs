const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
function cargar(archivo, responder) {
  const llamadas = [];
  let uuid = 0;
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', archivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, Date, Error, Number, Math, JSON, Object, Promise, Set, Map,
    setInterval: () => 1, clearInterval: () => {},
    require(nombre) {
      if (nombre === 'react') return { useSyncExternalStore: (_, leer) => leer(), useMemo: (fn) => fn() };
      if (nombre === 'react-native') return { AppState: { currentState: 'active' } };
      if (nombre === 'expo-crypto') return { randomUUID: () => 'uuid-' + ++uuid };
      if (nombre === './auth') return { getSession: async () => ({ id: 'yo' }), getToken: async () => 'token', guardarClubEnSesion: async () => {} };
      if (nombre === './api') return { ApiError, apiRequest: async (...args) => { llamadas.push(args); return responder(...args); } };
      throw Error(nombre);
    },
  });
  return { api: modulo.exports, llamadas };
}
const fecha = '2026-10-22T12:00:00Z';
const mensajeGrupo = { id: 7, author_id: 'otra', author_name: 'Ana P.', text: 'Hola', created_at: fecha, own: false };
const mensajeConsulta = { id: 9, de: 'club', texto: 'Hola', enviado_en: fecha, propio: false };

test('chat grupal usa listado, mensajes, lectura y no leídos del servidor', async () => {
  const { api, llamadas } = cargar('chatGrupal.ts', async (ruta) => {
    if (ruta === '/activities/chats') return [{ activity_id: 'a1', title: 'Trote', sport_code: 'running', starts_at: fecha, acceso: 'escribir', participantes: 3, ultimo: mensajeGrupo, unread: 2, silenciado: false }];
    if (ruta === '/activities/a1/chat/messages?limit=50') return { acceso: 'escribir', participantes: 3, silenciado: false, mensajes: [mensajeGrupo] };
    if (ruta === '/activities/a1/chat/read') return undefined;
    throw Error(ruta);
  });
  await api.cargarChatsGrupales();
  assert.equal(api.useNoLeidosGrupales(), 2);
  api.abrirSala('a1');
  await new Promise(setImmediate);
  assert.equal(api.useSalaGrupal('a1').mensajes[0].autorNombre, 'Ana P.');
  assert.ok(llamadas.some(([ruta, opciones]) => ruta === '/activities/a1/chat/read' && opciones.body.last_read_id === 7));
  api.cerrarSala('a1');
});

test('chat grupal reutiliza UUID al reintentar y valida 1000 caracteres', async () => {
  let fallos = 0;
  const { api, llamadas } = cargar('chatGrupal.ts', async (ruta) => {
    if (ruta === '/activities/a1/chat/messages') {
      if (fallos++ === 0) throw Error('sin conexión');
      return mensajeGrupo;
    }
    if (ruta.startsWith('/activities/a1/chat/messages?')) return { acceso: 'escribir', participantes: 2, silenciado: false, mensajes: [mensajeGrupo] };
    throw Error(ruta);
  });
  assert.equal((await api.enviarMensajeGrupal('a1', ' '.repeat(5))).ok, false);
  assert.equal((await api.enviarMensajeGrupal('a1', 'x'.repeat(1001))).ok, false);
  assert.equal((await api.enviarMensajeGrupal('a1', 'Hola')).ok, false);
  assert.equal((await api.enviarMensajeGrupal('a1', 'Hola')).ok, true);
  const envios = llamadas.filter(([ruta]) => ruta === '/activities/a1/chat/messages');
  assert.equal(envios.length, 2);
  assert.equal(envios[0][1].body.client_message_id, envios[1][1].body.client_message_id);
  assert.equal(envios[0][1].body.text, 'Hola');
});

test('consultas mapea hilos y envía texto con UUID por la ruta del deportista', async () => {
  const { api, llamadas } = cargar('consultas.ts', async (ruta) => {
    if (ruta === '/clubs/consultas/me') return [{ hilo_id: '10000000-0000-4000-8000-000000000004', club_id: 'c1', club_nombre: 'Club Uno', club_logo: null, ultimo: mensajeConsulta, no_leidos: 3 }];
    if (ruta === '/clubs/c1/consultas/me/messages') return { id: 10, de: 'deportista', texto: 'Consulta', enviado_en: fecha, propio: true };
    throw Error(ruta);
  });
  await api.cargarHilosDeportista();
  assert.equal(api.useNoLeidosConsultas('yo'), 3);
  assert.equal(api.useHilosDePostulante('yo')[0].clubNombre, 'Club Uno');
  assert.equal((await api.enviarConsulta('c1', 'yo', 'Yo', ' Consulta ')).ok, true);
  const envio = llamadas.find(([ruta]) => ruta === '/clubs/c1/consultas/me/messages');
  assert.equal(envio[1].body.texto, 'Consulta');
  assert.equal(envio[1].body.client_message_id, 'uuid-1');
});

test('la bandeja del club conserva el UUID del hilo para responder', async () => {
  const hiloId = '10000000-0000-4000-8000-000000000005';
  const { api, llamadas } = cargar('consultas.ts', async (ruta) => {
    if (ruta === '/clubs/c1/consultas') {
      return [{
        hilo_id: hiloId,
        deportista_id: 'u1',
        deportista_nombre: 'Ana',
        ultimo: mensajeConsulta,
        no_leidos: 1,
      }];
    }
    if (ruta === `/clubs/c1/consultas/${hiloId}/messages`) return mensajeConsulta;
    throw Error(ruta);
  });
  await api.cargarHilosClub('c1', 'Club Uno');
  assert.equal(api.useHilo(hiloId).id, hiloId);
  assert.equal((await api.responderConsulta(hiloId, 'Hola')).ok, true);
  assert.equal(llamadas[1][0], `/clubs/c1/consultas/${hiloId}/messages`);
});

test('administración crea el club con RUT y gestiona invitaciones sin guardar códigos', async () => {
  const { api, llamadas } = cargar('clubes.ts', async (ruta, opciones) => {
    if (ruta === '/clubs' && opciones.method === 'POST') return { id: 'c1', nombre: 'Club Uno', rut: '76123456-0', mi_rol: 'PRINCIPAL' };
    if (ruta === '/clubs/c1/admins/invitations' && opciones.method === 'POST') return { id: 'i1', codigo: 'SECRETO', expira_en: fecha };
    if (ruta === '/clubs/c1/admins/invitations/i1' && opciones.method === 'DELETE') return undefined;
    throw Error(ruta);
  });
  await api.crearClub('Club Uno', '76123456-0');
  const invitacion = await api.generarInvitacion('c1');
  await api.revocarInvitacion('c1', invitacion.id);
  assert.deepEqual(JSON.parse(JSON.stringify(llamadas[0][1].body)), { nombre: 'Club Uno', rut: '76123456-0' });
  assert.equal(llamadas[1][0], '/clubs/c1/admins/invitations');
  assert.equal(llamadas[2][0], '/clubs/c1/admins/invitations/i1');
});

test('directorio toma la página pública del backend y carga el detalle', async () => {
  const club = { id: 'c1', nombre: 'Club Uno', comuna: 'Ñuñoa', deportes: [] };
  const { api, llamadas } = cargar('clubes.ts', async (ruta) => {
    if (ruta === '/clubs?page=1&page_size=20') return { items: [club], total: 1, page: 1, page_size: 20 };
    if (ruta === '/clubs/c1') return club;
    throw Error(ruta);
  });
  await api.cargarClubes();
  await api.cargarClub('c1');
  assert.equal(api.useEstadoClubes().clubes[0].comuna, club.comuna);
  assert.equal(api.useClub('c1').nombre, 'Club Uno');
  assert.equal(llamadas[0][1], undefined);
});

test('convocatorias usa el contrato público y publica y cierra con token', async () => {
  const clubId = '10000000-0000-4000-8000-000000000001';
  const anuncioId = '10000000-0000-4000-8000-000000000002';
  const anuncio = { id: anuncioId, estado: 'ABIERTA' };
  const { api, llamadas } = cargar('convocatorias.ts', async (ruta) => {
    if (ruta.startsWith('/clubs/announcements?')) {
      return { items: [anuncio], total: 1, page: 1, page_size: 20 };
    }
    if (ruta === `/clubs/${clubId}/announcements`) return anuncio;
    if (ruta === `/clubs/${clubId}/announcements/${anuncioId}/close`) {
      return { ...anuncio, estado: 'CERRADA' };
    }
    throw Error(ruta);
  });
  const pagina = await api.listarConvocatorias(clubId);
  assert.equal(pagina.items[0].id, anuncioId);
  assert.match(llamadas[0][0], /club_id=10000000-0000-4000-8000-000000000001/);
  assert.match(llamadas[0][0], /estado=ABIERTA/);
  const datos = {
    deporte_id: 1,
    categoria_edad: 'Sub-17',
    fecha_prueba: '2026-11-07T13:00:00.000Z',
    requisitos: ['Experiencia previa'],
    cupos: 10,
    direccion: 'Cancha Central 123',
  };
  await api.publicarConvocatoria(clubId, datos);
  assert.equal(llamadas[1][1].token, 'token');
  assert.equal(llamadas[1][1].body, datos);
  await api.cerrarConvocatoria(clubId, anuncioId);
  assert.equal(llamadas[2][1].method, 'POST');
  assert.equal(llamadas[2][1].token, 'token');
});
