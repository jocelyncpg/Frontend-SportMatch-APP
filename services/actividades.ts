import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getSession, getToken, type DeporteConNivel } from './auth';
import { normalizar } from './comunas';
import { codigoDeporte, nombreDeporte } from './deportes';

// Actividades de Ms_Activities (vía gateway) con la forma que usan las pantallas del sprint 2.
// Lo que el backend todavía no guarda como campo propio (comuna, nivel mínimo y requisitos)
// viaja dentro de `location` y `description` en un formato legible; ver aBackend()/desdeBackend().
// Retirarse aún no tiene endpoint: devuelve un motivo en vez de simularlo.

/** Marca de la sesión actual: las actividades que organizas usan este id como organizadorId. */
export const YO = 'yo';

export type EstadoActividad = 'abierta' | 'llena' | 'vencida' | 'cancelada';
export type EstadoPostulacion = 'pendiente' | 'aprobada' | 'rechazada';
export type MiRelacion = 'organizador' | EstadoPostulacion | null;
export type Resultado = { ok: true } | { ok: false; motivo: string };
export type Postulante = { id: string; nombre: string; estado: EstadoPostulacion; mensaje: string };

export type Actividad = {
  id: string;
  titulo: string;
  deporte: string;
  /** Nivel mínimo para postular (1 a 5). null = sin requisito de nivel. */
  nivelMinimo: number | null;
  /** Inicio, en milisegundos. */
  fecha: number;
  lugar: string;
  comuna: string;
  /** null = sin límite (actividades creadas antes de que existieran los cupos). */
  cupos: number | null;
  /** Cupos ya tomados según el servidor (postulaciones aceptadas). */
  cuposOcupados: number;
  descripcion: string;
  /** Requisitos previos que el organizador pide para postular (texto libre). */
  requisitos: string;
  organizadorId: string;
  organizadorNombre: string;
  cancelada: boolean;
  /** Tu postulación (clave YO) o, si organizas, las de cada postulante (id de usuario → estado). */
  postulaciones: Record<string, EstadoPostulacion>;
  /** Solo lo escribes tú: el backend aún no guarda el mensaje de la postulación. */
  mensajes: Record<string, string>;
  /** Postulantes que ve quien organiza, con el id de su postulación para aceptar o rechazar. */
  postulantesRecibidos: (Postulante & { postulacionId: string })[];
};

export type FiltrosActividades = {
  deporte: string | null;
  fecha: 'todas' | 'hoy' | 'manana' | 'semana';
  comuna: string | null;
};

export const FILTROS_ACTIVIDADES_VACIOS: FiltrosActividades = { deporte: null, fecha: 'todas', comuna: null };
export type DatosActividad = {
  titulo: string; deporte: string; nivelMinimo: number | null; fecha: number; lugar: string; comuna: string;
  cupos: number; descripcion: string; requisitos: string;
};
export type ResultadoCrear = { ok: true; id: string } | { ok: false; motivo: string };
export type CambioActividad = 'horario' | 'lugar' | 'cancelada';
/** Aviso para quien participa (o postuló) cuando el organizador cambia o cancela la actividad (HU-37). */
export type AvisoActividad = { id: string; actividadId: string; cambio: CambioActividad; titulo: string; detalle: string; ts: number };
export type EstadoCarga = { cargando: boolean; error: string | null; sesionExpirada: boolean };

export const NOMBRES_NIVEL: Record<number, string> = { 1: 'Principiante', 2: 'Básico', 3: 'Intermedio', 4: 'Avanzado', 5: 'Experto' };

const NO_DISPONIBLE = 'Esta opción todavía no está disponible en el servidor.';

const DEPORTE_VISUAL: Record<string, { icon: string; colorBg: string }> = {
  Running: { icon: '🏃', colorBg: '#1B3324' },
  Fútbol: { icon: '⚽', colorBg: '#1B2144' },
  Yoga: { icon: '🧘', colorBg: '#2B1B44' },
  Ciclismo: { icon: '🚴', colorBg: '#1B2A2E' },
  Natación: { icon: '🏊', colorBg: '#1B2440' },
  Tenis: { icon: '🎾', colorBg: '#2E2A1B' },
  Trekking: { icon: '🥾', colorBg: '#2A2A1B' },
  Box: { icon: '🥊', colorBg: '#2A1B1E' },
};
export const DEPORTES_ACTIVIDAD: string[] = Object.keys(DEPORTE_VISUAL);

export function visualDeporte(deporte: string) {
  return DEPORTE_VISUAL[deporte] ?? { icon: '🏅', colorBg: '#1B2A2A' };
}

// ---------- fechas ----------
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_MS = 86400000;
const dos = (n: number) => String(n).padStart(2, '0');

export function inicioDelDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** Cuántos días calendario faltan desde `ahora` hasta `ms` (0 = hoy, 1 = mañana, negativo = pasado). */
function diasDe(ms: number, ahora: number): number {
  return Math.round((inicioDelDia(ms) - inicioDelDia(ahora)) / DIA_MS);
}

export function formatearCuando(ms: number, ahora: number = Date.now()): string {
  const d = new Date(ms);
  const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
  const dias = diasDe(ms, ahora);
  if (dias === 0) return `Hoy, ${hora}`;
  if (dias === 1) return `Mañana, ${hora}`;
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getDate()} ${MESES[d.getMonth()]}, ${hora}`;
}

export function formatearDia(ms: number, ahora: number = Date.now()): string {
  const dias = diasDe(ms, ahora);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  const d = new Date(ms);
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function formatearHora(minutos: number): string {
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}
/** Los próximos `n` días, como inicio de cada día. */
export function opcionesDias(ahora: number = Date.now(), n = 14): number[] {
  return Array.from({ length: n }, (_, i) => inicioDelDia(inicioDelDia(ahora) + i * DIA_MS + DIA_MS / 2));
}
/** Horarios disponibles al crear una actividad: de 06:00 a 22:00, cada 30 minutos (en minutos desde medianoche). */
export const HORARIOS: number[] = Array.from({ length: 33 }, (_, i) => 360 + i * 30);
export function combinarFecha(diaMs: number, minutos: number): number {
  const d = new Date(diaMs);
  d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return d.getTime();
}
export function minutosDelDia(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

// ---------- reglas ----------
/** Estado calculado al momento de mirar: se cancela, vence o se llena solo (HU-29). */
export function estadoActividad(a: Actividad, ahora: number = Date.now()): EstadoActividad {
  if (a.cancelada) return 'cancelada';
  if (a.fecha < ahora) return 'vencida';
  if (a.cupos !== null && cuposTomados(a) >= a.cupos) return 'llena';
  return 'abierta';
}

export function cuposTomados(a: Actividad): number {
  return a.cuposOcupados;
}
export function cuposLibres(a: Actividad): number {
  return a.cupos === null ? Number.POSITIVE_INFINITY : Math.max(0, a.cupos - cuposTomados(a));
}

export function relacionConActividad(a: Actividad): MiRelacion {
  if (a.organizadorId === YO) return 'organizador';
  return a.postulaciones[YO] ?? null;
}

export function nivelDeUsuario(deportes: DeporteConNivel[] | undefined, deporte: string): number | null {
  const d = (deportes ?? []).find((x) => x.nombre.toLowerCase() === deporte.toLowerCase());
  return d ? d.nivel : null;
}

/** Revisa todas las condiciones para postular y explica por qué no se puede (HU-26). */
export function puedePostular(a: Actividad, misDeportes: DeporteConNivel[] | undefined, ahora: number = Date.now()): Resultado {
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad fue cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  if (a.organizadorId === YO) return { ok: false, motivo: 'Eres quien organiza esta actividad.' };
  if (a.postulaciones[YO]) return { ok: false, motivo: 'Ya postulaste a esta actividad.' };
  if (estado === 'llena') return { ok: false, motivo: 'Ya no quedan cupos disponibles.' };
  if (a.nivelMinimo !== null) {
    const nivel = nivelDeUsuario(misDeportes, a.deporte);
    const pedido = NOMBRES_NIVEL[a.nivelMinimo];
    if (nivel === null) return { ok: false, motivo: `Pide nivel ${pedido} o más en ${a.deporte}. Agrega ese deporte a tu perfil para postular.` };
    if (nivel < a.nivelMinimo) return { ok: false, motivo: `Pide nivel ${pedido} o más en ${a.deporte}; el tuyo es ${NOMBRES_NIVEL[nivel]}.` };
  }
  return { ok: true };
}

export function filtrarActividades(lista: Actividad[], f: FiltrosActividades, ahora: number = Date.now()): Actividad[] {
  return lista
    .filter((a) => estadoActividad(a, ahora) === 'abierta') // solo las abiertas a postulación (HU-25)
    .filter((a) => !f.deporte || a.deporte === f.deporte)
    .filter((a) => !f.comuna || a.comuna === f.comuna)
    .filter((a) => {
      const dias = diasDe(a.fecha, ahora);
      if (f.fecha === 'hoy') return dias === 0;
      if (f.fecha === 'manana') return dias === 1;
      if (f.fecha === 'semana') return dias >= 0 && dias < 7;
      return true;
    })
    .sort((x, y) => x.fecha - y.fecha);
}

export function comunasDisponibles(lista: Actividad[], ahora: number = Date.now()): string[] {
  // Orden alfabético sin depender del idioma del teléfono: "Ñuñoa" queda entre "Maipú" y "Providencia".
  const comunas = lista.filter((a) => estadoActividad(a, ahora) === 'abierta' && a.comuna).map((a) => a.comuna);
  return [...new Set(comunas)].sort((a, b) => {
    const x = normalizar(a), y = normalizar(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

// ---------- reglas del organizador (HU-23, HU-26, HU-28) ----------
export function validarActividad(d: DatosActividad, ahora: number = Date.now(), minCupos = 0): Resultado {
  if (d.titulo.trim().length < 3) return { ok: false, motivo: 'Escribe un título de al menos 3 letras.' };
  if (!d.deporte) return { ok: false, motivo: 'Elige un deporte.' };
  if (d.lugar.trim().length < 3) return { ok: false, motivo: 'Indica el lugar donde será (al menos 3 letras).' };
  if (!d.comuna.trim()) return { ok: false, motivo: 'Indica la comuna.' };
  if (!Number.isInteger(d.cupos) || d.cupos < 2 || d.cupos > 50) return { ok: false, motivo: 'Los cupos deben ser un número entre 2 y 50.' };
  if (d.cupos < minCupos) return { ok: false, motivo: `Ya hay ${minCupos} personas aprobadas; no puedes dejar menos cupos.` };
  if (d.nivelMinimo !== null && !NOMBRES_NIVEL[d.nivelMinimo]) return { ok: false, motivo: 'El nivel mínimo no es válido.' };
  if (d.fecha <= ahora) return { ok: false, motivo: 'La fecha y la hora deben ser futuras.' };
  return { ok: true };
}

function limpiar(d: DatosActividad): DatosActividad {
  return { ...d, titulo: d.titulo.trim(), lugar: d.lugar.trim(), comuna: d.comuna.trim(), descripcion: d.descripcion.trim(), requisitos: d.requisitos.trim() };
}

/** Lista de postulantes (sin contarte a ti), con las pendientes primero. */
export function postulantes(a: Actividad): Postulante[] {
  const orden: Record<EstadoPostulacion, number> = { pendiente: 0, aprobada: 1, rechazada: 2 };
  return a.postulantesRecibidos
    .map(({ postulacionId: _id, ...p }) => p)
    .sort((x, y) => orden[x.estado] - orden[y.estado] || x.nombre.localeCompare(y.nombre));
}
export function pendientesDe(a: Actividad): number {
  return a.postulantesRecibidos.filter((p) => p.estado === 'pendiente').length;
}

// ---------- contrato HTTP ----------
type DeportistaApi = { user_id: string; nombre: string; apellido_inicial: string; foto_perfil: string | null };
type ActividadApi = {
  id: string; title: string; sport_code: string; description: string; starts_at: string; location: string;
  created_at: string; capacity: number | null; available_spots: number | null; organizer: DeportistaApi;
  cancelled_at?: string | null;
};
type PaginaApi = { items: ActividadApi[]; next_cursor: string | null };
type EstadoApi = 'pending' | 'accepted' | 'rejected';
type PostulacionApi = { id: string; activity_id: string; status: EstadoApi; created_at: string; decided_at: string | null };
type PostulacionRecibidaApi = PostulacionApi & { applicant: DeportistaApi };

const ESTADOS: Record<EstadoApi, EstadoPostulacion> = { pending: 'pendiente', accepted: 'aprobada', rejected: 'rechazada' };
const SEPARADOR_COMUNA = ' · ';
const PREFIJO_REQUISITOS = 'Requisitos: ';
const PATRON_NIVEL = /^Nivel mínimo: .* \(([1-5])\/5\)$/;

/** Lo que va al servidor. Comuna, nivel y requisitos se incluyen como texto hasta que tengan campo propio. */
function aBackend(d: DatosActividad) {
  const extras = [
    d.requisitos ? `${PREFIJO_REQUISITOS}${d.requisitos}` : '',
    d.nivelMinimo !== null ? `Nivel mínimo: ${NOMBRES_NIVEL[d.nivelMinimo]} (${d.nivelMinimo}/5)` : '',
  ].filter(Boolean);
  return {
    title: d.titulo,
    sport_code: codigoDeporte(d.deporte),
    description: [d.descripcion, extras.join('\n')].filter(Boolean).join('\n\n'),
    starts_at: new Date(d.fecha).toISOString(),
    location: `${d.lugar}${SEPARADOR_COMUNA}${d.comuna}`,
    capacity: d.cupos,
  };
}

/** Recupera comuna, nivel y requisitos del texto. Una actividad creada sin ellos los deja vacíos. */
function desdeBackend(a: ActividadApi, miId: string): Actividad {
  const corte = a.location.lastIndexOf(SEPARADOR_COMUNA);
  const lineas = a.description.split('\n');
  let nivelMinimo: number | null = null;
  let requisitos = '';
  for (let fin = lineas.length - 1; fin >= 0; fin--) {
    const linea = lineas[fin];
    const nivel = PATRON_NIVEL.exec(linea);
    if (nivel && nivelMinimo === null) nivelMinimo = Number(nivel[1]);
    else if (linea.startsWith(PREFIJO_REQUISITOS) && !requisitos) requisitos = linea.slice(PREFIJO_REQUISITOS.length);
    else break;
    lineas.pop();
  }
  const organiza = a.organizer.user_id === miId;
  return {
    id: a.id,
    titulo: a.title,
    deporte: nombreDeporte(a.sport_code),
    nivelMinimo,
    fecha: Date.parse(a.starts_at),
    lugar: corte >= 0 ? a.location.slice(0, corte) : a.location,
    comuna: corte >= 0 ? a.location.slice(corte + SEPARADOR_COMUNA.length) : '',
    cupos: a.capacity,
    cuposOcupados: a.capacity === null || a.available_spots === null ? 0 : a.capacity - a.available_spots,
    descripcion: lineas.join('\n').trim(),
    requisitos,
    organizadorId: organiza ? YO : a.organizer.user_id,
    organizadorNombre: organiza ? 'Tú' : `${a.organizer.nombre} ${a.organizer.apellido_inicial}`,
    cancelada: !!a.cancelled_at,
    postulaciones: {},
    mensajes: mensajesPropios[a.id] ? { [YO]: mensajesPropios[a.id] } : {},
    postulantesRecibidos: [],
  };
}

async function credenciales() {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) throw new ApiError('Inicia sesión para ver actividades.', 401, '');
  return { session, token };
}

async function mismaSesion(id: string, token: string) {
  const [actual, tokenActual] = await Promise.all([getSession(), getToken()]);
  return actual?.id === id && tokenActual === token;
}

/** Suma tu postulación, o las recibidas si organizas. */
async function conRelacion(a: Actividad, token: string): Promise<Actividad> {
  const ruta = `/activities/${encodeURIComponent(a.id)}/applications`;
  if (a.organizadorId === YO) {
    const recibidas = await apiRequest<PostulacionRecibidaApi[]>(ruta, { token });
    const lista = recibidas.map((p) => ({
      id: p.applicant.user_id, postulacionId: p.id, estado: ESTADOS[p.status], mensaje: '',
      nombre: `${p.applicant.nombre} ${p.applicant.apellido_inicial}`,
    }));
    return { ...a, postulantesRecibidos: lista, postulaciones: Object.fromEntries(lista.map((p) => [p.id, p.estado])) };
  }
  try {
    const mia = await apiRequest<PostulacionApi>(`${ruta}/me`, { token });
    return { ...a, postulaciones: { [YO]: ESTADOS[mia.status] } };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return a;
    throw e;
  }
}

function mensajeDe(e: unknown, porDefecto: string) {
  return e instanceof Error && e.message ? e.message : porDefecto;
}

// ---------- almacén ----------
let actividades: Actividad[] = [];
let estadoCarga: EstadoCarga = { cargando: false, error: null, sesionExpirada: false };
let usuarioId: string | null = null;
let cargaActual = 0;
/** Mensaje que escribiste al postular, por actividad (solo en este teléfono). */
let mensajesPropios: Record<string, string> = {};
/** Reintento de publicación: el mismo contenido reutiliza el id para que el servidor no duplique. */
let ultimoIntento: { firma: string; id: string } | null = null;

const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
/** Lectura directa del estado actual (sin hook), igual que getEstado en matchStore. */
export const getActividades = () => actividades;
const getEstadoCarga = () => estadoCarga;

function reiniciarSiCambioLaCuenta(id: string) {
  if (usuarioId === id) return;
  usuarioId = id;
  actividades = [];
  mensajesPropios = {};
  avisos = [];
  ultimoIntento = null;
}

function guardar(a: Actividad) {
  const existe = actividades.some((x) => x.id === a.id);
  actividades = existe ? actividades.map((x) => (x.id === a.id ? a : x)) : [a, ...actividades];
  emitir();
}

/** Trae las próximas actividades y tu relación con cada una. */
export async function cargarActividades(): Promise<void> {
  const carga = ++cargaActual;
  try {
    const { session, token } = await credenciales();
    if (carga !== cargaActual) return;
    reiniciarSiCambioLaCuenta(session.id);
    estadoCarga = { cargando: true, error: null, sesionExpirada: false };
    emitir();
    const items: ActividadApi[] = [];
    let cursor: string | null = null;
    do {
      const pagina: PaginaApi = await apiRequest<PaginaApi>(
        `/activities?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token });
      items.push(...pagina.items);
      cursor = pagina.next_cursor;
    } while (cursor && items.length < 300);
    const lista = await Promise.all(items.map((a) => conRelacion(desdeBackend(a, session.id), token)));
    if (carga !== cargaActual) return;
    if (!await mismaSesion(session.id, token)) { actividades = []; estadoCarga = { ...estadoCarga, cargando: false }; emitir(); return; }
    // El listado ya no trae las canceladas; las que conocías se conservan para tu historial.
    const canceladas = actividades.filter((a) => a.cancelada && !lista.some((x) => x.id === a.id));
    actividades = [...lista, ...canceladas];
    estadoCarga = { cargando: false, error: null, sesionExpirada: false };
  } catch (e) {
    if (carga !== cargaActual) return;
    const sesionExpirada = e instanceof ApiError && e.status === 401;
    if (sesionExpirada) actividades = [];
    estadoCarga = { cargando: false, error: mensajeDe(e, 'No se pudieron cargar las actividades.'), sesionExpirada };
  }
  emitir();
}

/** Vuelve a pedir una actividad (por ejemplo, al abrir su detalle) y la actualiza en la lista. */
export async function cargarActividad(id: string): Promise<Resultado> {
  try {
    const { session, token } = await credenciales();
    reiniciarSiCambioLaCuenta(session.id);
    const a = await apiRequest<ActividadApi>(`/activities/${encodeURIComponent(id)}`, { token });
    const completa = await conRelacion(desdeBackend(a, session.id), token);
    if (!await mismaSesion(session.id, token)) return { ok: false, motivo: 'La sesión cambió. Vuelve a iniciar sesión.' };
    guardar(completa);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      actividades = actividades.filter((x) => x.id !== id);
      emitir();
    }
    return { ok: false, motivo: mensajeDe(e, 'Actividad no disponible.') };
  }
}

/** Envía la postulación si se cumplen todas las condiciones (HU-26). */
export async function postular(id: string, mensaje: string, misDeportes: DeporteConNivel[] | undefined, ahora: number = Date.now()): Promise<Resultado> {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  const verificacion = puedePostular(a, misDeportes, ahora);
  if (!verificacion.ok) return verificacion;
  try {
    const { token } = await credenciales();
    await apiRequest<PostulacionApi>(`/activities/${encodeURIComponent(id)}/applications`, { method: 'POST', token });
    if (mensaje.trim()) mensajesPropios = { ...mensajesPropios, [id]: mensaje.trim() };
  } catch (e) {
    void cargarActividad(id);
    return { ok: false, motivo: mensajeDe(e, 'No se pudo enviar la postulación.') };
  }
  await cargarActividad(id);
  return { ok: true };
}

/** Aprueba o rechaza una postulación pendiente; aprobar usa un cupo (HU-26). */
export async function responderPostulacion(id: string, personaId: string, decision: 'aprobada' | 'rechazada', ahora: number = Date.now()): Promise<Resultado> {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  if (a.organizadorId !== YO) return { ok: false, motivo: 'Solo quien organiza puede responder postulaciones.' };
  const estado = estadoActividad(a, ahora);
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  const postulante = a.postulantesRecibidos.find((p) => p.id === personaId);
  if (!postulante || postulante.estado !== 'pendiente') return { ok: false, motivo: 'Esa postulación ya fue respondida.' };
  if (decision === 'aprobada' && cuposLibres(a) === 0) return { ok: false, motivo: 'No quedan cupos para aprobar a más personas.' };
  const accion = decision === 'aprobada' ? 'accept' : 'reject';
  try {
    const { token } = await credenciales();
    await apiRequest<PostulacionApi>(
      `/activities/${encodeURIComponent(id)}/applications/${encodeURIComponent(postulante.postulacionId)}/${accion}`,
      { method: 'POST', token });
  } catch (e) {
    void cargarActividad(id);
    return { ok: false, motivo: mensajeDe(e, 'No se pudo responder la postulación.') };
  }
  await cargarActividad(id);
  return { ok: true };
}

/** Publica una actividad nueva, abierta a postulaciones (HU-23). */
export async function crearActividad(datos: DatosActividad, ahora: number = Date.now()): Promise<ResultadoCrear> {
  const v = validarActividad(datos, ahora);
  if (!v.ok) return v;
  const cuerpo = aBackend(limpiar(datos));
  const firma = JSON.stringify(cuerpo);
  if (ultimoIntento?.firma !== firma) ultimoIntento = { firma, id: Crypto.randomUUID() };
  try {
    const { session, token } = await credenciales();
    const creada = await apiRequest<ActividadApi>('/activities', {
      method: 'POST', token, body: { ...cuerpo, client_activity_id: ultimoIntento.id },
    });
    ultimoIntento = null;
    guardar(desdeBackend(creada, session.id));
    return { ok: true, id: creada.id };
  } catch (e) {
    return { ok: false, motivo: mensajeDe(e, 'No se pudo publicar la actividad.') };
  }
}

/** Revisa en este teléfono que la actividad sea tuya y siga vigente; el servidor vuelve a validarlo. */
function puedeGestionar(a: Actividad | undefined, accion: string, ahora: number): Resultado {
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  if (a.organizadorId !== YO) return { ok: false, motivo: `Solo quien organiza puede ${accion}.` };
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad fue cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  return { ok: true };
}

/** Cambia los datos de una actividad tuya que sigue vigente (HU-28). */
export async function editarActividad(id: string, datos: DatosActividad, ahora: number = Date.now()): Promise<Resultado> {
  const a = actividades.find((x) => x.id === id);
  const permitido = puedeGestionar(a, 'editarla', ahora);
  if (!permitido.ok) return permitido;
  const v = validarActividad(datos, ahora, cuposTomados(a!));
  if (!v.ok) return v;
  try {
    const { session, token } = await credenciales();
    const editada = await apiRequest<ActividadApi>(`/activities/${encodeURIComponent(id)}`, {
      method: 'PATCH', token, body: aBackend(limpiar(datos)),
    });
    guardar(await conRelacion(desdeBackend(editada, session.id), token));
    return { ok: true };
  } catch (e) {
    void cargarActividad(id);
    return { ok: false, motivo: mensajeDe(e, 'No se pudieron guardar los cambios.') };
  }
}

/** Elimina una actividad tuya que aún no se realiza: queda cancelada para quienes postularon (HU-28). */
export async function cancelarActividad(id: string, ahora: number = Date.now()): Promise<Resultado> {
  const a = actividades.find((x) => x.id === id);
  const permitido = puedeGestionar(a, 'cancelarla', ahora);
  if (!permitido.ok) return permitido;
  try {
    const { token } = await credenciales();
    await apiRequest<void>(`/activities/${encodeURIComponent(id)}`, { method: 'DELETE', token });
  } catch (e) {
    void cargarActividad(id);
    return { ok: false, motivo: mensajeDe(e, 'No se pudo cancelar la actividad.') };
  }
  await cargarActividad(id);
  return { ok: true };
}

/** Quita tu postulación o tu cupo (HU-28). Pendiente de endpoint en Ms_Activities. */
export function retirarse(_id: string): Resultado {
  return { ok: false, motivo: NO_DISPONIBLE };
}

// ---------- avisos (HU-37) ----------
// Aún no hay notificaciones en el backend: los avisos solo se generan con la demo de abajo.
let avisos: AvisoActividad[] = [];
export const getAvisos = () => avisos;
export function useAvisos(): AvisoActividad[] {
  return useSyncExternalStore(suscribir, getAvisos, getAvisos);
}

/**
 * SOLO DEMO: simula que quien organiza una actividad en la que participas cambia el horario,
 * cambia el lugar o la cancela, para ver la alerta (HU-37). Cambia solo la copia de este
 * teléfono; al recargar, manda el servidor. Sin `id` válido usa la primera en la que participas.
 */
export function simularCambioDelOrganizador(id: string, cambio: CambioActividad, ahora: number = Date.now()): Resultado {
  const participa = (x: Actividad) => ['aprobada', 'pendiente'].includes(relacionConActividad(x) ?? '');
  const a = actividades.find((x) => x.id === id && participa(x)) ?? actividades.find((x) => participa(x) && estadoActividad(x, ahora) !== 'vencida' && !x.cancelada);
  if (!a) return { ok: false, motivo: 'Postula a una actividad para probar los avisos.' };
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad ya estaba cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  const aviso = (titulo: string, detalle: string): AvisoActividad => ({ id: `av-${avisos.length + 1}`, actividadId: a.id, cambio, titulo, detalle, ts: ahora });
  if (cambio === 'horario') {
    const nueva = a.fecha + 60 * 60 * 1000;
    guardar({ ...a, fecha: nueva });
    avisos = [...avisos, aviso(`Cambió el horario de "${a.titulo}"`, `Ahora: ${formatearCuando(nueva, ahora)} (antes: ${formatearCuando(a.fecha, ahora)})`)];
  } else if (cambio === 'lugar') {
    const nuevo = `${a.lugar} (acceso sur)`;
    guardar({ ...a, lugar: nuevo });
    avisos = [...avisos, aviso(`Cambió el lugar de "${a.titulo}"`, `Nuevo lugar: ${nuevo}`)];
  } else {
    guardar({ ...a, cancelada: true });
    avisos = [...avisos, aviso(`Se canceló "${a.titulo}"`, `${a.organizadorNombre} canceló la actividad.`)];
  }
  emitir();
  return { ok: true };
}

/** Borra los avisos de la demo y vuelve a cargar desde el servidor. */
export function reiniciarActividades() {
  avisos = [];
  emitir();
  void cargarActividades();
}

export function useActividades(): Actividad[] {
  return useSyncExternalStore(suscribir, getActividades, getActividades);
}

/** Cargando, error y sesión vencida de la última carga de la lista. */
export function useEstadoActividades(): EstadoCarga {
  return useSyncExternalStore(suscribir, getEstadoCarga, getEstadoCarga);
}
