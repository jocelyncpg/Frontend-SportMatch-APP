import { useMemo, useSyncExternalStore } from 'react';
import type { Resultado } from './consultas';

// Avisos del club a sus postulantes (HU-38, lado del club). El club escribe un comunicado y lo reciben
// quienes tienen una postulación vigente. Con el backend, esto vendrá de la API; por ahora vive en memoria.

export const TITULO_MAX = 80;
export const MENSAJE_MAX = 500;

export type AvisoClub = {
  id: string;
  clubId: string;
  clubNombre: string;
  titulo: string;
  mensaje: string;
  ts: number;
  /** Ids de los postulantes que lo reciben, fijados al momento de enviar. */
  destinatarios: string[];
};

// ---------- almacén en memoria (el más reciente primero) ----------
let avisos: AvisoClub[] = [];
let contador = 0;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
export const getAvisosClub = () => avisos;

/** El club envía un aviso a las personas indicadas. */
export function enviarAvisoClub(
  clubId: string,
  clubNombre: string,
  titulo: string,
  mensaje: string,
  destinatarios: string[],
  ahora: number = Date.now(),
): Resultado {
  const t = titulo.trim();
  const m = mensaje.trim();
  if (!t || !m) return { ok: false, motivo: 'Escribe un título y un mensaje.' };
  if (t.length > TITULO_MAX) return { ok: false, motivo: `El título admite hasta ${TITULO_MAX} caracteres.` };
  if (m.length > MENSAJE_MAX) return { ok: false, motivo: `El mensaje admite hasta ${MENSAJE_MAX} caracteres.` };
  if (destinatarios.length === 0) return { ok: false, motivo: 'No hay postulantes a quienes enviar el aviso.' };
  contador += 1;
  avisos = [
    { id: `${ahora}-${contador}`, clubId, clubNombre, titulo: t, mensaje: m, ts: ahora, destinatarios: [...new Set(destinatarios)] },
    ...avisos,
  ];
  emitir();
  return { ok: true };
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarAvisosClub() {
  avisos = [];
  emitir();
}

// ---------- hooks ----------
/** Avisos que envió un club. */
export function useAvisosEnviados(clubId: string): AvisoClub[] {
  const todos = useSyncExternalStore(suscribir, getAvisosClub, getAvisosClub);
  return useMemo(() => todos.filter((a) => a.clubId === clubId), [todos, clubId]);
}

/** Avisos que recibió una persona. */
export function useAvisosRecibidos(postulanteId: string): AvisoClub[] {
  const todos = useSyncExternalStore(suscribir, getAvisosClub, getAvisosClub);
  return useMemo(() => todos.filter((a) => a.destinatarios.includes(postulanteId)), [todos, postulanteId]);
}