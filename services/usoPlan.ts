import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { apiRequest, textoRecursoLimite } from './api';
import { getToken } from './auth';

// HU-54: "Te quedan X de N hoy". Cada servicio que aplica límites expone el uso actual con las mismas consultas
// que usa para el 402: ms-machine (/matching/plan-usage), Ms_activities (/activities/plan-usage) y
// Ms-club (/clubs/plan-usage/me). Es solo informativo: si un servicio no responde, ese recurso no se muestra.

/** limite null = sin límite (plan pagado); usado null = no se pudo saber (ms-pago no respondió). */
export type UsoRecurso = {
  recurso: string;
  limite: number | null;
  usado: number | null;
  ventana_horas: number | null;
  se_libera_en: string | null;
};
type UsoServicio = { plan: 'GRATIS' | 'PRO' | null; items: UsoRecurso[] };

export const RUTAS_USO = {
  solicitudes_match: '/matching/plan-usage',
  postulaciones_actividades: '/activities/plan-usage',
  actividades_organizadas: '/activities/plan-usage',
  postulaciones_convocatorias: '/clubs/plan-usage/me',
} as const;
export type RecursoDeportista = keyof typeof RUTAS_USO;

/** "Te quedan 4 de 6 solicitudes de match hoy"; null si no hay límite o no se sabe. */
export function textoUso(uso: UsoRecurso | undefined | null): string | null {
  if (!uso || uso.limite === null || uso.usado === null) return null;
  return `Te quedan ${Math.max(uso.limite - uso.usado, 0)} de ${uso.limite} ${textoRecursoLimite(uso.recurso)}`;
}

/** Versión corta para un subtítulo o junto a un botón: "Te quedan 4 de 6 hoy". */
export function textoUsoCorto(uso: UsoRecurso | undefined | null): string | null {
  if (!uso || uso.limite === null || uso.usado === null) return null;
  const cuando = uso.ventana_horas === 24 ? ' hoy' : uso.ventana_horas === 720 ? ' este mes' : '';
  return `Te quedan ${Math.max(uso.limite - uso.usado, 0)} de ${uso.limite}${cuando}`;
}

/** El uso de los recursos pedidos (una llamada por servicio). Los que fallan no aparecen. */
export async function cargarUso(recursos: readonly RecursoDeportista[]): Promise<UsoRecurso[]> {
  const token = await getToken();
  if (!token) return [];
  const rutas = [...new Set(recursos.map((r) => RUTAS_USO[r]))];
  const respuestas = await Promise.allSettled(rutas.map((ruta) => apiRequest<UsoServicio>(ruta, { token })));
  const items = respuestas.flatMap((r) => (r.status === 'fulfilled' && Array.isArray(r.value?.items) ? r.value.items : []));
  return recursos.map((recurso) => items.find((i) => i.recurso === recurso)).filter((i): i is UsoRecurso => !!i);
}

/** Recarga el uso cada vez que la pantalla gana el foco; `recargar` sirve después de usar un cupo. */
export function useUsoPlan(recursos: readonly RecursoDeportista[]): { uso: UsoRecurso[]; recargar: () => void } {
  const [uso, setUso] = useState<UsoRecurso[]>([]);
  const clave = recursos.join(',');
  const recargar = useCallback(() => {
    cargarUso(clave.split(',') as RecursoDeportista[]).then(setUso).catch(() => setUso([]));
  }, [clave]);
  useFocusEffect(recargar);
  return { uso, recargar };
}
