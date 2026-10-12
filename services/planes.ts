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

/** En la versión simulada, tu plan siempre es el Gratuito. */
export const PLAN_ACTUAL_DEMO: PlanId = 'gratuito';

/** Pesos chilenos con punto de miles, sin depender del idioma del teléfono: 4990 → "$4.990". */
export function formatearCLP(monto: number): string {
  return `$${String(Math.round(monto)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function precioTexto(plan: Plan): string {
  return plan.precioMensual === 0 ? 'Gratis' : `${formatearCLP(plan.precioMensual)} / mes`;
}

export function nombreDelPlan(id: PlanId): string {
  return PLANES.find((p) => p.id === id)?.nombre ?? 'Gratuito';
}