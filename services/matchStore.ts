import { useSyncExternalStore } from 'react';
import { FOTOS } from '../assets/personas';
import type { CalificacionRecibida } from './reputacion';

export type Persona = {
  id: string;
  name: string;
  age?: number;
  sport: string;
  level: string;
  distance?: string;
  distanceKm?: number;
  compatibility: number;
  colorFrom: string;
  bio?: string;
  fotoUri?: string | null;
  /** Simulación: esta persona ya te dio like, así que si le das like también es match. */
  leGustas?: boolean;
};

export type Calificacion = { estrellas: number; comentario?: string };

type Estado = {
  catalogo: Persona[];
  cargando: boolean;
  error: string | null;
  sesionExpirada: boolean;
  usuarioId: string | null;
  solicitudes: Persona[];
  confirmados: Persona[];
  enviadas: string[];
  descartados: string[];
  /** Radio de búsqueda en km; null = sin filtro (ver a todos). */
  radioKm: number | null;
  /** Calificaciones que TÚ diste a tus matches, por id de persona. */
  calificaciones: Record<string, Calificacion>;
  /** Calificaciones que TÚ recibiste de otros deportistas. */
  calificacionesRecibidas: CalificacionRecibida[];
};

// Le pone a cada persona su foto de assets/personas (si no tiene, se muestran las iniciales).
const conFoto = (p: Persona): Persona => ({ ...p, fotoUri: FOTOS[p.id] ?? p.fotoUri ?? null });

// Catálogo de prueba completo (sin backend). Se reemplaza por cargarSugerencias()
// real cuando vuelvas a usar matchStore.backend.ts.
const CATALOGO_BASE: Persona[] = [
  { id: 'camila', name: 'Camila R.', age: 24, sport: 'Running', level: 'Intermedio', distance: '1.8 km', distanceKm: 1.8, compatibility: 95, colorFrom: '#3648A6', bio: 'Entrenando para una media maratón. Busco compañera para trotes de fondo los fines de semana.' },
  { id: 'diego', name: 'Diego A.', age: 27, sport: 'Fútbol', level: 'Intermedio', distance: '2.3 km', distanceKm: 2.3, compatibility: 89, colorFrom: '#1F2A5C', bio: 'Juego 2 veces por semana, busco gente para armar equipo fijo.' },
  { id: 'fernanda', name: 'Fernanda S.', age: 22, sport: 'Trekking', level: 'Intermedio', distance: '2.7 km', distanceKm: 2.7, compatibility: 87, colorFrom: '#22C55E', bio: 'Salidas a cerros los fines de semana, ritmo tranquilo pero constante.', leGustas: true },
  { id: 'ignacia', name: 'Ignacia V.', age: 25, sport: 'Ciclismo', level: 'Intermedio', distance: '3.1 km', distanceKm: 3.1, compatibility: 83, colorFrom: '#7C3AED', bio: 'Ruta los sábados temprano. Busco compañía para rodar y subir cuestas.', leGustas: true },
  { id: 'jorge', name: 'Jorge M.', age: 26, sport: 'Trekking', level: 'Avanzado', distance: '3.4 km', distanceKm: 3.4, compatibility: 80, colorFrom: '#0EA5E9', bio: 'Trekking de montaña y fotografía. Busco gente para rutas largas.' },
  { id: 'matias', name: 'Matías P.', age: 29, sport: 'Ciclismo', level: 'Avanzado', distance: '3.2 km', distanceKm: 3.2, compatibility: 78, colorFrom: '#1F2A5C', bio: 'Ciclismo de ruta, salgo con grupo los domingos. Busco ritmo competitivo.' },
];
export const CATALOGO: Persona[] = CATALOGO_BASE.map(conFoto);

const DEMO_MATCHES_BASE: Persona[] = [
  { id: 'ignacio', name: 'Ignacio R.', age: 28, sport: 'Natación', level: 'Avanzado', distance: '4.0 km', distanceKm: 4.0, compatibility: 85, colorFrom: '#0EA5E9', bio: 'Nado en piscina temperada varias veces por semana. Busco compañero para series.' },
  { id: 'catalina', name: 'Catalina T.', age: 23, sport: 'Yoga', level: 'Intermedio', distance: '2.9 km', distanceKm: 2.9, compatibility: 90, colorFrom: '#DB2777', bio: 'Yoga y meditación al aire libre, busco un grupo constante para practicar.' },
];
const DEMO_MATCHES: Persona[] = DEMO_MATCHES_BASE.map(conFoto);

// DATOS DE EJEMPLO: con un solo usuario de prueba no existen calificaciones reales recibidas.
// Vienen de Camila y Diego, que son los matches confirmados desde el inicio de la demo.
// Se marcan `simulada: true` para que la pantalla muestre la etiqueta "Ejemplo".
const CALIFICACIONES_RECIBIDAS_DEMO: CalificacionRecibida[] = [
  { id: 'rec-camila', de: 'Camila R.', estrellas: 5, comentario: 'Excelente compañera de running, siempre puntual.', cuando: 'Hace 2 semanas', simulada: true },
  { id: 'rec-diego', de: 'Diego A.', estrellas: 4, comentario: 'Buen ritmo y muy buena onda.', cuando: 'Hace 1 mes', simulada: true },
];

function estadoInicial(usuarioId: string | null = null): Estado {
  return {
    catalogo: CATALOGO,
    cargando: false,
    error: null,
    sesionExpirada: false,
    usuarioId,
    solicitudes: [...DEMO_MATCHES],
    confirmados: [CATALOGO[0], CATALOGO[1]], // Camila y Diego, como siempre
    enviadas: [],
    descartados: [],
    radioKm: null,
    calificaciones: {},
    calificacionesRecibidas: [...CALIFICACIONES_RECIBIDAS_DEMO],
  };
}

let estado: Estado = estadoInicial();
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

/** Simulado: no llama al backend, solo carga el catálogo de prueba al instante. */
export async function cargarSugerencias(): Promise<void> {
  estado = { ...estado, cargando: true, error: null, sesionExpirada: false };
  emitir();
  estado = { ...estado, cargando: false, catalogo: CATALOGO };
  emitir();
}

/**
 * Define el radio de búsqueda en km (null = sin filtro, ver a todos).
 * Las personas sin distanceKm nunca se excluyen por radio, para no ocultar
 * gente solo porque falta el dato (el backend real aún no lo entrega).
 */
export function setRadio(km: number | null) {
  estado = { ...estado, radioKm: km };
  emitir();
}

export function sugerencias(e: Estado): Persona[] {
  const ocupados = new Set([
    ...e.solicitudes.map((p) => p.id),
    ...e.confirmados.map((p) => p.id),
    ...e.enviadas,
    ...e.descartados,
  ]);
  return e.catalogo
    .filter((p) => !ocupados.has(p.id))
    .filter((p) => e.radioKm === null || p.distanceKm === undefined || p.distanceKm <= e.radioKm)
    .sort((a, b) => b.compatibility - a.compatibility);
}

export function aceptarSolicitud(id: string): Persona | undefined {
  const persona = estado.solicitudes.find((p) => p.id === id);
  if (!persona) return undefined;
  estado = {
    ...estado,
    solicitudes: estado.solicitudes.filter((p) => p.id !== id),
    confirmados: [...estado.confirmados, persona],
  };
  emitir();
  return persona;
}

export function rechazarSolicitud(id: string) {
  estado = { ...estado, solicitudes: estado.solicitudes.filter((p) => p.id !== id) };
  emitir();
}

export function darLike(persona: Persona): 'match' | 'enviada' {
  if (persona.leGustas) {
    estado = { ...estado, confirmados: [...estado.confirmados, persona] };
    emitir();
    return 'match';
  }
  estado = { ...estado, enviadas: [...estado.enviadas, persona.id] };
  emitir();
  return 'enviada';
}

export function descartar(id: string) {
  estado = { ...estado, descartados: [...estado.descartados, id] };
  emitir();
}

/** Personas a las que ya enviaste una solicitud y siguen sin responder. */
export function solicitudesEnviadas(e: Estado): Persona[] {
  return e.enviadas
    .map((id) => e.catalogo.find((p) => p.id === id))
    .filter((p): p is Persona => p !== undefined);
}

/** Cancela una solicitud enviada antes de que la respondan (HU-21). La persona vuelve a aparecer en Descubrir. */
export function cancelarSolicitud(id: string) {
  if (!estado.enviadas.includes(id)) return;
  estado = { ...estado, enviadas: estado.enviadas.filter((x) => x !== id) };
  emitir();
}

/** Califica (o actualiza la calificación) de un match confirmado. Una sola entrada por persona. */
export function calificar(personaId: string, estrellas: number, comentario?: string) {
  estado = {
    ...estado,
    calificaciones: {
      ...estado.calificaciones,
      [personaId]: { estrellas, comentario: comentario || undefined },
    },
  };
  emitir();
}

/** Devuelve la calificación que ya diste a esa persona, si existe. */
export function calificacionDe(e: Estado, personaId: string): Calificacion | undefined {
  return e.calificaciones[personaId];
}

export function reiniciarDemo() {
  estado = estadoInicial(estado.usuarioId);
  emitir();
}