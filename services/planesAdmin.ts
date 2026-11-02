import { ApiError, apiRequest } from './api';
import { getToken } from './auth';

// HU-56: gestión de planes y convenios (solo administradores de la plataforma). Ms-club los guarda y el gateway
// los publica en /payments/admin/plans. Distinto del catálogo público de services/planes.ts.

export type TipoPlan = 'USUARIO' | 'CLUB';
/** Un convenio es un plan acordado con una institución o un club; se compra igual que un plan. */
export type CategoriaPlan = 'PLAN' | 'CONVENIO';
export type EstadoPlanFiltro = 'activo' | 'inactivo' | 'todos';

/** Mismos límites que valida ms-club. */
export const NOMBRE_MIN = 3;
export const NOMBRE_MAX = 60;
export const DESCRIPCION_MAX = 255;
export const INSTITUCION_MIN = 3;
export const INSTITUCION_MAX = 80;
export const PRECIO_MAX = 10_000_000;
export const DURACION_MIN = 1;
export const DURACION_MAX = 366;
export const BENEFICIOS_MAX = 10;
export const BENEFICIO_MIN = 3;
export const BENEFICIO_MAX = 120;
export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 300;

export type PlanAdmin = {
  id: number;
  nombre: string;
  tipo: TipoPlan;
  categoria: CategoriaPlan;
  descripcion: string | null;
  /** Solo un convenio la tiene: con quién se firmó. */
  institucion: string | null;
  /** Pesos chilenos enteros. 0 = gratuito (no se paga con Webpay). */
  precio: number;
  duracionDias: number;
  beneficios: string[];
  activo: boolean;
  /** Suscripciones cuya vigencia no termina y cuyo último pago fue de este plan. */
  suscripcionesVigentes: number;
};

export type PaginaPlanes = { planes: PlanAdmin[]; pagina: number; limit: number; total: number };

type PlanApi = {
  id: number; nombre: string; tipo: TipoPlan; categoria: CategoriaPlan; descripcion: string | null; precio: number;
  duracion_dias: number; beneficios: string[]; institucion?: string | null; is_active: boolean; suscripciones_vigentes: number;
};

export type DatosPlan = {
  nombre: string;
  tipo: TipoPlan;
  categoria: CategoriaPlan;
  descripcion?: string | null;
  /** Solo para un convenio (opcional). */
  institucion?: string | null;
  precio: number;
  duracionDias: number;
  beneficios: string[];
  motivo?: string;
};

async function sesion(): Promise<string> {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return token;
}

const aPlan = (p: PlanApi): PlanAdmin => ({
  id: p.id, nombre: p.nombre, tipo: p.tipo, categoria: p.categoria, descripcion: p.descripcion, institucion: p.institucion ?? null, precio: p.precio,
  duracionDias: p.duracion_dias, beneficios: p.beneficios, activo: p.is_active, suscripcionesVigentes: p.suscripciones_vigentes,
});

/** Pesos con punto de miles: 4990 → "$4.990" (0 → "Gratis"). */
export function formatearPrecio(precio: number): string {
  return precio === 0 ? 'Gratis' : `$${String(precio).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "uno, otro" → ["uno", "otro"] (sin vacíos). */
export const separarBeneficios = (texto: string): string[] =>
  texto.split(/[,\n]/).map((b) => b.trim()).filter((b) => b.length > 0);

/** Valida antes de enviar, con las mismas reglas que ms-club. Devuelve el problema o null. */
export function validarPlan(datos: Pick<DatosPlan, 'nombre' | 'precio' | 'duracionDias' | 'beneficios' | 'descripcion' | 'motivo'> & { institucion?: string | null }): string | null {
  const nombre = datos.nombre.trim();
  if (nombre.length < NOMBRE_MIN || nombre.length > NOMBRE_MAX) return `El nombre debe tener de ${NOMBRE_MIN} a ${NOMBRE_MAX} caracteres.`;
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'&()/:+%-]*$/.test(nombre)) return 'El nombre tiene caracteres no permitidos.';
  if (!Number.isInteger(datos.precio) || datos.precio < 0 || datos.precio > PRECIO_MAX) {
    return `El precio es un número entero de pesos, de 0 a ${formatearPrecio(PRECIO_MAX)}.`;
  }
  if (!Number.isInteger(datos.duracionDias) || datos.duracionDias < DURACION_MIN || datos.duracionDias > DURACION_MAX) {
    return `La duración debe ser de ${DURACION_MIN} a ${DURACION_MAX} días.`;
  }
  if ((datos.descripcion ?? '').length > DESCRIPCION_MAX) return `La descripción admite hasta ${DESCRIPCION_MAX} caracteres.`;
  const institucion = (datos.institucion ?? '').trim();
  if (institucion) {
    if (institucion.length < INSTITUCION_MIN || institucion.length > INSTITUCION_MAX) return `La institución debe tener de ${INSTITUCION_MIN} a ${INSTITUCION_MAX} caracteres.`;
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'&()/:+%-]*$/.test(institucion)) return 'La institución tiene caracteres no permitidos.';
  }
  if (datos.beneficios.length > BENEFICIOS_MAX) return `Puedes poner hasta ${BENEFICIOS_MAX} beneficios.`;
  if (datos.beneficios.some((b) => b.length < BENEFICIO_MIN || b.length > BENEFICIO_MAX)) {
    return `Cada beneficio debe tener de ${BENEFICIO_MIN} a ${BENEFICIO_MAX} caracteres.`;
  }
  const motivo = (datos.motivo ?? '').trim();
  if (motivo && (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX)) return `El motivo debe tener de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres.`;
  return null;
}

/** Activos e inactivos, el más reciente primero. */
export async function listarPlanesAdmin(estado: EstadoPlanFiltro = 'todos', pagina = 1, limit = 20): Promise<PaginaPlanes> {
  const params = new URLSearchParams({ estado, pagina: String(pagina), limit: String(limit) });
  const r = await apiRequest<{ items: PlanApi[]; pagina: number; limit: number; total: number }>(
    `/payments/admin/plans?${params.toString()}`, { token: await sesion() });
  return { planes: r.items.map(aPlan), pagina: r.pagina, limit: r.limit, total: r.total };
}

export async function crearPlan(datos: DatosPlan): Promise<PlanAdmin> {
  const problema = validarPlan(datos);
  if (problema) throw new Error(problema);
  if (datos.institucion?.trim() && datos.categoria !== 'CONVENIO') throw new Error('Solo un convenio tiene institución.');
  const body: Record<string, unknown> = {
    nombre: datos.nombre.trim(), tipo: datos.tipo, categoria: datos.categoria, precio: datos.precio,
    duracion_dias: datos.duracionDias, beneficios: datos.beneficios,
  };
  if (datos.descripcion?.trim()) body.descripcion = datos.descripcion.trim();
  if (datos.institucion?.trim()) body.institucion = datos.institucion.trim();
  if (datos.motivo?.trim()) body.motivo = datos.motivo.trim();
  return aPlan(await apiRequest<PlanApi>('/payments/admin/plans', { method: 'POST', token: await sesion(), body }));
}

/** Solo cambia lo que se envía. El tipo y la categoría no se editan. Un cambio de precio no afecta lo ya pagado. */
export async function editarPlan(id: number, datos: Partial<Omit<DatosPlan, 'tipo' | 'categoria'>>): Promise<PlanAdmin> {
  const body: Record<string, unknown> = {};
  if (datos.nombre !== undefined) body.nombre = datos.nombre.trim();
  if (datos.descripcion !== undefined) body.descripcion = datos.descripcion?.trim() || null;
  if (datos.precio !== undefined) body.precio = datos.precio;
  if (datos.duracionDias !== undefined) body.duracion_dias = datos.duracionDias;
  if (datos.beneficios !== undefined) body.beneficios = datos.beneficios;
  if (datos.institucion !== undefined) body.institucion = datos.institucion?.trim() || null;
  if (datos.motivo?.trim()) body.motivo = datos.motivo.trim();
  const problema = validarPlan({
    nombre: datos.nombre ?? 'Plan válido', precio: datos.precio ?? 0, duracionDias: datos.duracionDias ?? DURACION_MIN,
    beneficios: datos.beneficios ?? [], descripcion: datos.descripcion, institucion: datos.institucion, motivo: datos.motivo,
  });
  if (problema) throw new Error(problema);
  return aPlan(await apiRequest<PlanApi>(`/payments/admin/plans/${encodeURIComponent(String(id))}`, {
    method: 'PATCH', token: await sesion(), body,
  }));
}

/** Borrado lógico: deja de mostrarse y de poder contratarse; las suscripciones vigentes siguen hasta su término. */
export async function desactivarPlan(id: number, motivo?: string): Promise<PlanAdmin> {
  const texto = (motivo ?? '').trim();
  if (texto && (texto.length < MOTIVO_MIN || texto.length > MOTIVO_MAX)) {
    throw new Error(`El motivo debe tener de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres.`);
  }
  return aPlan(await apiRequest<PlanApi>(`/payments/admin/plans/${encodeURIComponent(String(id))}/deactivate`, {
    method: 'POST', token: await sesion(), body: texto ? { motivo: texto } : {},
  }));
}
