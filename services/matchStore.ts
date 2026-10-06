import { useSyncExternalStore } from 'react';

import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';
import { codigoDeporte, nombreDeporte } from './deportes';

export type FiltrosSugerencias = {
  radioKm: 2 | 5 | 10 | null;
  deporte: 'mis_deportes' | 'todos' | string;
  nivelMin: number;
  nivelMax: number;
  nivelSimilar: boolean;
};

export type Persona = {
  id: string;
  name: string;
  age?: number;
  sport: string;
  level: string;
  deportes?: { nombre: string; nivel: string }[];
  distance?: string;
  distanceKm?: number;
  nivelCoincidente?: boolean;
  compatibility: number;
  colorFrom: string;
  bio?: string;
  fotoUri?: string | null;
  requestId?: string;
  matchId?: string;
  ultimoMensaje?: string;
  ultimoMensajeFecha?: string;
};

type Estado = {
  /** Deportistas reales registrados (GET /users/suggestions), sin incluirte a ti. */
  catalogo: Persona[];
  cargando: boolean;
  error: string | null;
  sesionExpirada: boolean;
  /** Dueño de los likes y descartes en memoria; si cambia la sesión, se reinician. */
  usuarioId: string | null;
  solicitudes: Persona[];
  solicitudesEnviadas: Persona[];
  confirmados: Persona[];
  enviadas: string[];
  descartados: string[];
  ocultos: string[];
  ocupados: string[];
  cargandoMatches: boolean;
  matchingError: string | null;
  filtros: FiltrosSugerencias | null;
  ubicacionDisponible: boolean;
  misDeportes: string[];
};

/** Tarjeta pública que devuelve Ms_Users. */
export type SugerenciaApi = {
  user_id: string;
  nombre: string;
  apellido_inicial: string;
  edad: number | null;
  foto_perfil: string | null;
  biografia: string | null;
  deportes: { deporte_codigo: string; nivel: number }[];
  compatibilidad: number;
  distancia_km?: number | null;
  nivel_coincidente?: boolean;
};

const COLORES = ['#3648A6', '#1F2A5C', '#DB2777', '#22C55E', '#7C3AED', '#0EA5E9'];

function nombreNivel(nivel: number): string {
  return ({ 1: 'Principiante', 2: 'Básico', 3: 'Intermedio', 4: 'Avanzado', 5: 'Experto' } as Record<number, string>)[nivel] ?? 'Nivel por definir';
}

/** Siempre el mismo color para la misma persona. */
function colorPara(id: string): string {
  let suma = 0;
  for (const letra of id) suma = (suma + letra.charCodeAt(0)) % 997;
  return COLORES[suma % COLORES.length];
}

export function aPersona(s: SugerenciaApi): Persona {
  const principal = s.deportes[0];
  return {
    id: s.user_id,
    name: `${s.nombre} ${s.apellido_inicial}`,
    age: s.edad ?? undefined,
    sport: principal ? nombreDeporte(principal.deporte_codigo) : 'Sin deporte aún',
    level: principal ? `${nombreNivel(principal.nivel)} · ${principal.nivel}/5` : 'Nivel por definir',
    deportes: s.deportes.map((d) => ({ nombre: nombreDeporte(d.deporte_codigo), nivel: `${nombreNivel(d.nivel)} · ${d.nivel}/5` })),
    distance: s.distancia_km == null ? undefined : s.distancia_km < 0.1 ? 'A menos de 100 m' : `≈ ${s.distancia_km.toFixed(1)} km`,
    distanceKm: s.distancia_km ?? undefined,
    nivelCoincidente: s.nivel_coincidente,
    compatibility: s.compatibilidad,
    colorFrom: colorPara(s.user_id),
    bio: s.biografia ?? undefined,
    fotoUri: s.foto_perfil,
  };
}

function estadoInicial(usuarioId: string | null = null): Estado {
  return {
    catalogo: [],
    cargando: false,
    error: null,
    sesionExpirada: false,
    usuarioId,
    solicitudes: [],
    solicitudesEnviadas: [],
    confirmados: [],
    enviadas: [],
    descartados: [],
    ocultos: [],
    ocupados: [],
    cargandoMatches: false,
    matchingError: null,
    filtros: null,
    ubicacionDisponible: false,
    misDeportes: [],
  };
}

let estado: Estado = estadoInicial();
let cargaActual = 0;
let cargaMatching = 0;
const oyentes = new Set<() => void>();

function emitir() {
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function getEstado(): Estado {
  return estado;
}

export function useMatches(): Estado {
  return useSyncExternalStore(suscribir, getEstado, getEstado);
}

/** Trae los deportistas registrados desde el backend (frontend → gateway → Ms_Users). */
export async function cargarSugerencias(): Promise<void> {
  const carga = ++cargaActual;
  try {
    const [session, token] = await Promise.all([getSession(), getToken()]);
    if (carga !== cargaActual) return;
    if (!session || !token) {
      estado = { ...estadoInicial(), sesionExpirada: true, error: 'Inicia sesión para ver deportistas.' };
      emitir();
      return;
    }
    if (estado.usuarioId !== session.id) {
      // Otra cuenta en el mismo teléfono: no hereda likes ni descartes.
      estado = estadoInicial(session.id);
    }
    const ubicacionDisponible = session.latitud != null && session.longitud != null;
    const misDeportes = (session.deportes ?? []).map((sport) => codigoDeporte(sport.nombre));
    const filtros = estado.filtros ?? {
      radioKm: ubicacionDisponible ? 10 : null,
      deporte: misDeportes.length ? 'mis_deportes' : 'todos',
      nivelMin: 1, nivelMax: 5, nivelSimilar: misDeportes.length > 0,
    };
    estado = { ...estado, cargando: true, error: null, sesionExpirada: false, filtros, ubicacionDisponible, misDeportes };
    emitir();
    const query = ['limit=50'];
    if (filtros.radioKm != null) query.push(`radius_km=${filtros.radioKm}`);
    if (filtros.deporte === 'mis_deportes') query.push('shared_sports=true');
    else if (filtros.deporte !== 'todos') query.push(`sport=${encodeURIComponent(filtros.deporte)}`);
    if (filtros.nivelMin !== 1) query.push(`min_level=${filtros.nivelMin}`);
    if (filtros.nivelMax !== 5) query.push(`max_level=${filtros.nivelMax}`);
    if (filtros.nivelSimilar) query.push('level_tolerance=1');
    const tarjetas = await apiRequest<SugerenciaApi[]>(`/users/suggestions?${query.join('&')}`, { token });
    const [sesionActual, tokenActual] = await Promise.all([getSession(), getToken()]);
    if (carga !== cargaActual) return;
    if (sesionActual?.id !== session.id || tokenActual !== token) {
      estado = estadoInicial();
      emitir();
      return;
    }
    estado = {
      ...estado,
      cargando: false,
      // El backend ya te excluye; el filtro es una segunda barrera.
      catalogo: tarjetas.filter((t) => t.user_id !== session.id).map(aPersona),
    };
    emitir();
    await cargarMatching();
  } catch (e: unknown) {
    if (carga !== cargaActual) return;
    const sesionExpirada = e instanceof ApiError && e.status === 401;
    estado = {
      ...(sesionExpirada ? estadoInicial() : estado),
      cargando: false,
      error: e instanceof Error ? e.message : 'No se pudieron cargar los deportistas. Inténtalo de nuevo.',
      sesionExpirada,
    };
  }
  emitir();
}

/** Personas que todavía no has visto ni tienes como match o solicitud. */
export function sugerencias(e: Estado): Persona[] {
  const ocupados = new Set([
    ...e.solicitudes.map((p) => p.id),
    ...e.confirmados.map((p) => p.id),
    ...e.enviadas,
    ...e.descartados,
    ...e.ocultos,
  ]);
  return e.catalogo.filter((p) => !ocupados.has(p.id));
}

/** Both Home and Discover use the same server filters and preserve its distance ordering. */
export async function aplicarFiltros(filtros: FiltrosSugerencias | null): Promise<void> {
  estado = { ...estado, filtros, catalogo: [], descartados: [] };
  await cargarSugerencias();
}

/** Quick distance chips from the shared design use the same server filters. */
export async function setRadio(km: 2 | 5 | 10 | null): Promise<void> {
  if (!estado.filtros) await cargarSugerencias();
  if (!estado.filtros) return;
  await aplicarFiltros({ ...estado.filtros, radioKm: km });
}

export type ConexionApi = {
  id: string; sender_id: string; recipient_id: string;
  status: 'pending' | 'accepted' | 'rejected'; athlete: SugerenciaApi;
  last_message: string | null; last_message_at: string | null;
};

type MatchingApi = {
  incoming: ConexionApi[]; outgoing: ConexionApi[]; matches: ConexionApi[]; hidden_user_ids: string[];
};

export function personaConexion(c: ConexionApi): Persona {
  return { ...aPersona(c.athlete), requestId: c.id,
    matchId: c.status === 'accepted' ? c.id : undefined,
    ultimoMensaje: c.last_message ?? undefined, ultimoMensajeFecha: c.last_message_at ?? undefined };
}

async function credenciales() {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) throw new ApiError('Inicia sesión para hacer match.', 401, '');
  return { session, token };
}

async function mismaSesion(id: string, token: string) {
  const [current, currentToken] = await Promise.all([getSession(), getToken()]);
  return current?.id === id && currentToken === token;
}

export async function cargarMatching(): Promise<void> {
  if (estado.ocupados.length) return;
  const carga = ++cargaMatching;
  try {
    const { session, token } = await credenciales();
    if (carga !== cargaMatching) return;
    if (estado.usuarioId !== session.id) estado = estadoInicial(session.id);
    estado = { ...estado, cargandoMatches: true };
    emitir();
    const data = await apiRequest<MatchingApi>('/matching/state', { token });
    const vigente = await mismaSesion(session.id, token);
    if (carga !== cargaMatching) return;
    if (!vigente) { estado = estadoInicial(); emitir(); return; }
    estado = { ...estado, solicitudes: data.incoming.map(personaConexion),
      solicitudesEnviadas: data.outgoing.map(personaConexion),
      confirmados: data.matches.map(personaConexion), enviadas: data.outgoing.map((c) => c.athlete.user_id),
      ocultos: data.hidden_user_ids, cargandoMatches: false, matchingError: null, sesionExpirada: false };
  } catch (e) {
    if (carga !== cargaMatching) return;
    const expired = e instanceof ApiError && e.status === 401;
    estado = { ...(expired ? estadoInicial() : estado), cargandoMatches: false,
      matchingError: e instanceof Error ? e.message : 'No se pudieron cargar tus matches.', sesionExpirada: expired };
  }
  emitir();
}

async function cambiarConexion(id: string, path: string, body: unknown): Promise<Persona> {
  const { session, token } = await credenciales();
  if (estado.usuarioId !== session.id) estado = estadoInicial(session.id);
  if (estado.ocupados.includes(id)) throw new Error('La solicitud se está procesando.');
  ++cargaMatching;
  estado = { ...estado, ocupados: [...estado.ocupados, id], cargandoMatches: false };
  emitir();
  try {
    const c = await apiRequest<ConexionApi>(path, { method: 'POST', token, body });
    if (!await mismaSesion(session.id, token)) throw new Error('La sesión cambió. Vuelve a cargar tus matches.');
    ++cargaMatching;
    const p = personaConexion(c);
    estado = { ...estado,
      solicitudes: estado.solicitudes.filter((p) => p.id !== id),
      solicitudesEnviadas: estado.solicitudesEnviadas.filter((p) => p.id !== id),
      confirmados: estado.confirmados.filter((p) => p.id !== id),
      enviadas: estado.enviadas.filter((uid) => uid !== id), matchingError: null };
    if (c.status === 'accepted') estado.confirmados = [p, ...estado.confirmados];
    else if (c.status === 'rejected') estado.ocultos = [...estado.ocultos, id];
    else if (c.recipient_id === session.id) estado.solicitudes = [p, ...estado.solicitudes];
    else {
      estado.enviadas = [...estado.enviadas, id];
      estado.solicitudesEnviadas = [p, ...estado.solicitudesEnviadas];
    }
    return p;
  } finally {
    if (estado.usuarioId === session.id) {
      estado = { ...estado, ocupados: estado.ocupados.filter((uid) => uid !== id) };
      emitir();
    }
  }
}

export async function aceptarSolicitud(id: string): Promise<Persona> {
  const requestId = estado.solicitudes.find((p) => p.id === id)?.requestId;
  if (!requestId) throw new Error('La solicitud ya no está disponible. Actualiza la lista.');
  return cambiarConexion(id, `/matching/requests/${requestId}/decision`, { action: 'accept' });
}

export async function rechazarSolicitud(id: string): Promise<void> {
  const requestId = estado.solicitudes.find((p) => p.id === id)?.requestId;
  if (!requestId) throw new Error('La solicitud ya no está disponible. Actualiza la lista.');
  await cambiarConexion(id, `/matching/requests/${requestId}/decision`, { action: 'reject' });
}

export async function darLike(persona: Persona): Promise<Persona> {
  return cambiarConexion(persona.id, '/matching/requests', { recipient_id: persona.id });
}

export async function cancelarSolicitud(id: string): Promise<void> {
  const { session, token } = await credenciales();
  if (estado.usuarioId !== session.id) estado = estadoInicial(session.id);
  const requestId = estado.solicitudesEnviadas.find((p) => p.id === id)?.requestId;
  if (!requestId) throw new Error('La solicitud ya no está disponible. Actualiza la lista.');
  if (estado.ocupados.includes(id)) throw new Error('La solicitud se está procesando.');
  ++cargaMatching;
  estado = { ...estado, ocupados: [...estado.ocupados, id], cargandoMatches: false };
  emitir();
  let actualizar = false;
  try {
    await apiRequest<void>(`/matching/requests/${encodeURIComponent(requestId)}`, { method: 'DELETE', token });
    if (!await mismaSesion(session.id, token)) throw new Error('La sesión cambió. Vuelve a cargar tus matches.');
    ++cargaMatching;
    estado = { ...estado,
      solicitudesEnviadas: estado.solicitudesEnviadas.filter((p) => p.requestId !== requestId),
      enviadas: estado.enviadas.filter((uid) => uid !== id), matchingError: null };
  } catch (e) {
    actualizar = e instanceof ApiError && [404, 409].includes(e.status);
    throw e;
  } finally {
    if (estado.usuarioId === session.id) {
      estado = { ...estado, ocupados: estado.ocupados.filter((uid) => uid !== id) };
      emitir();
      if (actualizar && await mismaSesion(session.id, token)) await cargarMatching();
    }
  }
}

export function descartar(id: string) {
  estado = { ...estado, descartados: [...estado.descartados, id] };
  emitir();
}

/** Vuelve a mostrar descartados; las solicitudes y matches se conservan en el servidor. */
export function recargarDeportistas() {
  estado = { ...estado, descartados: [] };
  emitir();
  void cargarSugerencias();
}
