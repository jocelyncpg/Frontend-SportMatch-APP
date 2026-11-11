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

function auth({ fallarPreferencias = false } = {}) {
  const perfil = { nombre: 'Ana', apellido_paterno: 'Prueba', apellido_materno: null,
    fecha_nacimiento: null, telefono: '912345678', foto_perfil: '/api/v1/users/photos/foto.jpg', biografia: 'Entreno running' };
  const guardado = new Map([['sportmatch_token', 'token'], ['sportmatch_session', JSON.stringify({ id: 'u1', nombre: 'Ana', fotoPerfil: 'https://gateway/foto.jpg' })]]);
  const llamadas = [];
  const preferencias = { deportes: [], objetivos: ['competir'], disponibilidad: [], zona: { comuna: 'Santiago', latitud: -33.45, longitud: -70.66 } };
  const servicio = cargar('auth.ts', {
    '@react-native-async-storage/async-storage': { default: {
      getItem: async (key) => guardado.get(key) ?? null,
      setItem: async (key, value) => guardado.set(key, value),
    } },
    'react-native': { Platform: { OS: 'web' } },
    './validators': {}, './deportes': {},
    './api': { apiRequest: async (...args) => {
      llamadas.push(args);
      if (args[0].endsWith('/preferences')) {
        if (args[1]?.method === 'PUT') {
          if (fallarPreferencias) throw new Error('Sin conexión');
          Object.assign(preferencias, args[1].body);
        }
        return preferencias;
      }
      return perfil;
    } },
  });
  return { servicio, llamadas, perfil, preferencias, guardado };
}

test('la disponibilidad de sprint 2 se guarda en Users y se recupera desde sus preferencias', async () => {
  const { servicio, llamadas, preferencias } = auth();
  await servicio.updatePerfilExtra('u1', { disponibilidad: 'Lun 07:00, 18:30 · Sáb 23:30' });
  assert.deepEqual(JSON.parse(JSON.stringify(preferencias.disponibilidad)), [
    { dia_semana: 'lunes', hora_inicio: '07:00', hora_fin: '08:00' },
    { dia_semana: 'lunes', hora_inicio: '18:30', hora_fin: '19:30' },
    { dia_semana: 'sabado', hora_inicio: '23:30', hora_fin: '23:59' },
  ]);
  assert.equal(llamadas[1][0], '/users/u1/preferences');
  assert.equal(llamadas[1][1].method, 'PUT');
  assert.deepEqual(preferencias.objetivos, ['competir']);
  assert.equal(preferencias.zona.comuna, 'Santiago');
  const sesion = await servicio.refrescarPreferencias();
  assert.equal(sesion.disponibilidad, 'Lun 07:00, 18:30 · Sáb 23:30');
});

test('editar horas conserva la duración de las franjas existentes; vaciar elimina las del servidor', async () => {
  const { servicio, preferencias } = auth();
  preferencias.disponibilidad = [{ dia_semana: 'miercoles', hora_inicio: '10:00', hora_fin: '12:30' }];
  await servicio.updatePerfilExtra('u1', { disponibilidad: 'Mié 10:00' });
  assert.equal(preferencias.disponibilidad[0].hora_fin, '12:30');
  await servicio.updatePerfilExtra('u1', { disponibilidad: '' });
  assert.equal(preferencias.disponibilidad.length, 0);
  assert.equal((await servicio.refrescarPreferencias()).disponibilidad, undefined);
});

test('un fallo del backend no presenta la disponibilidad como guardada localmente', async () => {
  const { servicio, preferencias, guardado } = auth({ fallarPreferencias: true });
  await assert.rejects(servicio.updatePerfilExtra('u1', { disponibilidad: 'Lun 07:00' }), /Sin conexión/);
  assert.equal(preferencias.disponibilidad.length, 0);
  assert.equal((await servicio.getSession()).disponibilidad, undefined);
  assert.equal(guardado.has('sportmatch_local_extras'), false);
});

test('horarios inválidos y semanas de más de 21 franjas no envían PUT al servidor', async () => {
  const { servicio, llamadas } = auth();
  for (const disponibilidad of ['Lun 25:00', 'Lun 23:59', 'Los lunes', 'Lun 07:00 · Inexistente 08:00']) {
    await assert.rejects(servicio.updatePerfilExtra('u1', { disponibilidad }));
  }
  const semana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => `${dia} 06:00, 07:00, 08:00, 09:00`).join(' · ');
  await assert.rejects(servicio.updatePerfilExtra('u1', { disponibilidad: semana }), /21/);
  assert.equal(llamadas.filter((c) => c[1]?.method === 'PUT').length, 0);
});

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
