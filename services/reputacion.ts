import { ApiError, apiRequest } from './api';
import { getToken } from './auth';

// Tipos y utilidades de la reputación del deportista (calificaciones que RECIBE).
// Vive en un archivo propio para que sirva igual con la versión simulada y con la real.

export type CalificacionRecibida = {
    id: string;
    /** Nombre de quien calificó. */
    de: string;
    estrellas: number;
    comentario?: string;
    /** Texto ya listo para mostrar, ej. "Hace 2 semanas". */
    cuando: string;
    /** true = dato de ejemplo (no viene de un usuario real). La pantalla lo marca como "Ejemplo". */
    simulada?: boolean;
  };
  
  /** Promedio de estrellas, o null si todavía no hay calificaciones. */
  export function promedioEstrellas(lista: { estrellas: number }[]): number | null {
    if (lista.length === 0) return null;
    const suma = lista.reduce((acc, c) => acc + c.estrellas, 0);
    return suma / lista.length;
  }
  
  /** "4.5" para mostrar en pantalla, o "—" si no hay promedio. */
  export function formatearPromedio(promedio: number | null): string {
    return promedio === null ? '—' : promedio.toFixed(1);
  }

type DeportistaApi = { user_id: string; nombre: string; apellido_inicial: string; foto_perfil: string | null };
type RecibidaApi = { id: string; score: number; comment: string; created_at: string; updated_at: string; rater: DeportistaApi | null };
type ReputacionApi = { average: number | null; count: number; items: RecibidaApi[] };
type DadaApi = { rated_user_id: string; score: number; comment: string; updated_at: string };

export type Reputacion = { promedio: number | null; cantidad: number; recibidas: CalificacionRecibida[] };

async function token(): Promise<string> {
  const t = await getToken();
  if (!t) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return t;
}

/** "Hoy", "Hace 3 días", "Hace 2 semanas"... */
export function haceCuanto(fecha: string, ahora: number = Date.now()): string {
  const dias = Math.floor((ahora - Date.parse(fecha)) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;
  if (dias < 30) return Math.floor(dias / 7) === 1 ? 'Hace 1 semana' : `Hace ${Math.floor(dias / 7)} semanas`;
  return Math.floor(dias / 30) <= 1 ? 'Hace 1 mes' : `Hace ${Math.floor(dias / 30)} meses`;
}

/** Tu reputación: promedio, cantidad y quién te calificó (GET /ratings/me). */
export async function cargarReputacion(): Promise<Reputacion> {
  const r = await apiRequest<ReputacionApi>('/ratings/me', { token: await token() });
  return {
    promedio: r.average,
    cantidad: r.count,
    recibidas: r.items.map((c) => ({
      id: c.id,
      de: c.rater ? `${c.rater.nombre} ${c.rater.apellido_inicial}` : 'Deportista',
      estrellas: c.score,
      comentario: c.comment || undefined,
      cuando: haceCuanto(c.updated_at),
    })),
  };
}

/** Las calificaciones que diste, por id de la persona calificada (GET /ratings/given). */
export async function cargarCalificacionesDadas(): Promise<Record<string, { estrellas: number; comentario?: string }>> {
  const dadas = await apiRequest<DadaApi[]>('/ratings/given', { token: await token() });
  return Object.fromEntries(dadas.map((d) => [d.rated_user_id, { estrellas: d.score, comentario: d.comment || undefined }]));
}

/**
 * Califica (o actualiza tu calificación) de un deportista. El servidor solo lo permite si hicieron
 * match o compartieron una actividad ya realizada.
 */
export async function calificarDeportista(userId: string, estrellas: number, comentario?: string): Promise<void> {
  await apiRequest(`/ratings/${encodeURIComponent(userId)}`, {
    method: 'PUT', token: await token(), body: { score: estrellas, comment: comentario?.trim() || null },
  });
}
