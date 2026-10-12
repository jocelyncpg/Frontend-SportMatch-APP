import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getToken } from './auth';

export type TipoReporte = 'usuario' | 'actividad' | 'mensaje';
export type ResultadoReporte = { ok: true } | { ok: false; motivo: string };

export type EstadoReporte = 'pendiente' | 'revisado' | 'descartado';

/** Un reporte tal como lo ve un administrador (HU-43). */
export type Reporte = {
  id: string;
  tipo: TipoReporte;
  objetivoId: string;
  objetivoNombre: string;
  motivo: string;
  detalle: string;
  /** Nombre de quien reportó; null si su cuenta ya no existe. */
  reportante: string | null;
  estado: EstadoReporte;
  fecha: string;
};

/** Motivos predefinidos (HU-42). El último de cada lista es "Otro" y obliga a explicar. */
export const MOTIVOS: Record<TipoReporte, string[]> = {
  usuario: ['Acoso o trato irrespetuoso', 'Lenguaje ofensivo', 'Perfil falso o suplantación', 'Spam o publicidad', 'Otro'],
  actividad: ['Actividad falsa o engañosa', 'Contenido inapropiado', 'Lugar inseguro', 'Spam o publicidad', 'Otro'],
  mensaje: ['Acoso o amenazas', 'Lenguaje ofensivo', 'Contenido inapropiado', 'Spam o estafa', 'Otro'],
};
export const MOTIVO_OTRO = 'Otro';
export const MAX_DETALLE = 300;

export const TITULO_TIPO: Record<TipoReporte, string> = {
  usuario: 'Reportar usuario',
  actividad: 'Reportar actividad',
  mensaje: 'Reportar mensaje',
};

type PersonaApi = { user_id: string; nombre: string; apellido_inicial: string; foto_perfil: string | null };
type ReporteApi = {
  id: string; tipo: TipoReporte; objetivo_id: string; objetivo_nombre: string; motivo: string; detalle: string;
  reportante: PersonaApi | null; estado: EstadoReporte; fecha_creacion: string;
};

async function sesion(): Promise<string> {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return token;
}

const mensajeDe = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto);

/** Valida antes de enviar, con las mismas reglas que aplica Ms_Users. */
export function validarReporte(tipo: TipoReporte, motivo: string, detalle: string): ResultadoReporte {
  if (!MOTIVOS[tipo].includes(motivo)) return { ok: false, motivo: 'Elige un motivo para el reporte.' };
  const texto = detalle.trim();
  if (texto.length > MAX_DETALLE) return { ok: false, motivo: `El detalle admite hasta ${MAX_DETALLE} caracteres.` };
  if (motivo === MOTIVO_OTRO && texto.length < 10) return { ok: false, motivo: 'Cuéntanos qué pasó (al menos 10 caracteres).' };
  return { ok: true };
}

/** Envía un reporte (HU-42) a Ms_Users; queda pendiente para el panel de moderación (HU-43). */
export async function reportar(
  tipo: TipoReporte,
  objetivoId: string,
  objetivoNombre: string,
  motivo: string,
  detalle: string
): Promise<ResultadoReporte> {
  const valido = validarReporte(tipo, motivo, detalle);
  if (!valido.ok) return valido;
  try {
    await apiRequest('/users/reports', {
      method: 'POST', token: await sesion(),
      body: { tipo, objetivo_id: objetivoId, objetivo_nombre: objetivoNombre.slice(0, 200), motivo, detalle: detalle.trim() },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensajeDe(e, 'No se pudo enviar el reporte. Inténtalo de nuevo.') };
  }
}

// ---------- bloqueos ----------
// Bloquear oculta a ambas personas entre sí en Descubrir; matches, chats y actividades siguen igual.

let bloqueados: string[] = [];
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getBloqueados = () => bloqueados;

/** Ids de las personas que bloqueaste. */
export function useBloqueados(): string[] {
  return useSyncExternalStore(suscribir, getBloqueados, getBloqueados);
}

export async function cargarBloqueados(): Promise<void> {
  const lista = await apiRequest<PersonaApi[]>('/users/me/blocks', { token: await sesion() });
  bloqueados = lista.map((p) => p.user_id);
  emitir();
}

export async function bloquear(personaId: string): Promise<ResultadoReporte> {
  try {
    await apiRequest(`/users/me/blocks/${encodeURIComponent(personaId)}`, { method: 'PUT', token: await sesion() });
    if (!bloqueados.includes(personaId)) bloqueados = [...bloqueados, personaId];
    emitir();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensajeDe(e, 'No se pudo bloquear. Inténtalo de nuevo.') };
  }
}

export async function desbloquear(personaId: string): Promise<ResultadoReporte> {
  try {
    await apiRequest(`/users/me/blocks/${encodeURIComponent(personaId)}`, { method: 'DELETE', token: await sesion() });
    bloqueados = bloqueados.filter((id) => id !== personaId);
    emitir();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensajeDe(e, 'No se pudo desbloquear. Inténtalo de nuevo.') };
  }
}

// ---------- moderación (solo administradores) ----------

const aReporte = (r: ReporteApi): Reporte => ({
  id: r.id, tipo: r.tipo, objetivoId: r.objetivo_id, objetivoNombre: r.objetivo_nombre, motivo: r.motivo,
  detalle: r.detalle, estado: r.estado, fecha: r.fecha_creacion,
  reportante: r.reportante ? `${r.reportante.nombre} ${r.reportante.apellido_inicial}` : null,
});

/** Reportes más recientes primero; sin estado trae todos. */
export async function listarReportes(estado?: EstadoReporte): Promise<Reporte[]> {
  const query = estado ? `?estado=${estado}&limit=100` : '?limit=100';
  const lista = await apiRequest<ReporteApi[]>(`/users/admin/reports${query}`, { token: await sesion() });
  return lista.map(aReporte);
}

export async function revisarReporte(id: string, estado: Exclude<EstadoReporte, 'pendiente'>): Promise<Reporte> {
  const r = await apiRequest<ReporteApi>(`/users/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH', token: await sesion(), body: { estado },
  });
  return aReporte(r);
}

/** Solo para pruebas: olvida los bloqueos en memoria. */
export function reiniciarBloqueos() {
  bloqueados = [];
  emitir();
}
