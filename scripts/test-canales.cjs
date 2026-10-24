const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(responder) {
  const llamadas = [];
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/canales.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, Date, Error, Number, Math, JSON, Object, Promise, Set, Map,
    require(nombre) {
      if (nombre === 'react') return { useSyncExternalStore: (_, leer) => leer() };
      if (nombre === 'expo-crypto') return { randomUUID: () => 'uuid-1' };
      if (nombre === './sondeo') return { crearSondeo: () => ({ iniciar() {}, detener() {}, ahora() {} }), alCambiar: () => () => {}, avisarCambio() {} };
      if (nombre === './auth') return { getSession: async () => ({ id: 'u1' }), getToken: async () => 'token' };
      if (nombre === './api') return { ApiError: class ApiError extends Error {}, apiRequest: async (...args) => { llamadas.push(args); return responder(...args); } };
      throw Error(nombre);
    },
  });
  return { api: modulo.exports, llamadas };
}

test('canales valida el nombre y el texto antes de enviar', async () => {
  const { api, llamadas } = cargar(async () => ({}));
  await assert.rejects(api.crearCanal('c1', '   ', false), /entre 1 y 60/);
  await assert.rejects(api.crearCanal('c1', 'x'.repeat(61), false), /entre 1 y 60/);
  assert.equal(JSON.stringify(await api.enviarMensajeCanal('canal-1', 'c1', '  ')), JSON.stringify({ ok: false, motivo: 'Escribe entre 1 y 1000 caracteres.' }));
  assert.equal(JSON.stringify(await api.enviarMensajeCanal('canal-1', 'c1', 'x'.repeat(1001))), JSON.stringify({ ok: false, motivo: 'Escribe entre 1 y 1000 caracteres.' }));
  assert.equal(llamadas.length, 0);
});

test('crear canal transforma nombre y opciones al cuerpo del contrato', async () => {
  const { api, llamadas } = cargar(async (ruta, opciones) => {
    if (ruta === '/clubs/c1/canales' && opciones?.method === 'POST') return { id: 'ch1', club_id: 'c1', nombre: 'Avisos', miembros_escriben: true,
      miembros: 4, ultimo: null, no_leidos: 0, aviso_inactividad_en: null, mantener_hasta: null,
      fecha_creacion: '2026-10-24T12:00:00Z' };
    return [];
  });
  assert.equal(await api.crearCanal('c1', ' Avisos ', true), 'ch1');
  assert.deepEqual(JSON.parse(JSON.stringify(llamadas[0][1].body)), { nombre: 'Avisos', miembros_escriben: true });
});

test('canales del deportista convierten el formato del contrato', async () => {
  const { api } = cargar(async () => [{ id: 'ch1', club_id: 'c1', club_nombre: 'Club', club_logo: null,
    nombre: 'Avisos', miembros_escriben: false, ultimo: { id: 3, de: 'club', autor_nombre: 'Club', texto: 'Hola',
      enviado_en: '2026-10-24T12:00:00Z', propio: false }, no_leidos: 2, silenciado: true }]);
  await api.cargarCanalesDeportista();
  const canal = api.useCanales().deportista[0];
  assert.equal(canal.clubNombre, 'Club');
  assert.equal(canal.noLeidos, 2);
  assert.equal(canal.silenciado, true);
  assert.deepEqual({ de: canal.ultimo.de, autor: canal.ultimo.autorNombre, texto: canal.ultimo.texto }, { de: 'club', autor: 'Club', texto: 'Hola' });
});
