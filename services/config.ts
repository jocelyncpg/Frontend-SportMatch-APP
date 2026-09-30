// La app habla solo con el gateway (frontend → gateway → microservicios).
// En un teléfono, "localhost" es el propio teléfono: define la IP del PC en
// .env.local (no se sube a git), por ejemplo:
//   EXPO_PUBLIC_API_URL=http://192.168.1.18:8000/api/v1
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
