import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';
import { alCambiar, crearSondeo } from './sondeo';

export const MAX_MENSAJE_GRUPAL = 1000;
export type AccesoGrupal = 'escribir' | 'leer' | 'ninguno';
export type MensajeGrupal = {
  id: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  propio: boolean;
  enviadoEn: number;
};
export type SalaGrupal = {
  actividadId: string;
  mensajes: MensajeGrupal[];
  noLeidos: number;
  silenciado: boolean;
  acceso: AccesoGrupal;
  participantes: number;
};
export type ChatGrupal = {
  actividadId: string;
  titulo: string;
  deporteCodigo: string;
  inicio: number;
  sala: SalaGrupal;
  acceso: AccesoGrupal;
  participantes: number;
};
export type ResultadoGrupal = {
  ok: true;
} | {
  ok: false;
  motivo: string;
};
type MensajeApi = {
  id: number;
  author_id: string;
  author_name: string;
  text: string;
  created_at: string;
  own: boolean;
};
type ChatApi = {
  activity_id: string;
  title: string;
  sport_code: string;
  starts_at: string;
  acceso: AccesoGrupal;
  participantes: number;
  ultimo: MensajeApi | null;
  unread: number;
  silenciado: boolean;
};
type SalaApi = {
  acceso: AccesoGrupal;
  participantes: number;
  silenciado: boolean;
  mensajes: MensajeApi[];
};
type Estado = {
  usuarioId: string | null;
  chats: ChatGrupal[];
  salas: Record<string, SalaGrupal>;
  cargando: boolean;
  error: string | null;
};
let estado: Estado = { usuarioId: null, chats: [], salas: {}, cargando: false, error: null };
const oyentes = new Set<() => void>();
const intentos = new Map<string, string>();
const intervalos = new Map<string, { detener(): void; ahora(): void; aviso(): void }>();
const leidos = new Map<string, number>();
const cargadas = new Set<string>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
};
const getEstado = () => estado;
const mensaje = (m: MensajeApi): MensajeGrupal => ({
  id: String(m.id),
  autorId: m.author_id,
  autorNombre: m.author_name,
  texto: m.text,
  propio: m.own,
  enviadoEn: Date.parse(m.created_at)
});
const motivo = (e: unknown) => e instanceof Error ? e.message : 'No se pudo conectar con el servidor.';

async function credenciales() {
  const [sesion, token] = await Promise.all([getSession(), getToken()]);
  if (!sesion || !token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  if (estado.usuarioId && estado.usuarioId !== sesion.id) {
    cargadas.clear();
    leidos.clear();
    estado = { usuarioId: sesion.id, chats: [], salas: {}, cargando: false, error: null };
  }
  return { usuarioId: sesion.id, token };
}

export async function cargarChatsGrupales(): Promise<boolean> {
  estado = { ...estado, cargando: true, error: null };
  emitir();
  try {
    const { usuarioId, token } = await credenciales();
    const lista = await apiRequest<ChatApi[]>('/activities/chats', { token });
    if ((await getSession())?.id !== usuarioId) return false;
    const cambios = lista.some((c) => {
      const previo = estado.chats.find((chat) => chat.actividadId === c.activity_id);
      return previo?.sala.mensajes.at(-1)?.id !== (c.ultimo ? String(c.ultimo.id) : undefined)
        || previo?.sala.noLeidos !== c.unread;
    }) || lista.length !== estado.chats.length;
    const chats = lista.map((c): ChatGrupal => {
      const anterior = estado.salas[c.activity_id];
      const nuevoUltimo = c.ultimo ? mensaje(c.ultimo) : undefined;
      const cambio = nuevoUltimo && anterior?.mensajes.at(-1)?.id !== nuevoUltimo.id;
      if (cambio && !intervalos.has(c.activity_id)) cargadas.delete(c.activity_id);
      const mensajes = cambio && !intervalos.has(c.activity_id)
        ? [nuevoUltimo]
        : anterior?.mensajes ?? (nuevoUltimo ? [nuevoUltimo] : []);
      const sala: SalaGrupal = {
        actividadId: c.activity_id,
        mensajes,
        noLeidos: c.unread,
        silenciado: c.silenciado,
        acceso: c.acceso,
        participantes: c.participantes
      };
      return {
        actividadId: c.activity_id,
        titulo: c.title,
        deporteCodigo: c.sport_code,
        inicio: Date.parse(c.starts_at),
        acceso: c.acceso,
        participantes: c.participantes,
        sala
      };
    });
    estado = {
      usuarioId,
      chats,
      salas: Object.fromEntries(chats.map((c) => [c.actividadId, c.sala])),
      cargando: false,
      error: null
    };
    emitir();
    return cambios;
  } catch (e) {
    estado = { ...estado, cargando: false, error: motivo(e) };
    emitir();
    throw e;
  }
}

export async function cargarSala(actividadId: string): Promise<boolean> {
  const { usuarioId, token } = await credenciales();
  const ruta = '/activities/' + encodeURIComponent(actividadId) + '/chat';
  const anterior = estado.salas[actividadId];
  const ultimo = cargadas.has(actividadId) ? anterior?.mensajes.at(-1) : undefined;
  const query = ultimo ? '?after_id=' + encodeURIComponent(ultimo.id) + '&limit=50' : '?limit=50';
  const data = await apiRequest<SalaApi>(ruta + '/messages' + query, { token });
  if ((await getSession())?.id !== usuarioId) return false;
  const mensajes = [
    ...(cargadas.has(actividadId) ? anterior?.mensajes ?? [] : []),
    ...data.mensajes.map(mensaje),
  ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  cargadas.add(actividadId);
  const sala: SalaGrupal = {
    actividadId,
    mensajes,
    acceso: data.acceso,
    participantes: data.participantes,
    silenciado: data.silenciado,
    noLeidos: anterior?.noLeidos ?? 0
  };
  estado = { ...estado, salas: { ...estado.salas, [actividadId]: sala }, error: null };
  emitir();
  const ultimoId = mensajes.at(-1)?.id;
  if (intervalos.has(actividadId) && ultimoId && Number(ultimoId) > (leidos.get(actividadId) ?? 0)) {
    await apiRequest<void>(ruta + '/read', { method: 'POST', token, body: { last_read_id: Number(ultimoId) } });
    leidos.set(actividadId, Number(ultimoId));
    estado = { ...estado, salas: { ...estado.salas, [actividadId]: { ...estado.salas[actividadId], noLeidos: 0 } } };
    emitir();
  }
  return data.mensajes.some((m) => !anterior?.mensajes.some((viejo) => viejo.id === String(m.id)));
}

export async function enviarMensajeGrupal(actividadId: string, texto: string): Promise<ResultadoGrupal> {
  const limpio = texto.trim();
  if (!limpio || limpio.length > MAX_MENSAJE_GRUPAL) {
    return { ok: false, motivo: 'Escribe entre 1 y ' + MAX_MENSAJE_GRUPAL + ' caracteres.' };
  }
  const clave = actividadId + ':' + limpio;
  if (!intentos.has(clave)) intentos.set(clave, Crypto.randomUUID());
  try {
    const { token } = await credenciales();
    await apiRequest<MensajeApi>(`/activities/${encodeURIComponent(actividadId)}/chat/messages`, {
      method: 'POST',
      token,
      body: { text: limpio, client_message_id: intentos.get(clave) },
    });
    intentos.delete(clave);
    intervalos.get(actividadId)?.ahora();
    if (!intervalos.has(actividadId)) await cargarSala(actividadId).catch(() => { });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: motivo(e) };
  }
}

export async function silenciarSala(actividadId: string, silenciado: boolean): Promise<ResultadoGrupal> {
  try {
    const { token } = await credenciales();
    await apiRequest<void>(`/activities/${encodeURIComponent(actividadId)}/chat/mute`, {
      method: 'PUT',
      token,
      body: { muted: silenciado },
    });
    await cargarChatsGrupales();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: motivo(e) };
  }
}

export function abrirSala(actividadId: string) {
  if (intervalos.has(actividadId)) return;
  const sondeo = crearSondeo('grupo:' + actividadId, () => cargarSala(actividadId).catch((e) => {
    estado = { ...estado, error: motivo(e) };
    emitir();
    return false;
  }), { minMs: 3000, maxMs: 15000, factor: 1.5 });
  const quitarAviso = alCambiar(({ tipo, id }) => {
    if (tipo === 'activity_chat' && id === actividadId) sondeo.ahora();
  });
  intervalos.set(actividadId, { ...sondeo, aviso: quitarAviso });
  sondeo.iniciar();
}

export function cerrarSala(actividadId: string) {
  const timer = intervalos.get(actividadId);
  timer?.detener();
  timer?.aviso();
  intervalos.delete(actividadId);
}

export function ultimoMensajeGrupal(s: SalaGrupal) {
  return s.mensajes.at(-1);
}

export function reiniciarChatGrupal() {
  intervalos.forEach((timer) => {
    timer.detener();
    timer.aviso();
  });
  intervalos.clear();
  leidos.clear();
  intentos.clear();
  cargadas.clear();
  estado = { usuarioId: null, chats: [], salas: {}, cargando: false, error: null };
  emitir();
}

export function useEstadoChatGrupal() {
  return useSyncExternalStore(suscribir, getEstado, getEstado);
}

export function useSalaGrupal(id: string) {
  return useEstadoChatGrupal().salas[id];
}

export function useChatGrupal(id: string) {
  return useEstadoChatGrupal().chats.find((c) => c.actividadId === id);
}

export function useChatsGrupales() {
  return useEstadoChatGrupal().chats;
}

export function useNoLeidosGrupales() {
  return useChatsGrupales().reduce((n, c) => n + (c.sala.silenciado ? 0 : c.sala.noLeidos), 0);
}
