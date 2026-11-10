const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// HU-66 en la app (solo capa de datos): la lista de bloqueados se lee por páginas y el desbloqueo es un DELETE.

function cargar(servidor, llamadas) {
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/reportes.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, Error, Promise, Array, Math, String, Set, encodeURIComponent, Number,
    require(nombre) {
      if (nombre === 'react') return { useSyncExternalStore: () => [] };
      if (nombre === './auth') return { getToken: async () => 'token' };
      if (nombre === './api') {
        return {
          ApiError: class ApiError extends Error {},
          urlFoto: (v) => (v && v.startsWith('/api/') ? `http://gw${v}` : undefined),
          apiRequest: async (ruta, opciones) => { llamadas.push({ ruta, opciones }); return servidor(ruta, opciones); },
        };
      }
      throw Error(nombre);
    },
  });
  return modulo.exports;
}

const persona = (n, foto) => ({
  user_id: `id-${n}`, nombre: `Persona${n}`, apellido_inicial: 'T.', foto_perfil: foto ?? null, fecha_bloqueo: `2026-11-0${(n % 9) + 1}T10:00:00Z`,
});

test('la lista trae id, nombre, foto completa o undefined, y la fecha; pide la página con el token', async () => {
  const llamadas = [];
  const api = cargar(() => [persona(1, '/api/v1/users/photos/abc.jpg'), persona(2)], llamadas);
  const lista = await api.listarBloqueados(0, 50);
  assert.equal(llamadas[0].ruta, '/users/me/blocks?limit=50&offset=0');
  assert.equal(llamadas[0].opciones.token, 'token');
  assert.equal(lista.length, 2);
  assert.equal(lista[0].id, 'id-1');
  assert.equal(lista[0].nombre, 'Persona1');
  assert.equal(lista[0].apellidoInicial, 'T.');
  assert.equal(lista[0].foto, 'http://gw/api/v1/users/photos/abc.jpg');
  assert.equal(lista[1].foto, undefined);
  assert.equal(lista[0].fecha.startsWith('2026-11-'), true);
});

test('cargarBloqueados recorre todas las páginas hasta que una viene incompleta', async () => {
  const llamadas = [];
  const todas = Array.from({ length: 230 }, (_, i) => persona(i));
  const api = cargar((ruta) => {
    const [, limite, desde] = /limit=(\d+)&offset=(\d+)/.exec(ruta);
    return todas.slice(Number(desde), Number(desde) + Number(limite));
  }, llamadas);
  await api.cargarBloqueados();
  assert.deepEqual(llamadas.map((l) => l.ruta), [
    '/users/me/blocks?limit=100&offset=0', '/users/me/blocks?limit=100&offset=100', '/users/me/blocks?limit=100&offset=200',
  ]);
});

test('una página exacta de 100 pide una más para confirmar que no hay otra', async () => {
  const llamadas = [];
  const exacta = Array.from({ length: 100 }, (_, i) => persona(i));
  const api = cargar((ruta) => (ruta.endsWith('offset=0') ? exacta : []), llamadas);
  await api.cargarBloqueados();
  assert.equal(llamadas.length, 2);
});

test('desbloquear es un DELETE a esa persona y devuelve el mensaje del servidor si falla', async () => {
  const llamadas = [];
  const api = cargar((ruta, o) => { if (ruta.includes('mala')) throw new Error('No se pudo desbloquear.'); return null; }, llamadas);
  assert.deepEqual(JSON.parse(JSON.stringify(await api.desbloquear('a b'))), { ok: true });
  assert.equal(llamadas[0].ruta, '/users/me/blocks/a%20b');
  assert.equal(llamadas[0].opciones.method, 'DELETE');
  assert.deepEqual(JSON.parse(JSON.stringify(await api.desbloquear('mala'))), { ok: false, motivo: 'No se pudo desbloquear.' });
});
