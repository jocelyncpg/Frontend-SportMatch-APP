import { useSyncExternalStore } from 'react';
import { apiRequest } from './api';
import { getSession, getToken } from './auth';
import { avisarCambio } from './sondeo';

export type TipoNotificacion = 'solicitud' | 'match' | 'mensaje' | 'calificacion' | 'actividad' | 'canal';
export type DestinoNotificacion = {
  screen?: string;
  activityId?: string;
  matchId?: string;
  clubId?: string;
  hiloId?: string;
  canalId?: string;
};
export function avisarDestino(data: DestinoNotificacion) {
  if (data.screen === 'activity_chat') avisarCambio('activity_chat', data.activityId);
  if (data.screen === 'consulta') avisarCambio('consulta', data.clubId);
  if (data.screen === 'consulta_club') avisarCambio('consulta_club', data.hiloId);
  if (data.screen === 'canal_inactivo') avisarCambio('canal_inactivo', data.canalId);
  if (data.screen === 'canal') avisarCambio('canal', data.canalId);
  if (data.screen === 'chat') avisarCambio('chat', data.matchId);
}
export type Notificacion = {
  id: string; tipo: TipoNotificacion; titulo: string; detalle: string;
  cuando: string; leida: boolean; data: DestinoNotificacion;
  /** Solo en avisos de postulación: cómo respondió quien organiza (HU-38). */
  resultado?: 'aprobada' | 'rechazada';
};

// Ms_Activities titula así la respuesta a una postulación (migración 006_notification_outbox).
const RESULTADO_POR_TITULO: Record<string, Notificacion['resultado']> = {
  'Postulación aceptada': 'aprobada',
  'Postulación rechazada': 'rechazada',
};
type ItemApi = {
  id: string; kind: TipoNotificacion; title: string; body: string;
  created_at: string; read_at: string | null; data: DestinoNotificacion;
};
type Pagina = { items: ItemApi[]; unread: number; next_cursor: string | null };
type Estado = { usuarioId: string | null; lista: Notificacion[]; noLeidas: number;
  siguiente: string | null; cargando: boolean; error: string | null };
const inicial: Estado = { usuarioId: null, lista: [], noLeidas: 0, siguiente: null, cargando: false, error: null };
let estado: Estado = inicial;
let version = 0;
let paginaInicialCargada = false;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getEstado = () => estado;

export function hace(minutos: number): string {
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${Math.floor(minutos)} min`;
  if (minutos < 1440) return `Hace ${Math.floor(minutos / 60)} h`;
  const dias = Math.floor(minutos / 1440);
  return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export function reiniciarNotificaciones() {
  version++;
  paginaInicialCargada = false;
  estado = inicial;
  emitir();
}

export async function cargarNotificaciones(mas = false) {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) { reiniciarNotificaciones(); return; }
  if (estado.usuarioId !== session.id) {
    version++;
    paginaInicialCargada = false;
    estado = { ...inicial, usuarioId: session.id };
  }
  if (estado.cargando || (mas && !estado.siguiente)) return;
  const actual = version;
  const vigente = async () => actual === version
    && (await getSession())?.id === session.id
    && await getToken() === token;
  estado = { ...estado, cargando: true, error: null };
  emitir();
  try {
    const ruta = `/notifications?limit=50${mas ? `&before=${estado.siguiente}` : ''}`;
    const pagina = await apiRequest<Pagina>(ruta, { token, timeoutMs: 15000 });
    if (!await vigente()) return;
    const nuevos = pagina.items.map((n): Notificacion => ({ id: n.id, tipo: n.kind, titulo: n.title,
      detalle: n.body, leida: !!n.read_at, data: n.data,
      resultado: n.kind === 'actividad' ? RESULTADO_POR_TITULO[n.title] : undefined,
      cuando: hace(Math.max(0, (Date.now() - Date.parse(n.created_at)) / 60000)) }));
    if (!mas && paginaInicialCargada) {
      nuevos.filter((n) => !n.leida && !estado.lista.some((vieja) => vieja.id === n.id))
        .forEach((n) => avisarDestino(n.data));
    }
    if (!mas) paginaInicialCargada = true;
    const conservarHistorial = !mas && estado.lista.length > 50;
    const lista = mas
      ? [...estado.lista, ...nuevos.filter((n) => !estado.lista.some((old) => old.id === n.id))]
      : conservarHistorial
        ? [...nuevos, ...estado.lista.filter((n) => !nuevos.some((item) => item.id === n.id))]
        : nuevos;
    estado = {
      ...estado,
      lista,
      noLeidas: pagina.unread,
      siguiente: conservarHistorial ? estado.siguiente : pagina.next_cursor,
    };
  } catch (error) {
    if (await vigente()) {
      estado = { ...estado, error: error instanceof Error ? error.message : 'No se pudieron cargar los avisos.' };
    }
  } finally {
    if (actual === version) {
      estado = { ...estado, cargando: false };
      emitir();
    }
  }
}

async function marcar(ids: string[]) {
  if (!ids.length) return;
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!token || !session) return;
  await apiRequest('/notifications/read', { method: 'POST', token, body: { ids }, timeoutMs: 15000 });
  if ((await getSession())?.id !== session.id || await getToken() !== token) return;
  if (estado.usuarioId !== session.id) { await cargarNotificaciones(); return; }
  version++;
  const cambiadas = estado.lista.filter((n) => ids.includes(n.id) && !n.leida).length;
  estado = { ...estado, cargando: false, lista: estado.lista.map((n) => ids.includes(n.id) ? { ...n, leida: true } : n),
    noLeidas: Math.max(0, estado.noLeidas - cambiadas) };
  emitir();
}

export const marcarLeida = (id: string) => marcar([id]);
// Only displayed IDs are acknowledged; notifications arriving concurrently remain unread.
export async function marcarTodasLeidas() {
  // Los mensajes sin leer de los chats también se muestran aquí (ver notificaciones.tsx).
  const { marcarTodasLeidasEnChats } = await import('./chat');
  await marcarTodasLeidasEnChats().catch(() => {});
  const ids = estado.lista.filter((n) => !n.leida).map((n) => n.id);
  const usuarioId = estado.usuarioId;
  for (let i = 0; i < ids.length && estado.usuarioId === usuarioId; i += 100) await marcar(ids.slice(i, i + 100));
}
export const useNotificaciones = () => useSyncExternalStore(suscribir, getEstado, getEstado);
