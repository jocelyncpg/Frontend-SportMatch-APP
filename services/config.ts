import Constants from 'expo-constants';

// La app habla solo con el gateway (frontend → gateway → microservicios).
// En un teléfono, "localhost" es el propio teléfono, así que por defecto se usa
// la IP del PC que sirve la app (la misma del QR de Expo) con el puerto 8000.
// Para otro servidor, define en .env.local (no se sube a git), por ejemplo:
//   EXPO_PUBLIC_API_URL=http://192.168.1.18:8000/api/v1
function urlPorDefecto(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:8000/api/v1`;
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? urlPorDefecto();
