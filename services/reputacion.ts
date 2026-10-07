// Tipos y utilidades de la reputación del deportista (calificaciones que RECIBE).
// Vive en un archivo propio para que sirva igual con la versión simulada y con la real.

export type CalificacionRecibida = {
    id: string;
    /** Nombre de quien calificó. */
    de: string;
    estrellas: number;
    comentario?: string;
    /** Texto ya listo para mostrar, ej. "Hace 2 semanas". */
    cuando: string;
    /** true = dato de ejemplo (no viene de un usuario real). La pantalla lo marca como "Ejemplo". */
    simulada?: boolean;
  };
  
  /** Promedio de estrellas, o null si todavía no hay calificaciones. */
  export function promedioEstrellas(lista: { estrellas: number }[]): number | null {
    if (lista.length === 0) return null;
    const suma = lista.reduce((acc, c) => acc + c.estrellas, 0);
    return suma / lista.length;
  }
  
  /** "4.5" para mostrar en pantalla, o "—" si no hay promedio. */
  export function formatearPromedio(promedio: number | null): string {
    return promedio === null ? '—' : promedio.toFixed(1);
  }