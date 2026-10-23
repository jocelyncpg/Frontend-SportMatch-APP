const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function entorno() {
  let tiempo = 0;
  let siguiente = 1;
  const timers = new Map();
  const cambios = new Set();
  const app = {
    currentState: 'active',
    addEventListener: (_, callback) => {
      cambios.add(callback);
      return { remove: () => cambios.delete(callback) };
    },
  };
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/sondeo.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports, Promise, Math, Map, Set,
    setTimeout: (fn, demora) => {
      const id = siguiente++;
      timers.set(id, { fn, vence: tiempo + demora });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    require: (nombre) => {
      if (nombre === 'react-native') return { AppState: app };
      throw Error(nombre);
    },
  });
  const avanzar = async (ms) => {
    const destino = tiempo + ms;
    while (true) {
      const proximos = [...timers].filter(([, t]) => t.vence <= destino)
        .sort((a, b) => a[1].vence - b[1].vence);
      if (!proximos.length) break;
      const [id, timer] = proximos[0];
      tiempo = timer.vence;
      timers.delete(id);
      timer.fn();
      await new Promise(setImmediate);
    }
    tiempo = destino;
  };
  const estado = (valor) => {
    app.currentState = valor;
    cambios.forEach((cambiar) => cambiar(valor));
  };
  return { api: modulo.exports, avanzar, estado, pendientes: () => timers.size };
}

test('aumenta el intervalo sin cambios y vuelve al mínimo con cambios', async () => {
  const e = entorno();
  const momentos = [];
  let cambio = false;
  const sondeo = e.api.crearSondeo('lista', async () => {
    momentos.push(momento);
    return cambio;
  }, { minMs: 1000, maxMs: 2250, factor: 1.5 });
  let momento = 0;
  sondeo.iniciar();
  await e.avanzar(0);
  momento = 1500;
  await e.avanzar(1500);
  momento = 3750;
  await e.avanzar(2250);
  cambio = true;
  momento = 6000;
  await e.avanzar(2250);
  momento = 7000;
  await e.avanzar(1000);
  assert.deepEqual(momentos, [0, 1500, 3750, 6000, 7000]);
  sondeo.detener();
  assert.equal(e.pendientes(), 0);
});

test('pausa en segundo plano y ahora evita ejecuciones simultáneas', async () => {
  const e = entorno();
  let resolver;
  let simultaneas = 0;
  let maximo = 0;
  let llamadas = 0;
  const sondeo = e.api.crearSondeo('sala', async () => {
    llamadas++;
    simultaneas++;
    maximo = Math.max(maximo, simultaneas);
    await new Promise((resolve) => { resolver = resolve; });
    simultaneas--;
    return false;
  }, { minMs: 3000, maxMs: 15000, factor: 1.5 });
  sondeo.iniciar();
  await e.avanzar(0);
  sondeo.ahora();
  await e.avanzar(0);
  assert.equal(llamadas, 1);
  resolver();
  await new Promise(setImmediate);
  await e.avanzar(0);
  assert.equal(llamadas, 2);
  resolver();
  await new Promise(setImmediate);
  e.estado('background');
  await e.avanzar(60000);
  assert.equal(llamadas, 2);
  e.estado('active');
  await e.avanzar(0);
  assert.equal(llamadas, 3);
  assert.equal(maximo, 1);
  sondeo.detener();
  resolver();
  await new Promise(setImmediate);
  assert.equal(e.pendientes(), 0);
});

test('emisor entrega tipo e id y elimina suscriptores', () => {
  const e = entorno();
  const avisos = [];
  const quitar = e.api.alCambiar((aviso) => avisos.push(aviso.tipo + ':' + aviso.id));
  e.api.avisarCambio('consulta', 'c1');
  quitar();
  e.api.avisarCambio('consulta', 'c2');
  assert.deepEqual(avisos, ['consulta:c1']);
});

test('dos consumidores de la misma clave comparten tarea hasta que ambos cierran', async () => {
  const e = entorno();
  let llamadas = 0;
  const tarea = async () => { llamadas++; return false; };
  const a = e.api.crearSondeo('club', tarea, { minMs: 1000, maxMs: 2000, factor: 2 });
  const b = e.api.crearSondeo('club', tarea, { minMs: 1000, maxMs: 2000, factor: 2 });
  a.iniciar();
  b.iniciar();
  await e.avanzar(0);
  assert.equal(llamadas, 1);
  a.detener();
  await e.avanzar(2000);
  assert.equal(llamadas, 2);
  b.detener();
  assert.equal(e.pendientes(), 0);
});

test('cerrar y reabrir durante una petición no solapa la misma clave', async () => {
  const e = entorno();
  let resolver;
  let activas = 0;
  let maximo = 0;
  const tarea = async () => {
    activas++;
    maximo = Math.max(maximo, activas);
    await new Promise((resolve) => { resolver = resolve; });
    activas--;
    return false;
  };
  const primero = e.api.crearSondeo('sala', tarea, { minMs: 1000, maxMs: 2000, factor: 2 });
  primero.iniciar();
  await e.avanzar(0);
  primero.detener();
  const segundo = e.api.crearSondeo('sala', tarea, { minMs: 1000, maxMs: 2000, factor: 2 });
  segundo.iniciar();
  await e.avanzar(0);
  assert.equal(maximo, 1);
  resolver();
  await new Promise(setImmediate);
  await e.avanzar(0);
  assert.equal(maximo, 1);
  segundo.detener();
  resolver();
  await new Promise(setImmediate);
});
