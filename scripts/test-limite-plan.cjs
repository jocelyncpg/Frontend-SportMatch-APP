const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// HU-54 en la app: un 402 {codigo: "LIMITE_PLAN"} de cualquier servicio se convierte en
// "Te quedan 0 de N · Pásate a Pro" y se ofrece el catálogo de planes con un botón.

function transpilar(archivo) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}

function cargarApi(respuesta) {
  const module = { exports: {} };
  vm.runInNewContext(transpilar('services/api.ts'), {
    module, exports: module.exports, Error, JSON, Map, Set, Promise, Date, Number, String, Array, Object, setTimeout, clearTimeout,
    fetch: async () => respuesta,
    require(name) {
      if (name === './config') return { API_BASE_URL: 'http://gateway.test/api/v1' };
      if (name === './suspension') return { leerSuspension: () => undefined };
      throw Error(name);
    },
  });
  return module.exports;
}

function cargarLimite(api) {
  const module = { exports: {} };
  vm.runInNewContext(transpilar('services/limitePlan.ts'), {
    module, exports: module.exports, Error, Date, Number, String,
    require(name) {
      if (name === './api') return api;
      if (name === './dialogo') return {};
      throw Error(name);
    },
  });
  return module.exports;
}

const respuesta402 = (cuerpo) => ({ ok: false, status: 402, json: async () => cuerpo });
const LIMITE = { codigo: 'LIMITE_PLAN', recurso: 'solicitudes_match', limite: 6, usado: 6,
  se_libera_en: '2026-11-09T15:30:00Z', detail: 'Te quedan 0 de 6 solicitudes de match cada 24 h en el plan gratuito.' };

test('un 402 LIMITE_PLAN se vuelve "Te quedan 0 de N · Pásate a Pro" y avisa a quien escucha', async () => {
  const api = cargarApi(respuesta402(LIMITE));
  const avisados = [];
  api.alLlegarAlLimite((e) => avisados.push(e));
  await assert.rejects(api.apiRequest('/matching/requests', { method: 'POST' }), (e) => {
    assert.equal(e.status, 402);
    assert.equal(e.code, 'LIMITE_PLAN');
    assert.equal(e.message, 'Te quedan 0 de 6 solicitudes de match hoy · Pásate a Pro');
    assert.equal(e.limitePlan.limite, 6);
    assert.equal(e.limitePlan.se_libera_en, '2026-11-09T15:30:00Z');
    return true;
  });
  assert.equal(avisados.length, 1);
});

test('el aviso lleva al catálogo del deportista o del club según el límite', async () => {
  const api = cargarApi(respuesta402(LIMITE));
  const lim = cargarLimite(api);
  let error;
  try { await api.apiRequest('/matching/requests'); } catch (e) { error = e; }
  const rutas = [];
  const aviso = lim.avisoLimite(error, (r) => rutas.push(r), Date.parse('2026-11-09T10:00:00Z'));
  assert.match(aviso.mensaje, /^Te quedan 0 de 6 solicitudes de match hoy · Pásate a Pro\nSe libera un cupo /);
  assert.equal(aviso.botones[1].text, 'Pásate a Pro');
  aviso.botones[1].onPress();
  assert.deepEqual(rutas, ['/(deportista)/planes']);

  const club = cargarApi(respuesta402({ ...LIMITE, recurso: 'convocatorias_abiertas', limite: 2, usado: 2, se_libera_en: null }));
  try { await club.apiRequest('/clubs/x/announcements'); } catch (e) { error = e; }
  assert.equal(error.message, 'Te quedan 0 de 2 convocatorias abiertas a la vez · Contrata el plan Club');
  const avisoClub = cargarLimite(club).avisoLimite(error, (r) => rutas.push(r));
  assert.equal(avisoClub.mensaje, error.message);
  avisoClub.botones[1].onPress();
  assert.equal(rutas[1], '/(club)/planes');
});

test('otros 402 o errores sin código siguen como antes', async () => {
  const api = cargarApi(respuesta402({ detail: 'Pago requerido' }));
  const avisados = [];
  api.alLlegarAlLimite((e) => avisados.push(e));
  await assert.rejects(api.apiRequest('/x'), (e) => e.message === 'Pago requerido' && e.limitePlan === undefined);
  assert.equal(avisados.length, 0);
  assert.equal(cargarLimite(api).avisoLimite(new api.ApiError('x', 500, ''), () => {}), null);
});

function cargarUso(api) {
  const module = { exports: {} };
  vm.runInNewContext(transpilar('services/usoPlan.ts'), {
    module, exports: module.exports, Error, Promise, Math, Array, Set, String, Number, Object,
    require(name) {
      if (name === './api') return api;
      if (name === './auth') return { getToken: async () => 'token' };
      if (name === 'expo-router') return { useFocusEffect: () => undefined };
      if (name === 'react') return { useCallback: (f) => f, useState: (v) => [v, () => undefined] };
      throw Error(name);
    },
  });
  return module.exports;
}

test('el uso del plan se muestra como "Te quedan X de N" y se pide a cada servicio una sola vez', async () => {
  const api = cargarApi({ ok: true, status: 200, json: async () => ({}) });
  const llamadas = [];
  const respuestas = {
    '/matching/plan-usage': { plan: 'GRATIS', items: [{ recurso: 'solicitudes_match', limite: 6, usado: 2, ventana_horas: 24, se_libera_en: null }] },
    '/activities/plan-usage': { plan: 'GRATIS', items: [
      { recurso: 'postulaciones_actividades', limite: 5, usado: 5, ventana_horas: 24, se_libera_en: '2026-11-09T15:30:00Z' },
      { recurso: 'actividades_organizadas', limite: 3, usado: 1, ventana_horas: 720, se_libera_en: null }] },
  };
  const uso = cargarUso({
    ...api,
    apiRequest: async (ruta) => {
      llamadas.push(ruta);
      if (!respuestas[ruta]) throw new Error('caído');
      return respuestas[ruta];
    },
  });
  const items = await uso.cargarUso(['solicitudes_match', 'postulaciones_actividades', 'actividades_organizadas', 'postulaciones_convocatorias']);
  assert.deepEqual(llamadas.sort(), ['/activities/plan-usage', '/clubs/plan-usage/me', '/matching/plan-usage']);
  assert.deepEqual(items.map((i) => i.recurso), ['solicitudes_match', 'postulaciones_actividades', 'actividades_organizadas']);
  assert.equal(uso.textoUso(items[0]), 'Te quedan 4 de 6 solicitudes de match hoy');
  assert.equal(uso.textoUso(items[1]), 'Te quedan 0 de 5 postulaciones a actividades hoy');
  assert.equal(uso.textoUsoCorto(items[0]), 'Te quedan 4 de 6 hoy');
  assert.equal(uso.textoUsoCorto(items[2]), 'Te quedan 2 de 3 este mes');
  assert.equal(uso.textoUso({ recurso: 'solicitudes_match', limite: null, usado: 9, ventana_horas: 24, se_libera_en: null }), null);
  assert.equal(uso.textoUso({ recurso: 'solicitudes_match', limite: 6, usado: null, ventana_horas: null, se_libera_en: null }), null);
});

test('la pantalla de planes, descubrir y las postulaciones muestran el uso', () => {
  const leer = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(leer('app/(deportista)/planes.tsx'), /useUsoPlan\(RECURSOS_USO\)/);
  assert.match(leer('app/(deportista)/(tabs)/discover.tsx'), /textoUsoCorto\(usoMatch\[0\]\)/);
  assert.match(leer('app/(deportista)/activity/[id].tsx'), /textoUso\(usoPostular\[0\]\)/);
  assert.match(leer('app/(deportista)/club/[id].tsx'), /textoUso\(usoPostular\[0\]\)/);
});
