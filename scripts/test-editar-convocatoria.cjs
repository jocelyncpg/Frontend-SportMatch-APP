const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// HU-68 en la app (solo capa de datos): editar una convocatoria es un PATCH con solo lo que cambia.

function cargar(llamadas) {
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/convocatorias.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, URLSearchParams, Error, Promise, Array, Math, String, encodeURIComponent,
    require(nombre) {
      if (nombre === './clubes') return {};
      if (nombre === './auth') return { getToken: async () => 'token' };
      if (nombre === './api') return { apiRequest: async (ruta, opciones) => { llamadas.push({ ruta, opciones }); if (ruta.includes('cerrada')) throw new Error('La convocatoria está cerrada; no se puede editar.'); return { id: 'c1' }; } };
      throw Error(nombre);
    },
  });
  return modulo.exports;
}

test('editar envía un PATCH a la convocatoria del club con el token y solo los cambios', async () => {
  const llamadas = [];
  const api = cargar(llamadas);
  const cambios = { direccion: 'Av. Nueva 77', cupos: 30, comuna: null };
  const resultado = await api.editarConvocatoria('club 1', 'conv/1', cambios);
  assert.equal(resultado.id, 'c1');
  assert.equal(llamadas[0].ruta, '/clubs/club%201/announcements/conv%2F1');
  assert.equal(llamadas[0].opciones.method, 'PATCH');
  assert.equal(llamadas[0].opciones.token, 'token');
  assert.deepEqual(JSON.parse(JSON.stringify(llamadas[0].opciones.body)), cambios);
});

test('los errores del servidor (409 cerrada, cupos bajo los aceptados) llegan tal cual a quien llama', async () => {
  const api = cargar([]);
  await assert.rejects(() => api.editarConvocatoria('club', 'cerrada', { cupos: 3 }),
    { message: 'La convocatoria está cerrada; no se puede editar.' });
});
