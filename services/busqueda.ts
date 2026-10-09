import { normalizar } from './comunas';
import type { Persona } from './matchStore';

export type Franja = 'manana' | 'tarde' | 'noche' | 'finde';

export type FiltrosBusqueda = {
  texto: string;
  /** null = cualquier deporte. */
  deporte: string | null;
  /** Nombres de nivel; vacío = cualquier nivel. Se puede elegir más de uno. */
  niveles: string[];
  /** null = cualquier horario. */
  franja: Franja | null;
  /** null = cualquier distancia. */
  radioKm: number | null;
};

export const FILTROS_VACIOS: FiltrosBusqueda = { texto: '', deporte: null, niveles: [], franja: null, radioKm: null };

export const DEPORTES_BUSQUEDA = ['Running', 'Fútbol', 'Ciclismo', 'Yoga', 'Tenis', 'Natación', 'Trekking'];
export const NIVELES_BUSQUEDA = ['Principiante', 'Básico', 'Intermedio', 'Avanzado', 'Experto'];
export const FRANJAS_BUSQUEDA: { key: Franja; label: string }[] = [
  { key: 'manana', label: 'Mañana' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noche', label: 'Noche' },
  { key: 'finde', label: 'Fin de semana' },
];
export const DISTANCIAS_BUSQUEDA: { label: string; km: number | null }[] = [
  { label: 'Todas', km: null },
  { label: '2 km', km: 2 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
];

// DATOS DE EJEMPLO: en la versión simulada los deportistas no traen disponibilidad.
// Cuando el backend la entregue, `disponibilidadDe` pasa a leerla directo de la persona.
export const DISPONIBILIDAD_DEMO: Record<string, string> = {
  camila: 'Sábados y domingos en la mañana',
  diego: 'Martes y jueves en la noche',
  sofia: 'Sábados en la mañana',
  valentina: 'Sábados en la mañana, miércoles en la tarde',
  andres: 'Lunes, miércoles y viernes en la tarde',
  tomas: 'Todos los días en la mañana',
  matias: 'Domingos en la tarde',
  ignacio: 'Domingos temprano en la mañana',
  daniela: 'Martes y jueves en la noche, sábados en la mañana',
};

export function disponibilidadDe(p: Persona): string | undefined {
  return DISPONIBILIDAD_DEMO[p.id];
}

/** La disponibilidad es texto libre, así que se busca por palabras ("mañana", "sábados"...), sin tildes. */
export function coincideFranja(texto: string | undefined, franja: Franja): boolean {
  const t = normalizar(texto ?? '');
  switch (franja) {
    case 'manana': return /manana|temprano|madrugada/.test(t);
    case 'tarde': return /tarde/.test(t);
    case 'noche': return /noche/.test(t);
    case 'finde': return /sabado|domingo|fin de semana|findes?|todos los dias/.test(t);
  }
}

/** Todas las personas conocidas, sin repetir: sugeridas, con solicitud pendiente y ya confirmadas. */
export function todasLasPersonas(e: { catalogo: Persona[]; solicitudes: Persona[]; confirmados: Persona[] }): Persona[] {
  const vistos = new Set<string>();
  return [...e.catalogo, ...e.solicitudes, ...e.confirmados].filter((p) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)));
}

/** Cuántos filtros hay activos (el texto escrito no cuenta como filtro). */
export function contarFiltros(f: FiltrosBusqueda): number {
  return (f.deporte ? 1 : 0) + (f.niveles.length ? 1 : 0) + (f.franja ? 1 : 0) + (f.radioKm !== null ? 1 : 0);
}

/**
 * Aplica todos los filtros a la vez y ordena por compatibilidad.
 * Quien no tiene distancia conocida nunca se excluye por radio (igual que en Descubrir).
 */
export function filtrarPersonas(personas: Persona[], f: FiltrosBusqueda): Persona[] {
  const q = normalizar(f.texto);
  return personas
    .filter((p) => {
      if (q && !normalizar(p.name).includes(q) && !normalizar(p.sport).includes(q)) return false;
      if (f.deporte && p.sport !== f.deporte) return false;
      if (f.niveles.length && !f.niveles.some((n) => p.level.startsWith(n))) return false;
      if (f.franja && !coincideFranja(disponibilidadDe(p), f.franja)) return false;
      if (f.radioKm !== null && p.distanceKm !== undefined && p.distanceKm > f.radioKm) return false;
      return true;
    })
    .sort((a, b) => b.compatibility - a.compatibility);
}