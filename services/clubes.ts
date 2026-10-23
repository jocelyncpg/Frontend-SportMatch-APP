import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getToken, guardarClubEnSesion } from './auth';

export type ClubPublico = { id: string; nombre: string; rut: string };
export type ClubGestionado = ClubPublico & { mi_rol: 'PRINCIPAL' | 'ADMIN' };
export type AdministradorClub = { usuario_id: string; nombre: string; rol: 'PRINCIPAL' | 'ADMIN'; fecha_alta: string };
export type InvitacionClub = { id: string; creada_por: string; fecha_creacion: string; expira_en: string };
export type InvitacionCreada = { id: string; codigo: string; expira_en: string };
type PaginaClubes = { items: ClubPublico[]; total: number; page: number; page_size: number };
type Estado = { clubes: ClubPublico[]; detalles: Record<string, ClubPublico>; total: number; pagina: number; cargando: boolean; error: string | null };
let estado: Estado = { clubes: [], detalles: {}, total: 0, pagina: 1, cargando: false, error: null };
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getEstado = () => estado;
async function tokenActual() {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return token;
}
export async function cargarClubes(pagina = 1) {
  estado = { ...estado, cargando: true, error: null }; emitir();
  try {
    // PENDIENTE BACKEND: confirmar el parámetro page de GET /clubs; la respuesta paginada se indicó en el encargo.
    const data = await apiRequest<PaginaClubes>('/clubs?page=' + pagina);
    estado = { ...estado, clubes: pagina === 1 ? data.items : [...estado.clubes, ...data.items], total: data.total, pagina: data.page, cargando: false, error: null }; emitir();
  } catch (e) { estado = { ...estado, cargando: false, error: e instanceof Error ? e.message : 'No se pudieron cargar los clubes.' }; emitir(); throw e; }
}
export async function cargarClub(id: string) {
  const club = await apiRequest<ClubPublico>('/clubs/' + encodeURIComponent(id));
  estado = { ...estado, detalles: { ...estado.detalles, [id]: club } }; emitir();
  return club;
}
export async function miClubActual(): Promise<ClubGestionado | null> {
  try { return await apiRequest<ClubGestionado>('/clubs/me', { token: await tokenActual() }); }
  catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
}
export async function crearClub(nombre: string, rut: string) {
  const club = await apiRequest<ClubGestionado>('/clubs', { method: 'POST', token: await tokenActual(), body: { nombre, rut } });
  await guardarClubEnSesion(club.id, club.nombre);
  return club;
}
export async function aceptarInvitacion(codigo: string) {
  const club = await apiRequest<ClubGestionado>('/clubs/admins/invitations/accept', { method: 'POST', token: await tokenActual(), body: { codigo } });
  await guardarClubEnSesion(club.id, club.nombre);
  return club;
}
export async function listarAdministradores(clubId: string) {
  return apiRequest<AdministradorClub[]>('/clubs/' + encodeURIComponent(clubId) + '/admins', { token: await tokenActual() });
}
export async function quitarAdministrador(clubId: string, usuarioId: string) {
  await apiRequest<void>('/clubs/' + encodeURIComponent(clubId) + '/admins/' + encodeURIComponent(usuarioId), { method: 'DELETE', token: await tokenActual() });
}
export async function generarInvitacion(clubId: string) {
  return apiRequest<InvitacionCreada>('/clubs/' + encodeURIComponent(clubId) + '/admins/invitations', { method: 'POST', token: await tokenActual() });
}
export async function listarInvitaciones(clubId: string) {
  return apiRequest<InvitacionClub[]>('/clubs/' + encodeURIComponent(clubId) + '/admins/invitations', { token: await tokenActual() });
}
export async function revocarInvitacion(clubId: string, invitacionId: string) {
  await apiRequest<void>('/clubs/' + encodeURIComponent(clubId) + '/admins/invitations/' + encodeURIComponent(invitacionId), { method: 'DELETE', token: await tokenActual() });
}
export function useEstadoClubes() { return useSyncExternalStore(suscribir, getEstado, getEstado); }
export function useClub(id: string) { return useEstadoClubes().detalles[id]; }
