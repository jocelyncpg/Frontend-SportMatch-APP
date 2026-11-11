import { router } from 'expo-router';
import { getSession, rolDe } from './auth';

/** Acepta solo ids numéricos de ms-pago: un enlace o un push nunca decide otra cosa. */
export function planDeParametro(valor: unknown): string | null {
  return typeof valor === 'string' && /^\d{1,9}$/.test(valor) ? valor : null;
}

/**
 * HU-55: abre el catálogo de la cuenta (deportista o club). Con `planId`, la pantalla abre directo
 * el pago de ese plan para renovarlo. Sin sesión, lleva a iniciar sesión.
 */
export async function abrirPlanes(planId?: string | null, reemplazar = false) {
  const session = await getSession();
  const ir = reemplazar ? router.replace : router.push;
  if (!session) {
    ir('/(auth)/login');
    return;
  }
  const params = planId ? { plan: planId } : {};
  if (rolDe(session) === 'club') ir({ pathname: '/(club)/planes', params });
  else ir({ pathname: '/(deportista)/planes', params });
}
