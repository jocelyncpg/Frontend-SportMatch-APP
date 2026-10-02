import { useSyncExternalStore } from 'react';

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
};

// Catálogo de prueba completo (sin backend). Se reemplaza por cargarSugerencias()
// real cuando vuelvas a usar matchStore.backend.ts.
export const CATALOGO: Persona[] = [
  { id: 'camila', name: 'Camila R.', age: 24, sport: 'Running', level: 'Intermedio', distance: '1.8 km', distanceKm: 1.8, compatibility: 95, colorFrom: '#3648A6', bio: 'Entrenando para una media maratón. Busco compañera para trotes de fondo los fines de semana.' },
  { id: 'diego', name: 'Diego A.', age: 27, sport: 'Fútbol', level: 'Intermedio', distance: '2.3 km', distanceKm: 2.3, compatibility: 89, colorFrom: '#1F2A5C', bio: 'Juego 2 veces por semana, busco gente para armar equipo fijo.' },
  { id: 'sofia', name: 'Sofía T.', age: 23, sport: 'Yoga', level: 'Intermedio', distance: '2.1 km', distanceKm: 2.1, compatibility: 91, colorFrom: '#DB2777', bio: 'Practico yoga al aire libre y me encantaría sumar gente a las clases de los sábados.', leGustas: true },
  { id: 'valentina', name: 'Valentina S.', age: 22, sport: 'Ciclismo', level: 'Intermedio', distance: '2.7 km', distanceKm: 2.7, compatibility: 87, colorFrom: '#22C55E', bio: 'Salidas los sábados en la mañana, ritmo tranquilo pero constante.', leGustas: true },
  { id: 'andres', name: 'Andrés M.', age: 25, sport: 'Running', level: 'Principiante', distance: '3.1 km', distanceKm: 3.1, compatibility: 83, colorFrom: '#7C3AED', bio: 'Recién empezando a correr, busco compañía para agarrar el hábito.' },
  { id: 'tomas', name: 'Tomás L.', age: 26, sport: 'Natación', level: 'Avanzado', distance: '3.4 km', distanceKm: 3.4, compatibility: 80, colorFrom: '#0EA5E9', bio: 'Nado 3 veces por semana en piscina temperada. Busco alguien para entrenar series.' },
  { id: 'matias', name: 'Matías P.', age: 29, sport: 'Fútbol', level: 'Avanzado', distance: '3.2 km', distanceKm: 3.2, compatibility: 78, colorFrom: '#1F2A5C', bio: 'Nivel competitivo, juego en liga amateur los domingos.' },
];

const DEMO_MATCHES: Persona[] = [
  { id: 'ignacio', name: 'Ignacio R.', age: 28, sport: 'Ciclismo', level: 'Avanzado', distance: '4.0 km', distanceKm: 4.0, compatibility: 85, colorFrom: '#7C3AED', bio: 'Ruta y montaña. Salgo casi todos los domingos temprano.' },
  { id: 'daniela', name: 'Daniela S.', age: 24, sport: 'Yoga', level: 'Intermedio', distance: '2.9 km', distanceKm: 2.9, compatibility: 90, colorFrom: '#22C55E', bio: 'Yoga y meditación, busco un grupo constante para practicar.' },
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
 * Nota: el backend real todavía no entrega distancia en /users/suggestions
 * (ver comentario de Benjamín en matchStore.backend.ts). Mientras eso no
 * exista, las personas sin distanceKm nunca se excluyen por radio, para no
 * ocultar gente solo porque falta el dato.
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

export function reiniciarDemo() {
  estado = estadoInicial(estado.usuarioId);
  emitir();
}