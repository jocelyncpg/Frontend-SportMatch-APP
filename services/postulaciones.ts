import type { Resultado } from './consultas';
import {
  cambiarEstadoPostulacion,
  listarCandidatos,
  listarTodasConvocatoriasClub,
  mensajeErrorPostulacion,
  postularConvocatoria,
  type Candidato,
  type EstadoRevision,
} from './convocatorias';

// Postulaciones a convocatorias de club (HU-33 / HU-34) conectadas al backend:
//  - el deportista postula con POST /clubs/announcements/{id}/applications;
//  - el club revisa a sus candidatos con GET /clubs/announcements/{id}/applications
//    y responde con PATCH /clubs/announcements/applications/{postulacion_id}.
// Retirar una postulación todavía no tiene endpoint en el backend (pendiente).

const TAMANO_PAGINA = 50;

/** El deportista postula a la convocatoria abierta de un club. */
export async function postular(convocatoriaId: string, mensaje?: string | null): Promise<Resultado> {
  try {
    await postularConvocatoria(convocatoriaId, { mensaje: mensaje ?? null });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensajeErrorPostulacion(e) };
  }
}

/** El club preselecciona, acepta o rechaza a un candidato, con comentario opcional para el deportista. */
export async function resolverPostulacion(
  postulacionId: string,
  estado: EstadoRevision,
  comentario?: string,
): Promise<Resultado> {
  try {
    await cambiarEstadoPostulacion(postulacionId, estado, comentario);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo actualizar la postulación.' };
  }
}

/** Todos los candidatos de una convocatoria, acumulando páginas. */
async function candidatosDeConvocatoria(convocatoriaId: string): Promise<Candidato[]> {
  const primera = await listarCandidatos(convocatoriaId, undefined, 1, TAMANO_PAGINA);
  const paginas = Math.ceil(primera.total / primera.page_size);
  if (paginas <= 1) return primera.items;
  const siguientes = await Promise.all(
    Array.from({ length: paginas - 1 }, (_, i) => listarCandidatos(convocatoriaId, undefined, i + 2, TAMANO_PAGINA)),
  );
  return [...primera.items, ...siguientes.flatMap((pagina) => pagina.items)];
}

/** Panel del club: candidatos de todas sus convocatorias (abiertas, cerradas y finalizadas). */
export async function cargarPostulacionesDelClub(clubId: string): Promise<Candidato[]> {
  const convocatorias = await listarTodasConvocatoriasClub(clubId);
  const listas = await Promise.all(convocatorias.map((c) => candidatosDeConvocatoria(c.id)));
  return listas.flat();
}

/** Personas que reciben un aviso del club: postulaciones vigentes (no rechazadas), sin repetir a nadie. */
export function contarPostulantesVigentes(candidatos: Candidato[]): number {
  return new Set(candidatos.filter((c) => c.estado !== 'RECHAZADO').map((c) => c.usuario_id)).size;
}
