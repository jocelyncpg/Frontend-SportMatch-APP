# Integración de vistas — 6 de octubre de 2026

Se resolvió el merge entre la implementación local `eac02d7` y el commit de Jocelyn
`90e1b09` (**Deportes por nivel**), conservando su diseño y adaptándolo a Users y Matching.

## Qué se conservó del trabajo de Jocelyn

- El editor de deportes de Perfil: sugeridos, deportes personalizados, botón para agregar,
  eliminación individual y selector de nivel por deporte.
- Los nombres de niveles: Principiante, Básico, Intermedio, Avanzado y Experto.
- Los controles rápidos de Descubrir: Todas, 2 km, 5 km y 10 km.
- El botón de información sobre la foto y el gesto que distingue entre tocar y arrastrar.
- La vista `/perfil/[id]`: foto, afinidad, información, deportes, biografía y acciones.
- `RatingModal.tsx` sin modificaciones. Sigue disponible como componente; este merge no
  implementa ni simula un servicio de valoraciones.

## Adaptaciones realizadas

| Archivo | Ajuste |
|---|---|
| `services/auth.ts` | Usa `DeporteConNivel` (`nombre`, `nivel`) en la sesión y traduce esos datos a `deporte_codigo`/`nivel` para Users. Conserva autenticación, recuperación de contraseña y guardado reales. Convierte las sesiones antiguas de nombres y mapa de niveles al nuevo formato. |
| `services/matchStore.ts` | Mantiene las solicitudes reales, cancelación, matches y filtros. Los radios rápidos usan el servidor y conservan el deporte y rango de nivel seleccionados. Añade `distanceKm` a partir del dato real del backend. |
| `profile.tsx` | Conserva el diseño de Jocelyn. Lee preferencias del servidor, guarda deportes con niveles, bloquea envíos mientras se guardan y permite desplazar el modal en pantallas pequeñas. Mantiene las correcciones del GPS y de la comuna manual. |
| `discover.tsx` | Integra los radios y botón de información de Jocelyn con el matching real. Añade acceso compacto a los filtros de deporte/nivel. Navega al perfil usando solo el identificador del deportista. |
| `services/athletes.ts` | Consulta el perfil público por ID con autenticación; descarta respuestas si cambia la sesión. |
| `/perfil/[id]` | Obtiene los datos públicos del servidor. El corazón espera la respuesta real. Muestra el estado de la solicitud o permite chatear si existe un match aceptado. No utiliza nombres o biografías recibidos en la URL como fuente del perfil. |
| `/athlete/[id]` | Redirige a la vista de Jocelyn conservando los enlaces existentes desde Matches y Chat y la validación por ID de match. |
| `SuggestionFilters.tsx` | Admite 2 km y presentación compacta en Descubrir; mantiene los filtros completos y el requisito de ubicación. |
| `scripts/test-discovery.cjs` | Actualiza las pruebas al formato de deportes con nivel y agrega casos para sesiones antiguas, guardado, radio de 2 km y perfiles autenticados. |

Las pantallas de Matches y Chat conservan el funcionamiento implementado previamente.
No se modifican contratos del backend: la API existente ya admite el radio de 2 km y
los niveles numéricos del 1 al 5.

## Verificación

- 27 pruebas automatizadas de app aprobadas.
- TypeScript y ESLint de los archivos involucrados sin errores.
- Exportación web de Expo verificada al cerrar la integración.
- Sin marcadores de conflicto en las fuentes ni entradas sin resolver en Git.
- Revisión visual interactiva pendiente: el control del navegador requiere permisos de
  Accesibilidad y Grabación de pantalla que no estaban habilitados durante la revisión.

## Comprobación manual sugerida

1. Recargar Expo e iniciar sesión con una cuenta ya existente.
2. Abrir Perfil → Deportes → Editar y comprobar el diseño de Jocelyn; guardar y volver
   a abrir para verificar los niveles.
3. En Descubrir, elegir un radio y un deporte/nivel; los radios requieren GPS guardado.
4. Tocar el botón de información de una card sin arrastrarla y abrir su perfil.
5. Enviar una solicitud desde ese perfil y verificar que continúa pendiente hasta que
   la otra persona la acepte.
6. Abrir un match aceptado desde Matches y desde Chat: ambos deben mostrar el mismo
   diseño de perfil y permitir abrir la conversación correcta.
