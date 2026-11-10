# Integración de respaldo-sprint2 en main

Se incorporaron las pantallas, iconos, calendario, mapa estático, configuración,
diálogos y banner de avisos de `respaldo-sprint2`, manteniendo las API de `main`.

- Registro, login, biometría y sesión usan Ms_Users. Se conservan los roles
  `player`, `club_admin` y `admin` y el manejo de cuentas suspendidas.
- Descubrir conserva filtros del servidor, selección por `userId` y solicitudes
  asíncronas. Una petición fallida devuelve la tarjeta para reintentar.
- Matches conserva recibidas, enviadas, cancelación y confirmados. Chats mantiene
  conversaciones, grupos, consultas y canales reales con sus controles de acceso.
- Mi club carga el perfil y el catálogo de deportes del servidor. Dirección y
  coordenadas se guardan mediante PATCH; el mapa público lee esos mismos datos.
- Configuración guarda los nombres en Ms_Users y lista los bloqueos del backend.
- La foto usa la API multipart de HU-61 y la eliminación del servidor. La API
  actual admite **una foto por perfil**: el editor respeta ese límite; las cinco
  fotos de la versión local no se presentan como si estuvieran sincronizadas.
- Se conserva el historial de actividades y la reputación calculada por el backend.
- Los planes y pagos se confirman en Ms-club. No se activa una suscripción local
  al pulsar contratar. El cambio de contraseña con contraseña actual sigue
  dependiendo de una API pendiente; la recuperación por correo está disponible.

Los datos que una persona guardó en su teléfono no forman parte del repositorio
Git. Para revisar se usan las bases PostgreSQL del entorno local.

## Comprobación

```sh
npm test
npx tsc --noEmit
npm run lint
npx expo start --web --port 8081
```

`test-integracion-sprint2.cjs` cubre la edición de datos personales sin perder
otros campos, la foto persistente y las coordenadas del perfil del club.
