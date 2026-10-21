import { useSyncExternalStore } from 'react';
import { apiRequest, ApiError } from './api';
import { getSession, getToken } from './auth';
import { ConexionApi, personaConexion } from './matchStore';

// Chat sobre Ms_Matching (vía gateway): /matching/matches/{id} para la ficha del match y
// /chats para la lista con no leídos, los mensajes con ubicación o adjunto y el estado de lectura.
// Silenciar vive en Ms_Users (/users/chat-preferences); bloquear, en services/reportes.ts.

export type TipoMensaje = 'TEXT' | 'IMAGE' | 'LOCATION' | 'FILE';

export type MensajeApi = {
  id: string; match_id: string; sender_id: string; client_message_id: string;
  text: string; created_at: string;
  read_at?: string | null; is_read?: boolean;
  message_type?: TipoMensaje;
  attachment_url?: string | null; attachment_name?: string | null;
  latitude?: number | null; longitude?: number | null; location_name?: string | null;
};

/** Punto geolocalizado que se comparte en un chat (HU-58). */
export type UbicacionChat = { latitud: number; longitud: number; comuna?: string };

async function chatRequest<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {}) {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) throw new ApiError('Inicia sesión para abrir el chat.', 401, '');
  const data = await apiRequest<T>(path, { ...options, token });
  const [current, currentToken] = await Promise.all([getSession(), getToken()]);
  if (current?.id !== session.id || currentToken !== token) throw new ApiError('La sesión cambió.', 401, '');
  return { data, userId: session.id };
}

export async function getChat(matchId: string) {
  const result = await chatRequest<ConexionApi>(`/matching/matches/${encodeURIComponent(matchId)}`);
  return { persona: personaConexion(result.data), userId: result.userId };
}

/** Página de mensajes. Leerla marca como leídos los mensajes de la otra persona. */
export async function getMensajes(matchId: string, cursor: { after?: string; before?: string } = {}) {
  const query = cursor.after ? `&after_id=${cursor.after}` : cursor.before ? `&before_id=${cursor.before}` : '';
  return (await chatRequest<MensajeApi[]>(`/chats/${encodeURIComponent(matchId)}/messages?limit=50${query}`)).data;
}

async function enviar(matchId: string, body: Record<string, unknown>) {
  return (await chatRequest<MensajeApi>(`/chats/${encodeURIComponent(matchId)}/messages`, { method: 'POST', body })).data;
}

export function enviarMensaje(matchId: string, text: string, clientId: string) {
  return enviar(matchId, { type: 'TEXT', content: text, clientMessageId: clientId });
}

/** Comparte un punto geolocalizado (HU-58). */
export function enviarUbicacion(matchId: string, ubicacion: UbicacionChat, clientId: string) {
  return enviar(matchId, {
    type: 'LOCATION', latitude: ubicacion.latitud, longitude: ubicacion.longitud,
    locationName: ubicacion.comuna || undefined, clientMessageId: clientId,
  });
}

/**
 * Ms_Matching solo guarda enlaces https a un almacenamiento de confianza (CHAT_ATTACHMENT_HOSTS);
 * no recibe archivos. Hasta que exista un servicio de subida, la app no puede enviar fotos
 * (una ruta file:// del teléfono no la puede abrir la otra persona), pero sí muestra las que lleguen.
 */
export const ENVIO_DE_FOTOS_DISPONIBLE = false;

/** Texto corto para la lista de chats y los avisos (como lo resume el backend). */
export function resumenMensaje(m: Pick<MensajeApi, 'text' | 'message_type' | 'location_name'>): string {
  if (m.message_type === 'LOCATION') return m.location_name ? `📍 Ubicación: ${m.location_name}` : '📍 Ubicación compartida';
  if (m.message_type === 'IMAGE') return m.text ? `📷 ${m.text}` : '📷 Foto';
  if (m.message_type === 'FILE') return m.text ? `📎 ${m.text}` : '📎 Archivo';
  return m.text;
}

/** "18:42" si es de hoy, "Ayer" si es de ayer, "05/10" si es más antiguo. */
export function horaCorta(enviadoEn: number, ahora: number = Date.now()): string {
  const d = new Date(enviadoEn);
  const hoy = new Date(ahora);
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const DIA = 24 * 60 * 60 * 1000;
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  if (enviadoEn >= inicioHoy) return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
  if (enviadoEn >= inicioHoy - DIA) return 'Ayer';
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`;
}

// ---------- lista de chats, no leídos, silenciados y aviso entrante (HU-49, HU-59, HU-60) ----------

type ChatSummaryApi = {
  conversationId: string;
  participant: { userId: string; name: string; avatarUrl: string | null };
  lastMessage: { content: string; senderId: string; createdAt: string; type: TipoMensaje } | null;
  unreadCount: number;
};
type ChatPreferencesApi = { muted_users: { user_id: string }[] };

export type ResumenChat = {
  /** Id del match (= de la conversación). */
  matchId: string;
  personaId: string;
  nombre: string;
  ultimo: { texto: string; propio: boolean; enviadoEn: number; tipo: TipoMensaje } | null;
  noLeidos: number;
};

/** Aviso dentro de la app cuando llega un mensaje y no estás en ese chat (HU-60). */
export type AvisoEntrante = { id: string; matchId: string; personaId: string; nombre: string; texto: string };

type Estado = {
  usuarioId: string | null;
  chats: Record<string, ResumenChat>;
  /** Ids de usuario silenciados (HU-59): sus mensajes llegan, pero sin aviso. */
  silenciados: string[];
  chatAbierto: string | null;
  aviso: AvisoEntrante | null;
  cargado: boolean;
};
const inicial: Estado = { usuarioId: null, chats: {}, silenciados: [], chatAbierto: null, aviso: null, cargado: false };
let estado: Estado = inicial;
let version = 0;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };

export const useChats = () => useSyncExternalStore(suscribir, () => estado.chats, () => estado.chats);
export const useSilenciados = () => useSyncExternalStore(suscribir, () => estado.silenciados, () => estado.silenciados);
export const useAvisoEntrante = () => useSyncExternalStore(suscribir, () => estado.aviso, () => estado.aviso);

/** Total de mensajes sin leer de chats no silenciados (para el globo de la pestaña). */
export function totalNoLeidos(e: Pick<Estado, 'chats' | 'silenciados'> = estado): number {
  return Object.values(e.chats).reduce((suma, c) => suma + (e.silenciados.includes(c.personaId) ? 0 : c.noLeidos), 0);
}
export const useNoLeidosTotal = () => useSyncExternalStore(suscribir, () => totalNoLeidos(), () => totalNoLeidos());

/** Lee la lista de chats y deja un aviso si llegó algo nuevo a un chat cerrado y no silenciado. */
export async function cargarChats(): Promise<void> {
  const actual = version;
  const [{ data: lista, userId }, preferencias] = await Promise.all([
    chatRequest<ChatSummaryApi[]>('/chats?limit=100'),
    // Si Ms_Users no responde, se conserva la última lista de silenciados.
    chatRequest<ChatPreferencesApi>('/users/chat-preferences').then((r) => r.data).catch(() => null),
  ]);
  if (actual !== version) return;
  const mismoUsuario = estado.usuarioId === userId;
  const previos = mismoUsuario ? estado.chats : {};
  const silenciados = preferencias ? preferencias.muted_users.map((u) => u.user_id) : mismoUsuario ? estado.silenciados : [];
  const chats: Record<string, ResumenChat> = {};
  let aviso = mismoUsuario ? estado.aviso : null;
  for (const c of lista) {
    const abierto = estado.chatAbierto === c.conversationId;
    const r: ResumenChat = {
      matchId: c.conversationId,
      personaId: c.participant.userId,
      nombre: c.participant.name,
      ultimo: c.lastMessage ? {
        texto: c.lastMessage.content, propio: c.lastMessage.senderId === userId,
        enviadoEn: Date.parse(c.lastMessage.createdAt), tipo: c.lastMessage.type,
      } : null,
      // El chat abierto ya está leído aunque el servidor aún no lo sepa.
      noLeidos: abierto ? 0 : c.unreadCount,
    };
    chats[r.matchId] = r;
    const antes = previos[r.matchId]?.noLeidos ?? 0;
    // En la primera carga no se avisa de lo que ya estaba pendiente.
    if (estado.cargado && mismoUsuario && r.noLeidos > antes && r.ultimo && !r.ultimo.propio && !silenciados.includes(r.personaId)) {
      aviso = { id: `${r.matchId}:${r.ultimo.enviadoEn}`, matchId: r.matchId, personaId: r.personaId, nombre: r.nombre, texto: r.ultimo.texto };
    }
  }
  estado = { ...estado, usuarioId: userId, chats, silenciados, aviso, cargado: true };
  emitir();
}

/** Entras a un chat: queda abierto, leído y sin aviso pendiente. */
export function abrirChat(matchId: string) {
  const c = estado.chats[matchId];
  estado = {
    ...estado,
    chatAbierto: matchId,
    aviso: estado.aviso?.matchId === matchId ? null : estado.aviso,
    chats: c && c.noLeidos > 0 ? { ...estado.chats, [matchId]: { ...c, noLeidos: 0 } } : estado.chats,
  };
  emitir();
}

/** Sales del chat. Solo cierra si sigue siendo ese chat (evita pisar uno recién abierto). */
export function cerrarChat(matchId: string) {
  if (estado.chatAbierto !== matchId) return;
  estado = { ...estado, chatAbierto: null };
  emitir();
}

export function descartarAviso() {
  if (estado.aviso === null) return;
  estado = { ...estado, aviso: null };
  emitir();
}

/** Silencia o reactiva los avisos de una persona (HU-59). */
export async function silenciarChat(personaId: string, silenciado: boolean): Promise<void> {
  const { data } = await chatRequest<ChatPreferencesApi>('/users/chat-preferences', {
    method: 'PATCH', body: silenciado ? { muteUserIds: [personaId] } : { unmuteUserIds: [personaId] },
  });
  estado = {
    ...estado,
    silenciados: data.muted_users.map((u) => u.user_id),
    aviso: silenciado && estado.aviso?.personaId === personaId ? null : estado.aviso,
  };
  emitir();
}

/** Marca como leídos todos los chats con pendientes (lo usa "Marcar todas" en Notificaciones). */
export async function marcarTodasLeidasEnChats(): Promise<void> {
  const pendientes = Object.values(estado.chats).filter((c) => c.noLeidos > 0);
  if (!pendientes.length) return;
  await Promise.all(pendientes.map((c) => chatRequest(`/chats/${encodeURIComponent(c.matchId)}/read`, { method: 'PATCH' })));
  const chats = { ...estado.chats };
  for (const c of pendientes) if (chats[c.matchId]) chats[c.matchId] = { ...chats[c.matchId], noLeidos: 0 };
  estado = { ...estado, chats, aviso: null };
  emitir();
}

/** Al cerrar sesión. */
export function reiniciarChat() {
  version++;
  estado = inicial;
  emitir();
}
