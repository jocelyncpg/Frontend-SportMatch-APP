import { useSyncExternalStore } from 'react';
import type { Resultado } from './consultas';

// Perfil público del club (HU-31): lo que el club edita en "Mi club" y verán los deportistas.
// SIMULADO: vive en memoria y se reinicia al cerrar la app. Con el backend (HU-30/31) llegará de la API.

export type PerfilClub = {
  nombre: string;
  descripcion: string;
  zona: string;
  deportes: string[];
  email: string;
  telefono: string;
  instagram: string;
  web: string;
};

export const MAX_NOMBRE_CLUB = 60;
export const MAX_DESCRIPCION_CLUB = 500;

let perfiles: Record<string, PerfilClub> = {};
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
export const getPerfiles = () => perfiles;

/** Perfil guardado del club; undefined si todavía no lo ha editado. */
export function usePerfilClub(clubId: string): PerfilClub | undefined {
  return useSyncExternalStore(suscribir, getPerfiles, getPerfiles)[clubId];
}

/** Punto de partida cuando el club aún no edita su perfil: solo el nombre con que se registró. */
export function perfilInicial(nombre: string, email: string = ''): PerfilClub {
  return { nombre, descripcion: '', zona: '', deportes: [], email, telefono: '', instagram: '', web: '' };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Guarda el perfil. Valida lo mismo que el panel web: nombre, al menos un deporte y correo con formato válido. */
export function guardarPerfilClub(clubId: string, datos: PerfilClub): Resultado {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { ok: false, motivo: 'Escribe el nombre del club.' };
  if (nombre.length > MAX_NOMBRE_CLUB) return { ok: false, motivo: `El nombre admite hasta ${MAX_NOMBRE_CLUB} caracteres.` };
  if (datos.descripcion.trim().length > MAX_DESCRIPCION_CLUB) {
    return { ok: false, motivo: `La descripción admite hasta ${MAX_DESCRIPCION_CLUB} caracteres.` };
  }
  if (datos.deportes.length === 0) return { ok: false, motivo: 'Selecciona al menos un deporte.' };
  const email = datos.email.trim();
  if (email && !EMAIL.test(email)) return { ok: false, motivo: 'El correo de contacto no tiene un formato válido.' };
  const telefono = datos.telefono.trim();
  if (telefono && telefono.replace(/\D/g, '').length < 8) return { ok: false, motivo: 'El teléfono debe tener al menos 8 dígitos.' };

  perfiles = {
    ...perfiles,
    [clubId]: {
      nombre,
      descripcion: datos.descripcion.trim(),
      zona: datos.zona.trim(),
      deportes: datos.deportes,
      email,
      telefono,
      instagram: datos.instagram.trim(),
      web: datos.web.trim(),
    },
  };
  emitir();
  return { ok: true };
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarPerfilesClub() {
  perfiles = {};
  emitir();
}