import { ApiError, cuentaDelLimite } from './api';
import type { BotonDialogo } from './dialogo';

// HU-54: cuando un servicio responde 402 LIMITE_PLAN, la app avisa "Te quedan 0 de N · Pásate a Pro"
// con un botón al catálogo de planes. El layout raíz lo conecta con alLlegarAlLimite (services/api.ts).

export const RUTA_CATALOGO = { deportista: '/(deportista)/planes', club: '/(club)/planes' } as const;

/** "el 9/11 a las 14:05", en la hora del teléfono. */
export function cuandoSeLibera(iso: string | null, ahora: number = Date.now()): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
  const hoy = new Date(ahora);
  const mismoDia = fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate();
  return mismoDia ? `hoy a las ${hora}` : `el ${fecha.getDate()}/${fecha.getMonth() + 1} a las ${hora}`;
}

export type AvisoLimite = { titulo: string; mensaje: string; botones: BotonDialogo[] };

/** El diálogo para un error de límite; null si el error no es de límite del plan. */
export function avisoLimite(error: ApiError, ir: (ruta: string) => void, ahora: number = Date.now()): AvisoLimite | null {
  const limite = error.limitePlan;
  if (!limite) return null;
  const cuenta = cuentaDelLimite(limite);
  const libera = cuandoSeLibera(limite.se_libera_en, ahora);
  return {
    titulo: 'Llegaste al límite de tu plan',
    mensaje: libera ? `${error.message}\nSe libera un cupo ${libera}.` : error.message,
    botones: [
      { text: 'Ahora no', style: 'cancel' },
      { text: cuenta === 'club' ? 'Ver planes' : 'Pásate a Pro', onPress: () => ir(RUTA_CATALOGO[cuenta]) },
    ],
  };
}
