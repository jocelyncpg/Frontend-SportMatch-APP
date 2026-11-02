const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// HU-48 en la app: historial de acciones administrativas (solo lectura) con filtros simples y etiquetas legibles.

function cargar({ token = 'token-admin', responder = async () => undefined } = {}) {
  const calls = [];
  const module = { exports: {} };
  class ApiError extends Error { constructor(m, status, detail = '') { super(m); this.status = status; this.detail = detail; } }
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/auditoria.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module, exports: module.exports, Error, Promise, JSON, URLSearchParams, Number, String, Date, Object, Math,
    require(name) {
      if (name === './auth') return { getToken: async () => token };
      if (name === './api') return { ApiError, apiRequest: async (...args) => { calls.push(args); return responder(...args); } };
      throw Error(name);
    },
  });
  return { api: module.exports, calls, ApiError };
}
const plano = (v) => JSON.parse(JSON.stringify(v));

const EVENTO_API = {
  id: 'e-1', fecha: '2026-11-02T12:00:00Z', admin: { id: 'a-1', nombre: 'Ada W.' }, accion: 'PLAN_UPDATED', recurso_tipo: 'plan',
  recurso_id: '7', afectado: null, motivo: 'Ajuste de temporada', resultado: 'success',
  detalle: { precio_anterior: 4990, precio_nuevo: 9990, duracion_anterior: 30, duracion_nueva: 60, campos: 'precio,duracion_dias' },
};

test('las 12 acciones del catálogo tienen una etiqueta legible y una acción desconocida nunca muestra el código', () => {
  const { api } = cargar();
  assert.equal(api.ACCIONES_FILTRO.length, 12);
  for (const a of api.ACCIONES_FILTRO) {
    assert.doesNotMatch(api.etiquetaAccion(a), /^[A-Z_]+$/, a);
    assert.ok(api.etiquetaAccion(a).length > 5, a);
  }
  assert.equal(api.etiquetaAccion('SANCTION_APPLIED'), 'Sanción aplicada');
  assert.equal(api.etiquetaAccion('PLAN_DEACTIVATED'), 'Plan o convenio desactivado');
  assert.equal(api.etiquetaAccion('ACCION_NUEVA'), 'Acción administrativa');
  assert.equal(api.etiquetaRecurso('plan'), 'Plan o convenio');
  assert.equal(api.etiquetaRecurso('user'), 'Cuenta');
  assert.equal(api.etiquetaRecurso(null), '—');
  assert.equal(api.RECURSOS_FILTRO.length, 8);
});

test('las fechas de los filtros aceptan DD-MM-AAAA y AAAA-MM-DD, y rechazan las que no existen', () => {
  const { api } = cargar();
  const ini = api.fechaAIso('08-11-2026');
  const fin = api.fechaAIso('08-11-2026', true);
  assert.match(ini, /Z$/);
  assert.equal(new Date(fin) - new Date(ini), 24 * 3600 * 1000 - 1);                 // el día completo
  assert.equal(api.fechaAIso('2026-11-08'), ini);
  assert.equal(api.fechaAIso('8/11/2026'), ini);
  for (const mala of ['', '31-02-2026', '32-01-2026', '00-01-2026', '08-13-2026', 'mañana', '2026-1-8', '08-11-26', '08-11-2026 10:00']) {
    assert.equal(api.fechaAIso(mala), null, mala);
  }
});

test('armarFiltros valida el formulario y arma los filtros de la API', () => {
  const { api } = cargar();
  const ok = api.armarFiltros({ desde: '01-11-2026', hasta: '08-11-2026', accion: 'SANCTION_APPLIED', recurso: 'user', pagina: 2 });
  assert.equal(ok.error, undefined);
  assert.equal(ok.filtros.accion, 'SANCTION_APPLIED');
  assert.equal(ok.filtros.recursoTipo, 'user');
  assert.equal(ok.filtros.pagina, 2);
  assert.equal(ok.filtros.porPagina, 20);
  assert.ok(ok.filtros.desde < ok.filtros.hasta);
  const vacio = api.armarFiltros({ desde: '', hasta: '  ', pagina: 1 });
  assert.equal(vacio.filtros.desde, undefined);
  assert.equal(vacio.filtros.hasta, undefined);
  assert.match(api.armarFiltros({ desde: '31-02-2026', hasta: '', pagina: 1 }).error, /"Desde" no es válida/);
  assert.match(api.armarFiltros({ desde: '', hasta: 'x', pagina: 1 }).error, /"Hasta" no es válida/);
  assert.match(api.armarFiltros({ desde: '09-11-2026', hasta: '08-11-2026', pagina: 1 }).error, /posterior/);
  assert.ok(api.armarFiltros({ desde: '', hasta: '', pagina: 0 }).error);
  assert.ok(api.armarFiltros({ desde: '', hasta: '', pagina: 1.5 }).error);
});

test('la consulta usa los nombres de la API y omite lo que no se filtró', () => {
  const { api } = cargar();
  assert.equal(api.queryAuditoria({}), '');
  assert.equal(api.queryAuditoria({ accion: 'PLAN_CREATED', recursoTipo: 'plan', resultado: 'failure', pagina: 3, porPagina: 20, desde: '', hasta: undefined }),
    '?accion=PLAN_CREATED&recurso_tipo=plan&resultado=failure&pagina=3&por_pagina=20');
});

test('listarAuditoria llama solo con GET, entiende la página y convierte los nombres', async () => {
  const { api, calls } = cargar({ responder: async () => ({ items: [EVENTO_API], pagina: 2, por_pagina: 20, total: 41, total_paginas: 3 }) });
  const pagina = await api.listarAuditoria({ accion: 'PLAN_UPDATED', pagina: 2, porPagina: 20 });
  const [ruta, opciones] = calls[0];
  assert.equal(ruta, '/users/admin/audit-events?accion=PLAN_UPDATED&pagina=2&por_pagina=20');
  assert.equal(opciones.token, 'token-admin');
  assert.equal(opciones.method, undefined);                              // GET: solo lectura
  assert.deepEqual(plano({ ...pagina, items: undefined }), { pagina: 2, porPagina: 20, total: 41, totalPaginas: 3 });
  assert.equal(pagina.items[0].adminNombre, 'Ada W.');
  assert.equal(pagina.items[0].recursoTipo, 'plan');
});

test('sin sesión no se llama al backend', async () => {
  const { api, calls } = cargar({ token: null });
  await assert.rejects(() => api.listarAuditoria(), (e) => e.status === 401);
  assert.equal(calls.length, 0);
});

test('un 403 (no es administrador) llega como error y no se reintenta', async () => {
  const { api, calls, ApiError } = cargar({ responder: async () => { throw new ApiError('Solo un administrador puede consultar la auditoría.', 403); } });
  await assert.rejects(() => api.listarAuditoria(), (e) => e.status === 403 && /administrador/.test(e.message));
  assert.equal(calls.length, 1);
});

test('el resumen del detalle muestra precio anterior y nuevo, duración y campos, sin datos crudos', () => {
  const { api } = cargar();
  assert.equal(api.resumenDetalle({ accion: 'PLAN_UPDATED', detalle: EVENTO_API.detalle }),
    'Precio: $4.990 → $9.990 · Duración: 30 → 60 días · Cambió: precio, duración');
  assert.equal(api.resumenDetalle({ accion: 'PLAN_CREATED', detalle: { precio_nuevo: 0, duracion_nueva: 90, categoria: 'CONVENIO', campos: 'creacion' } }),
    'Precio: Gratis · Duración: 90 días · Convenio');
  assert.equal(api.resumenDetalle({ accion: 'PLAN_UPDATED', detalle: { campos: 'institucion,is_active' } }), 'Cambió: institución, estado');
  assert.equal(api.resumenDetalle({ accion: 'SANCTION_APPLIED', detalle: { tipo: 'temporal', dias: 7, reporte_id: 'r-1', sancion_id: 's-1' } }), 'Temporal, 7 días');
  assert.equal(api.resumenDetalle({ accion: 'SANCTION_APPLIED', detalle: { tipo: 'permanente', dias: null } }), 'Permanente');
  assert.equal(api.resumenDetalle({ accion: 'REPORT_REVIEWED', detalle: null }), '');
  assert.doesNotMatch(api.resumenDetalle({ accion: 'SANCTION_APPLIED', detalle: { tipo: 'temporal', dias: 7, sancion_id: 's-1' } }), /s-1/);
});

test('el cliente de auditoría es de solo lectura', () => {
  const servicio = fs.readFileSync(path.join(__dirname, '../services/auditoria.ts'), 'utf8');
  assert.doesNotMatch(servicio, /method:\s*'(POST|PUT|PATCH|DELETE)'/);
});
