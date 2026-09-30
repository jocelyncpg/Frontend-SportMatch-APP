import { useSyncExternalStore } from 'react';

import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';

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
  /** Deportistas reales registrados (GET /users/suggestions), sin incluirte a ti. */
  catalogo: Persona[];
  cargando: boolean;
  error: string | null;
  sesionExpirada: boolean;
  /** Dueño de los likes y descartes en memoria; si cambia la sesión, se reinician. */
  usuarioId: string | null;
  solicitudes: Persona[];
  confirmados: Persona[];
  enviadas: string[];
  descartados: string[];
};

/** Tarjeta pública que devuelve Ms_Users. */
type SugerenciaApi = {
  user_id: string;
  nombre: string;
  apellido_inicial: string;
  edad: number | null;
  foto_perfil: string | null;
  biografia: string | null;
  deportes: { deporte_codigo: string; nivel: number }[];
  compatibilidad: number;
};

// Solicitudes y matches siguen siendo de demostración: se reemplazan cuando
// exista el servicio de matching (likes y matches reales).
const DEMO_MATCHES: Persona[] = [
  { id: 'demo-camila', name: 'Camila R.', age: 24, sport: 'Running', level: 'Intermedio', distance: '1.8 km', compatibility: 95, colorFrom: '#3648A6', bio: 'Entrenando para una media maratón. Busco compañera para trotes de fondo los fines de semana.' },
  { id: 'demo-diego', name: 'Diego A.', age: 27, sport: 'Fútbol', level: 'Intermedio', distance: '2.3 km', compatibility: 89, colorFrom: '#1F2A5C', bio: 'Juego 2 veces por semana, busco gente para armar equipo fijo.' },
  { id: 'demo-ignacio', name: 'Ignacio R.', age: 28, sport: 'Ciclismo', level: 'Avanzado', distance: '4.0 km', compatibility: 85, colorFrom: '#7C3AED', bio: 'Ruta y montaña. Salgo casi todos los domingos temprano.' },
  { id: 'demo-daniela', name: 'Daniela S.', age: 24, sport: 'Yoga', level: 'Intermedio', distance: '2.9 km', compatibility: 90, colorFrom: '#22C55E', bio: 'Yoga y meditación, busco un grupo constante para practicar.' },
];

const porId = (id: string) => DEMO_MATCHES.find((p) => p.id === id)!;

const COLORES = ['#3648A6', '#1F2A5C', '#DB2777', '#22C55E', '#7C3AED', '#0EA5E9'];

const DEPORTES: Record<string, string> = {
  tennis: 'Tenis',
  tenis: 'Tenis',
  futbol: 'Fútbol',
  running: 'Running',
  ciclismo: 'Ciclismo',
  natacion: 'Natación',
  yoga: 'Yoga',
  basquetbol: 'Básquetbol',
  padel: 'Pádel',
  voleibol: 'Vóleibol',
};

function nombreDeporte(codigo: string): string {
  return DEPORTES[codigo.toLowerCase()] ?? codigo.charAt(0).toUpperCase() + codigo.slice(1);
}

function nombreNivel(nivel: number): string {
  if (nivel <= 2) return 'Principiante';
  if (nivel === 3) return 'Intermedio';
  return 'Avanzado';
}

/** Siempre el mismo color para la misma persona. */
function colorPara(id: string): string {
  let suma = 0;
  for (const letra of id) suma = (suma + letra.charCodeAt(0)) % 997;
  return COLORES[suma % COLORES.length];
}

function aPersona(s: SugerenciaApi): Persona {
  const principal = s.deportes[0];
  return {
    id: s.user_id,
    name: `${s.nombre} ${s.apellido_inicial}`,
    age: s.edad ?? undefined,
    sport: principal ? nombreDeporte(principal.deporte_codigo) : 'Sin deporte aún',
    level: principal ? nombreNivel(principal.nivel) : 'Nivel por definir',
    // Sin ubicación en el backend todavía: la distancia no se muestra.
    distance: undefined,
    compatibility: s.compatibilidad,
    colorFrom: colorPara(s.user_id),
    bio: s.biografia ?? undefined,
    fotoUri: s.foto_perfil,
    // Sin servicio de matching todavía: un like queda como solicitud enviada.
    leGustas: false,
  };
}

function estadoInicial(usuarioId: string | null = null): Estado {
  return {
    catalogo: [],
    cargando: false,
    error: null,
    sesionExpirada: false,
    usuarioId,
    solicitudes: [porId('demo-ignacio'), porId('demo-daniela')],
    confirmados: [porId('demo-camila'), porId('demo-diego')],
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

/** Trae los deportistas registrados desde el backend (frontend → gateway → Ms_Users). */
export async function cargarSugerencias(): Promise<void> {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) {
    estado = { ...estadoInicial(), sesionExpirada: true, error: 'Inicia sesión para ver deportistas.' };
    emitir();
    return;
  }
  if (estado.usuarioId !== session.id) {
    // Otra cuenta en el mismo teléfono: no hereda likes ni descartes.
    estado = estadoInicial(session.id);
  }
  estado = { ...estado, cargando: true, error: null, sesionExpirada: false };
  emitir();
  try {
    const tarjetas = await apiRequest<SugerenciaApi[]>('/users/suggestions?limit=50', { token });
    estado = {
      ...estado,
      cargando: false,
      // El backend ya te excluye; el filtro es una segunda barrera.
      catalogo: tarjetas.filter((t) => t.user_id !== session.id).map(aPersona),
    };
  } catch (e: any) {
    estado = {
      ...estado,
      cargando: false,
      error: e.message,
      sesionExpirada: e instanceof ApiError && e.status === 401,
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
  ]);
  return e.catalogo.filter((p) => !ocupados.has(p.id)).sort((a, b) => b.compatibility - a.compatibility);
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

/** Vuelve a mostrar a quienes descartaste o diste like, y recarga desde el backend. */
export function reiniciarDemo() {
  estado = estadoInicial(estado.usuarioId);
  emitir();
  void cargarSugerencias();
}
