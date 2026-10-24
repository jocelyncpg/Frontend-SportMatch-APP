import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';
import { alCambiar, avisarCambio, crearSondeo } from './sondeo';

export const MAX_TEXTO_CANAL = 1000;
export const MAX_NOMBRE_CANAL = 60;
export type MensajeCanal = {
  id: string; de: 'club' | 'deportista'; autorNombre: string; texto: string; enviadoEn: number; propio: boolean;
};
export type CanalClub = {
  id: string; clubId: string; nombre: string; miembrosEscriben: boolean; miembros: number;
  ultimo: MensajeCanal | null; noLeidos: number; avisoInactividadEn: string | null;
  mantenerHasta: string | null; fechaCreacion: string;
};
export type CanalDeportista = {
  id: string; clubId: string; clubNombre: string; clubLogo: string | null; nombre: string;
  miembrosEscriben: boolean; ultimo: MensajeCanal | null; noLeidos: number; silenciado: boolean;
};
export type MiembroCanal = { usuarioId: string; nombre: string; agregadoEn: string | null };
export type ResultadoCanal = { ok: true } | { ok: false; motivo: string };
type MensajeApi = { id: number; de: 'club' | 'deportista'; autor_nombre: string; texto: string; enviado_en: string; propio: boolean };
type CanalClubApi = {
  id: string; club_id: string; nombre: string; miembros_escriben: boolean; miembros: number;
  ultimo: MensajeApi | null; no_leidos: number; aviso_inactividad_en: string | null;
  mantener_hasta: string | null; fecha_creacion: string;
};
type CanalDeportistaApi = {
  id: string; club_id: string; club_nombre: string; club_logo: string | null; nombre: string;
  miembros_escriben: boolean; ultimo: MensajeApi | null; no_leidos: number; silenciado: boolean;
};
type MensajesApi = { canal: CanalClubApi | CanalDeportistaApi; mensajes: MensajeApi[] };
type Estado = { club: CanalClub[]; deportista: CanalDeportista[]; mensajes: Record<string, MensajeCanal[]>; error: string | null };
let estado: Estado = { club: [], deportista: [], mensajes: {}, error: null };
const oyentes = new Set<() => void>();
const intervalos = new Map<string, { detener(): void; ahora(): void; aviso(): void }>();
const leidos = new Map<string, number>();
const uuids = new Map<string, string>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getEstado = () => estado;
const motivo = (e: unknown) => e instanceof Error ? e.message : 'No se pudo conectar con el servidor.';
const convertirMensaje = (m: MensajeApi): MensajeCanal => ({
  id: String(m.id), de: m.de, autorNombre: m.autor_nombre, texto: m.texto,
  enviadoEn: Date.parse(m.enviado_en), propio: m.propio,
});

async function credenciales() {
  const [sesion, token] = await Promise.all([getSession(), getToken()]);
  if (!sesion || !token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return { usuarioId: sesion.id, token };
}

export async function cargarCanalesClub(clubId: string) {
  const { token } = await credenciales();
  const lista = await apiRequest<CanalClubApi[]>(`/clubs/${encodeURIComponent(clubId)}/canales`, { token });
  estado = { ...estado, club: lista.map((c) => ({
    id: c.id, clubId: c.club_id, nombre: c.nombre, miembrosEscriben: c.miembros_escriben,
    miembros: c.miembros, ultimo: c.ultimo ? convertirMensaje(c.ultimo) : null, noLeidos: c.no_leidos,
    avisoInactividadEn: c.aviso_inactividad_en, mantenerHasta: c.mantener_hasta, fechaCreacion: c.fecha_creacion,
  })), error: null };
  emitir();
}

export async function cargarCanalesDeportista() {
  const { usuarioId, token } = await credenciales();
  const lista = await apiRequest<CanalDeportistaApi[]>('/clubs/canales/me', { token });
  if ((await getSession())?.id !== usuarioId) return;
  estado = { ...estado, deportista: lista.map((c) => ({
    id: c.id, clubId: c.club_id, clubNombre: c.club_nombre, clubLogo: c.club_logo,
    nombre: c.nombre, miembrosEscriben: c.miembros_escriben,
    ultimo: c.ultimo ? convertirMensaje(c.ultimo) : null, noLeidos: c.no_leidos, silenciado: c.silenciado,
  })), error: null };
  emitir();
}

export async function crearCanal(clubId: string, nombre: string, miembrosEscriben: boolean) {
  const limpio = nombre.trim();
  if (!limpio || limpio.length > MAX_NOMBRE_CANAL) throw new Error('El nombre debe tener entre 1 y 60 caracteres.');
  const { token } = await credenciales();
  const canal = await apiRequest<CanalClubApi>(`/clubs/${encodeURIComponent(clubId)}/canales`, {
    method: 'POST', token, body: { nombre: limpio, miembros_escriben: miembrosEscriben },
  });
  await cargarCanalesClub(clubId);
  avisarCambio('canales', clubId);
  return canal.id;
}

export async function editarCanal(clubId: string, canalId: string, cambios: { nombre?: string; miembrosEscriben?: boolean }) {
  if (cambios.nombre !== undefined && (!cambios.nombre.trim() || cambios.nombre.trim().length > MAX_NOMBRE_CANAL)) {
    throw new Error('El nombre debe tener entre 1 y 60 caracteres.');
  }
  const { token } = await credenciales();
  await apiRequest<CanalClubApi>(`/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}`, {
    method: 'PATCH', token,
    body: { ...(cambios.nombre !== undefined ? { nombre: cambios.nombre.trim() } : {}),
      ...(cambios.miembrosEscriben !== undefined ? { miembros_escriben: cambios.miembrosEscriben } : {}) },
  });
  await cargarCanalesClub(clubId);
  avisarCambio('canales', clubId);
}

export async function eliminarCanal(clubId: string, canalId: string) {
  const { token } = await credenciales();
  await apiRequest<void>(`/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}`, { method: 'DELETE', token });
  estado = { ...estado, club: estado.club.filter((c) => c.id !== canalId) };
  emitir();
  avisarCambio('canales', clubId);
}

export async function listarMiembrosCanal(clubId: string, canalId: string, candidatos = false) {
  const { token } = await credenciales();
  const lista = await apiRequest<{ usuario_id: string; nombre: string; agregado_en: string | null }[]>(
    `/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}/${candidatos ? 'candidatos' : 'miembros'}`, { token });
  return lista.map((m) => ({ usuarioId: m.usuario_id, nombre: m.nombre, agregadoEn: m.agregado_en }));
}

export async function cambiarMiembroCanal(clubId: string, canalId: string, usuarioId: string, agregar: boolean) {
  const { token } = await credenciales();
  await apiRequest<void>(`/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}/miembros/${encodeURIComponent(usuarioId)}`, {
    method: agregar ? 'PUT' : 'DELETE', token,
  });
  await cargarCanalesClub(clubId);
  avisarCambio('canales', clubId);
}

export async function decidirInactividad(clubId: string, canalId: string, decision: 'eliminar' | 'mantener') {
  const { token } = await credenciales();
  await apiRequest<void>(`/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}/inactividad`, {
    method: 'POST', token, body: { decision },
  });
  if (decision === 'eliminar') estado = { ...estado, club: estado.club.filter((c) => c.id !== canalId) };
  else await cargarCanalesClub(clubId);
  emitir();
  avisarCambio('canales', clubId);
}

async function cargarMensajes(clave: string, ruta: string) {
  const { token } = await credenciales();
  const anterior = estado.mensajes[clave] ?? [];
  const cursor = anterior.at(-1)?.id;
  const query = cursor ? `?after_id=${encodeURIComponent(cursor)}&limit=50` : '?limit=50';
  const data = await apiRequest<MensajesApi>(ruta + '/messages' + query, { token });
  const nuevos = data.mensajes.map(convertirMensaje);
  const mensajes = [...anterior, ...nuevos].filter((m, i, todos) => todos.findIndex((x) => x.id === m.id) === i);
  estado = { ...estado, mensajes: { ...estado.mensajes, [clave]: mensajes }, error: null };
  emitir();
  const ultimoId = Number(mensajes.at(-1)?.id ?? 0);
  if (intervalos.has(clave) && ultimoId > (leidos.get(clave) ?? 0)) {
    await apiRequest<void>(ruta + '/read', { method: 'POST', token, body: { hasta_id: ultimoId } });
    leidos.set(clave, ultimoId);
  }
  return nuevos.length > 0;
}

function abrir(clave: string, ruta: string) {
  if (intervalos.has(clave)) return;
  const sondeo = crearSondeo('canal:' + clave, () => cargarMensajes(clave, ruta).catch((e) => {
    estado = { ...estado, error: motivo(e) }; emitir(); return false;
  }), { minMs: 3000, maxMs: 15000, factor: 1.5 });
  const quitarAviso = alCambiar(({ tipo, id }) => {
    if ((tipo === 'canal' && id === clave) || tipo === 'canales') sondeo.ahora();
  });
  intervalos.set(clave, { ...sondeo, aviso: quitarAviso });
  sondeo.iniciar();
}

export function abrirCanalClub(clubId: string, canalId: string) {
  abrir(canalId, `/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}`);
}
export function abrirCanalDeportista(canalId: string) {
  abrir(canalId, `/clubs/canales/${encodeURIComponent(canalId)}`);
}
export function cerrarCanal(canalId: string) {
  const sondeo = intervalos.get(canalId); sondeo?.detener(); sondeo?.aviso(); intervalos.delete(canalId);
}
export function mensajesCanal(canalId: string) { return estado.mensajes[canalId] ?? []; }

export async function enviarMensajeCanal(canalId: string, clubId: string | null, texto: string): Promise<ResultadoCanal> {
  const limpio = texto.trim();
  if (!limpio || limpio.length > MAX_TEXTO_CANAL) return { ok: false, motivo: 'Escribe entre 1 y 1000 caracteres.' };
  const clave = `${canalId}:${limpio}`;
  if (!uuids.has(clave)) uuids.set(clave, Crypto.randomUUID());
  try {
    const { token } = await credenciales();
    const ruta = clubId ? `/clubs/${encodeURIComponent(clubId)}/canales/${encodeURIComponent(canalId)}`
      : `/clubs/canales/${encodeURIComponent(canalId)}`;
    await apiRequest<MensajeApi>(ruta + '/messages', { method: 'POST', token,
      body: { texto: limpio, client_message_id: uuids.get(clave) } });
    uuids.delete(clave); intervalos.get(canalId)?.ahora(); avisarCambio('canal', canalId);
    if (clubId) { await cargarCanalesClub(clubId).catch(() => { }); avisarCambio('canales', clubId); }
    return { ok: true };
  } catch (e) { return { ok: false, motivo: motivo(e) }; }
}

export async function silenciarCanal(canalId: string, silenciado: boolean) {
  const { token } = await credenciales();
  await apiRequest<void>(`/clubs/canales/${encodeURIComponent(canalId)}/mute`, { method: 'PUT', token, body: { silenciado } });
  await cargarCanalesDeportista();
  avisarCambio('canales');
}

export function useCanales() { return useSyncExternalStore(suscribir, getEstado, getEstado); }
