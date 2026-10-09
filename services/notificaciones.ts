import { useMemo, useSyncExternalStore } from 'react';
import { getAvisos, useAvisos, type AvisoActividad } from './actividades';
import { useMatches, type Persona } from './matchStore';
import type { CalificacionRecibida } from './reputacion';

export type TipoNotificacion = 'solicitud' | 'match' | 'calificacion' | 'actividad';

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
  /** Actividad involucrada (para abrir su detalle). */
  actividadId?: string;
};

type Fuente = {
  solicitudes: Persona[];
  confirmados: Persona[];
  calificacionesRecibidas: CalificacionRecibida[];
  /** Cambios o cancelaciones de actividades en las que participas (HU-37). */
  avisos?: AvisoActividad[];
};

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

export const idAviso = (a: AvisoActividad) => `act-${a.id}`;

/** Arma la bandeja a partir de lo que ya sabe la app. Lo más reciente va primero. */
export function construirNotificaciones(e: Fuente, sinLeer: ReadonlySet<string>, ahora: number = Date.now()): Notificacion[] {
  const crear = (id: string, tipo: TipoNotificacion, titulo: string, detalle: string, persona?: Persona): Notificacion => {
    const minutos = MINUTOS_DEMO[id] ?? 0;
    return { id, tipo, titulo, detalle, cuando: hace(minutos), minutos, leida: !sinLeer.has(id), persona };
  };
  const items: Notificacion[] = [
    ...e.solicitudes.map((p) => crear(`sol-${p.id}`, 'solicitud', `${p.name} te envió una solicitud`, `${p.sport} · ${p.level} · ${p.compatibility} % compatible`, p)),
    ...e.confirmados.map((p) => crear(`match-${p.id}`, 'match', `Tú y ${p.name} son match`, 'Escríbele para coordinar un entrenamiento', p)),
    ...e.calificacionesRecibidas.map((c) => crear(`cal-${c.id}`, 'calificacion', `${c.de} te calificó con ${c.estrellas} ${c.estrellas === 1 ? 'estrella' : 'estrellas'}`, c.comentario ?? 'Sin comentario')),
    ...(e.avisos ?? []).map((a): Notificacion => {
      const minutos = Math.max(0, (ahora - a.ts) / 60000);
      return { id: idAviso(a), tipo: 'actividad', titulo: a.titulo, detalle: a.detalle, cuando: hace(minutos), minutos, leida: !sinLeer.has(idAviso(a)), actividadId: a.actividadId };
    }),
  ];
  // Lo más reciente primero. Si dos ocurrieron "ahora", va antes el que llegó último
  // (las listas de matches y solicitudes agregan lo nuevo al final).
  return items
    .map((n, i) => ({ n, i }))
    .sort((a, b) => a.n.minutos - b.n.minutos || b.i - a.i)
    .map(({ n }) => n);
}

// ---------- qué falta por leer (se mantiene en memoria, como el resto de la versión simulada) ----------
type Estado = { sinLeer: ReadonlySet<string>; avisosLeidos: ReadonlySet<string> };
let estado: Estado = { sinLeer: new Set(SIN_LEER_INICIALES), avisosLeidos: new Set() };
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getEstado = () => estado;

export function marcarLeida(id: string) {
  if (id.startsWith('act-')) {
    if (estado.avisosLeidos.has(id)) return;
    estado = { ...estado, avisosLeidos: new Set(estado.avisosLeidos).add(id) };
  } else {
    if (!estado.sinLeer.has(id)) return;
    const nuevo = new Set(estado.sinLeer);
    nuevo.delete(id);
    estado = { ...estado, sinLeer: nuevo };
  }
  emitir();
}

export function marcarTodasLeidas() {
  estado = { sinLeer: new Set(), avisosLeidos: new Set(getAvisos().map(idAviso)) };
  emitir();
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarNotificaciones() {
  estado = { sinLeer: new Set(SIN_LEER_INICIALES), avisosLeidos: new Set() };
  emitir();
}

export function useNotificaciones() {
  const matches = useMatches();
  const avisos = useAvisos();
  const leidos = useSyncExternalStore(suscribir, getEstado, getEstado);
  const lista = useMemo(() => {
    // Los avisos de actividades nacen sin leer: lo pendiente es todo lo que aún no se marcó.
    const pendientes = new Set(leidos.sinLeer);
    avisos.forEach((a) => { if (!leidos.avisosLeidos.has(idAviso(a))) pendientes.add(idAviso(a)); });
    return construirNotificaciones({ ...matches, avisos }, pendientes);
  }, [matches, avisos, leidos]);
  const noLeidas = lista.filter((n) => !n.leida).length;
  return { lista, noLeidas };
}