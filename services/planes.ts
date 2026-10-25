import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getToken } from './auth';

export type PlanId = 'gratuito' | 'pro' | 'club';

export type Plan = {
  id: PlanId;
  nombre: string;
  /** Frase corta que describe para quién es el plan. */
  resumen: string;
  /** Precio mensual en pesos chilenos (0 = gratis). */
  precioMensual: number;
  /** Plan que se resalta en la tabla. */
  destacado: boolean;
  /** Para qué tipo de cuenta está pensado. */
  paraCuenta: 'deportista' | 'club';
  /** Id del plan en Ms-club (/payments/plans). Sin él, el plan aún no se puede contratar. */
  backendId?: number;
};

/** Una fila de la tabla comparativa: true/false se muestran como ✓ / —, el texto se muestra tal cual. */
export type FilaComparativa = {
  etiqueta: string;
  gratuito: string | boolean;
  pro: string | boolean;
  club: string | boolean;
};

export const PLANES: Plan[] = [
  { id: 'gratuito', nombre: 'Gratuito', resumen: 'Para empezar a entrenar en comunidad', precioMensual: 0, destacado: false, paraCuenta: 'deportista' },
  { id: 'pro', nombre: 'Pro', resumen: 'Para deportistas que entrenan seguido', precioMensual: 4990, destacado: true, paraCuenta: 'deportista' },
  { id: 'club', nombre: 'Club', resumen: 'Para clubes, escuelas y comunidades', precioMensual: 19990, destacado: false, paraCuenta: 'club' },
];

export const FILAS_COMPARATIVA: FilaComparativa[] = [
  { etiqueta: 'Actividades que puedes organizar al mes', gratuito: '3', pro: 'Sin límite', club: 'Sin límite' },
  { etiqueta: 'Postulaciones activas a la vez', gratuito: '5', pro: 'Sin límite', club: 'Sin límite' },
  { etiqueta: 'Filtros de búsqueda', gratuito: 'Básicos', pro: 'Avanzados', club: 'Avanzados' },
  { etiqueta: 'Chat con tus matches', gratuito: true, pro: true, club: true },
  { etiqueta: 'Insignia de perfil destacado', gratuito: false, pro: true, club: true },
  { etiqueta: 'Panel web para el club', gratuito: false, pro: false, club: true },
  { etiqueta: 'Convocatorias y gestión de postulantes', gratuito: false, pro: false, club: true },
  { etiqueta: 'Estadísticas de postulaciones', gratuito: false, pro: false, club: true },
];

export type CuentaPlan = 'deportista' | 'club';
export type ResultadoPlan = { ok: true } | { ok: false; motivo: string; reintentar: boolean };

export type RetornoWebpay = {
  token_ws?: string;
  tbk_token?: string;
  tbk_orden_compra?: string;
  tbk_id_sesion?: string;
};

/** Extrae solo los parámetros admitidos en el retorno de la app. */
export function leerRetornoWebpay(url: string): RetornoWebpay | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'sportmatchapp:' || parsed.hostname !== 'pago') return null;
    const retorno: RetornoWebpay = {};
    for (const key of ['token_ws', 'tbk_token', 'tbk_orden_compra', 'tbk_id_sesion'] as const) {
      const value = parsed.searchParams.get(key);
      if (value) retorno[key] = value;
    }
    return Object.values(retorno).length ? retorno : null;
  } catch {
    return null;
  }
}

/** Clasifica el resultado y conserva la opción de reintento solo ante errores transitorios. */
export function evaluarResultadoPago(
  status: PagoConfirmadoApi['status'],
  error?: { status: number; detail?: string; message?: string },
): { ok: boolean; motivo?: string; reintentar: boolean } {
  if (status === 'APPROVED') return { ok: true, reintentar: false };
  if (status === 'REJECTED') return { ok: false, motivo: 'El pago fue rechazado por el banco simulado.', reintentar: false };
  if (status === 'CANCELLED') return { ok: false, motivo: 'El pago fue cancelado. No se realizó ningún cobro.', reintentar: false };
  if (error) {
    const detail = error.detail ?? error.message ?? '';
    if (/rechazad/i.test(detail)) return { ok: false, motivo: 'El pago fue rechazado por el banco simulado.', reintentar: false };
    if (/cancelad|anulad/i.test(detail)) return { ok: false, motivo: 'El pago fue cancelado. No se realizó ningún cobro.', reintentar: false };
    const reintentar = error.status === 0 || error.status >= 500;
    return {
      ok: false,
      motivo: reintentar ? 'No pudimos confirmar el pago por un problema de conexión. Puedes reintentar sin volver a pagar.' : detail || 'No pudimos confirmar el pago.',
      reintentar,
    };
  }
  return { ok: false, motivo: 'El pago no se completó. No se realizó ningún cobro.', reintentar: false };
}

/** Pesos chilenos con punto de miles, sin depender del idioma del teléfono: 4990 → "$4.990". */
export function formatearCLP(monto: number): string {
  return `$${String(Math.round(monto)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function precioTexto(plan: Plan): string {
  return plan.precioMensual === 0 ? 'Gratis' : `${formatearCLP(plan.precioMensual)} / mes`;
}

export function nombreDelPlan(id: PlanId | null): string {
  if (id === null) return 'Sin plan';
  return PLANES.find((p) => p.id === id)?.nombre ?? 'Gratuito';
}

/** Planes de pago que esta cuenta puede contratar (el Gratuito ya viene incluido). */
export function planesParaContratar(cuenta: CuentaPlan, planes: Plan[] = PLANES): Plan[] {
  return planes.filter((p) => p.paraCuenta === cuenta && p.precioMensual > 0);
}

/** Lo que incluye un plan, tomado de la tabla comparativa: lo que no es "—". */
export function beneficiosDe(id: PlanId): string[] {
  return FILAS_COMPARATIVA
    .filter((f) => f[id] !== false)
    .map((f) => (f[id] === true ? f.etiqueta : `${f.etiqueta}: ${f[id]}`));
}

// ---------- catálogo y plan vigente desde Ms-club (/payments) ----------

/** Plan de /payments/plans. USUARIO es el plan de pago del deportista (Pro); CLUB, el del club. */
type PlanApi = { id: number; nombre: string; tipo: 'USUARIO' | 'CLUB'; descripcion: string | null; precio: number; duracion_dias: number };
type SuscripcionApi = { estado: 'ACTIVE' | 'EXPIRED'; plan: PlanApi; fecha_fin: string };
type PagoIniciadoApi = { token_ws: string; url: string };
type PagoConfirmadoApi = { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; suscripcion: SuscripcionApi | null };

const ID_POR_TIPO: Record<PlanApi['tipo'], PlanId> = { USUARIO: 'pro', CLUB: 'club' };
const SIN_PLAN: Record<CuentaPlan, PlanId | null> = { deportista: 'gratuito', club: null };

type EstadoPlanes = { planes: Plan[]; actual: Record<CuentaPlan, PlanId | null>; fechaFin: Record<CuentaPlan, string | null> };
const SIN_FECHA: Record<CuentaPlan, string | null> = { deportista: null, club: null };
const INICIAL: EstadoPlanes = { planes: PLANES, actual: { ...SIN_PLAN }, fechaFin: { ...SIN_FECHA } };
let estado: EstadoPlanes = INICIAL;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };

export const getPlanActual = (cuenta: CuentaPlan): PlanId | null => estado.actual[cuenta];

/** Fecha de vencimiento informada por la suscripción activa del backend. */
export function useFechaFinPlan(cuenta: CuentaPlan): string | null {
  return useSyncExternalStore(suscribir, () => estado.fechaFin[cuenta], () => estado.fechaFin[cuenta]);
}

export function fechaVencimientoTexto(fecha: string): string {
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return fecha;
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

/** Plan vigente de la cuenta (según Ms-club); se actualiza al cargar o al confirmar un pago. */
export function usePlanActual(cuenta: CuentaPlan): PlanId | null {
  return useSyncExternalStore(suscribir, () => estado.actual[cuenta], () => estado.actual[cuenta]);
}

/** Los planes con el precio y el id reales de Ms-club, cuando ya se cargaron. */
export function usePlanes(): Plan[] {
  return useSyncExternalStore(suscribir, () => estado.planes, () => estado.planes);
}

function vigente(s: SuscripcionApi | null): PlanId | null {
  return s && s.estado === 'ACTIVE' ? ID_POR_TIPO[s.plan.tipo] ?? null : null;
}

function guardarSuscripcion(cuenta: CuentaPlan, suscripcion: SuscripcionApi | null) {
  const id = vigente(suscripcion) ?? SIN_PLAN[cuenta];
  const fechaFin = suscripcion?.estado === 'ACTIVE' ? suscripcion.fecha_fin : null;
  if (estado.actual[cuenta] === id && estado.fechaFin[cuenta] === fechaFin) return;
  estado = {
    ...estado,
    actual: { ...estado.actual, [cuenta]: id },
    fechaFin: { ...estado.fechaFin, [cuenta]: fechaFin },
  };
  emitir();
}

async function token(): Promise<string> {
  const t = await getToken();
  if (!t) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return t;
}

/** Trae el catálogo (público) y la suscripción de la cuenta. Un 404 de la suscripción = nunca contrató. */
export async function cargarPlanes(cuenta: CuentaPlan): Promise<void> {
  const lista = await apiRequest<PlanApi[]>(`/payments/plans?tipo=${cuenta === 'club' ? 'CLUB' : 'USUARIO'}`);
  // Si hubiera varios del mismo tipo, se usa el más barato (el catálogo de la app tiene uno por tipo).
  const porId = new Map<PlanId, PlanApi>();
  for (const p of [...lista].sort((a, b) => a.precio - b.precio)) {
    const id = ID_POR_TIPO[p.tipo];
    if (id && !porId.has(id)) porId.set(id, p);
  }
  estado = {
    ...estado,
    planes: estado.planes.map((p) => {
      const api = porId.get(p.id);
      return api ? { ...p, backendId: api.id, precioMensual: api.precio } : p;
    }),
  };
  emitir();
  try {
    guardarSuscripcion(cuenta, await apiRequest<SuscripcionApi>('/payments/subscription/me', { token: await token() }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) guardarSuscripcion(cuenta, null);
    else throw e;
  }
}

/**
 * Paso 1 del pago (HU-42/43): crea la transacción en Webpay Plus y devuelve la página de pago.
 * Webpay acepta el token_ws en la URL, así que basta con abrirla en el navegador.
 */
export async function iniciarPago(cuenta: CuentaPlan, plan: Plan): Promise<{ tokenWs: string; urlPago: string }> {
  if (plan.paraCuenta !== cuenta) {
    throw new Error(`El plan ${plan.nombre} es para cuentas de ${plan.paraCuenta === 'club' ? 'club' : 'deportista'}.`);
  }
  if (plan.precioMensual === 0) throw new Error('El plan Gratuito ya está incluido; no necesitas contratarlo.');
  if (estado.actual[cuenta] === plan.id) throw new Error(`Ya tienes el plan ${plan.nombre}.`);
  if (!plan.backendId) throw new Error('Este plan aún no está disponible para contratar. Intenta más tarde.');
  const r = await apiRequest<PagoIniciadoApi>('/payments/webpay/initiate', {
    method: 'POST', token: await token(), body: { plan_id: plan.backendId },
  });
  const separador = r.url.includes('?') ? '&' : '?';
  return { tokenWs: r.token_ws, urlPago: `${r.url}${separador}token_ws=${encodeURIComponent(r.token_ws)}` };
}

/** Paso 2: al volver de Webpay, confirma el pago. Solo un pago APPROVED deja el plan activo. */
export async function confirmarPago(cuenta: CuentaPlan, retorno: string | RetornoWebpay): Promise<ResultadoPlan> {
  try {
    const payload = typeof retorno === 'string' ? { token_ws: retorno } : retorno;
    const r = await apiRequest<PagoConfirmadoApi>('/payments/webpay/commit', {
      method: 'POST', token: await token(), body: payload,
    });
    const evaluacion = evaluarResultadoPago(r.status);
    if (!evaluacion.ok) return { ok: false, motivo: evaluacion.motivo!, reintentar: false };
    guardarSuscripcion(cuenta, r.suscripcion);
    return { ok: true };
  } catch (e) {
    const detail = e instanceof ApiError ? e.detail : '';
    if (/rechazad/i.test(detail)) return { ok: false, motivo: 'El pago fue rechazado por el banco simulado.', reintentar: false };
    if (/cancelad|anulad/i.test(detail)) return { ok: false, motivo: 'El pago fue cancelado. No se realizó ningún cobro.', reintentar: false };
    if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) {
      return { ok: false, motivo: 'No pudimos confirmar el pago por un problema de conexión. Puedes reintentar sin volver a pagar.', reintentar: true };
    }
    // Webpay rechazó o se anuló la compra: el backend responde 400 con el detalle.
    return { ok: false, motivo: e instanceof Error && e.message ? e.message : 'No pudimos confirmar el pago.', reintentar: false };
  }
}

/** Al cerrar sesión: el plan de otra cuenta no debe verse en la siguiente. */
export function reiniciarPlanes() {
  estado = { ...estado, actual: { ...SIN_PLAN }, fechaFin: { ...SIN_FECHA } };
  emitir();
}
