# Integración sprint 2 con el backend — 8 de octubre de 2026

Merge de `respaldo-sprint2` (vistas del sprint 2) sobre `main` (integración con Users,
Matching y Activities). Criterio: **la vista es la del sprint 2; los datos vienen del backend**.

## Cómo quedó cada parte

| Parte | Vista | Datos |
|---|---|---|
| Inicio, Matches, Perfil, Perfil de otra persona | Sprint 2 | Servidor (main) |
| Matches | Sprint 2 + pestaña **Enviadas** con Cancelar | Servidor |
| Chat | Main + reportar persona y mensaje (sprint 2) | Servidor |
| Actividades: lista, detalle y **`activity/nueva`** | Sprint 2 | Ms_Activities |
| Recuperar contraseña | Sprint 2 | Ms_Users (`password-reset`) |
| Objetivos del perfil | Sprint 2 | Ms_Users (`preferences.objetivos`, máximo 5) |
| Disponibilidad (texto libre) | Sprint 2 | Solo en el teléfono: Ms_Users pide franjas con hora |
| Calificaciones, reportes, notificaciones, búsqueda | Sprint 2 | Simulado (no hay servicio aún) |

`create-activity.tsx`, `services/activities.ts`, `hooks/useActivities.ts` y
`components/ActivityCard.tsx` se eliminaron: los reemplazan `activity/nueva.tsx` y
`services/actividades.ts`.

## `services/actividades.ts`

Mantiene la misma interfaz que usaban las pantallas del sprint 2 y por dentro llama a
Ms_Activities: lista, detalle, crear (con `client_activity_id` para no duplicar al
reintentar), postular, ver postulantes y aceptar o rechazar. Los cupos ocupados salen de
`capacity - available_spots`.

Ms_Activities todavía **no tiene campos** para comuna, nivel mínimo ni requisitos, y
rechaza campos desconocidos (422). Mientras tanto viajan como texto legible:

- `location`: `"Cancha Los Pinos · Maipú"`
- al final de `description`: `"Requisitos: …"` y `"Nivel mínimo: Intermedio (3/5)"`

Toda esa conversión está en `aBackend()` y `desdeBackend()`. Cuando el backend agregue los
campos, solo hay que cambiar esas dos funciones.

**Sin endpoint todavía** (muestran "Esta opción todavía no está disponible en el servidor"):
editar actividad, cancelar actividad y retirarse. El mensaje que se escribe al postular solo
lo ve quien postula.

## Verificación

- `npm run test:activities`: 9 pruebas nuevas del servicio (lista, organizador, publicar y
  leer comuna/nivel/requisitos, reintento sin duplicar, postular y aprobar, nivel mínimo,
  sin sesión, cambio de cuenta, opciones sin endpoint).
- `npm run test:discovery`: 27 pruebas correctas.
- `npx tsc --noEmit` sin errores; `npm run lint` sin errores (1 advertencia previa en `MatchModal`).
- Exportación web de Expo correcta.
- Contra Docker local: crear, reintentar con la misma clave, listar, postular, ver
  recibidas, aceptar y recalcular cupos con dos cuentas; datos de prueba eliminados.
- Revisión visual en el teléfono: pendiente.
