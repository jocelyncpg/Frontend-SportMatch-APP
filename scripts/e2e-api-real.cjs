/* eslint-disable */
// Los servicios de la app (los mismos archivos .ts) contra el gateway REAL del entorno local aislado.
// No abre la app ni un emulador: ejecuta el código de services/ con fetch real. Verifica el contrato de HU-45, 47, 48 y 56.
// Uso (solo local): E2E_CONTEXT=<json con cuentas y tokens desechables> node scripts/e2e-api-real.cjs
// No imprime tokens ni contraseñas. No ejecuta pagos (Webpay) en ningún caso.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const CTX = JSON.parse(process.env.E2E_CONTEXT);
const API = 'http://127.0.0.1:8000/api/v1';
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error('Solo contra el entorno local aislado');

const resultados = [];
const check = (nombre, ok, detalle = '') => {
  resultados.push({ nombre, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${nombre}${detalle ? `  [${String(detalle).slice(0, 170).replace(/\s+/g, ' ')}]` : ''}`);
};

/** Carga los servicios de la app con un fetch real y la URL indicada. `auth.token` es el token de quien "tiene la sesión". */
function crearApp(baseUrl) {
  const auth = { token: null };
  const cache = {};
  const storage = new Map();
  const cargar = (nombre) => {
    if (cache[nombre]) return cache[nombre].exports;
    const module = { exports: {} };
    cache[nombre] = module;
    const codigo = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'services', `${nombre}.ts`), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(codigo, {
      module, exports: module.exports, Error, Promise, JSON, Set, Map, URLSearchParams, Number, String, Date, Object, Array, Math,
      setTimeout, clearTimeout, AbortController, fetch,
      require(req) {
        if (req === './config') return { API_BASE_URL: baseUrl };
        if (req === 'react') return { useSyncExternalStore: (_suscribir, instantanea) => instantanea() };
        if (req === '@react-native-async-storage/async-storage') return {
          getItem: async (k) => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v); }, removeItem: async (k) => { storage.delete(k); },
        };
        if (req === './auth') return { getToken: async () => auth.token, getSession: async () => ({ id: 'e2e' }) };
        if (['./api', './suspension'].includes(req)) return cargar(req.slice(2));
        throw new Error(`import inesperado: ${req}`);
      },
    });
    return module.exports;
  };
  return { auth, api: cargar('api'), reportes: cargar('reportes'), sanciones: cargar('sanciones'), planesAdmin: cargar('planesAdmin'),
    auditoria: cargar('auditoria'), planes: cargar('planes') };
}

const dd = (n) => String(n).padStart(2, '0');
const fechaLocal = (d) => `${dd(d.getDate())}-${dd(d.getMonth() + 1)}-${d.getFullYear()}`;
const falla = async (promesa) => { try { await promesa; return null; } catch (e) { return e; } };

(async () => {
  const app = crearApp(API);
  const { auth } = app;
  const H = new Date();
  const motivoHtml = 'Acoso <img src=x onerror=alert(1)> reiterado';

  console.log('== HU-47/45/48/56: quien no es administrador');
  auth.token = CTX.a.token;
  for (const [nombre, fn] of [
    ['reportes', () => app.reportes.listarReportes('pendiente')], ['sanciones', () => app.sanciones.listarSanciones()],
    ['auditoría', () => app.auditoria.listarAuditoria()], ['planes (admin)', () => app.planesAdmin.listarPlanesAdmin()],
  ]) {
    const e = await falla(fn());
    check(`un deportista no puede usar ${nombre} del panel de admin (403)`, e && e.status === 403, e && `${e.status} ${e.message}`);
  }

  console.log('== HU-47 reportes (administrador)');
  auth.token = CTX.admin.token;
  const pendientes = await app.reportes.listarReportes('pendiente');
  const rep = (id) => pendientes.find((r) => r.objetivoId === id);
  check('lista los reportes pendientes con el reportado y quien reportó', rep(CTX.b.id) && rep(CTX.c.id) && rep(CTX.d.id) && /\w+ \w\./.test(rep(CTX.b.id).reportado) && /\w+ \w\./.test(rep(CTX.b.id).reportante));
  const rB = rep(CTX.b.id), rC = rep(CTX.c.id), rD = rep(CTX.d.id);
  check('revisar -> revisado', (await app.reportes.revisarReporte(rB.id, 'revisado', 'Revisado en la prueba')).estado === 'revisado');
  check('descartar -> descartado (motivo opcional)', (await app.reportes.revisarReporte(rC.id, 'descartado')).estado === 'descartado');
  check('escalar -> escalado', (await app.reportes.revisarReporte(rD.id, 'escalado', 'Reincidente')).estado === 'escalado');
  const inv = await falla(app.reportes.revisarReporte(rC.id, 'escalado'));
  check('transición inválida -> 409 con mensaje', inv && inv.status === 409 && inv.message.length > 5, inv && `${inv.status} ${inv.message}`);
  check('el filtro "escalado" muestra el reporte escalado', (await app.reportes.listarReportes('escalado')).some((r) => r.id === rD.id));

  console.log('== HU-45 sanciones y cuenta suspendida (cuenta D, temporal)');
  const sD = await app.sanciones.aplicarSancion({ usuarioId: CTX.d.id, tipo: 'temporal', dias: 7, motivo: motivoHtml, reporteId: rD.id });
  check('aplicar sanción temporal desde un reporte escalado', sD.estado === 'activa' && sD.tipo === 'temporal' && sD.reporteId === rD.id);
  const dup = await falla(app.sanciones.aplicarSancion({ usuarioId: CTX.d.id, tipo: 'permanente', dias: null, motivo: 'Duplicada' }));
  check('sanción duplicada -> 409', dup && dup.status === 409, dup && dup.message);
  const auto = await falla(app.sanciones.aplicarSancion({ usuarioId: CTX.admin.id, tipo: 'permanente', dias: null, motivo: 'Auto sanción' }));
  check('no se puede sancionar a un admin ni a sí mismo (422)', auto && auto.status === 422, auto && auto.message);
  const sC = await app.sanciones.aplicarSancion({ usuarioId: CTX.c.id, tipo: 'permanente', dias: null, motivo: 'Conducta grave comprobada' });
  check('aplicar sanción permanente', sC.estado === 'activa' && sC.tipo === 'permanente' && sC.fin === null);
  const activas = await app.sanciones.listarSanciones('activa');
  const vigenteD = activas.find((s) => s.id === sD.id);
  check('el motivo con HTML llega como texto tal cual (la app lo pinta con <Text>)', vigenteD && vigenteD.motivo === motivoHtml, vigenteD && vigenteD.motivo);
  check('la lista de sanciones trae nombre corto, sin correo ni RUT', /^\w+ \w\.$/.test(vigenteD.usuario) && !JSON.stringify(vigenteD).includes('@'), vigenteD.usuario);

  // La cuenta sancionada, al iniciar sesión
  const login = await falla(app.api.apiRequest('/users/auth/login', { method: 'POST', body: { email: CTX.d.email, password: CTX.password } }));
  check('al iniciar sesión recibe 403 account_suspended con el mensaje del backend (motivo y fecha de fin) y los datos para la alerta',
    login && login.status === 403 && login.code === 'account_suspended' && login.message === login.detail
    && login.message.includes(motivoHtml) && login.message.includes(fechaLocal(new Date(H.getTime() + 7 * 86400000)))
    && login.suspension.tipo === 'temporal' && login.suspension.motivo === motivoHtml, login && login.message);
  // En cualquier llamada con sesión (con el token que ya tenía)
  const avisos = [];
  const dejar = app.api.alSuspenderse((e) => avisos.push(e));
  const llamadas = [];
  for (const ruta of ['/matching/state', '/activities', '/notifications', '/chats', '/payments/subscription/me']) {
    const e = await falla(app.api.apiRequest(ruta, { token: CTX.d.token }));
    llamadas.push(e && e.status === 403 && e.code === 'account_suspended' && e.suspension.tipo === 'temporal' && !!e.suspension.fin);
  }
  dejar();
  check('en cualquier llamada con su token (5 rutas de distintos servicios) -> 403 account_suspended y se avisa a la app', llamadas.every(Boolean) && avisos.length === 5, llamadas.join(','));
  const loginC = await falla(app.api.apiRequest('/users/auth/login', { method: 'POST', body: { email: CTX.c.email, password: CTX.password } }));
  check('la suspensión permanente llega con el mensaje del backend y sin fecha de fin', loginC && /permanente/.test(loginC.message) && loginC.message === loginC.detail && loginC.suspension.fin === null, loginC && loginC.message);

  const lev = await app.sanciones.levantarSancion(sD.id, 'Apelación aceptada');
  check('levantar -> levantada, y la cuenta vuelve a iniciar sesión al instante',
    lev.estado === 'levantada' && (await app.api.apiRequest('/users/auth/login', { method: 'POST', body: { email: CTX.d.email, password: CTX.password } })).access_token !== undefined);
  await app.sanciones.levantarSancion(sC.id, 'Fin de la prueba');

  console.log('== HU-48 auditoría');
  const hoy = fechaLocal(H);
  const armado = app.auditoria.armarFiltros({ desde: hoy, hasta: hoy, accion: 'SANCTION_APPLIED', recurso: 'user', pagina: 1 });
  check('los filtros (fecha, acción, recurso) se arman sin error', !armado.error, armado.error);
  const pagina = await app.auditoria.listarAuditoria(armado.filtros);
  check('filtro acción + recurso + fecha -> solo "Sanción aplicada" sobre cuentas', pagina.items.length >= 2 && pagina.items.every((e) => e.accion === 'SANCTION_APPLIED' && e.recursoTipo === 'user'), pagina.items.length);
  check('las etiquetas son legibles y el detalle resume la sanción', pagina.items.every((e) => app.auditoria.etiquetaAccion(e.accion) === 'Sanción aplicada')
    && pagina.items.some((e) => app.auditoria.resumenDetalle(e) === 'Temporal, 7 días') && pagina.items.some((e) => app.auditoria.resumenDetalle(e) === 'Permanente'));
  const reps = await app.auditoria.listarAuditoria(app.auditoria.armarFiltros({ desde: hoy, hasta: hoy, accion: 'REPORT_ESCALATED', pagina: 1 }).filtros);
  check('filtro por otra acción (reporte escalado)', reps.items.length >= 1 && reps.items.every((e) => e.accion === 'REPORT_ESCALATED'));
  const fuera = await app.auditoria.listarAuditoria(app.auditoria.armarFiltros({ desde: '01-01-2020', hasta: '02-01-2020', pagina: 1 }).filtros);
  check('una ventana de fechas sin acciones -> vacío (200)', fuera.total === 0 && fuera.items.length === 0);
  const uno = await app.auditoria.listarAuditoria({ desde: app.auditoria.fechaAIso(hoy), porPagina: 1, pagina: 1 });
  const dos = await app.auditoria.listarAuditoria({ desde: app.auditoria.fechaAIso(hoy), porPagina: 1, pagina: 2 });
  check('paginación: la página 2 trae otro registro y el total coincide', uno.totalPaginas >= 2 && dos.items.length === 1 && dos.items[0].id !== uno.items[0].id && dos.total === uno.total, `${uno.totalPaginas} páginas`);
  check('la auditoría no trae correos, contraseñas ni tokens', !/@|password|bearer|eyJ/i.test(JSON.stringify(pagina)));

  console.log('== HU-56 planes y convenios (administrador) y catálogo del deportista');
  const nombrePlan = `HUA Plan ${CTX.tag}`, nombreConv = `HUA Convenio ${CTX.tag}`;
  const plan = await app.planesAdmin.crearPlan({ nombre: nombrePlan, tipo: 'USUARIO', categoria: 'PLAN', precio: 4990, duracionDias: 30, beneficios: ['Actividades sin límite', 'Filtros avanzados'], descripcion: 'Plan de la prueba' });
  const conv = await app.planesAdmin.crearPlan({ nombre: nombreConv, tipo: 'USUARIO', categoria: 'CONVENIO', precio: 2990, duracionDias: 90, beneficios: ['Cupos para estudiantes'] });
  check('crear un plan y un convenio (la institución no se pide en la app)', plan.activo && conv.categoria === 'CONVENIO');
  const dupP = await falla(app.planesAdmin.crearPlan({ nombre: nombrePlan.toUpperCase(), tipo: 'USUARIO', categoria: 'PLAN', precio: 100, duracionDias: 10, beneficios: [] }));
  check('nombre duplicado entre activos -> 409', dupP && dupP.status === 409, dupP && dupP.message);
  const lista = await app.planesAdmin.listarPlanesAdmin('todos', 1, 50);
  check('el listado de admin incluye activos con sus suscripciones vigentes', lista.planes.some((p) => p.id === plan.id && p.suscripcionesVigentes === 0) && lista.total >= 3);

  auth.token = CTX.a.token;                      // ahora quien mira es un deportista
  await app.planes.cargarPlanes('deportista');
  let planes = app.planes.usePlanes();
  const porBackend = (id) => planes.find((p) => p.backendId === id);
  const verPlan = porBackend(plan.id), verConv = porBackend(conv.id);
  check('el catálogo conserva el diseño: solo Gratuito, Pro y Club, con la tabla comparativa',
    planes.map((p) => p.id).join() === 'gratuito,pro,club' && planes.find((p) => p.id === 'pro').nombre === 'Pro' && app.planes.FILAS_COMPARATIVA.length === 8);
  check('los datos reales de un plan activo van por debajo del diseño, sin ids fijos',
    planes.some((p) => p.backendId !== undefined && p.precioMensual > 0 && p.beneficios !== undefined), planes.map((p) => `${p.id}:${p.backendId}`).join());
  check('un convenio del backend no agrega columnas ni cambia el diseño', !verConv && planes.length === 3);
  check('"Gratuito" del diseño sigue visible y no se contrata', planes.find((p) => p.id === 'gratuito').precioMensual === 0
    && !app.planes.planesParaContratar('deportista', planes).some((p) => p.id === 'gratuito'));

  auth.token = CTX.admin.token;
  await app.planesAdmin.editarPlan(plan.id, { precio: 5990 });
  await app.planesAdmin.desactivarPlan(conv.id, 'Fin del convenio de la prueba');
  auth.token = CTX.a.token;
  await app.planes.cargarPlanes('deportista');
  planes = app.planes.usePlanes();
  check('un convenio desactivado no está en el catálogo', !porBackend(conv.id));
  const todos = await (async () => { auth.token = CTX.admin.token; return app.planesAdmin.listarPlanesAdmin('inactivo', 1, 50); })();
  check('el convenio desactivado sigue en el listado de admin (borrado lógico)', todos.planes.some((p) => p.id === conv.id && !p.activo));
  check('no se puede contratar un plan que no está en el catálogo (el botón no existe)', !app.planes.planesParaContratar('deportista', planes).some((p) => p.backendId === conv.id));

  console.log('== Si la API falla, la pantalla muestra su error de siempre');
  const caida = crearApp('http://127.0.0.1:9/api/v1');                 // puerto cerrado: sin conexión
  caida.auth.token = CTX.a.token;
  const eCarga = await falla(caida.planes.cargarPlanes('deportista'));
  const diseno = caida.planes.usePlanes();
  check('sin conexión: cargarPlanes falla con un mensaje y el diseño queda sin datos del backend', eCarga && /conectar/i.test(eCarga.message)
    && diseno.length === 3 && diseno.every((p) => p.backendId === undefined), eCarga && eCarga.message);

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\nRESUMEN: ${resultados.length - fallos.length} PASS, ${fallos.length} FAIL`);
  for (const f of fallos) console.log(`  FAIL: ${f.nombre}`);
  process.exitCode = fallos.length ? 1 : 0;
})().catch((e) => { console.error('ERROR del recorrido:', e.message); process.exitCode = 2; });
