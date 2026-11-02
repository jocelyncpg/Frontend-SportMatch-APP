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

/** services/planesAdmin.ts con el backend simulado por `responder(ruta, opciones)`. */
function cargar(responder = async () => undefined, token = 'token-admin') {
  const calls = [];
  const module = { exports: {} };
  class ApiError extends Error { constructor(m, status, detail = '') { super(m); this.status = status; this.detail = detail; } }
  vm.runInNewContext(compile('services/planesAdmin.ts'), {
    module, exports: module.exports, Error, Promise, JSON, URLSearchParams, Number, String, RegExp,
    require(name) {
      if (name === './auth') return { getToken: async () => token };
      if (name === './api') return { ApiError, apiRequest: async (...args) => { calls.push(args); return responder(...args); } };
      throw Error(name);
    },
  });
  return { api: module.exports, calls };
}

const PLAN = {
  id: 7, nombre: 'Pro Mensual', tipo: 'USUARIO', categoria: 'PLAN', descripcion: null, precio: 4990, duracion_dias: 30,
  beneficios: ['Actividades sin límite'], is_active: true, suscripciones_vigentes: 3,
};
const DATOS = { nombre: ' Pro Mensual ', tipo: 'USUARIO', categoria: 'PLAN', precio: 4990, duracionDias: 30, beneficios: ['Actividades sin límite'] };

test('crear un plan envía lo esperado, sin el motivo vacío, y devuelve el plan en la forma de la app', async () => {
  const { api, calls } = cargar(async () => PLAN);
  const plan = await api.crearPlan({ ...DATOS, descripcion: '  ', motivo: ' ' });
  const [ruta, opciones] = calls[0];
  assert.equal(ruta, '/payments/admin/plans');
  assert.equal(opciones.method, 'POST');
  assert.equal(opciones.token, 'token-admin');
  assert.deepEqual(plano(opciones.body), {
    nombre: 'Pro Mensual', tipo: 'USUARIO', categoria: 'PLAN', precio: 4990, duracion_dias: 30, beneficios: ['Actividades sin límite'],
  });
  assert.deepEqual(plano(plan), {
    id: 7, nombre: 'Pro Mensual', tipo: 'USUARIO', categoria: 'PLAN', descripcion: null, institucion: null, precio: 4990, duracionDias: 30,
    beneficios: ['Actividades sin límite'], activo: true, suscripcionesVigentes: 3,
  });
});

test('un convenio puede llevar institución; un plan no, y se puede editar o borrar', async () => {
  const { api, calls } = cargar(async () => ({ ...PLAN, categoria: 'CONVENIO', institucion: 'DuocUC' }));
  const convenio = await api.crearPlan({ ...DATOS, nombre: 'Convenio DuocUC', categoria: 'CONVENIO', institucion: '  DuocUC  ', precio: 0 });
  assert.deepEqual(plano(calls[0][1].body).institucion, 'DuocUC');
  assert.equal(convenio.institucion, 'DuocUC');
  await assert.rejects(() => api.crearPlan({ ...DATOS, institucion: 'DuocUC' }), /Solo un convenio/);
  for (const mala of ['ab', 'x'.repeat(81), 'a@b.cl', '<b>x</b>']) {
    await assert.rejects(() => api.crearPlan({ ...DATOS, categoria: 'CONVENIO', institucion: mala }), Error, mala);
  }
  await api.editarPlan(7, { institucion: '  Inacap ' });
  assert.deepEqual(plano(calls.at(-1)[1].body), { institucion: 'Inacap' });
  await api.editarPlan(7, { institucion: '   ' });
  assert.deepEqual(plano(calls.at(-1)[1].body), { institucion: null });
});

test('un convenio gratuito es válido y las reglas se revisan antes de enviar', async () => {
  const { api, calls } = cargar(async () => ({ ...PLAN, categoria: 'CONVENIO', precio: 0 }));
  await api.crearPlan({ ...DATOS, nombre: 'Convenio Ñuñoa', categoria: 'CONVENIO', precio: 0 });
  assert.equal(calls.length, 1);
  const malos = [
    { nombre: 'ab' }, { nombre: 'x'.repeat(61) }, { nombre: 'Plan <b>' }, { nombre: 'a@b.cl' },
    { precio: -1 }, { precio: 10_000_001 }, { precio: 49.9 }, { precio: NaN },
    { duracionDias: 0 }, { duracionDias: 367 }, { duracionDias: 1.5 },
    { beneficios: Array(11).fill('Beneficio') }, { beneficios: ['ab'] }, { beneficios: ['x'.repeat(121)] },
    { descripcion: 'd'.repeat(256) }, { motivo: 'ab' }, { motivo: 'm'.repeat(301) },
  ];
  for (const cambio of malos) await assert.rejects(() => api.crearPlan({ ...DATOS, ...cambio }), Error, JSON.stringify(cambio));
  assert.equal(calls.length, 1);
});

test('editar envía solo lo que cambia, nunca el tipo ni la categoría, y avisa al backend el motivo', async () => {
  const { api, calls } = cargar(async () => PLAN);
  await api.editarPlan(7, { precio: 5990, beneficios: ['Uno bueno'], descripcion: '  ', motivo: ' Ajuste de temporada ' });
  const [ruta, opciones] = calls[0];
  assert.equal(ruta, '/payments/admin/plans/7');
  assert.equal(opciones.method, 'PATCH');
  assert.deepEqual(plano(opciones.body), { precio: 5990, beneficios: ['Uno bueno'], descripcion: null, motivo: 'Ajuste de temporada' });
  await assert.rejects(() => api.editarPlan(7, { precio: -5 }), Error);
  await assert.rejects(() => api.editarPlan(7, { nombre: 'ab' }), Error);
  assert.equal(calls.length, 1);
});

test('desactivar usa la ruta de desactivar (no hay borrado) y el motivo es opcional', async () => {
  const { api, calls } = cargar(async () => ({ ...PLAN, is_active: false }));
  const plan = await api.desactivarPlan(7);
  assert.equal(calls[0][0], '/payments/admin/plans/7/deactivate');
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(plano(calls[0][1].body), {});
  assert.equal(plan.activo, false);
  await api.desactivarPlan(7, ' Fin de temporada ');
  assert.deepEqual(plano(calls[1][1].body), { motivo: 'Fin de temporada' });
  await assert.rejects(() => api.desactivarPlan(7, 'ab'), Error);
  assert.equal(calls.length, 2);
});

test('listar pide la página con tope y entiende la respuesta paginada', async () => {
  const { api, calls } = cargar(async () => ({ items: [PLAN], pagina: 2, limit: 10, total: 11 }));
  const pagina = await api.listarPlanesAdmin('activo', 2, 10);
  assert.equal(calls[0][0], '/payments/admin/plans?estado=activo&pagina=2&limit=10');
  assert.equal(calls[0][1].token, 'token-admin');
  assert.equal(pagina.total, 11);
  assert.equal(pagina.planes[0].suscripcionesVigentes, 3);
});

test('sin sesión no se llama al backend', async () => {
  const { api, calls } = cargar(async () => PLAN, null);
  await assert.rejects(() => api.listarPlanesAdmin(), (e) => e.status === 401);
  await assert.rejects(() => api.crearPlan(DATOS), (e) => e.status === 401);
  await assert.rejects(() => api.desactivarPlan(7), (e) => e.status === 401);
  assert.equal(calls.length, 0);
});

test('formatear el precio y separar los beneficios', () => {
  const { api } = cargar();
  assert.equal(api.formatearPrecio(4990), '$4.990');
  assert.equal(api.formatearPrecio(10_000_000), '$10.000.000');
  assert.equal(api.formatearPrecio(0), 'Gratis');
  assert.deepEqual(plano(api.separarBeneficios('uno, otro,, \n tercero ')), ['uno', 'otro', 'tercero']);
});
