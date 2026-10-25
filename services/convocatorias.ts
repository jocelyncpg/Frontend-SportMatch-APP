import { apiRequest } from './api';
import { getToken } from './auth';
import type { DeporteClub } from './clubes';

export type Convocatoria = {
  id: string;
  club: { id: string; nombre: string; logo: string | null };
  deporte: DeporteClub;
  titulo: string | null;
  descripcion: string | null;
  categoria_edad: string;
  edad_minima: number | null;
  edad_maxima: number | null;
  fecha_prueba: string;
  requisitos: string[];
  cupos: number;
  cupos_disponibles: number;
  direccion: string;
  comuna: string | null;
  estado: 'ABIERTA' | 'CERRADA' | 'FINALIZADA';
  fecha_creacion: string | null;
};

export type CrearConvocatoria = {
  deporte_id: number;
  categoria_edad: string;
  edad_minima?: number;
  edad_maxima?: number;
  fecha_prueba: string;
  requisitos: string[];
  cupos: number;
  direccion: string;
  comuna?: string;
  titulo?: string;
  descripcion?: string;
};

export type PaginaConvocatorias = {
  items: Convocatoria[];
  total: number;
  page: number;
  page_size: number;
};

export type EstadoPostulacion = 'PENDIENTE' | 'PRESELECCIONADO' | 'ACEPTADO' | 'RECHAZADO';
export type EstadoRevision = Exclude<EstadoPostulacion, 'PENDIENTE'>;
export type PerfilDeportivo = {
  nombre: string;
  apellido_inicial: string;
  edad: number | null;
  foto_perfil: string | null;
  biografia: string | null;
  deportes: { deporte_codigo: string; nivel: number }[];
};
export type Antecedente = {
  institucion: string;
  deporte: string;
  anio_inicio: number;
  anio_fin: number | null;
  logros: string | null;
};
export type Candidato = {
  id: string;
  usuario_id: string;
  estado: EstadoPostulacion;
  perfil_deportivo: PerfilDeportivo;
  mensaje: string | null;
  antecedentes: Antecedente[];
  comentario_club: string | null;
  fecha_postulacion: string;
  fecha_actualizacion: string;
};
export type Postulacion = {
  id: string;
  estado: EstadoPostulacion;
  convocatoria: Convocatoria;
  mensaje: string | null;
  antecedentes: Antecedente[];
  perfil_deportivo: PerfilDeportivo;
  comentario_club: string | null;
  fecha_creacion: string;
  fecha_actualizacion: string;
};
export type PaginaMisPostulaciones = {
  items: Postulacion[];
  total: number;
  page: number;
  page_size: number;
};
export type PresentacionConvocatoria =
  | { tipo: 'postular'; texto: 'Postular' }
  | { tipo: 'estado'; texto: 'Postulación enviada' | 'Preseleccionado' | 'Aceptado' | 'Rechazado' }
  | { tipo: 'cerrada'; texto: 'Convocatoria cerrada' };
type TextoEstadoPostulacion = Extract<PresentacionConvocatoria, { tipo: 'estado' }>['texto'];
export type PaginaCandidatos = {
  convocatoria: Convocatoria;
  items: Candidato[];
  total: number;
  page: number;
  page_size: number;
  conteo_por_estado: Record<string, number>;
};

async function tokenActual() {
  const token = await getToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return token;
}

export async function listarConvocatorias(
  clubId: string,
  estado: Convocatoria['estado'] = 'ABIERTA',
  page = 1,
) {
  const params = `club_id=${encodeURIComponent(clubId)}&estado=${estado}&page=${page}&page_size=20`;
  return apiRequest<PaginaConvocatorias>(`/clubs/announcements?${params}`);
}

export async function postularConvocatoria(convocatoriaId: string, datos?: { mensaje?: string | null }) {
  return apiRequest<Postulacion>(`/clubs/announcements/${encodeURIComponent(convocatoriaId)}/applications`, {
    method: 'POST',
    token: await tokenActual(),
    body: { mensaje: datos?.mensaje ?? null, antecedentes: [] },
  });
}

export async function misPostulaciones() {
  return apiRequest<PaginaMisPostulaciones>('/clubs/announcements/applications/me', { token: await tokenActual() });
}

export function presentacionConvocatoria(estado: Convocatoria['estado'], postulacion?: EstadoPostulacion): PresentacionConvocatoria {
  if (postulacion) {
    const textos: Record<EstadoPostulacion, TextoEstadoPostulacion> = {
      PENDIENTE: 'Postulación enviada', PRESELECCIONADO: 'Preseleccionado', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado',
    };
    return { tipo: 'estado', texto: textos[postulacion] };
  }
  return estado === 'ABIERTA' ? { tipo: 'postular', texto: 'Postular' } : { tipo: 'cerrada', texto: 'Convocatoria cerrada' };
}

export function mensajeErrorPostulacion(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo enviar la postulación.';
}

/** Lista todas las convocatorias de un club en el estado elegido, acumulando páginas. */
export async function listarConvocatoriasClub(clubId: string, estado: Convocatoria['estado'] = 'ABIERTA') {
  const primera = await listarConvocatorias(clubId, estado, 1);
  const paginas = Math.ceil(primera.total / primera.page_size);
  if (paginas <= 1) return primera.items;
  const siguientes = await Promise.all(
    Array.from({ length: paginas - 1 }, (_, i) => listarConvocatorias(clubId, estado, i + 2)),
  );
  return [ ...primera.items, ...siguientes.flatMap((pagina) => pagina.items) ];
}

export async function listarTodasConvocatoriasClub(clubId: string) {
  const listas = await Promise.all((['ABIERTA', 'CERRADA', 'FINALIZADA'] as const)
    .map((estado) => listarConvocatoriasClub(clubId, estado)));
  return listas.flat();
}

export async function listarCandidatos(
  convocatoriaId: string,
  estado?: EstadoPostulacion,
  page = 1,
  pageSize = 20,
) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (estado) params.set('estado', estado);
  return apiRequest<PaginaCandidatos>(
    `/clubs/announcements/${encodeURIComponent(convocatoriaId)}/applications?${params.toString()}`,
    { token: await tokenActual() },
  );
}

export async function cambiarEstadoPostulacion(
  postulacionId: string,
  estado: EstadoRevision,
  comentario?: string,
) {
  return apiRequest<Candidato>(`/clubs/announcements/applications/${encodeURIComponent(postulacionId)}`, {
    method: 'PATCH',
    token: await tokenActual(),
    body: { estado, ...(comentario === undefined ? {} : { comentario }) },
  });
}

export async function detalleConvocatoria(id: string) {
  return apiRequest<Convocatoria>(`/clubs/announcements/${encodeURIComponent(id)}`);
}

export async function publicarConvocatoria(clubId: string, datos: CrearConvocatoria) {
  return apiRequest<Convocatoria>(`/clubs/${encodeURIComponent(clubId)}/announcements`, {
    method: 'POST',
    token: await tokenActual(),
    body: datos,
  });
}

export async function cerrarConvocatoria(clubId: string, id: string) {
  const ruta = `/clubs/${encodeURIComponent(clubId)}/announcements/${encodeURIComponent(id)}/close`;
  return apiRequest<Convocatoria>(ruta, { method: 'POST', token: await tokenActual() });
}
