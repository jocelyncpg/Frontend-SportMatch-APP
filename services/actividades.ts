import { useSyncExternalStore } from 'react';
import type { DeporteConNivel } from './auth';
import { normalizar } from './comunas';

/** En la versión simulada, tú siempre eres este usuario. */
export const YO = 'yo';

export type EstadoActividad = 'abierta' | 'llena' | 'vencida' | 'cancelada';
export type EstadoPostulacion = 'pendiente' | 'aprobada' | 'rechazada';
export type MiRelacion = 'organizador' | EstadoPostulacion | null;
export type Resultado = { ok: true } | { ok: false; motivo: string };

export type Actividad = {
  id: string;
  titulo: string;
  deporte: string;
  /** Nivel mínimo para postular (1 a 5). null = sin requisito de nivel. */
  nivelMinimo: number | null;
  /** Inicio, en milisegundos. */
  fecha: number;
  lugar: string;
  comuna: string;
  cupos: number;
  descripcion: string;
  /** Requisitos previos que el organizador pide para postular (texto libre). */
  requisitos: string;
  organizadorId: string;
  organizadorNombre: string;
  cancelada: boolean;
  /** Postulaciones por persona (id → estado). Los cupos ocupados son las aprobadas. */
  postulaciones: Record<string, EstadoPostulacion>;
  /** Mensaje que dejó cada persona al postular. */
  mensajes: Record<string, string>;
};

export type FiltrosActividades = {
  deporte: string | null;
  fecha: 'todas' | 'hoy' | 'manana' | 'semana';
  comuna: string | null;
};

export const FILTROS_ACTIVIDADES_VACIOS: FiltrosActividades = { deporte: null, fecha: 'todas', comuna: null };
export type DatosActividad = {
  titulo: string; deporte: string; nivelMinimo: number | null; fecha: number; lugar: string; comuna: string;
  cupos: number; descripcion: string; requisitos: string;
};
export type ResultadoCrear = { ok: true; id: string } | { ok: false; motivo: string };
export type Postulante = { id: string; nombre: string; estado: EstadoPostulacion; mensaje: string };

export const NOMBRES_NIVEL: Record<number, string> = { 1: 'Principiante', 2: 'Básico', 3: 'Intermedio', 4: 'Avanzado', 5: 'Experto' };

const DEPORTE_VISUAL: Record<string, { icon: string; colorBg: string }> = {
  Running: { icon: '🏃', colorBg: '#1B3324' },
  Fútbol: { icon: '⚽', colorBg: '#1B2144' },
  Yoga: { icon: '🧘', colorBg: '#2B1B44' },
  Ciclismo: { icon: '🚴', colorBg: '#1B2A2E' },
  Natación: { icon: '🏊', colorBg: '#1B2440' },
  Tenis: { icon: '🎾', colorBg: '#2E2A1B' },
  Trekking: { icon: '🥾', colorBg: '#2A2A1B' },
  Box: { icon: '🥊', colorBg: '#2A1B1E' },
};
export const DEPORTES_ACTIVIDAD: string[] = Object.keys(DEPORTE_VISUAL);

const PERSONAS_DEMO: Record<string, string> = {
  camila: 'Camila R.', diego: 'Diego A.', sofia: 'Sofía T.', valentina: 'Valentina S.',
  andres: 'Andrés M.', tomas: 'Tomás L.', matias: 'Matías P.', ignacio: 'Ignacio R.', daniela: 'Daniela V.',
};
export function nombreDePersona(id: string): string {
  return PERSONAS_DEMO[id] ?? 'Deportista';
}

export function visualDeporte(deporte: string) {
  return DEPORTE_VISUAL[deporte] ?? { icon: '🏅', colorBg: '#1B2A2A' };
}

// ---------- fechas ----------
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_MS = 86400000;
const dos = (n: number) => String(n).padStart(2, '0');

export function inicioDelDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
/** Cuántos días calendario faltan desde `ahora` hasta `ms` (0 = hoy, 1 = mañana, negativo = pasado). */
function diasDe(ms: number, ahora: number): number {
  return Math.round((inicioDelDia(ms) - inicioDelDia(ahora)) / DIA_MS);
}

export function formatearCuando(ms: number, ahora: number = Date.now()): string {
  const d = new Date(ms);
  const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
  const dias = diasDe(ms, ahora);
  if (dias === 0) return `Hoy, ${hora}`;
  if (dias === 1) return `Mañana, ${hora}`;
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getDate()} ${MESES[d.getMonth()]}, ${hora}`;
}

export function formatearDia(ms: number, ahora: number = Date.now()): string {
  const dias = diasDe(ms, ahora);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  const d = new Date(ms);
  const dia = DIAS[d.getDay()];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function formatearHora(minutos: number): string {
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}
/** Los próximos `n` días, como inicio de cada día. */
export function opcionesDias(ahora: number = Date.now(), n = 14): number[] {
  return Array.from({ length: n }, (_, i) => inicioDelDia(inicioDelDia(ahora) + i * DIA_MS + DIA_MS / 2));
}
/** Horarios disponibles al crear una actividad: de 06:00 a 22:00, cada 30 minutos (en minutos desde medianoche). */
export const HORARIOS: number[] = Array.from({ length: 33 }, (_, i) => 360 + i * 30);
export function combinarFecha(diaMs: number, minutos: number): number {
  const d = new Date(diaMs);
  d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return d.getTime();
}
export function minutosDelDia(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

// ---------- reglas ----------
/** Estado calculado al momento de mirar: se cancela, vence o se llena solo (HU-29). */
export function estadoActividad(a: Actividad, ahora: number = Date.now()): EstadoActividad {
  if (a.cancelada) return 'cancelada';
  if (a.fecha < ahora) return 'vencida';
  if (cuposTomados(a) >= a.cupos) return 'llena';
  return 'abierta';
}

export function cuposTomados(a: Actividad): number {
  return Object.values(a.postulaciones).filter((e) => e === 'aprobada').length;
}
export function cuposLibres(a: Actividad): number {
  return Math.max(0, a.cupos - cuposTomados(a));
}

export function relacionConActividad(a: Actividad): MiRelacion {
  if (a.organizadorId === YO) return 'organizador';
  return a.postulaciones[YO] ?? null;
}

export function nivelDeUsuario(deportes: DeporteConNivel[] | undefined, deporte: string): number | null {
  const d = (deportes ?? []).find((x) => x.nombre.toLowerCase() === deporte.toLowerCase());
  return d ? d.nivel : null;
}

/** Revisa todas las condiciones para postular y explica por qué no se puede (HU-26). */
export function puedePostular(a: Actividad, misDeportes: DeporteConNivel[] | undefined, ahora: number = Date.now()): Resultado {
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad fue cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  if (a.organizadorId === YO) return { ok: false, motivo: 'Eres quien organiza esta actividad.' };
  if (a.postulaciones[YO]) return { ok: false, motivo: 'Ya postulaste a esta actividad.' };
  if (estado === 'llena') return { ok: false, motivo: 'Ya no quedan cupos disponibles.' };
  if (a.nivelMinimo !== null) {
    const nivel = nivelDeUsuario(misDeportes, a.deporte);
    const pedido = NOMBRES_NIVEL[a.nivelMinimo];
    if (nivel === null) return { ok: false, motivo: `Pide nivel ${pedido} o más en ${a.deporte}. Agrega ese deporte a tu perfil para postular.` };
    if (nivel < a.nivelMinimo) return { ok: false, motivo: `Pide nivel ${pedido} o más en ${a.deporte}; el tuyo es ${NOMBRES_NIVEL[nivel]}.` };
  }
  return { ok: true };
}

export function filtrarActividades(lista: Actividad[], f: FiltrosActividades, ahora: number = Date.now()): Actividad[] {
  return lista
    .filter((a) => estadoActividad(a, ahora) === 'abierta') // solo las abiertas a postulación (HU-25)
    .filter((a) => !f.deporte || a.deporte === f.deporte)
    .filter((a) => !f.comuna || a.comuna === f.comuna)
    .filter((a) => {
      const dias = diasDe(a.fecha, ahora);
      if (f.fecha === 'hoy') return dias === 0;
      if (f.fecha === 'manana') return dias === 1;
      if (f.fecha === 'semana') return dias >= 0 && dias < 7;
      return true;
    })
    .sort((x, y) => x.fecha - y.fecha);
}

export function comunasDisponibles(lista: Actividad[], ahora: number = Date.now()): string[] {
  // Orden alfabético sin depender del idioma del teléfono: "Ñuñoa" queda entre "Maipú" y "Providencia".
  return [...new Set(lista.filter((a) => estadoActividad(a, ahora) === 'abierta').map((a) => a.comuna))].sort((a, b) => {
    const x = normalizar(a), y = normalizar(b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

// ---------- datos de ejemplo ----------
/** DATOS DE EJEMPLO: se arman respecto a "ahora" para que las fechas siempre estén en el futuro. */
export function crearActividadesDemo(ahora: number = Date.now()): Actividad[] {
  const en = (dias: number, hora: number, min = 0) => {
    const d = new Date(inicioDelDia(ahora) + dias * DIA_MS);
    d.setHours(hora, min, 0, 0);
    return d.getTime();
  };
  const aprobados = (n: number, extra: Record<string, EstadoPostulacion> = {}) => ({
    ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i + 1}`, 'aprobada' as EstadoPostulacion])),
    ...extra,
  });
  const base = { cancelada: false, mensajes: {}, requisitos: '' };
  return [
    { ...base, id: 'act-trote', titulo: 'Trote suave en Parque Bicentenario', deporte: 'Running', nivelMinimo: null, fecha: en(1, 19, 30), lugar: 'Parque Bicentenario', comuna: 'Vitacura', cupos: 10, descripcion: 'Salida de 5 km a ritmo cómodo para conversar. Todos los niveles.', organizadorId: 'camila', organizadorNombre: 'Camila R.', postulaciones: aprobados(3) },
    { ...base, id: 'act-mia', titulo: 'Running matutino en el San Cristóbal', deporte: 'Running', nivelMinimo: null, fecha: en(2, 7, 30), lugar: 'Entrada Pedro de Valdivia Norte', comuna: 'Providencia', cupos: 4, descripcion: 'Subida a ritmo suave, bajamos juntos. Llevar agua.', organizadorId: YO, organizadorNombre: 'Tú', postulaciones: { camila: 'aprobada', diego: 'pendiente', daniela: 'pendiente', ignacio: 'pendiente' }, mensajes: { diego: 'Corro 5 km seguido, me gustaría sumarme.', daniela: 'Busco gente para salir a correr temprano.' } },
    { ...base, id: 'act-futbol', titulo: 'Fútbol 7 en Maipú', deporte: 'Fútbol', nivelMinimo: 3, fecha: en(2, 20, 0), lugar: 'Cancha Los Pinos', comuna: 'Maipú', cupos: 14, descripcion: 'Partido amistoso y juego limpio. Lleva una camiseta clara y una oscura.', requisitos: 'Zapatillas para pasto sintético.', organizadorId: 'diego', organizadorNombre: 'Diego A.', postulaciones: aprobados(11) },
    { ...base, id: 'act-yoga', titulo: 'Yoga al aire libre', deporte: 'Yoga', nivelMinimo: null, fecha: en(3, 9, 0), lugar: 'Parque Araucano', comuna: 'Las Condes', cupos: 12, descripcion: 'Clase abierta. Lleva tu mat y agua.', organizadorId: 'sofia', organizadorNombre: 'Sofía T.', postulaciones: aprobados(5, { [YO]: 'aprobada' }) },
    { ...base, id: 'act-bici', titulo: 'Ruta en bici por la costanera', deporte: 'Ciclismo', nivelMinimo: 4, fecha: en(4, 8, 0), lugar: 'Costanera Center', comuna: 'Providencia', cupos: 6, descripcion: 'Ruta de 40 km a ritmo medio-alto, con una parada para hidratarse.', requisitos: 'Casco obligatorio y bicicleta en buen estado.', organizadorId: 'ignacio', organizadorNombre: 'Ignacio R.', postulaciones: aprobados(2) },
    { ...base, id: 'act-natacion', titulo: 'Natación en piscina municipal', deporte: 'Natación', nivelMinimo: 2, fecha: en(5, 18, 0), lugar: 'Piscina Municipal', comuna: 'Ñuñoa', cupos: 10, descripcion: 'Entrenamiento de series en piscina temperada. Una pista por grupo de nivel.', requisitos: 'Gorro de natación.', organizadorId: 'tomas', organizadorNombre: 'Tomás L.', postulaciones: aprobados(4, { [YO]: 'pendiente' }), mensajes: { [YO]: 'Llevo un año nadando, quiero mejorar mi técnica.' } },
    { ...base, id: 'act-box', titulo: 'Box grupal Ñuñoa', deporte: 'Box', nivelMinimo: null, fecha: en(6, 19, 0), lugar: 'Gimnasio Ñuñoa', comuna: 'Ñuñoa', cupos: 8, descripcion: 'Circuito técnico y sparring suave. Se presta equipo.', organizadorId: 'matias', organizadorNombre: 'Matías P.', postulaciones: aprobados(2) },
    { ...base, id: 'act-tenis', titulo: 'Tenis dobles de fin de semana', deporte: 'Tenis', nivelMinimo: 3, fecha: en(3, 11, 0), lugar: 'Club de Tenis', comuna: 'La Reina', cupos: 4, descripcion: 'Dobles amistosos de dos sets.', organizadorId: 'valentina', organizadorNombre: 'Valentina S.', postulaciones: aprobados(4) },
    { ...base, id: 'act-trekking', titulo: 'Trekking Cerro Manquehue', deporte: 'Trekking', nivelMinimo: null, fecha: en(-2, 8, 0), lugar: 'Cerro Manquehue', comuna: 'Vitacura', cupos: 8, descripcion: 'Subida suave con vista a la ciudad.', organizadorId: 'andres', organizadorNombre: 'Andrés M.', postulaciones: aprobados(5, { [YO]: 'aprobada' }) },
  ];
}

// ---------- reglas del organizador (HU-23, HU-26, HU-28) ----------
export function validarActividad(d: DatosActividad, ahora: number = Date.now(), minCupos = 0): Resultado {
  if (d.titulo.trim().length < 3) return { ok: false, motivo: 'Escribe un título de al menos 3 letras.' };
  if (!d.deporte) return { ok: false, motivo: 'Elige un deporte.' };
  if (!d.lugar.trim()) return { ok: false, motivo: 'Indica el lugar donde será.' };
  if (!d.comuna.trim()) return { ok: false, motivo: 'Indica la comuna.' };
  if (!Number.isInteger(d.cupos) || d.cupos < 2 || d.cupos > 50) return { ok: false, motivo: 'Los cupos deben ser un número entre 2 y 50.' };
  if (d.cupos < minCupos) return { ok: false, motivo: `Ya hay ${minCupos} personas aprobadas; no puedes dejar menos cupos.` };
  if (d.nivelMinimo !== null && !NOMBRES_NIVEL[d.nivelMinimo]) return { ok: false, motivo: 'El nivel mínimo no es válido.' };
  if (d.fecha <= ahora) return { ok: false, motivo: 'La fecha y la hora deben ser futuras.' };
  return { ok: true };
}

function limpiar(d: DatosActividad): DatosActividad {
  return { ...d, titulo: d.titulo.trim(), lugar: d.lugar.trim(), comuna: d.comuna.trim(), descripcion: d.descripcion.trim(), requisitos: d.requisitos.trim() };
}

/** Lista de postulantes (sin contarte a ti), con las pendientes primero. */
export function postulantes(a: Actividad): Postulante[] {
  const orden: Record<EstadoPostulacion, number> = { pendiente: 0, aprobada: 1, rechazada: 2 };
  return Object.entries(a.postulaciones)
    .filter(([id]) => id !== YO)
    .map(([id, estado]) => ({ id, nombre: nombreDePersona(id), estado, mensaje: a.mensajes[id] ?? '' }))
    .sort((x, y) => orden[x.estado] - orden[y.estado] || x.nombre.localeCompare(y.nombre));
}
export function pendientesDe(a: Actividad): number {
  return postulantes(a).filter((p) => p.estado === 'pendiente').length;
}

// ---------- almacén en memoria (como el resto de la versión simulada) ----------
let actividades: Actividad[] = crearActividadesDemo();
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
/** Lectura directa del estado actual (sin hook), igual que getEstado en matchStore. */
export const getActividades = () => actividades;

function actualizar(id: string, cambio: (a: Actividad) => Actividad) {
  actividades = actividades.map((a) => (a.id === id ? cambio(a) : a));
  emitir();
}

/** Envía la postulación si se cumplen todas las condiciones (HU-26). */
export function postular(id: string, mensaje: string, misDeportes: DeporteConNivel[] | undefined, ahora: number = Date.now()): Resultado {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  const verificacion = puedePostular(a, misDeportes, ahora);
  if (!verificacion.ok) return verificacion;
  actualizar(id, (x) => ({
    ...x,
    postulaciones: { ...x.postulaciones, [YO]: 'pendiente' },
    mensajes: { ...x.mensajes, [YO]: mensaje.trim() },
  }));
  return { ok: true };
}

/** Quita tu postulación, o tu lugar si ya estabas aprobado: el cupo vuelve a quedar libre (HU-28). */
export function retirarse(id: string): Resultado {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  const estado = a.postulaciones[YO];
  if (estado !== 'pendiente' && estado !== 'aprobada') return { ok: false, motivo: 'No tienes una postulación activa en esta actividad.' };
  actualizar(id, (x) => {
    const { [YO]: _quitada, ...resto } = x.postulaciones;
    const { [YO]: _mensaje, ...mensajes } = x.mensajes;
    return { ...x, postulaciones: resto, mensajes };
  });
  return { ok: true };
}

let contador = 1;

/** Publica una actividad nueva, abierta a postulaciones (HU-23). */
export function crearActividad(datos: DatosActividad, ahora: number = Date.now()): ResultadoCrear {
  const v = validarActividad(datos, ahora);
  if (!v.ok) return v;
  const id = `act-nueva-${contador++}`;
  const nueva: Actividad = { ...limpiar(datos), id, organizadorId: YO, organizadorNombre: 'Tú', cancelada: false, postulaciones: {}, mensajes: {} };
  actividades = [nueva, ...actividades];
  emitir();
  return { ok: true, id };
}

/** Cambia los datos de una actividad tuya que sigue vigente (HU-28). */
export function editarActividad(id: string, datos: DatosActividad, ahora: number = Date.now()): Resultado {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  if (a.organizadorId !== YO) return { ok: false, motivo: 'Solo quien organiza puede editarla.' };
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad fue cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  const v = validarActividad(datos, ahora, cuposTomados(a));
  if (!v.ok) return v;
  actualizar(id, (x) => ({ ...x, ...limpiar(datos) }));
  return { ok: true };
}

/** Cancela una actividad tuya que aún no se realiza (HU-28). */
export function cancelarActividad(id: string, ahora: number = Date.now()): Resultado {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  if (a.organizadorId !== YO) return { ok: false, motivo: 'Solo quien organiza puede cancelarla.' };
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad ya estaba cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  actualizar(id, (x) => ({ ...x, cancelada: true }));
  return { ok: true };
}

/** Aprueba o rechaza una postulación pendiente; aprobar usa un cupo (HU-26). */
export function responderPostulacion(id: string, personaId: string, decision: 'aprobada' | 'rechazada', ahora: number = Date.now()): Resultado {
  const a = actividades.find((x) => x.id === id);
  if (!a) return { ok: false, motivo: 'No encontramos esta actividad.' };
  if (a.organizadorId !== YO) return { ok: false, motivo: 'Solo quien organiza puede responder postulaciones.' };
  const estado = estadoActividad(a, ahora);
  if (estado === 'cancelada') return { ok: false, motivo: 'Esta actividad fue cancelada.' };
  if (estado === 'vencida') return { ok: false, motivo: 'Esta actividad ya finalizó.' };
  if (a.postulaciones[personaId] !== 'pendiente') return { ok: false, motivo: 'Esa postulación ya fue respondida.' };
  if (decision === 'aprobada' && cuposLibres(a) === 0) return { ok: false, motivo: 'No quedan cupos para aprobar a más personas.' };
  actualizar(id, (x) => ({ ...x, postulaciones: { ...x.postulaciones, [personaId]: decision } }));
  return { ok: true };
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarActividades(ahora: number = Date.now()) {
  actividades = crearActividadesDemo(ahora);
  contador = 1;
  emitir();
}

export function useActividades(): Actividad[] {
  return useSyncExternalStore(suscribir, getActividades, getActividades);
}