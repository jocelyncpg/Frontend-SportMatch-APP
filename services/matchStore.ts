import { useSyncExternalStore } from 'react';

export type Persona = {
  id: string;
  name: string;
  age?: number;
  sport: string;
  level: string;
  distance?: string;
  compatibility: number;
  colorFrom: string;
  bio?: string;
  fotoUri?: string | null;
  /** Simulación: esta persona ya te dio like, así que si le das like también es match. */
  leGustas?: boolean;
};

type Estado = {
  solicitudes: Persona[];
  confirmados: Persona[];
  enviadas: string[];
  descartados: string[];
};

// Datos de prueba: se reemplazan por la API cuando el backend de matching esté listo.
export const CATALOGO: Persona[] = [
  { id: 'camila', name: 'Camila R.', age: 24, sport: 'Running', level: 'Intermedio', distance: '1.8 km', compatibility: 95, colorFrom: '#3648A6', bio: 'Entrenando para una media maratón. Busco compañera para trotes de fondo los fines de semana.' },
  { id: 'diego', name: 'Diego A.', age: 27, sport: 'Fútbol', level: 'Intermedio', distance: '2.3 km', compatibility: 89, colorFrom: '#1F2A5C', bio: 'Juego 2 veces por semana, busco gente para armar equipo fijo.' },
  { id: 'sofia', name: 'Sofía T.', age: 23, sport: 'Yoga', level: 'Intermedio', distance: '2.1 km', compatibility: 91, colorFrom: '#DB2777', bio: 'Practico yoga al aire libre y me encantaría sumar gente a las clases de los sábados.', leGustas: true },
  { id: 'valentina', name: 'Valentina S.', age: 22, sport: 'Ciclismo', level: 'Intermedio', distance: '2.7 km', compatibility: 87, colorFrom: '#22C55E', bio: 'Salidas los sábados en la mañana, ritmo tranquilo pero constante.', leGustas: true },
  { id: 'andres', name: 'Andrés M.', age: 25, sport: 'Running', level: 'Principiante', distance: '3.1 km', compatibility: 83, colorFrom: '#7C3AED', bio: 'Recién empezando a correr, busco compañía para agarrar el hábito.' },
  { id: 'tomas', name: 'Tomás L.', age: 26, sport: 'Natación', level: 'Avanzado', distance: '3.4 km', compatibility: 80, colorFrom: '#0EA5E9', bio: 'Nado 3 veces por semana en piscina temperada. Busco alguien para entrenar series.' },
  { id: 'matias', name: 'Matías P.', age: 29, sport: 'Fútbol', level: 'Avanzado', distance: '3.2 km', compatibility: 78, colorFrom: '#1F2A5C', bio: 'Nivel competitivo, juego en liga amateur los domingos.' },
  { id: 'ignacio', name: 'Ignacio R.', age: 28, sport: 'Ciclismo', level: 'Avanzado', distance: '4.0 km', compatibility: 85, colorFrom: '#7C3AED', bio: 'Ruta y montaña. Salgo casi todos los domingos temprano.' },
  { id: 'daniela', name: 'Daniela S.', age: 24, sport: 'Yoga', level: 'Intermedio', distance: '2.9 km', compatibility: 90, colorFrom: '#22C55E', bio: 'Yoga y meditación, busco un grupo constante para practicar.' },
];

const porId = (id: string) => CATALOGO.find((p) => p.id === id)!;

function estadoInicial(): Estado {
  return {
    solicitudes: [porId('ignacio'), porId('daniela')],
    confirmados: [porId('camila'), porId('diego')],
    enviadas: [],
    descartados: [],
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

/** Personas que todavía no has visto ni tienes como match o solicitud. */
export function sugerencias(e: Estado): Persona[] {
  const ocupados = new Set([
    ...e.solicitudes.map((p) => p.id),
    ...e.confirmados.map((p) => p.id),
    ...e.enviadas,
    ...e.descartados,
  ]);
  return CATALOGO.filter((p) => !ocupados.has(p.id)).sort((a, b) => b.compatibility - a.compatibility);
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

/** Devuelve 'match' si la otra persona ya te había dado like, o 'enviada' si queda como solicitud pendiente. */
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

/** Deja todo como al abrir la app (útil para repetir la demo). */
export function reiniciarDemo() {
  estado = estadoInicial();
  emitir();
}