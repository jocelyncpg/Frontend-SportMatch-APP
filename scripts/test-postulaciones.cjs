const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(responder) {
  const llamadas = [];
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/convocatorias.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, URLSearchParams, Error, Promise, Array, Math, String, encodeURIComponent,
    require(nombre) {
      if (nombre === './clubes') return {};
      if (nombre === './auth') return { getToken: async () => 'token' };
      if (nombre === './api') return { apiRequest: async (...args) => { llamadas.push(args); return responder(...args); } };
      throw Error(nombre);
    },
  });
  return { api: modulo.exports, llamadas };
}

test('lista candidatos aplicando filtros y paginación del contrato', async () => {
  const { api, llamadas } = cargar(async () => ({ items: [], total: 0, page: 2, page_size: 10, conteo_por_estado: {} }));
  const pagina = await api.listarCandidatos('conv 1', 'ACEPTADO', 2, 10);
  assert.equal(pagina.page, 2);
  assert.equal(llamadas[0][0], '/clubs/announcements/conv%201/applications?page=2&page_size=10&estado=ACEPTADO');
  assert.equal(llamadas[0][1].token, 'token');
});

test('cambia el estado de postulacion con comentario opcional', async () => {
  const { api, llamadas } = cargar(async () => ({ id: 'p1', estado: 'PRESELECCIONADO' }));
  await api.cambiarEstadoPostulacion('p1', 'PRESELECCIONADO', 'Buena experiencia');
  assert.equal(llamadas[0][0], '/clubs/announcements/applications/p1');
  assert.equal(llamadas[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(JSON.stringify(llamadas[0][1].body)), {
    estado: 'PRESELECCIONADO', comentario: 'Buena experiencia',
  });
});

test('acumula todas las páginas al listar convocatorias del club', async () => {
  const { api, llamadas } = cargar(async (ruta) => {
    const pagina = Number(new URL('http://local' + ruta).searchParams.get('page'));
    return {
      items: [{ id: `conv-${pagina}`, estado: 'ABIERTA' }], total: 2, page: pagina, page_size: 1,
    };
  });
  const lista = await api.listarConvocatoriasClub('club-1', 'ABIERTA');
  assert.deepEqual(JSON.parse(JSON.stringify(lista.map((item) => item.id))), ['conv-1', 'conv-2']);
  assert.equal(llamadas.length, 2);
  assert.match(llamadas[0][0], /club_id=club-1&estado=ABIERTA&page=1/);
  assert.match(llamadas[1][0], /page=2/);
});
