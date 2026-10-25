import { useMemo, useSyncExternalStore } from 'react';
import { getConvocatoria, type Resultado } from './consultas';

// Postulaciones a convocatorias de club (HU-33 / HU-34): el deportista postula y el club revisa,
// acepta o rechaza. Con el backend, esto vendrá de la API; por ahora vive en memoria.

export type EstadoPostulacion = 'pendiente' | 'preseleccionada' | 'aceptada' | 'rechazada' | 'retirada';

/** Lo que el club necesita ver de quien postula. */
export type PerfilPostulante = {
  id: string;
  nombre: string;
  deporte: string;
  nivel: string;
  colorFrom: string;
  fotoUri?: string | null;
};

export type Postulacion = {
  id: string;
  clubId: string;
  clubNombre: string;
  /** Título de la convocatoria al momento de postular. */
  convocatoria: string;
  postulante: PerfilPostulante;
  estado: EstadoPostulacion;
  creadaEn: number;
  resueltaEn?: number;
};

export const idPostulacion = (clubId: string, postulanteId: string) => `${clubId}__${postulanteId}`;

// ---------- almacén en memoria ----------
let postulaciones: Record<string, Postulacion> = {};
let sembradas = new Set<string>();
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
export const getPostulaciones = () => postulaciones;

// ---------- acciones ----------
/** El deportista postula a la convocatoria abierta de un club. */
export function postular(clubId: string, perfil: PerfilPostulante, ahora: number = Date.now()): Resultado {
  const c = getConvocatoria(clubId);
  if (!c) return { ok: false, motivo: 'Este club no tiene una convocatoria.' };
  if (!c.abierta) return { ok: false, motivo: 'La convocatoria está cerrada: ya no se reciben postulaciones.' };
  const id = idPostulacion(clubId, perfil.id);
  const previa = postulaciones[id];
  if (previa?.estado === 'pendiente') return { ok: false, motivo: 'Ya postulaste a esta convocatoria. El club revisará tu perfil.' };
  if (previa?.estado === 'preseleccionada') return { ok: false, motivo: 'El club ya te preseleccionó. Falta su respuesta final.' };
  if (previa?.estado === 'aceptada') return { ok: false, motivo: 'El club ya aceptó tu postulación.' };
  if (previa?.estado === 'rechazada') return { ok: false, motivo: 'El club ya respondió tu postulación y no la aceptó.' };
  // Si la había retirado, puede volver a postular.
  postulaciones = {
    ...postulaciones,
    [id]: { id, clubId, clubNombre: c.clubNombre, convocatoria: c.titulo, postulante: perfil, estado: 'pendiente', creadaEn: ahora },
  };
  emitir();
  return { ok: true };
}

/** El deportista retira su postulación mientras el club no da una respuesta final (pendiente o preseleccionada). */
export function retirarPostulacion(id: string, ahora: number = Date.now()): Resultado {
  const p = postulaciones[id];
  if (!p) return { ok: false, motivo: 'No encontramos esta postulación.' };
  if (p.estado !== 'pendiente' && p.estado !== 'preseleccionada') {
    return { ok: false, motivo: 'Solo puedes retirar una postulación que el club aún no responde.' };
  }
  postulaciones = { ...postulaciones, [id]: { ...p, estado: 'retirada', resueltaEn: ahora } };
  emitir();
  return { ok: true };
}

/**
 * El club preselecciona, acepta o rechaza. Puede hacerlo aunque la convocatoria ya esté cerrada.
 * Una postulación pendiente puede pasar a cualquiera de las tres; una preseleccionada, a aceptada o rechazada.
 * Preseleccionar no ocupa cupo: el cupo solo se descuenta al aceptar.
 */
export function resolverPostulacion(
  id: string,
  decision: 'preseleccionada' | 'aceptada' | 'rechazada',
  ahora: number = Date.now(),
): Resultado {
  const p = postulaciones[id];
  if (!p) return { ok: false, motivo: 'No encontramos esta postulación.' };
  if (p.estado === 'retirada') return { ok: false, motivo: 'La persona retiró su postulación.' };
  if (p.estado !== 'pendiente' && p.estado !== 'preseleccionada') {
    return { ok: false, motivo: 'Esta postulación ya fue respondida.' };
  }
  if (decision === 'preseleccionada' && p.estado === 'preseleccionada') {
    return { ok: false, motivo: 'Esta persona ya está preseleccionada.' };
  }
  if (decision === 'aceptada') {
    // El club no puede confirmar a más personas que los cupos de su convocatoria.
    const cupos = getConvocatoria(p.clubId)?.cupos;
    const confirmados = Object.values(postulaciones).filter((x) => x.clubId === p.clubId && x.estado === 'aceptada').length;
    if (cupos !== undefined && confirmados >= cupos) {
      return { ok: false, motivo: `Ya confirmaste ${cupos === 1 ? 'el único cupo' : `los ${cupos} cupos`} de la convocatoria. Rechaza a alguien o aumenta los cupos.` };
    }
  }
  postulaciones = { ...postulaciones, [id]: { ...p, estado: decision, resueltaEn: ahora } };
  emitir();
  return { ok: true };
}

/** SOLO DEMO: deja dos postulaciones de ejemplo en el panel del club (las mismas personas de sus consultas). */
export function sembrarDemoPostulaciones(clubId: string, clubNombre: string, ahora: number = Date.now()) {
  if (sembradas.has(clubId)) return;
  sembradas.add(clubId);
  const titulo = getConvocatoria(clubId)?.titulo ?? 'Convocatoria del club';
  const min = 60 * 1000;
  const nueva = (postulante: PerfilPostulante, hace: number): Postulacion => ({
    id: idPostulacion(clubId, postulante.id), clubId, clubNombre, convocatoria: titulo, postulante, estado: 'pendiente', creadaEn: ahora - hace * min,
  });
  const matias = nueva({ id: 'matias', nombre: 'Matías P.', deporte: 'Atletismo', nivel: 'Avanzado', colorFrom: '#7C3AED' }, 3 * 60);
  const valentina = nueva({ id: 'valentina', nombre: 'Valentina S.', deporte: 'Atletismo', nivel: 'Intermedio', colorFrom: '#22C55E' }, 26 * 60);
  postulaciones = { ...postulaciones, [matias.id]: matias, [valentina.id]: valentina };
  emitir();
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarPostulaciones() {
  postulaciones = {};
  sembradas = new Set();
  emitir();
}

// ---------- hooks ----------
export function usePostulacion(clubId: string, postulanteId: string): Postulacion | undefined {
  return useSyncExternalStore(suscribir, getPostulaciones, getPostulaciones)[idPostulacion(clubId, postulanteId)];
}

/** Panel del club: todas las postulaciones de su convocatoria (sin las retiradas), las más recientes primero. */
export function usePostulacionesDelClub(clubId: string): Postulacion[] {
  const todas = useSyncExternalStore(suscribir, getPostulaciones, getPostulaciones);
  return useMemo(
    () => Object.values(todas).filter((p) => p.clubId === clubId && p.estado !== 'retirada').sort((a, b) => b.creadaEn - a.creadaEn),
    [todas, clubId],
  );
}