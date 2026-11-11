import Constants from 'expo-constants';

// La app habla solo con el gateway (frontend → gateway → microservicios).
// En un teléfono, "localhost" es el propio teléfono, así que por defecto se usa
// la IP del PC que sirve la app (la misma del QR de Expo) con el puerto 8000.
// Para otro servidor, define en .env.local (no se sube a git), por ejemplo:
//   EXPO_PUBLIC_API_URL=http://192.168.1.18:8000/api/v1
export function resolverApiUrl(configurada?: string, hostExpo?: string | null): string {
  const explicita = configurada?.trim().replace(/\/+$/, '');
  if (explicita) return explicita;
  let host = 'localhost';
  if (hostExpo) {
    try { host = new URL(hostExpo.includes('://') ? hostExpo : `http://${hostExpo}`).hostname; }
    catch { /* Sin servidor de Expo disponible, se usa el gateway local. */ }
  }
  return `http://${host}:8000/api/v1`;
}

export const API_BASE_URL = resolverApiUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri);
