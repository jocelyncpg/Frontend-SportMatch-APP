import { useSyncExternalStore } from 'react';

export type TipoReporte = 'usuario' | 'actividad' | 'mensaje';
export type ResultadoReporte = { ok: true } | { ok: false; motivo: string };

export type Reporte = {
  id: string;
  tipo: TipoReporte;
  objetivoId: string;
  objetivoNombre: string;
  motivo: string;
  detalle: string;
  ts: number;
};

/** Motivos predefinidos (HU-42). El último de cada lista es "Otro" y obliga a explicar. */
export const MOTIVOS: Record<TipoReporte, string[]> = {
  usuario: ['Acoso o trato irrespetuoso', 'Lenguaje ofensivo', 'Perfil falso o suplantación', 'Spam o publicidad', 'Otro'],
  actividad: ['Actividad falsa o engañosa', 'Contenido inapropiado', 'Lugar inseguro', 'Spam o publicidad', 'Otro'],
  mensaje: ['Acoso o amenazas', 'Lenguaje ofensivo', 'Contenido inapropiado', 'Spam o estafa', 'Otro'],
};
export const MOTIVO_OTRO = 'Otro';
export const MAX_DETALLE = 300;

export const TITULO_TIPO: Record<TipoReporte, string> = {
  usuario: 'Reportar usuario',
  actividad: 'Reportar actividad',
  mensaje: 'Reportar mensaje',
};

let reportes: Reporte[] = [];
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
export const getReportes = () => reportes;
export function useReportes(): Reporte[] {
  return useSyncExternalStore(suscribir, getReportes, getReportes);
}

/**
 * Registra un reporte (HU-42). SIMULADO: queda solo en memoria; en la app real lo recibe el backend
 * y llega al panel de moderación (HU-43).
 */
export function reportar(
  tipo: TipoReporte,
  objetivoId: string,
  objetivoNombre: string,
  motivo: string,
  detalle: string,
  ahora: number = Date.now()
): ResultadoReporte {
  if (!MOTIVOS[tipo].includes(motivo)) return { ok: false, motivo: 'Elige un motivo para el reporte.' };
  const texto = detalle.trim();
  if (texto.length > MAX_DETALLE) return { ok: false, motivo: `El detalle admite hasta ${MAX_DETALLE} caracteres.` };
  if (motivo === MOTIVO_OTRO && texto.length < 10) return { ok: false, motivo: 'Cuéntanos qué pasó (al menos 10 caracteres).' };
  if (reportes.some((r) => r.tipo === tipo && r.objetivoId === objetivoId && r.motivo === motivo)) {
    return { ok: false, motivo: 'Ya enviaste este reporte. Lo estamos revisando.' };
  }
  reportes = [...reportes, { id: `rep-${reportes.length + 1}`, tipo, objetivoId, objetivoNombre, motivo, detalle: texto, ts: ahora }];
  emitir();
  return { ok: true };
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarReportes() {
  reportes = [];
  emitir();
}