import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getToken, guardarClubEnSesion } from './auth';

export type DeporteClub = {
  id: number;
  nombre: string;
  descripcion: string | null;
  longitud?: number | null;
};
export type ClubResumen = {
  id: string;
  nombre: string;
  descripcion_corta: string | null;
  logo: string | null;
  direccion: string | null;
  comuna: string | null;
  verificado: boolean;
  deportes: DeporteClub[];
};
export type ClubPublico = {
  id: string;
  nombre: string;
  rut: string | null;
  descripcion: string | null;
  historia: string | null;
  deportes: DeporteClub[];
  convocatorias_abiertas: import('./convocatorias').Convocatoria[];
};
export type ClubGestionado = Omit<ClubPublico, 'convocatorias_abiertas'> & {
  mi_rol: 'PRINCIPAL' | 'ADMIN';
};
export type AdministradorClub = {
  usuario_id: string;
  nombre: string;
  rol: 'PRINCIPAL' | 'ADMIN';
  fecha_alta: string;
};
export type AsignacionRead = {
  id: string;
  email: string;
  asignada_por: string;
  fecha_creacion: string;
};
type PaginaClubes = {
  items: ClubResumen[];
  total: number;
  page: number;
  page_size: number;
};
type Estado = {
  clubes: ClubResumen[];
  detalles: Record<string, ClubPublico>;
  total: number;
  pagina: number;
  cargando: boolean;
  error: string | null;
};
let estado: Estado = { clubes: [], detalles: {}, total: 0, pagina: 1, cargando: false, error: null };
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
};
const getEstado = () => estado;

async function tokenActual() {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return token;
}

export async function cargarClubes(pagina = 1) {
  estado = { ...estado, cargando: true, error: null };
  emitir();
  try {
    const data = await apiRequest<PaginaClubes>(`/clubs?page=${pagina}&page_size=20`);
    estado = {
      ...estado,
      clubes: pagina === 1 ? data.items : [...estado.clubes, ...data.items],
      total: data.total,
      pagina: data.page,
      cargando: false,
      error: null
    };
    emitir();
  } catch (e) {
    estado = {
      ...estado,
      cargando: false,
      error: e instanceof Error ? e.message : 'No se pudieron cargar los clubes.',
    };
    emitir();
    throw e;
  }
}

export async function cargarClub(id: string) {
  const club = await apiRequest<ClubPublico>('/clubs/' + encodeURIComponent(id));
  estado = { ...estado, detalles: { ...estado.detalles, [id]: club } };
  emitir();
  return club;
}

export async function listarDeportesClub() {
  return apiRequest<DeporteClub[]>('/clubs/deportes');
}

export async function agregarDeporteClub(clubId: string, deporteId: number) {
  const ruta = `/clubs/${encodeURIComponent(clubId)}/deportes/${deporteId}`;
  await apiRequest<void>(ruta, { method: 'PUT', token: await tokenActual() });
}

export async function miClubActual(): Promise<ClubGestionado | null> {
  try {
    return await apiRequest<ClubGestionado>('/clubs/me', { token: await tokenActual() });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function crearClub(nombre: string, rut: string) {
  const club = await apiRequest<ClubGestionado>('/clubs', {
    method: 'POST',
    token: await tokenActual(),
    body: { nombre, rut },
  });
  await guardarClubEnSesion(club.id, club.nombre);
  return club;
}

export async function listarAdministradores(clubId: string) {
  return apiRequest<AdministradorClub[]>(`/clubs/${encodeURIComponent(clubId)}/admins`, {
    token: await tokenActual(),
  });
}

export async function quitarAdministrador(clubId: string, usuarioId: string) {
  const ruta = `/clubs/${encodeURIComponent(clubId)}/admins/${encodeURIComponent(usuarioId)}`;
  await apiRequest<void>(ruta, { method: 'DELETE', token: await tokenActual() });
}

export async function asignarCorreo(clubId: string, email: string) {
  const normalizado = email.trim().toLowerCase();
  if (normalizado.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizado)) {
    throw new Error('Ingresa un correo válido.');
  }
  return apiRequest<AsignacionRead>(`/clubs/${encodeURIComponent(clubId)}/admins/assignments`, {
    method: 'POST',
    token: await tokenActual(),
    body: { email: normalizado },
  });
}

export async function listarAsignaciones(clubId: string) {
  return apiRequest<AsignacionRead[]>(`/clubs/${encodeURIComponent(clubId)}/admins/assignments`, {
    token: await tokenActual(),
  });
}

export async function revocarAsignacion(clubId: string, asignacionId: string) {
  const ruta = `/clubs/${encodeURIComponent(clubId)}/admins/assignments/${encodeURIComponent(asignacionId)}`;
  await apiRequest<void>(ruta, { method: 'DELETE', token: await tokenActual() });
}

export function useEstadoClubes() {
  return useSyncExternalStore(suscribir, getEstado, getEstado);
}

export function useClub(id: string) {
  return useEstadoClubes().detalles[id];
}
