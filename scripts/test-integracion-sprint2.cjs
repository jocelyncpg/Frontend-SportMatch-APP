const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(nombre, modulos) {
  const module = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services', nombre), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module, exports: module.exports,
    require(nombre) {
      if (nombre in modulos) return modulos[nombre];
      throw new Error(`Import sin configurar: ${nombre}`);
    },
  });
  return module.exports;
}

function auth() {
  const perfil = { nombre: 'Ana', apellido_paterno: 'Prueba', apellido_materno: null,
    fecha_nacimiento: null, telefono: '912345678', foto_perfil: '/api/v1/users/photos/foto.jpg', biografia: 'Entreno running' };
  const guardado = new Map([['sportmatch_token', 'token'], ['sportmatch_session', JSON.stringify({ id: 'u1', nombre: 'Ana', fotoPerfil: 'https://gateway/foto.jpg' })]]);
  const llamadas = [];
  const servicio = cargar('auth.ts', {
    '@react-native-async-storage/async-storage': { default: {
      getItem: async (key) => guardado.get(key) ?? null,
      setItem: async (key, value) => guardado.set(key, value),
    } },
    'react-native': { Platform: { OS: 'web' } },
    './validators': {}, './deportes': {},
    './api': { apiRequest: async (...args) => { llamadas.push(args); return perfil; } },
  });
  return { servicio, llamadas, perfil };
}

test('Configuración guarda el nombre en la API y conserva foto, biografía y teléfono', async () => {
  const { servicio, llamadas, perfil } = auth();
  await servicio.updateDatosPersonales('u1', { nombre: 'Andrea', apellidoPaterno: 'Nueva', apellidoMaterno: undefined });
  const [ruta, opciones] = llamadas[1];
  assert.equal(ruta, '/users/u1/profile');
  assert.equal(opciones.method, 'PUT');
  assert.equal(opciones.body.nombre, 'Andrea');
  assert.equal(opciones.body.foto_perfil, perfil.foto_perfil);
  assert.equal(opciones.body.biografia, perfil.biografia);
  assert.equal(opciones.body.telefono, perfil.telefono);
  assert.equal(opciones.body.apellido_materno, null);
  assert.equal('user_id' in opciones.body, false);
  assert.equal((await servicio.getSession()).nombre, 'Andrea');
});

test('quitar la foto usa DELETE en el backend y actualiza la sesión; no simula varias fotos', async () => {
  const { servicio, llamadas } = auth();
  assert.equal(servicio.MAX_FOTOS, 1);
  await assert.rejects(servicio.updateFotos('u1', ['a', 'b']), /una foto/);
  assert.equal(llamadas.length, 0);
  assert.equal((await servicio.updateFotos('u1', [])).length, 0);
  assert.equal(llamadas[0][0], '/users/u1/profile/photo');
  assert.equal(llamadas[0][1].method, 'DELETE');
  assert.equal((await servicio.getSession()).fotoPerfil, undefined);
  await assert.rejects(servicio.updateFotos('otra-cuenta', []), /sesión/);
});

test('el mapa de Mi club se lee y guarda en la API con las coordenadas originales', async () => {
  const llamadas = [];
  const servicio = cargar('perfilClub.ts', {
    './auth': { getToken: async () => 'token' },
    './clubes': { listarDeportesClub: async () => [{ id: 7, nombre: 'Running' }] },
    './api': { apiRequest: async (...args) => {
      llamadas.push(args);
      return { nombre: 'Club', deportes: [{ id: 7, nombre: 'Running' }], ubicacion: { comuna: 'Santiago', direccion: 'Parque 123', latitud: -33.45, longitud: -70.66 } };
    } },
  });
  const perfil = await servicio.cargarPerfilClub('club-id');
  assert.equal(perfil.latitud, -33.45);
  assert.equal(perfil.direccion, 'Parque 123');
  assert.equal((await servicio.guardarPerfilClub('club-id', perfil)).ok, true);
  assert.equal(llamadas[1][1].body.latitud, -33.45);
  assert.equal(llamadas[1][1].body.longitud, -70.66);
  assert.equal(llamadas[1][1].body.deporte_ids[0], 7);
  assert.equal((await servicio.guardarPerfilClub('club-id', { ...perfil, longitud: null })).ok, false);
  assert.equal(llamadas.length, 2);
});
