// Disponibilidad del deportista como días de la semana + horas ("Lun 07:00, 18:00 · Sáb 10:00").
// Se sigue guardando como TEXTO en el perfil (campo `disponibilidad`), igual que antes, así el backend y la
// búsqueda no cambian: lo único nuevo es cómo se arma ese texto en el editor.

export type DiaHorario = 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom';
export type Horarios = Partial<Record<DiaHorario, string[]>>;

export const DIAS_HORARIO: DiaHorario[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const NOMBRE_DIA: Record<DiaHorario, string> = {
  Lun: 'lunes', Mar: 'martes', Mié: 'miércoles', Jue: 'jueves', Vie: 'viernes', Sáb: 'sábado', Dom: 'domingo',
};

/** Horas de uso común para elegir con un toque; cualquier otra se escribe a mano. */
export const HORAS_SUGERIDAS = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '15:00', '17:00', '18:00', '19:00', '20:00', '21:00'];

/** Máximo de horas por día, para que el perfil se mantenga ordenado. */
export const MAX_HORAS_DIA = 5;

/** Acepta "7", "07", "7:30", "07:30" o "1830" y devuelve "HH:MM"; null si no es una hora válida (00:00–23:59). */
export function normalizarHora(texto: string): string | null {
  const t = texto.trim();
  let h: string;
  let m = '00';
  const conPuntos = /^(\d{1,2})[:.](\d{2})$/.exec(t);
  const compacta = /^(\d{2})(\d{2})$/.exec(t);
  const soloHora = /^(\d{1,2})$/.exec(t);
  if (conPuntos) { h = conPuntos[1]; m = conPuntos[2]; }
  else if (compacta) { h = compacta[1]; m = compacta[2]; }
  else if (soloHora) { h = soloHora[1]; }
  else return null;
  const hn = Number(h);
  const mn = Number(m);
  if (hn > 23 || mn > 59) return null;
  return `${String(hn).padStart(2, '0')}:${m}`;
}

export type ResultadoHorario = { ok: true; horarios: Horarios } | { ok: false; motivo: string };

/** Agrega una hora a un día (no modifica el original). Las horas quedan ordenadas y sin repetir. */
export function agregarHora(h: Horarios, dia: DiaHorario, hora: string): ResultadoHorario {
  const normal = normalizarHora(hora);
  if (!normal) return { ok: false, motivo: 'Escribe una hora válida, por ejemplo 18:30.' };
  const actuales = h[dia] ?? [];
  if (actuales.includes(normal)) return { ok: false, motivo: `Ya agregaste las ${normal}.` };
  if (actuales.length >= MAX_HORAS_DIA) return { ok: false, motivo: `Puedes agregar hasta ${MAX_HORAS_DIA} horas por día.` };
  return { ok: true, horarios: { ...h, [dia]: [...actuales, normal].sort() } };
}

/** Quita una hora de un día; el día queda seleccionado aunque se quede sin horas. */
export function quitarHora(h: Horarios, dia: DiaHorario, hora: string): Horarios {
  return { ...h, [dia]: (h[dia] ?? []).filter((x) => x !== hora) };
}

/** Quita un día completo. */
export function quitarDia(h: Horarios, dia: DiaHorario): Horarios {
  const nuevo = { ...h };
  delete nuevo[dia];
  return nuevo;
}

/** Días elegidos que todavía no tienen ninguna hora. */
export function diasSinHoras(h: Horarios): DiaHorario[] {
  return DIAS_HORARIO.filter((d) => h[d] !== undefined && h[d]!.length === 0);
}

/** Texto que se guarda en el perfil: solo los días con horas, de lunes a domingo. */
export function serializarHorarios(h: Horarios): string {
  return DIAS_HORARIO.filter((d) => (h[d] ?? []).length > 0)
    .map((d) => `${d} ${[...h[d]!].sort().join(', ')}`)
    .join(' · ');
}

/**
 * Lee un texto guardado con el formato de arriba. Devuelve null si es texto libre de la versión anterior
 * (por ejemplo "Sábados en la mañana"), para que el editor no lo malinterprete.
 */
export function parsearHorarios(texto: string): Horarios | null {
  const t = texto.trim();
  if (t === '') return {};
  const resultado: Horarios = {};
  for (const bloque of t.split(' · ')) {
    const m = /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) (\d{2}:\d{2}(?:, \d{2}:\d{2})*)$/.exec(bloque);
    if (!m) return null;
    const dia = m[1] as DiaHorario;
    if (resultado[dia]) return null;
    const horas = m[2].split(', ');
    if (horas.some((x) => normalizarHora(x) !== x)) return null;
    resultado[dia] = horas;
  }
  return resultado;
}