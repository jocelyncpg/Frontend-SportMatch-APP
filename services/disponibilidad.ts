// Tipos y utilidades del bloque "disponibilidad + objetivos" del perfil deportivo.
// Vive en un archivo propio (y no en auth.ts) para que sirva igual con la versión
// simulada y con la versión real de auth.ts.

export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
export type Franja = 'manana' | 'tarde' | 'noche';
export type Disponibilidad = Partial<Record<DiaSemana, Franja[]>>;

export const DIAS: { key: DiaSemana; corto: string }[] = [
  { key: 'lun', corto: 'Lun' },
  { key: 'mar', corto: 'Mar' },
  { key: 'mie', corto: 'Mié' },
  { key: 'jue', corto: 'Jue' },
  { key: 'vie', corto: 'Vie' },
  { key: 'sab', corto: 'Sáb' },
  { key: 'dom', corto: 'Dom' },
];

export const FRANJAS: { key: Franja; label: string }[] = [
  { key: 'manana', label: 'Mañana' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noche', label: 'Noche' },
];

export const OBJETIVOS_DISPONIBLES = [
  'Mantener la salud',
  'Bajar de peso',
  'Ganar masa muscular',
  'Mejorar resistencia',
  'Competir',
  'Aprender un deporte nuevo',
  'Conocer gente y socializar',
];

export function tieneFranja(d: Disponibilidad | undefined, dia: DiaSemana, franja: Franja): boolean {
  return (d?.[dia] ?? []).includes(franja);
}

/** Activa o desactiva una franja de un día. No modifica el objeto original. */
export function toggleFranja(d: Disponibilidad | undefined, dia: DiaSemana, franja: Franja): Disponibilidad {
  const nuevo: Disponibilidad = { ...(d ?? {}) };
  const actuales = nuevo[dia] ?? [];
  const siguientes = actuales.includes(franja)
    ? actuales.filter((f) => f !== franja)
    : [...actuales, franja];
  // Siempre en el orden mañana → tarde → noche
  const ordenadas = FRANJAS.map((f) => f.key).filter((k) => siguientes.includes(k));
  if (ordenadas.length === 0) delete nuevo[dia];
  else nuevo[dia] = ordenadas;
  return nuevo;
}

/** Resumen legible, en orden de lunes a domingo, solo con los días que tienen franjas. */
export function resumenDisponibilidad(d: Disponibilidad | undefined): { dia: string; texto: string }[] {
  const resumen: { dia: string; texto: string }[] = [];
  for (const dia of DIAS) {
    const franjas = d?.[dia.key] ?? [];
    if (franjas.length === 0) continue;
    const texto =
      franjas.length === FRANJAS.length
        ? 'Todo el día'
        : FRANJAS.filter((f) => franjas.includes(f.key)).map((f) => f.label).join(', ');
    resumen.push({ dia: dia.corto, texto });
  }
  return resumen;
}