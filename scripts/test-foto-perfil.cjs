const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// HU-61 en la app (solo capa de datos): la foto llega del servidor como una ruta del gateway, se completa con la
// dirección del gateway, y subirla es un multipart (no JSON).

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function cargarSuspension() {
  const module = { exports: {} };
  vm.runInNewContext(compile('services/suspension.ts'), { module, exports: module.exports, Date, Number, String, Promise });
  return module.exports;
}
function cargarApi({ base = 'http://192.168.1.18:8000/api/v1', fetch = async () => ({ ok: true, status: 200, json: async () => ({}) }), FormData } = {}) {
  const module = { exports: {} };
  vm.runInNewContext(compile('services/api.ts'), {
    module, exports: module.exports, Error, Promise, JSON, Set, setTimeout, clearTimeout, AbortController, fetch, FormData,
    require(name) {
      if (name === './config') return { API_BASE_URL: base };
      if (name === './suspension') return cargarSuspension();
      throw Error(name);
    },
  });
  return module.exports;
}

test('urlFoto completa la ruta del servidor con la dirección del gateway, igual para app y web', () => {
  const clave = '0123456789abcdef0123456789abcdef.jpg';
  assert.equal(cargarApi().urlFoto(`/api/v1/users/photos/${clave}`), `http://192.168.1.18:8000/api/v1/users/photos/${clave}`);
  assert.equal(cargarApi({ base: 'https://api.sportmatch.cl/api/v1/' }).urlFoto(`/api/v1/users/photos/${clave}`),
    `https://api.sportmatch.cl/api/v1/users/photos/${clave}`);
});

test('sin foto, o con un valor que no es una ruta del servidor, no hay foto y la pantalla muestra su avatar de siempre', () => {
  const { urlFoto } = cargarApi();
  for (const valor of [null, undefined, '', 'file:///data/user/0/cache/foto.jpg', 'http://evil.example/x.png', 'javascript:alert(1)', 'foto.jpg']) {
    assert.equal(urlFoto(valor), undefined, String(valor));
  }
});

test('subir la foto envía el FormData tal cual, con el token y sin forzar Content-Type (fetch pone el límite multipart)', async () => {
  class FormularioFalso {}
  const llamadas = [];
  const { apiRequest } = cargarApi({
    FormData: FormularioFalso,
    fetch: async (url, opciones) => { llamadas.push({ url, opciones }); return { ok: true, status: 200, json: async () => ({ foto_perfil: '/api/v1/users/photos/x.jpg' }) }; },
  });
  const formulario = new FormularioFalso();
  const perfil = await apiRequest('/users/u1/profile/photo', { method: 'PUT', token: 't0k', body: formulario });
  assert.equal(perfil.foto_perfil, '/api/v1/users/photos/x.jpg');
  const { url, opciones } = llamadas[0];
  assert.equal(url, 'http://192.168.1.18:8000/api/v1/users/u1/profile/photo');
  assert.equal(opciones.method, 'PUT');
  assert.equal(opciones.body, formulario);
  assert.equal(opciones.headers.Authorization, 'Bearer t0k');
  assert.equal(opciones.headers['Content-Type'], undefined);
});

test('una petición normal sigue siendo JSON', async () => {
  const llamadas = [];
  const { apiRequest } = cargarApi({
    FormData: class {},
    fetch: async (url, opciones) => { llamadas.push(opciones); return { ok: true, status: 200, json: async () => ({}) }; },
  });
  await apiRequest('/users/u1/profile', { method: 'PUT', body: { nombre: 'Ana' } });
  assert.equal(llamadas[0].headers['Content-Type'], 'application/json');
  assert.equal(llamadas[0].body, '{"nombre":"Ana"}');
});

test('los errores del servidor al subir (413, 415, 400) se muestran con su propio mensaje', async () => {
  const { apiRequest } = cargarApi({
    FormData: class {},
    fetch: async () => ({ ok: false, status: 415, json: async () => ({ detail: 'Formato no permitido. Usa una imagen JPG o PNG.' }) }),
  });
  await assert.rejects(() => apiRequest('/users/u1/profile/photo', { method: 'PUT', body: new (class {})() }),
    (e) => e.status === 415 && e.message === 'Formato no permitido. Usa una imagen JPG o PNG.');
});
