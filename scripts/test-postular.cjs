const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function cargar() {
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/convocatorias.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, URLSearchParams, Error, Promise, Array, Math, String, encodeURIComponent,
    require(nombre) {
      if (nombre === './clubes') return {};
      if (nombre === './auth') return { getToken: async () => 'token' };
      if (nombre === './api') return { apiRequest: async () => ({}) };
      throw Error(nombre);
    },
  });
  return modulo.exports;
}

test('presenta las convocatorias abiertas, cerradas y postulaciones por estado', () => {
  const api = cargar();
  assert.deepEqual(JSON.parse(JSON.stringify(api.presentacionConvocatoria('ABIERTA'))), { tipo: 'postular', texto: 'Postular' });
  assert.deepEqual(JSON.parse(JSON.stringify(api.presentacionConvocatoria('CERRADA'))), { tipo: 'cerrada', texto: 'Convocatoria cerrada' });
  for (const [estado, texto] of [['PENDIENTE', 'Postulación enviada'], ['PRESELECCIONADO', 'Preseleccionado'], ['ACEPTADO', 'Aceptado'], ['RECHAZADO', 'Rechazado']]) {
    assert.deepEqual(JSON.parse(JSON.stringify(api.presentacionConvocatoria('ABIERTA', estado))), { tipo: 'estado', texto });
  }
});

test('muestra el mensaje original del error y usa un texto de respaldo si no es Error', () => {
  const api = cargar();
  assert.equal(api.mensajeErrorPostulacion(new Error('No quedan cupos.')), 'No quedan cupos.');
  assert.equal(api.mensajeErrorPostulacion(null), 'No se pudo enviar la postulación.');
});
