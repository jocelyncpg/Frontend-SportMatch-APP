import { ApiError, apiRequest } from './api';
import { getToken } from './auth';

// HU-45: sanciones a cuentas (solo administradores). Ms_Users las guarda, avisa a la persona y le restringe el acceso.

export type TipoSancion = 'temporal' | 'permanente';
/** 'vencida' = temporal cuya fecha de fin ya pasó (se calcula, no hay un job). */
export type EstadoSancion = 'activa' | 'levantada' | 'vencida';

/** Mismos límites que valida Ms_Users. */
export const DIAS_MIN = 1;
export const DIAS_MAX = 365;
export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 300;

export type Sancion = {
  id: string;
  usuarioId: string;
  usuario: string | null;
  tipo: TipoSancion;
  motivo: string;
  inicio: string;
  /** null si es permanente. */
  fin: string | null;
  estado: EstadoSancion;
  reporteId: string | null;
  motivoLevantamiento: string | null;
};

type PersonaApi = { user_id: string; nombre: string | null; apellido_inicial: string | null };
type SancionApi = {
  id: string; usuario: PersonaApi; tipo: TipoSancion; motivo: string; inicio: string; fin: string | null;
  estado: EstadoSancion; reporte_id: string | null; motivo_levantamiento: string | null;
};

async function sesion(): Promise<string> {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return token;
}

const aSancion = (s: SancionApi): Sancion => ({
  id: s.id, usuarioId: s.usuario.user_id,
  usuario: s.usuario.nombre ? `${s.usuario.nombre} ${s.usuario.apellido_inicial ?? ''}`.trim() : null,
  tipo: s.tipo, motivo: s.motivo, inicio: s.inicio, fin: s.fin, estado: s.estado, reporteId: s.reporte_id,
  motivoLevantamiento: s.motivo_levantamiento,
});

/** Valida antes de enviar, con las mismas reglas que aplica Ms_Users. Devuelve el problema o null. */
export function validarSancion(tipo: TipoSancion, dias: number | null, motivo: string): string | null {
  if (tipo === 'temporal' && (dias === null || !Number.isInteger(dias) || dias < DIAS_MIN || dias > DIAS_MAX)) {
    return `La duración debe ser de ${DIAS_MIN} a ${DIAS_MAX} días.`;
  }
  const texto = motivo.trim();
  if (texto.length < MOTIVO_MIN) return `Escribe el motivo (al menos ${MOTIVO_MIN} caracteres).`;
  if (texto.length > MOTIVO_MAX) return `El motivo admite hasta ${MOTIVO_MAX} caracteres.`;
  return null;
}

/** Aplica una sanción. `reporteId` (opcional) debe ser un reporte escalado de esa misma cuenta. */
export async function aplicarSancion(datos: {
  usuarioId: string; tipo: TipoSancion; dias: number | null; motivo: string; reporteId?: string | null;
}): Promise<Sancion> {
  const problema = validarSancion(datos.tipo, datos.dias, datos.motivo);
  if (problema) throw new Error(problema);
  const body: Record<string, unknown> = { usuario_id: datos.usuarioId, tipo: datos.tipo, motivo: datos.motivo.trim() };
  if (datos.tipo === 'temporal') body.dias = datos.dias;
  if (datos.reporteId) body.reporte_id = datos.reporteId;
  return aSancion(await apiRequest<SancionApi>('/users/admin/sanctions', { method: 'POST', token: await sesion(), body }));
}

export async function levantarSancion(id: string, motivo: string): Promise<Sancion> {
  const texto = motivo.trim();
  if (texto.length < MOTIVO_MIN || texto.length > MOTIVO_MAX) {
    throw new Error(`Escribe el motivo (de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres).`);
  }
  return aSancion(await apiRequest<SancionApi>(`/users/admin/sanctions/${encodeURIComponent(id)}/lift`, {
    method: 'POST', token: await sesion(), body: { motivo: texto },
  }));
}

/** Más recientes primero. Sin estado trae todas. */
export async function listarSanciones(estado?: EstadoSancion, usuarioId?: string): Promise<Sancion[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (estado) params.set('estado', estado);
  if (usuarioId) params.set('usuario_id', usuarioId);
  const lista = await apiRequest<SancionApi[]>(`/users/admin/sanctions?${params.toString()}`, { token: await sesion() });
  return lista.map(aSancion);
}
