const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }

const DIA = 86400000;
const enDias = (n) => new Date(Date.now() + n * DIA).toISOString();
const persona = (id, nombre = 'Ana') => ({ user_id: id, nombre, apellido_inicial: 'T.', foto_perfil: null });
const actividad = (cambios = {}) => ({
  id: 'act-1', title: 'Trote en el parque', sport_code: 'running', description: 'Ritmo suave',
  starts_at: enDias(2), location: 'Parque Bicentenario · Vitacura', created_at: enDias(0),
  capacity: 10, available_spots: 7, organizer: persona('otra'), ...cambios,
});
const pagina = (...items) => ({ items, next_cursor: null });
const plano = (valor) => JSON.parse(JSON.stringify(valor));
const noEncontrada = () => { throw new ApiError('Postulación no encontrada.', 404); };

/** Carga services/actividades.ts con el backend simulado por `responder(ruta, opciones)`. */
function load(responder = async () => pagina()) {
  const auth = { session: { id: 'yo-id' }, token: 'token-a' }; const calls = [];
  let uuid = 0;
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/actividades.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date, Error, Number, Math, JSON, Object, Promise, Set,
    require(name) {
      if (name === 'react') return { useSyncExternalStore: () => undefined };
      if (name === 'expo-crypto') return { randomUUID: () => `uuid-${++uuid}` };
      if (name === './auth') return { getSession: async () => auth.session, getToken: async () => auth.token };
      if (name === './api') return { ApiError, apiRequest: async (...args) => { calls.push(args); return responder(...args); } };
      if (name === './comunas') return { normalizar: (t) => t.toLowerCase() };
      if (name === './deportes') return {
        codigoDeporte: (n) => n.toLowerCase(),
        nombreDeporte: (c) => c.charAt(0).toUpperCase() + c.slice(1),
      };
      throw Error(name);
    },
  });
  return { api: module.exports, auth, calls };
}

// Fecha fija, como la que arma la pantalla con el día y la hora elegidos.
const FECHA = Math.floor((Date.now() + 2 * DIA) / 60000) * 60000;
const datos = (cambios = {}) => ({
  titulo: 'Fútbol 7', deporte: 'Fútbol', nivelMinimo: 3, fecha: FECHA, lugar: 'Cancha Los Pinos',
  comuna: 'Maipú', cupos: 14, descripcion: 'Partido amistoso', requisitos: 'Zapatillas para pasto', ...cambios,
});

test('la lista viene del servidor, con cupos ocupados y tu postulación', async () => {
  const { api, calls } = load(async (ruta) => {
    if (ruta.startsWith('/activities?')) return pagina(actividad());
    if (ruta === '/activities/act-1/applications/me') return { id: 'post-1', status: 'pending' };
    throw Error(ruta);
  });
  await api.cargarActividades();
  const [a] = api.getActividades();
  assert.equal(calls[0][0], '/activities?limit=100');
  assert.equal(calls[0][1].token, 'token-a');
  assert.equal(a.lugar, 'Parque Bicentenario');
  assert.equal(a.comuna, 'Vitacura');
  assert.equal(a.cupos, 10);
  assert.equal(api.cuposTomados(a), 3);
  assert.equal(a.organizadorNombre, 'Ana T.');
  assert.equal(api.relacionConActividad(a), 'pendiente');
});

test('si organizas, se cargan las postulaciones recibidas y no la tuya', async () => {
  const { api, calls } = load(async (ruta) => {
    if (ruta.startsWith('/activities?')) return pagina(actividad({ organizer: persona('yo-id') }));
    if (ruta === '/activities/act-1/applications') return [
      { id: 'post-9', status: 'pending', applicant: persona('diego', 'Diego') },
      { id: 'post-8', status: 'accepted', applicant: persona('sofia', 'Sofía') },
    ];
    throw Error(ruta);
  });
  await api.cargarActividades();
  const [a] = api.getActividades();
  assert.equal(api.relacionConActividad(a), 'organizador');
  assert.equal(api.pendientesDe(a), 1);
  assert.deepEqual(api.postulantes(a).map((p) => [p.id, p.estado]), [['diego', 'pendiente'], ['sofia', 'aprobada']]);
  assert.ok(!calls.some(([ruta]) => ruta.endsWith('/me')));
});

test('publicar envía solo campos del backend y comuna, nivel y requisitos se recuperan al leer', async () => {
  let creado;
  const { api, calls } = load(async (ruta, opciones) => {
    if (ruta === '/activities' && opciones.method === 'POST') {
      const { client_activity_id: _id, ...cuerpo } = opciones.body;
      creado = actividad({ id: 'nueva', ...cuerpo, available_spots: cuerpo.capacity, organizer: persona('yo-id') });
      return creado;
    }
    throw Error(ruta);
  });
  const r = await api.crearActividad(datos());
  assert.deepEqual(plano(r), { ok: true, id: 'nueva' });
  const enviado = calls[0][1].body;
  assert.deepEqual(Object.keys(enviado).sort(),
    ['capacity', 'client_activity_id', 'description', 'location', 'sport_code', 'starts_at', 'title']);
  assert.equal(enviado.organizer_id, undefined);
  const a = api.getActividades()[0];
  assert.equal(a.comuna, 'Maipú');
  assert.equal(a.lugar, 'Cancha Los Pinos');
  assert.equal(a.nivelMinimo, 3);
  assert.equal(a.requisitos, 'Zapatillas para pasto');
  assert.equal(a.descripcion, 'Partido amistoso');
  assert.equal(api.relacionConActividad(a), 'organizador');
});

test('reintentar la misma publicación reutiliza la clave para no duplicar', async () => {
  let intentos = 0;
  const { api, calls } = load(async () => { if (++intentos === 1) throw Error('offline'); return actividad({ id: 'ok' }); });
  assert.deepEqual(plano(await api.crearActividad(datos())), { ok: false, motivo: 'offline' });
  assert.equal((await api.crearActividad(datos())).ok, true);
  assert.equal(calls[0][1].body.client_activity_id, calls[1][1].body.client_activity_id);
  await api.crearActividad(datos({ titulo: 'Otro partido' }));
  assert.notEqual(calls[2][1].body.client_activity_id, calls[1][1].body.client_activity_id);
});

test('postular y aprobar usan los endpoints de postulaciones', async () => {
  let organiza = false; let aceptada = false; let postulo = false;
  const { api, calls } = load(async (ruta, opciones = {}) => {
    const dueno = persona(organiza ? 'yo-id' : 'otra');
    if (ruta.startsWith('/activities?')) return pagina(actividad({ organizer: dueno }));
    if (ruta === '/activities/act-1') return actividad({ organizer: dueno });
    if (ruta === '/activities/act-1/applications' && opciones.method === 'POST') { postulo = true; return { id: 'post-1', status: 'pending' }; }
    if (ruta === '/activities/act-1/applications/me') return postulo ? { id: 'post-1', status: 'pending' } : noEncontrada();
    if (ruta === '/activities/act-1/applications') return [{ id: 'post-7', status: aceptada ? 'accepted' : 'pending', applicant: persona('diego') }];
    if (ruta === '/activities/act-1/applications/post-7/accept') { aceptada = true; return { id: 'post-7', status: 'accepted' }; }
    throw Error(ruta);
  });
  await api.cargarActividades();
  assert.deepEqual(plano(await api.postular('act-1', 'Corro 5 km', [])), { ok: true });
  assert.ok(calls.some(([ruta, o]) => ruta === '/activities/act-1/applications' && o.method === 'POST'));
  assert.equal(api.getActividades()[0].mensajes.yo, 'Corro 5 km');
  assert.equal(api.relacionConActividad(api.getActividades()[0]), 'pendiente');

  organiza = true;
  await api.cargarActividades();
  assert.deepEqual(plano(await api.responderPostulacion('act-1', 'diego', 'aprobada')), { ok: true });
  assert.equal(api.postulantes(api.getActividades()[0])[0].estado, 'aprobada');
});

test('el nivel mínimo se revisa antes de llamar al servidor', async () => {
  const { api, calls } = load(async (ruta) => {
    if (ruta.startsWith('/activities?')) return pagina(actividad({
      description: 'Partido\n\nNivel mínimo: Intermedio (3/5)', sport_code: 'running',
    }));
    return noEncontrada();
  });
  await api.cargarActividades();
  const antes = calls.length;
  const r = await api.postular('act-1', '', [{ nombre: 'Running', nivel: 2 }]);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Intermedio/);
  assert.equal(calls.length, antes);
});

test('sin sesión no se envían solicitudes y se pide iniciar sesión', async () => {
  const { api, auth, calls } = load(); auth.token = null;
  await api.cargarActividades();
  assert.equal(calls.length, 0);
  assert.equal(api.getActividades().length, 0);
});

test('si la cuenta cambia durante la carga, se descartan los datos', async () => {
  let soltar;
  const { api, auth } = load((ruta) => ruta.startsWith('/activities?')
    ? new Promise((r) => { soltar = () => r(pagina(actividad())); }) : noEncontrada());
  const pendiente = api.cargarActividades();
  await new Promise((r) => setImmediate(r));
  auth.session = { id: 'otra-cuenta' };
  soltar();
  await pendiente;
  assert.equal(api.getActividades().length, 0);
});

test('editar envía PATCH y eliminar envía DELETE; la cancelada se conserva en tu historial', async () => {
  let cancelada = false; let titulo = 'Trote en el parque';
  const { api, calls } = load(async (ruta, opciones = {}) => {
    const mia = () => actividad({ title: titulo, organizer: persona('yo-id'), cancelled_at: cancelada ? enDias(0) : null });
    if (ruta.startsWith('/activities?')) return pagina(...(cancelada ? [] : [mia()]));
    if (ruta === '/activities/act-1' && opciones.method === 'PATCH') { titulo = opciones.body.title; return mia(); }
    if (ruta === '/activities/act-1' && opciones.method === 'DELETE') { cancelada = true; return undefined; }
    if (ruta === '/activities/act-1') return mia();
    if (ruta === '/activities/act-1/applications') return [];
    throw Error(ruta);
  });
  await api.cargarActividades();
  assert.deepEqual(plano(await api.editarActividad('act-1', datos({ titulo: 'Trote largo', cupos: 12 }))), { ok: true });
  const patch = calls.find(([, o]) => o && o.method === 'PATCH')[1].body;
  assert.equal(patch.title, 'Trote largo');
  assert.equal(patch.capacity, 12);
  assert.equal(patch.client_activity_id, undefined);
  assert.equal(api.getActividades()[0].titulo, 'Trote largo');

  assert.deepEqual(plano(await api.cancelarActividad('act-1')), { ok: true });
  assert.ok(calls.some(([ruta, o]) => ruta === '/activities/act-1' && o && o.method === 'DELETE'));
  assert.equal(api.estadoActividad(api.getActividades()[0]), 'cancelada');
  await api.cargarActividades();
  assert.equal(api.getActividades().length, 1);
  assert.equal(api.getActividades()[0].cancelada, true);
  assert.equal((await api.editarActividad('act-1', datos())).ok, false);
});

test('solo quien organiza puede editar o eliminar, y retirarse aún no existe', async () => {
  const { api, calls } = load(async (ruta) => {
    if (ruta.startsWith('/activities?')) return pagina(actividad());
    return noEncontrada();
  });
  await api.cargarActividades();
  const antes = calls.length;
  assert.match((await api.editarActividad('act-1', datos())).motivo, /Solo quien organiza/);
  assert.match((await api.cancelarActividad('act-1')).motivo, /Solo quien organiza/);
  assert.equal(calls.length, antes);
  assert.match(api.retirarse('act-1').motivo, /todavía no está disponible/);
});
