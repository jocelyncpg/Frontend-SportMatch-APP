const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function cargar() {
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/planes.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, URL, URLSearchParams, Error, Map, Set, Array, Math, String, encodeURIComponent,
    require(nombre) {
      if (nombre === 'react') return { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() };
      if (nombre === './api') return { ApiError: class ApiError extends Error {}, apiRequest: async () => ({}) };
      if (nombre === './auth') return { getToken: async () => 'token' };
      throw Error(nombre);
    },
  });
  return modulo.exports;
}

test('confirma la aprobación y permite activar el plan', () => {
  const { evaluarResultadoPago, fechaVencimientoTexto } = cargar();
  assert.deepEqual(JSON.parse(JSON.stringify(evaluarResultadoPago('APPROVED'))), { ok: true, reintentar: false });
  assert.match(fechaVencimientoTexto('2026-11-24T23:09:55.838051Z'), /24 de noviembre de 2026/);
});

test('muestra el motivo en español y no reintenta un pago rechazado', () => {
  const { evaluarResultadoPago } = cargar();
  assert.deepEqual(JSON.parse(JSON.stringify(evaluarResultadoPago('REJECTED'))), {
    ok: false, motivo: 'El pago fue rechazado por el banco simulado.', reintentar: false,
  });
  assert.equal(evaluarResultadoPago('PENDING', { status: 400, detail: 'El pago fue rechazado.' }).reintentar, false);
});

test('conserva la confirmación pendiente tras un error de red para reintentar sin pagar otra vez', () => {
  const { evaluarResultadoPago } = cargar();
  const resultado = evaluarResultadoPago('PENDING', { status: 0, message: 'offline' });
  assert.equal(resultado.reintentar, true);
  assert.match(resultado.motivo, /reintentar sin volver a pagar/);
});

test('reconoce retornos aprobados y cancelados del esquema de la app', () => {
  const { leerRetornoWebpay } = cargar();
  assert.deepEqual(JSON.parse(JSON.stringify(leerRetornoWebpay('sportmatchapp://pago?token_ws=abc123'))), { token_ws: 'abc123' });
  assert.deepEqual(JSON.parse(JSON.stringify(leerRetornoWebpay('sportmatchapp://pago?tbk_token=abc123&tbk_orden_compra=SM123&tbk_id_sesion=user%3A1'))), {
    tbk_token: 'abc123', tbk_orden_compra: 'SM123', tbk_id_sesion: 'user:1',
  });
  assert.equal(leerRetornoWebpay('https://example.com/pago?token_ws=abc'), null);
});
