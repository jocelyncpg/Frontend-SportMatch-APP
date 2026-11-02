const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// HU-56 en la app: el catálogo conserva el diseño (planes Gratuito, Pro y Club y su tabla comparativa) y los datos de
// /payments/plans (precio, duración, descripción, beneficios) se ponen por debajo. Los planes y convenios del backend
// que el diseño no trae se suman con el mismo formato; un plan desactivado no llega de la API.

function cargar() {
  const calls = [];
  const storage = new Map();
  let responder = async () => [];
  class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
  const module = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/planes.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(codigo, {
    module, exports: module.exports, Error, JSON, Map, Set, Promise, Date, Number, String, Array, Object,
    require(name) {
      if (name === 'react') return { useSyncExternalStore: (_suscribir, instantanea) => instantanea() };
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async (k) => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v); }, removeItem: async (k) => { storage.delete(k); },
      };
      if (name === './auth') return { getToken: async () => 'token', getSession: async () => ({ id: 'athlete-a' }) };
      if (name === './api') return { ApiError, apiRequest: async (url, options) => { calls.push({ url, options }); return responder(url, options); } };
      throw Error(name);
    },
  });
  return { api: module.exports, calls, ApiError, responder(fn) { responder = fn; } };
}
const plano = (v) => JSON.parse(JSON.stringify(v));
const P = (id, nombre, precio, extra = {}) => ({
  id, nombre, tipo: 'USUARIO', categoria: 'PLAN', descripcion: null, precio, duracion_dias: 30, beneficios: [], institucion: null, ...extra,
});
const sinSuscripcion = (c) => (url) => {
  if (url.startsWith('/payments/subscription')) throw new c.ApiError('No tienes una suscripción.', 404);
  return c.lista;
};

test('el diseño de siempre: Gratuito, Pro y Club con su tabla comparativa, antes de cargar nada', () => {
  const { api } = cargar();
  assert.deepEqual(plano(api.PLANES.map((p) => [p.id, p.nombre, p.precioMensual, p.paraCuenta, p.destacado])),
    [['gratuito', 'Gratuito', 0, 'deportista', false], ['pro', 'Pro', 4990, 'deportista', true], ['club', 'Club', 19990, 'club', false]]);
  assert.equal(api.FILAS_COMPARATIVA.length, 8);
  assert.equal(api.FILAS_COMPARATIVA[0].etiqueta, 'Actividades que puedes organizar al mes');
  assert.deepEqual(plano(api.usePlanes().map((p) => p.id)), ['gratuito', 'pro', 'club']);
  assert.equal(api.precioTexto(api.PLANES[1]), '$4.990 / mes');
  assert.equal(api.precioTexto(api.PLANES[0]), 'Gratis');
  assert.deepEqual(plano(api.beneficiosDe('pro')).slice(0, 2), ['Actividades que puedes organizar al mes: Sin límite', 'Postulaciones activas a la vez: Sin límite']);
});

test('los datos reales van por debajo del diseño: Pro toma el plan de pago más barato, con el nombre del diseño', async () => {
  const c = cargar();
  c.lista = [P(41, 'Pro Anual', 39990, { duracion_dias: 365, beneficios: ['Todo ilimitado'] }),
    P(7, 'Pro Mensual', 3990, { descripcion: 'Para quien entrena', beneficios: ['Actividades sin límite', 'Filtros avanzados'] })];
  c.responder(sinSuscripcion(c));
  await c.api.cargarPlanes('deportista');
  const planes = c.api.usePlanes();
  const pro = planes.find((p) => p.id === 'pro');
  assert.deepEqual(plano([pro.nombre, pro.precioMensual, pro.backendId, pro.duracionDias, pro.resumen, pro.beneficios]),
    ['Pro', 3990, 7, 30, 'Para quien entrena', ['Actividades sin límite', 'Filtros avanzados']]);
  assert.equal(c.api.precioTexto(pro), '$3.990 / mes');
  assert.deepEqual(plano(c.api.beneficiosDe('pro')), ['Actividades sin límite', 'Filtros avanzados']);
  // Lo que el backend no tiene sigue siendo del diseño.
  assert.equal(planes.find((p) => p.id === 'gratuito').resumen, 'Para empezar a entrenar en comunidad');
  assert.equal(planes.find((p) => p.id === 'club').backendId, undefined);
  assert.equal(c.calls[0].url, '/payments/plans?tipo=USUARIO');
});

test('el diseño no cambia por lo que haya en el backend: un convenio o plan extra no agrega columnas', async () => {
  const c = cargar();
  c.lista = [P(1, 'Pro Mensual', 4990), P(41, 'Pro Anual', 39990, { duracion_dias: 365 }),
    P(9, 'Convenio DuocUC', 2990, { categoria: 'CONVENIO', duracion_dias: 90, institucion: 'DuocUC' })];
  c.responder(sinSuscripcion(c));
  await c.api.cargarPlanes('deportista');
  const planes = c.api.usePlanes();
  assert.deepEqual(plano(planes.map((p) => p.id)), ['gratuito', 'pro', 'club']);
  assert.equal(planes.find((p) => p.id === 'pro').backendId, 1);       // el más barato de pago
  assert.deepEqual(plano(c.api.planesParaContratar('deportista', planes).map((p) => p.id)), ['pro']);
  assert.deepEqual(plano(c.api.planesParaContratar('club', planes).map((p) => p.id)), ['club']);
  assert.equal(c.api.precioTexto(planes.find((p) => p.id === 'pro')), '$4.990 / mes');
});

test('un plan desactivado ya no llega de la API: su lugar del diseño sigue visible pero no se puede contratar', async () => {
  const c = cargar();
  c.lista = [P(1, 'Pro Mensual', 4990)];
  c.responder(sinSuscripcion(c));
  await c.api.cargarPlanes('deportista');
  assert.equal(c.api.usePlanes().find((p) => p.id === 'pro').backendId, 1);
  c.lista = [];
  await c.api.cargarPlanes('deportista');
  const pro = c.api.usePlanes().find((p) => p.id === 'pro');
  assert.equal(pro.backendId, undefined);
  assert.equal(pro.precioMensual, 4990);   // el diseño
  await assert.rejects(() => c.api.iniciarPago('deportista', pro), /aún no está disponible/);
});

test('el plan vigente se reconoce por el id real del plan; si no tiene columna propia, por su tipo', async () => {
  const c = cargar();
  c.lista = [P(7, 'Pro Mensual', 4990), P(9, 'Convenio DuocUC', 2990, { categoria: 'CONVENIO' })];
  const suscripcion = (plan) => (url) => (url.startsWith('/payments/subscription') ? { estado: 'ACTIVE', plan, fecha_fin: '2027-01-01' } : c.lista);
  c.responder(suscripcion({ id: 7, tipo: 'USUARIO', nombre: 'Pro Mensual' }));
  await c.api.cargarPlanes('deportista');
  assert.equal(c.api.getPlanActual('deportista'), 'pro');
  c.responder(suscripcion({ id: 9, tipo: 'USUARIO', nombre: 'Convenio DuocUC' }));
  await c.api.cargarPlanes('deportista');
  assert.equal(c.api.getPlanActual('deportista'), 'pro');   // un convenio no tiene columna propia: cuenta como el plan de su tipo
  c.responder(suscripcion({ id: 55, tipo: 'USUARIO', nombre: 'Plan viejo' }));
  await c.api.cargarPlanes('deportista');
  assert.equal(c.api.getPlanActual('deportista'), 'pro');
  c.responder((url) => { if (url.startsWith('/payments/subscription')) throw new c.ApiError('No', 404); return c.lista; });
  await c.api.cargarPlanes('deportista');
  assert.equal(c.api.getPlanActual('deportista'), 'gratuito');
  c.api.reiniciarPlanes();
  assert.equal(c.api.getPlanActual('club'), null);
});

test('si la API falla, cargarPlanes falla (la pantalla muestra su error de siempre) y el diseño queda como estaba', async () => {
  const c = cargar();
  c.responder(async () => { throw new c.ApiError('El servicio no está disponible.', 503); });
  await assert.rejects(() => c.api.cargarPlanes('deportista'), /no está disponible/);
  assert.deepEqual(plano(c.api.usePlanes().map((p) => [p.id, p.precioMensual, p.backendId])), [['gratuito', 0, null], ['pro', 4990, null], ['club', 19990, null]]);
});

test('las pantallas del catálogo conservan su diseño: sin "Reintentar" ni componentes de error nuevos', () => {
  const leer = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  for (const rel of ['components/CatalogoPlanes.tsx', 'app/(deportista)/planes.tsx', 'app/(club)/planes.tsx']) {
    assert.doesNotMatch(leer(rel), /Reintentar|useCatalogo|ActivityIndicator|periodoTexto/, rel);
  }
  assert.match(leer('app/(deportista)/planes.tsx'), /\{error \? <Text style=\{styles\.error\}>\{error\}<\/Text> : null\}/);
  assert.match(leer('app/(club)/planes.tsx'), /Disponible pronto/);
  assert.match(leer('components/CatalogoPlanes.tsx'), /FILAS_COMPARATIVA/);
});
