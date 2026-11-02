import { ApiError, apiRequest } from './api';
import { getToken } from './auth';

// HU-48: historial de acciones administrativas (solo administradores, solo lectura).
// Solo es la conexión con Ms_Users vía el gateway; todavía no hay pantalla que lo use.

/** Catálogo cerrado de acciones; igual al de Ms_Users (app/schemas/audit.py). */
export type AccionAuditoria =
  | 'REPORT_REVIEWED' | 'REPORT_DISCARDED' | 'REPORT_ESCALATED' | 'USER_SUSPENDED' | 'USER_REACTIVATED' | 'SANCTION_APPLIED'
  | 'SANCTION_LIFTED' | 'PLAN_CREATED' | 'PLAN_UPDATED' | 'PLAN_DEACTIVATED' | 'MEMBERSHIP_UPDATED'
  | 'PAYMENT_REFUNDED';
export type RecursoAuditoria = 'user' | 'report' | 'plan' | 'membership' | 'payment' | 'club' | 'activity' | 'message';
export type ResultadoAuditoria = 'success' | 'failure';

export type FiltrosAuditoria = {
  /** ISO 8601 con zona horaria, p. ej. new Date().toISOString(). */
  desde?: string;
  hasta?: string;
  adminId?: string;
  accion?: AccionAuditoria;
  recursoTipo?: RecursoAuditoria;
  recursoId?: string;
  resultado?: ResultadoAuditoria;
  /** Desde 1. */
  pagina?: number;
  /** Máximo 100 (Ms_Users lo rechaza si lo supera). */
  porPagina?: number;
};

export type EventoAuditoria = {
  id: string;
  fecha: string;
  /** Nombre corto ("Ana T."); nunca correo ni RUT. null si la cuenta ya no existe. */
  adminNombre: string | null;
  adminId: string;
  accion: AccionAuditoria | string;
  recursoTipo: RecursoAuditoria | null;
  recursoId: string | null;
  /** Solo cuando el recurso afectado es una persona. */
  afectadoNombre: string | null;
  motivo: string | null;
  resultado: ResultadoAuditoria | string;
  detalle: Record<string, string | number | boolean | null> | null;
};

export type PaginaAuditoria = {
  items: EventoAuditoria[];
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
};

type PersonaApi = { id: string | null; nombre: string | null };
type EventoApi = {
  id: string; fecha: string; admin: PersonaApi; accion: string; recurso_tipo: RecursoAuditoria | null;
  recurso_id: string | null; afectado: PersonaApi | null; motivo: string | null; resultado: string;
  detalle: EventoAuditoria['detalle'];
};
type PaginaApi = { items: EventoApi[]; pagina: number; por_pagina: number; total: number; total_paginas: number };

const aEvento = (e: EventoApi): EventoAuditoria => ({
  id: e.id, fecha: e.fecha, adminId: e.admin.id ?? '', adminNombre: e.admin.nombre, accion: e.accion,
  recursoTipo: e.recurso_tipo, recursoId: e.recurso_id, afectadoNombre: e.afectado?.nombre ?? null,
  motivo: e.motivo, resultado: e.resultado, detalle: e.detalle,
});

/** Arma la query solo con los filtros presentes (los nombres son los de la API). */
export function queryAuditoria(f: FiltrosAuditoria): string {
  const params = new URLSearchParams();
  const pares: [string, string | number | undefined][] = [
    ['desde', f.desde], ['hasta', f.hasta], ['admin_id', f.adminId], ['accion', f.accion],
    ['recurso_tipo', f.recursoTipo], ['recurso_id', f.recursoId], ['resultado', f.resultado],
    ['pagina', f.pagina], ['por_pagina', f.porPagina],
  ];
  for (const [clave, valor] of pares) if (valor !== undefined && valor !== '') params.set(clave, String(valor));
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}

/** Más reciente primero. 401 sin sesión, 403 si la cuenta no es administradora. */
export async function listarAuditoria(filtros: FiltrosAuditoria = {}): Promise<PaginaAuditoria> {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  const r = await apiRequest<PaginaApi>(`/users/admin/audit-events${queryAuditoria(filtros)}`, { token });
  return { items: r.items.map(aEvento), pagina: r.pagina, porPagina: r.por_pagina, total: r.total, totalPaginas: r.total_paginas };
}

// -- Etiquetas legibles y filtros de la pantalla ------------------------------------------------------------------

export const ETIQUETA_ACCION: Record<AccionAuditoria, string> = {
  REPORT_REVIEWED: 'Reporte revisado',
  REPORT_DISCARDED: 'Reporte descartado',
  REPORT_ESCALATED: 'Reporte escalado a sanción',
  USER_SUSPENDED: 'Cuenta suspendida',
  USER_REACTIVATED: 'Cuenta reactivada',
  SANCTION_APPLIED: 'Sanción aplicada',
  SANCTION_LIFTED: 'Sanción levantada',
  PLAN_CREATED: 'Plan o convenio creado',
  PLAN_UPDATED: 'Plan o convenio editado',
  PLAN_DEACTIVATED: 'Plan o convenio desactivado',
  MEMBERSHIP_UPDATED: 'Membresía modificada',
  PAYMENT_REFUNDED: 'Pago reembolsado',
};
export const ETIQUETA_RECURSO: Record<RecursoAuditoria, string> = {
  user: 'Cuenta', report: 'Reporte', plan: 'Plan o convenio', membership: 'Membresía', payment: 'Pago',
  club: 'Club', activity: 'Actividad', message: 'Mensaje',
};
export const ETIQUETA_RESULTADO: Record<ResultadoAuditoria, string> = { success: 'Correcto', failure: 'Fallido' };

/** Nunca muestra el código crudo: una acción nueva que la app aún no conoce se ve como "Acción administrativa". */
export const etiquetaAccion = (accion: string): string => (ETIQUETA_ACCION as Record<string, string>)[accion] ?? 'Acción administrativa';
export const etiquetaRecurso = (tipo: string | null | undefined): string =>
  tipo ? (ETIQUETA_RECURSO as Record<string, string>)[tipo] ?? 'Otro' : '—';

export const ACCIONES_FILTRO = Object.keys(ETIQUETA_ACCION) as AccionAuditoria[];
export const RECURSOS_FILTRO = Object.keys(ETIQUETA_RECURSO) as RecursoAuditoria[];
export const AUDITORIA_POR_PAGINA = 20;

/**
 * Una fecha escrita por una persona ("08-11-2026" o "2026-11-08") a un instante ISO con zona. `fin` = el último
 * instante de ese día. Devuelve null si no es una fecha real (por ejemplo el 31-02).
 */
export function fechaAIso(texto: string, fin = false): string | null {
  const t = texto.trim();
  const latina = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);   // 08-11-2026
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);               // 2026-11-08
  let dia: number, mes: number, anio: number;
  if (latina) [dia, mes, anio] = [Number(latina[1]), Number(latina[2]), Number(latina[3])];
  else if (iso) [anio, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const d = fin ? new Date(anio, mes - 1, dia, 23, 59, 59, 999) : new Date(anio, mes - 1, dia, 0, 0, 0, 0);
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d.toISOString();
}

export type FormularioFiltros = { desde: string; hasta: string; accion?: AccionAuditoria; recurso?: RecursoAuditoria; pagina: number };

/** Del formulario de la pantalla a los filtros de la API, o un mensaje claro si algo no es válido. */
export function armarFiltros(f: FormularioFiltros): { filtros: FiltrosAuditoria } | { error: string } {
  const desde = f.desde.trim() ? fechaAIso(f.desde) : undefined;
  if (desde === null) return { error: 'La fecha "Desde" no es válida. Escríbela como 08-11-2026.' };
  const hasta = f.hasta.trim() ? fechaAIso(f.hasta, true) : undefined;
  if (hasta === null) return { error: 'La fecha "Hasta" no es válida. Escríbela como 08-11-2026.' };
  if (desde && hasta && desde > hasta) return { error: 'La fecha "Desde" no puede ser posterior a "Hasta".' };
  if (!Number.isInteger(f.pagina) || f.pagina < 1) return { error: 'La página no es válida.' };
  return {
    filtros: {
      desde: desde ?? undefined, hasta: hasta ?? undefined, accion: f.accion, recursoTipo: f.recurso,
      pagina: f.pagina, porPagina: AUDITORIA_POR_PAGINA,
    },
  };
}

const clp = (n: number) => `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/** Lo más útil del detalle de un evento (precios, duración, campos que cambiaron), sin mostrar datos crudos. */
export function resumenDetalle(e: Pick<EventoAuditoria, 'accion' | 'detalle'>): string {
  const d = e.detalle;
  if (!d) return '';
  const partes: string[] = [];
  const num = (v: unknown): v is number => typeof v === 'number';
  if (num(d.precio_nuevo)) {
    partes.push(num(d.precio_anterior) && d.precio_anterior !== d.precio_nuevo
      ? `Precio: ${clp(d.precio_anterior)} → ${clp(d.precio_nuevo)}`
      : `Precio: ${d.precio_nuevo === 0 ? 'Gratis' : clp(d.precio_nuevo)}`);
  }
  if (num(d.duracion_nueva)) {
    partes.push(num(d.duracion_anterior) && d.duracion_anterior !== d.duracion_nueva
      ? `Duración: ${d.duracion_anterior} → ${d.duracion_nueva} días`
      : `Duración: ${d.duracion_nueva} días`);
  }
  if (d.categoria === 'CONVENIO') partes.push('Convenio');
  if (typeof d.campos === 'string' && d.campos && d.campos !== 'creacion') {
    const nombres: Record<string, string> = {
      nombre: 'nombre', descripcion: 'descripción', precio: 'precio', duracion_dias: 'duración', beneficios: 'beneficios',
      institucion: 'institución', is_active: 'estado',
    };
    partes.push(`Cambió: ${d.campos.split(',').map((c) => nombres[c] ?? c).join(', ')}`);
  }
  if (e.accion.startsWith('SANCTION_')) {
    if (d.tipo === 'temporal') partes.push(num(d.dias) ? `Temporal, ${d.dias} días` : 'Temporal');
    else if (d.tipo === 'permanente') partes.push('Permanente');
  }
  return partes.join(' · ');
}
