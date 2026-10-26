import { apiRequest } from './api';
import { getToken } from './auth';

// Avisos del club a sus postulantes (HU-38, lado del club), con el backend (comunicados):
//  - POST /clubs/{club_id}/notices publica el aviso; la audiencia TODOS llega a quienes postulan
//    (pendientes y preseleccionados) y a los aceptados, es decir, a las postulaciones no rechazadas.
//  - GET /clubs/{club_id}/notices lista los avisos que el club ya publicó.

export const TITULO_MAX = 80;
export const MENSAJE_MAX = 500;

export type AvisoClub = {
  id: string;
  titulo: string;
  mensaje: string;
  ts: number;
  /** Cuántas personas recibieron el aviso (informado por el backend). */
  destinatarios: number;
};

type ComunicadoClubApi = {
  id: string;
  titulo: string;
  contenido: string;
  fecha_creacion: string;
  destinatarios: number;
};

type PaginaComunicadosClub = {
  items: ComunicadoClubApi[];
  total: number;
  page: number;
  page_size: number;
};

export type ResultadoAviso = { ok: true; destinatarios: number } | { ok: false; motivo: string };

async function tokenActual() {
  const token = await getToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return token;
}

const convertir = (c: ComunicadoClubApi): AvisoClub => ({
  id: c.id,
  titulo: c.titulo,
  mensaje: c.contenido,
  ts: Date.parse(c.fecha_creacion),
  destinatarios: c.destinatarios,
});

/** Avisos publicados por el club, el más reciente primero. */
export async function cargarAvisosClub(clubId: string): Promise<AvisoClub[]> {
  const pagina = await apiRequest<PaginaComunicadosClub>(
    `/clubs/${encodeURIComponent(clubId)}/notices?page=1&page_size=50`,
    { token: await tokenActual() },
  );
  return pagina.items.map(convertir);
}

/** El club envía un aviso a sus postulantes y miembros. */
export async function enviarAvisoClub(clubId: string, titulo: string, mensaje: string): Promise<ResultadoAviso> {
  const t = titulo.trim();
  const m = mensaje.trim();
  if (!t || !m) return { ok: false, motivo: 'Escribe un título y un mensaje.' };
  if (t.length > TITULO_MAX) return { ok: false, motivo: `El título admite hasta ${TITULO_MAX} caracteres.` };
  if (m.length > MENSAJE_MAX) return { ok: false, motivo: `El mensaje admite hasta ${MENSAJE_MAX} caracteres.` };
  try {
    const creado = await apiRequest<ComunicadoClubApi>(`/clubs/${encodeURIComponent(clubId)}/notices`, {
      method: 'POST',
      token: await tokenActual(),
      body: { titulo: t, contenido: m, audiencia: 'TODOS', prioridad: 'NORMAL' },
    });
    return { ok: true, destinatarios: creado.destinatarios };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo enviar el aviso.' };
  }
}
