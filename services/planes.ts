import { useSyncExternalStore } from 'react';

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

/** En la versión simulada, el deportista parte con el plan Gratuito y el club, sin plan. */
export const PLAN_ACTUAL_DEMO: PlanId = 'gratuito';

export type CuentaPlan = 'deportista' | 'club';
export type ResultadoPlan = { ok: true } | { ok: false; motivo: string };

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
export function planesParaContratar(cuenta: CuentaPlan): Plan[] {
  return PLANES.filter((p) => p.paraCuenta === cuenta && p.precioMensual > 0);
}

/** Lo que incluye un plan, tomado de la tabla comparativa: lo que no es "—". */
export function beneficiosDe(id: PlanId): string[] {
  return FILAS_COMPARATIVA
    .filter((f) => f[id] !== false)
    .map((f) => (f[id] === true ? f.etiqueta : `${f.etiqueta}: ${f[id]}`));
}

// ---------- plan contratado (en memoria, como el resto de la versión simulada) ----------
type EstadoPlanes = Record<CuentaPlan, PlanId | null>;
const INICIAL: EstadoPlanes = { deportista: PLAN_ACTUAL_DEMO, club: null };
let estado: EstadoPlanes = INICIAL;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };

export const getPlanActual = (cuenta: CuentaPlan): PlanId | null => estado[cuenta];

/** Plan vigente de la cuenta; se actualiza solo cuando contratas uno nuevo. */
export function usePlanActual(cuenta: CuentaPlan): PlanId | null {
  return useSyncExternalStore(suscribir, () => estado[cuenta], () => estado[cuenta]);
}

/**
 * Contrata un plan (HU-42). SOLO DEMO: no hay cobro ni pasarela; el plan queda activo al instante.
 * El pago real con Webpay Plus llega en el Sprint 7 (HU-43 y HU-53).
 */
export function contratarPlan(cuenta: CuentaPlan, id: PlanId): ResultadoPlan {
  const plan = PLANES.find((p) => p.id === id);
  if (!plan) return { ok: false, motivo: 'No encontramos ese plan.' };
  if (plan.paraCuenta !== cuenta) {
    return { ok: false, motivo: `El plan ${plan.nombre} es para cuentas de ${plan.paraCuenta === 'club' ? 'club' : 'deportista'}.` };
  }
  if (plan.precioMensual === 0) return { ok: false, motivo: 'El plan Gratuito ya está incluido; no necesitas contratarlo.' };
  if (estado[cuenta] === id) return { ok: false, motivo: `Ya tienes el plan ${plan.nombre}.` };
  estado = { ...estado, [cuenta]: id };
  emitir();
  return { ok: true };
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarPlanes() {
  estado = INICIAL;
  emitir();
}