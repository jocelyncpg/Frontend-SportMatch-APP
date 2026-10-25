import { useMemo, useSyncExternalStore } from 'react';

// Consultas sobre convocatorias de club (HU-51): el deportista le escribe al club y el club responde
// desde una bandeja compartida por todos sus representantes.

export const MAX_CONSULTA = 500;

export type Resultado = { ok: true } | { ok: false; motivo: string };

export type Convocatoria = {
  clubId: string;
  clubNombre: string;
  titulo: string;
  descripcion: string;
  abierta: boolean;
  deporte?: string;
  comuna?: string;
  colorFrom: string;
  /** Categoría o edad a la que apunta la prueba, ej. "Sub-18" o "Adultos". */
  categoria?: string;
  /** Fecha de la prueba, AAAA-MM-DD. */
  fecha?: string;
  requisitos?: string;
  /** Cupos disponibles; el club no puede aceptar más postulantes que esto. */
  cupos?: number;
};
export type DatosConvocatoria = {
  titulo: string;
  descripcion: string;
  deporte: string;
  categoria: string;
  /** AAAA-MM-DD */
  fecha: string;
  requisitos: string;
  cupos: number;
};

/** Deportes que un club puede elegir al publicar una convocatoria (los mismos de la web). */
export const DEPORTES_CLUB = [
  'Fútbol', 'Básquetbol', 'Vóleibol', 'Natación', 'Tenis', 'Running',
  'Ciclismo', 'Escalada', 'Boxeo', 'Yoga', 'Pádel', 'Atletismo',
];

/** Hoy en AAAA-MM-DD (hora local, no UTC), para comparar con la fecha de la prueba. */
export function hoyISO(ahora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** Fecha válida y existente en formato AAAA-MM-DD ("2026-02-31" no vale). */
export function fechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
}

/** "2026-11-14" → "14-11-2026". */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
}

export type MensajeConsulta = { id: string; de: 'postulante' | 'club'; texto: string; enviadoEn: number };
/** Una conversación entre un postulante y un club. */
export type Hilo = {
  id: string;
  clubId: string;
  clubNombre: string;
  postulanteId: string;
  postulanteNombre: string;
  mensajes: MensajeConsulta[];
  /** Mensajes del postulante que el club aún no ha visto (bandeja del club). */
  noLeidosClub: number;
  /** Respuestas del club que el postulante aún no ha visto. */
  noLeidosPostulante: number;
};

// ---------- datos de ejemplo ----------
const COLOR_CLUB = '#7C3AED';
// Los mismos clubes del directorio (clubs.tsx). Con el backend, las convocatorias vendrán de la API.
/** Fecha de ejemplo a N días desde hoy (AAAA-MM-DD), para que los datos de demostración nunca queden vencidos. */
const enDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return hoyISO(d);
};
const CONVOCATORIAS_DEMO: Convocatoria[] = [
  { clubId: '1', clubNombre: 'Club Atlético Ñuñoa', deporte: 'Atletismo', comuna: 'Ñuñoa', colorFrom: '#7C3AED', abierta: true, titulo: 'Buscamos velocistas nivel intermedio-avanzado', descripcion: 'Completar el equipo de pista para la temporada.', categoria: 'Adultos', fecha: enDias(14), cupos: 8, requisitos: 'Zapatillas de clavos y ropa deportiva.' },
  { clubId: '2', clubNombre: 'Fútbol Amateur Maipú', deporte: 'Fútbol', comuna: 'Maipú', colorFrom: '#1F2A5C', abierta: true, titulo: 'Pruebas para el plantel de la temporada', descripcion: 'Buscamos defensas y arqueros. Pruebas abiertas los sábados.', categoria: 'Sub-23', fecha: enDias(10), cupos: 6, requisitos: 'Canilleras y zapatos de fútbol.' },
  { clubId: '3', clubNombre: 'Ciclistas La Florida', deporte: 'Ciclismo', comuna: 'La Florida', colorFrom: '#22C55E', abierta: true, titulo: 'Nuevos integrantes para salidas de ruta', descripcion: 'Salidas de 60 km los domingos. Nivel medio.', categoria: 'Mixto', fecha: enDias(7), cupos: 12, requisitos: 'Bicicleta de ruta y casco.' },
];

// ---------- almacén en memoria ----------
let convocatorias: Record<string, Convocatoria> = Object.fromEntries(CONVOCATORIAS_DEMO.map((c) => [c.clubId, c]));
let hilos: Record<string, Hilo> = {};
let sembrados = new Set<string>();
let contador = 1;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
export const getConvocatorias = () => convocatorias;
export const getHilos = () => hilos;
const idMensaje = () => `cs-${contador++}`;
export const idHilo = (clubId: string, postulanteId: string) => `${clubId}__${postulanteId}`;

// ---------- convocatorias ----------
export function getConvocatoria(clubId: string): Convocatoria | undefined {
  return convocatorias[clubId];
}

/** El club publica su convocatoria o edita la que tiene; queda abierta. */
export function publicarConvocatoria(clubId: string, clubNombre: string, datos: DatosConvocatoria): Resultado {
  const titulo = datos.titulo.trim();
  if (titulo.length < 3) return { ok: false, motivo: 'Escribe un título de al menos 3 letras.' };
  if (!DEPORTES_CLUB.includes(datos.deporte)) return { ok: false, motivo: 'Elige el deporte de la convocatoria.' };
  const categoria = datos.categoria.trim();
  if (!categoria) return { ok: false, motivo: 'Indica la categoría o edad (ej: Sub-18, Adultos).' };
  if (!fechaValida(datos.fecha.trim())) return { ok: false, motivo: 'Escribe la fecha de la prueba como AAAA-MM-DD (ej: 2026-11-14).' };
  if (datos.fecha.trim() < hoyISO()) return { ok: false, motivo: 'La fecha de la prueba no puede estar en el pasado.' };
  const requisitos = datos.requisitos.trim();
  if (!requisitos) return { ok: false, motivo: 'Escribe los requisitos para postular.' };
  if (!Number.isInteger(datos.cupos) || datos.cupos < 1) return { ok: false, motivo: 'Los cupos deben ser un número entero mayor a 0.' };
  const previa = convocatorias[clubId];
  convocatorias = {
    ...convocatorias,
    [clubId]: {
      ...previa,
      clubId,
      clubNombre,
      titulo,
      descripcion: datos.descripcion.trim(),
      deporte: datos.deporte,
      categoria,
      fecha: datos.fecha.trim(),
      requisitos,
      cupos: datos.cupos,
      abierta: true,
      colorFrom: previa?.colorFrom ?? COLOR_CLUB,
    },
  };
  emitir();
  return { ok: true };
}

/** Cierra la convocatoria: nadie puede iniciar o seguir consultando, pero el club puede responder lo pendiente. */
export function cerrarConvocatoria(clubId: string): Resultado {
  const c = convocatorias[clubId];
  if (!c) return { ok: false, motivo: 'Este club no tiene convocatoria.' };
  convocatorias = { ...convocatorias, [clubId]: { ...c, abierta: false } };
  emitir();
  return { ok: true };
}

// ---------- consultas ----------
function validarTexto(texto: string): { ok: true; limpio: string } | { ok: false; motivo: string } {
  const limpio = texto.trim();
  if (!limpio) return { ok: false, motivo: 'Escribe tu mensaje.' };
  if (limpio.length > MAX_CONSULTA) return { ok: false, motivo: `El mensaje no puede pasar de ${MAX_CONSULTA} caracteres.` };
  return { ok: true, limpio };
}

function agregar(hilo: Hilo, de: MensajeConsulta['de'], texto: string, ahora: number): Hilo {
  return {
    ...hilo,
    mensajes: [...hilo.mensajes, { id: idMensaje(), de, texto, enviadoEn: ahora }],
    noLeidosClub: de === 'postulante' ? hilo.noLeidosClub + 1 : hilo.noLeidosClub,
    noLeidosPostulante: de === 'club' ? hilo.noLeidosPostulante + 1 : hilo.noLeidosPostulante,
  };
}

/** El postulante le escribe al club. Solo mientras la convocatoria está abierta. */
export function enviarConsulta(clubId: string, postulanteId: string, postulanteNombre: string, texto: string, ahora: number = Date.now()): Resultado {
  const c = convocatorias[clubId];
  if (!c) return { ok: false, motivo: 'Este club no tiene una convocatoria.' };
  if (!c.abierta) return { ok: false, motivo: 'La convocatoria está cerrada: ya no se reciben consultas.' };
  const v = validarTexto(texto);
  if (!v.ok) return v;
  const id = idHilo(clubId, postulanteId);
  const base: Hilo = hilos[id] ?? { id, clubId, clubNombre: c.clubNombre, postulanteId, postulanteNombre, mensajes: [], noLeidosClub: 0, noLeidosPostulante: 0 };
  hilos = { ...hilos, [id]: agregar({ ...base, postulanteNombre }, 'postulante', v.limpio, ahora) };
  emitir();
  return { ok: true };
}

/** El club responde en una consulta. Puede hacerlo aunque la convocatoria ya esté cerrada. */
export function responderConsulta(hiloId: string, texto: string, ahora: number = Date.now()): Resultado {
  const h = hilos[hiloId];
  if (!h) return { ok: false, motivo: 'No encontramos esta consulta.' };
  const v = validarTexto(texto);
  if (!v.ok) return v;
  hilos = { ...hilos, [hiloId]: agregar(h, 'club', v.limpio, ahora) };
  emitir();
  return { ok: true };
}

const RESPUESTAS_CLUB = [
  'Hola, gracias por escribirnos. Las pruebas son este sábado a las 10:00 en nuestra cancha.',
  'Sí, puedes venir a probar sin costo. Lleva ropa deportiva y agua.',
  '¡Perfecto! Te esperamos. Cualquier otra duda, escríbenos por aquí.',
];

/** SOLO DEMO: el club de ejemplo responde. En la app real lo hace quien administra el club. */
export function simularRespuestaClub(hiloId: string, ahora: number = Date.now()): Resultado {
  const h = hilos[hiloId];
  if (!h) return { ok: false, motivo: 'No encontramos esta consulta.' };
  const delClub = h.mensajes.filter((m) => m.de === 'club').length;
  return responderConsulta(hiloId, RESPUESTAS_CLUB[delClub % RESPUESTAS_CLUB.length], ahora);
}

export function marcarLeidoClub(hiloId: string) {
  const h = hilos[hiloId];
  if (!h || h.noLeidosClub === 0) return;
  hilos = { ...hilos, [hiloId]: { ...h, noLeidosClub: 0 } };
  emitir();
}
export function marcarLeidoPostulante(hiloId: string) {
  const h = hilos[hiloId];
  if (!h || h.noLeidosPostulante === 0) return;
  hilos = { ...hilos, [hiloId]: { ...h, noLeidosPostulante: 0 } };
  emitir();
}

/** SOLO DEMO: deja dos consultas de ejemplo en la bandeja del club, una sin responder y otra respondida. */
export function sembrarDemoClub(clubId: string, clubNombre: string, ahora: number = Date.now()) {
  if (sembrados.has(clubId)) return;
  sembrados.add(clubId);
  const min = 60 * 1000;
  const matias = idHilo(clubId, 'matias');
  const valentina = idHilo(clubId, 'valentina');
  const nuevo = (id: string, postulanteId: string, nombre: string, mensajes: Omit<MensajeConsulta, 'id'>[], noLeidosClub: number): Hilo => ({
    id, clubId, clubNombre, postulanteId, postulanteNombre: nombre, noLeidosClub, noLeidosPostulante: 0,
    mensajes: mensajes.map((m) => ({ ...m, id: idMensaje() })),
  });
  hilos = {
    ...hilos,
    [matias]: nuevo(matias, 'matias', 'Matías P.', [{ de: 'postulante', texto: '¿Hay que llevar zapatillas de clavos para la prueba?', enviadoEn: ahora - 40 * min }], 1),
    [valentina]: nuevo(valentina, 'valentina', 'Valentina S.', [
      { de: 'postulante', texto: '¿Hasta cuándo puedo postular a la convocatoria?', enviadoEn: ahora - 5 * 60 * min },
      { de: 'club', texto: 'Hasta el viernes de esta semana. ¡Te esperamos!', enviadoEn: ahora - 4 * 60 * min },
    ], 0),
  };
  emitir();
}

// ---------- consultas derivadas ----------
/** Hilos cuyo último mensaje es del postulante: el club todavía no responde. */
export function sinResponder(lista: Hilo[]): Hilo[] {
  return lista.filter((h) => h.mensajes[h.mensajes.length - 1]?.de === 'postulante');
}
const ultimoEn = (h: Hilo) => h.mensajes[h.mensajes.length - 1]?.enviadoEn ?? 0;

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarConsultas() {
  convocatorias = Object.fromEntries(CONVOCATORIAS_DEMO.map((c) => [c.clubId, c]));
  hilos = {};
  sembrados = new Set();
  contador = 1;
  emitir();
}

// ---------- hooks ----------
export function useConvocatoria(clubId: string): Convocatoria | undefined {
  return useSyncExternalStore(suscribir, getConvocatorias, getConvocatorias)[clubId];
}

/** Clubes con convocatoria abierta, para el directorio. */
export function useConvocatoriasAbiertas(): Convocatoria[] {
  const todas = useSyncExternalStore(suscribir, getConvocatorias, getConvocatorias);
  return useMemo(() => Object.values(todas).filter((c) => c.abierta), [todas]);
}

export function useHilo(hiloId: string): Hilo | undefined {
  return useSyncExternalStore(suscribir, getHilos, getHilos)[hiloId];
}

/** Bandeja del club: todas las consultas de sus postulantes, las más recientes primero. */
export function useHilosDelClub(clubId: string): Hilo[] {
  const todos = useSyncExternalStore(suscribir, getHilos, getHilos);
  return useMemo(() => Object.values(todos).filter((h) => h.clubId === clubId).sort((a, b) => ultimoEn(b) - ultimoEn(a)), [todos, clubId]);
}

/** Consultas que hizo una persona a distintos clubes, para su lista de Chats. */
export function useHilosDePostulante(postulanteId: string): Hilo[] {
  const todos = useSyncExternalStore(suscribir, getHilos, getHilos);
  return useMemo(() => Object.values(todos).filter((h) => h.postulanteId === postulanteId).sort((a, b) => ultimoEn(b) - ultimoEn(a)), [todos, postulanteId]);
}

/** Consultas del club sin responder (para el contador de su panel). */
export function useConsultasPendientes(clubId: string): number {
  return sinResponder(useHilosDelClub(clubId)).length;
}

/** Respuestas de clubes que el postulante aún no ve (para el globo de Chats). */
export function useNoLeidosConsultas(postulanteId: string): number {
  return useHilosDePostulante(postulanteId).reduce((n, h) => n + h.noLeidosPostulante, 0);
}