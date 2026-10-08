import { useMemo, useSyncExternalStore } from 'react';
import { useMatches, type Persona } from './matchStore';
import type { CalificacionRecibida } from './reputacion';

export type TipoNotificacion = 'solicitud' | 'match' | 'calificacion';

export type Notificacion = {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  detalle: string;
  cuando: string;
  /** Minutos desde que ocurrió; sirve para ordenar (lo más reciente primero). */
  minutos: number;
  leida: boolean;
  /** Persona involucrada (para abrir su perfil o el chat). */
  persona?: Persona;
};

type Fuente = { solicitudes: Persona[]; confirmados: Persona[]; calificacionesRecibidas: CalificacionRecibida[] };

// DATOS DE EJEMPLO: cuándo "ocurrió" cada aviso inicial de la demo. Lo que se crea mientras usas
// la app (por ejemplo un match nuevo) no está aquí y aparece como "Ahora".
const MINUTOS_DEMO: Record<string, number> = {
  'sol-daniela': 12,
  'sol-ignacio': 95,
  'match-camila': 2 * 24 * 60,
  'match-diego': 7 * 24 * 60,
  'cal-rec-camila': 14 * 24 * 60,
  'cal-rec-diego': 30 * 24 * 60,
};

// DATOS DE EJEMPLO: avisos que llegan "de otros" y están sin leer al abrir la app.
// Lo que haces tú (aceptar, calificar...) no genera avisos sin leer.
const SIN_LEER_INICIALES = ['sol-daniela', 'sol-ignacio', 'cal-rec-camila'];

export function hace(minutos: number): string {
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${Math.floor(minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  const semanas = Math.floor(dias / 7);
  if (dias < 30) return `Hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`;
  const meses = Math.floor(dias / 30);
  return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

/** Arma la bandeja a partir de lo que ya sabe la app. Lo más reciente va primero. */
export function construirNotificaciones(e: Fuente, sinLeer: ReadonlySet<string>): Notificacion[] {
  const crear = (id: string, tipo: TipoNotificacion, titulo: string, detalle: string, persona?: Persona): Notificacion => {
    const minutos = MINUTOS_DEMO[id] ?? 0;
    return { id, tipo, titulo, detalle, cuando: hace(minutos), minutos, leida: !sinLeer.has(id), persona };
  };
  const items: Notificacion[] = [
    ...e.solicitudes.map((p) => crear(`sol-${p.id}`, 'solicitud', `${p.name} te envió una solicitud`, `${p.sport} · ${p.level} · ${p.compatibility} % compatible`, p)),
    ...e.confirmados.map((p) => crear(`match-${p.id}`, 'match', `Tú y ${p.name} son match`, 'Escríbele para coordinar un entrenamiento', p)),
    ...e.calificacionesRecibidas.map((c) => crear(`cal-${c.id}`, 'calificacion', `${c.de} te calificó con ${c.estrellas} ${c.estrellas === 1 ? 'estrella' : 'estrellas'}`, c.comentario ?? 'Sin comentario')),
  ];
  // Lo más reciente primero. Si dos ocurrieron "ahora", va antes el que llegó último
  // (las listas de matches y solicitudes agregan lo nuevo al final).
  return items
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.minutos - b.n.minutos || b.i - a.i)
    .map(({ n }) => n);
}

// ---------- qué falta por leer (se mantiene en memoria, como el resto de la versión simulada) ----------
let sinLeer: ReadonlySet<string> = new Set(SIN_LEER_INICIALES);
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getSinLeer = () => sinLeer;

export function marcarLeida(id: string) {
  if (!sinLeer.has(id)) return;
  const nuevo = new Set(sinLeer);
  nuevo.delete(id);
  sinLeer = nuevo;
  emitir();
}

export function marcarTodasLeidas() {
  if (sinLeer.size === 0) return;
  sinLeer = new Set();
  emitir();
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarNotificaciones() {
  sinLeer = new Set(SIN_LEER_INICIALES);
  emitir();
}

export function useNotificaciones() {
  const estado = useMatches();
  const pendientes = useSyncExternalStore(suscribir, getSinLeer, getSinLeer);
  const lista = useMemo(() => construirNotificaciones(estado, pendientes), [estado, pendientes]);
  const noLeidas = lista.filter((n) => !n.leida).length;
  return { lista, noLeidas };
}