// HU-45: lo que la app sabe de una suspensión. Sin dependencias: lo usan api.ts y el layout (aviso y cierre de sesión).

/** Lo que el gateway responde en un 403 con code "account_suspended". `fin` es null si es permanente. */
export type Suspension = { tipo: 'temporal' | 'permanente'; motivo: string; fin: string | null };

/** Normaliza lo que llega del backend: tipo conocido, motivo como texto y fin como texto o null. */
export function leerSuspension(data: { tipo?: unknown; motivo?: unknown; fin?: unknown } | null | undefined): Suspension {
  const permanente = data?.tipo === 'permanente' || !data?.fin;
  return {
    tipo: permanente ? 'permanente' : 'temporal',
    motivo: typeof data?.motivo === 'string' ? data.motivo.trim() : '',
    fin: permanente || typeof data?.fin !== 'string' ? null : data.fin,
  };
}

type DependenciasSuspension = {
  /** ¿Sigue habiendo una sesión abierta? Una respuesta tardía de una sesión ya cerrada no vuelve a avisar. */
  haySesion: () => Promise<boolean>;
  avisar: (texto: string) => void;
  cerrarSesion: () => Promise<void>;
  irAlLogin: () => void;
};

/**
 * Qué hace la app cuando una llamada con sesión recibe 403 account_suspended: avisa una sola vez (aunque varias
 * llamadas fallen a la vez), cierra la sesión y vuelve al inicio de sesión. Si cerrar la sesión falla a medias,
 * igual vuelve al login: la sesión local ya no sirve.
 */
export function crearManejadorSuspension(deps: DependenciasSuspension) {
  let enCurso = false;
  return async (error: { message: string }): Promise<void> => {
    if (enCurso) return;
    enCurso = true;
    try {
      if (!(await deps.haySesion())) return;
      deps.avisar(error.message);
      try {
        await deps.cerrarSesion();
      } catch {
        // se sigue: lo que pudo limpiarse ya se limpió y la sesión suspendida no debe quedar usable
      }
      deps.irAlLogin();
    } finally {
      enCurso = false;
    }
  };
}
