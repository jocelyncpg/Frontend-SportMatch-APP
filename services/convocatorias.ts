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
