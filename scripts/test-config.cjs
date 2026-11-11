const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const moduleConfig = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../services/config.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: moduleConfig, exports: moduleConfig.exports, URL, process: { env: {} },
  require: () => ({ default: { expoConfig: {} } }),
});
const { resolverApiUrl } = moduleConfig.exports;

test('la URL explícita del gateway tiene prioridad y se normaliza para todas las llamadas', () => {
  assert.equal(resolverApiUrl(' https://api.example/api/v1/ ', '192.168.1.20:8081'), 'https://api.example/api/v1');
});

test('Expo Go usa el PC del QR cuando la variable está vacía, también con IPv6', () => {
  assert.equal(resolverApiUrl('  ', '192.168.1.20:8081'), 'http://192.168.1.20:8000/api/v1');
  assert.equal(resolverApiUrl(undefined, '[::1]:8081'), 'http://[::1]:8000/api/v1');
  assert.equal(resolverApiUrl(undefined, 'exp://192.168.1.20:8081'), 'http://192.168.1.20:8000/api/v1');
  assert.equal(resolverApiUrl(undefined, null), 'http://localhost:8000/api/v1');
});
