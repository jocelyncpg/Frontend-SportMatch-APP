# Mapa de rutas: integración visual Jocelyn + backend

Rama `integracion-visual-jocelyn`. Cada archivo de `app\` es una pantalla de Expo Router.

Estados:
- **OK**: la pantalla usa el backend real y el endpoint responde en el gateway desplegado (`http://localhost:8000`). Si no se probó el flujo completo, dice qué se probó.
- **SIMULADO**: la pantalla muestra contenido de plantilla o datos locales sin conexión al backend.
- **FALLA**: la pantalla tiene una acción que no funciona con el backend desplegado hoy. El código de la app ya está corregido o el problema es del backend (ver nota).

Resumen: 38 rutas. **OK: 35. SIMULADO: 1. FALLA: 2.**

| ruta | rol que la ve | servicio | endpoint | estado | nota |
|---|---|---|---|---|---|
| `/` (app/index.tsx) | todos | ninguno (redirección) | ninguno | OK | Siempre redirige a onboarding, aunque haya sesión guardada. Pendiente de producto. |
| `/modal` (app/modal.tsx) | nadie (sin enlace) | ninguno | ninguno | SIMULADO | Plantilla de Expo en inglés, no se llega desde la app. Pendiente: borrar. |
| `/(auth)/onboarding` | público | ninguno | ninguno | OK | Solo navega a login o registro. |
| `/(auth)/login` | público | auth | POST /users/auth/login; GET /users/{id}/profile; GET /users/{id}/preferences; GET /clubs/me (club_admin) | OK | Probado: deportista 200 (frontend "app"), club 200 (frontend "web"), clave incorrecta 401. El login no bloquea a ningún rol. |
| `/(auth)/register` | público | auth | POST /users/auth/register | OK | Endpoint presente en el gateway. No probado (crea cuentas). |
| `/(auth)/register-club` | público | auth, validators | POST /users/auth/register-club; POST /clubs (si el club quedó pendiente) | OK | Endpoints presentes. No probado (crea cuentas). |
| `/(auth)/verify-email` | público | auth | POST /users/auth/email-verification/confirm; POST /users/auth/email-verification/request | OK | Endpoints presentes. No probado (requiere código). |
| `/(auth)/forgot-password` | público | recuperacion | POST /users/auth/password-reset/request; POST /users/auth/password-reset/confirm | OK | Endpoints presentes. No probado (requiere código). |
| `/(admin)/home` | admin | reportes | GET /users/admin/reports; PATCH /users/admin/reports/{id} | OK | Endpoints presentes. No hay cuenta admin de prueba. |
| `/(club)/home` | club_admin | clubes, consultas, convocatorias (ConvocatoriasClub), auth | GET /clubs/me; GET /clubs/{id}/consultas; GET /clubs/deportes; POST /clubs/{id}/announcements; POST /clubs/{id}/announcements/{id}/close; PATCH /clubs/{id}/announcements/{id}/chat; cambio de contraseña (sin endpoint) | FALLA | El toggle de chat de postulantes llama a PATCH .../chat, que el gateway desplegado no tiene (404). La ruta correcta ya está en el código. El modal "Cambiar contraseña" no tiene endpoint en el backend: siempre muestra error. |
| `/(club)/mi-club` | club_admin | perfilClub, clubes | GET /clubs/{id}; PATCH /clubs/{id}; GET /clubs/deportes | OK | GET /clubs/{id} probado (200). PATCH no probado. |
| `/(club)/postulaciones` | club_admin | convocatorias, consultas, ReportarModal | GET /clubs/announcements?club_id=; GET /clubs/announcements/{id}/applications; PATCH /clubs/announcements/applications/{id}; POST /clubs/{id}/consultas/postulantes/{usuario}/messages; POST /users/reports | FALLA | Lectura y filtros probados (200). "En espera" envía PENDIENTE (corregido en la app). El backend desplegado responde 400 a PENDIENTE: su imagen está desactualizada respecto al código fuente, que sí lo acepta. |
| `/(club)/avisos` | club_admin | avisosClub, postulaciones | GET /clubs/{id}/notices; POST /clubs/{id}/notices | OK | GET 200 y POST 201 probados (se publicó un comunicado de prueba). |
| `/(club)/consultas` | club_admin | consultas | GET /clubs/{id}/consultas | OK | 200 probado. |
| `/(club)/consulta/[id]` | club_admin | consultas | GET /clubs/{id}/consultas/{hilo}/messages; POST /clubs/{id}/consultas/{hilo}/messages | OK | Lectura del hilo probada (200). |
| `/(club)/canales` | club_admin | canales | GET /clubs/{id}/canales; POST /clubs/{id}/canales | OK | GET 200 probado. POST presente. |
| `/(club)/canal/[id]` | club_admin | canales | GET/POST .../canales/{id}/messages; PATCH/DELETE .../canales/{id}; GET .../miembros; POST .../inactividad | OK | Endpoints presentes. No probado en detalle. |
| `/(club)/planes` | club_admin | planes | GET /payments/plans?tipo=CLUB; GET /payments/subscription/me; POST /payments/webpay/initiate | OK | Planes 200. Suscripción sin plan (404) se maneja como "sin plan". |
| `/(deportista)/(tabs)/index` | player | actividades, matchStore, notificaciones | GET /users/suggestions; GET /activities; GET /notifications | OK | 200 probado. |
| `/(deportista)/(tabs)/discover` | player | matchStore | GET /users/suggestions; POST /matching/requests | OK | GET 200 probado. POST presente. |
| `/(deportista)/(tabs)/matches` | player | matchStore | GET /matching/state; DELETE /matching/requests/{id} | OK | 200 probado. |
| `/(deportista)/(tabs)/chat` | player | chat, chatGrupal, consultas, canales, reportes | GET /chats; GET /users/chat-preferences; GET /activities/chats; GET /clubs/consultas/me; GET /clubs/canales/me; GET /users/me/blocks | OK | 200 probado en todos. |
| `/(deportista)/(tabs)/profile` | player | auth, planes, actividades, reputacion, horarios | GET/PUT /users/{id}/profile; GET/PUT /users/{id}/preferences; GET /ratings/me; GET /activities/history; GET /payments/subscription/me | OK | GET probados (200). Rama "Ejemplo" de calificaciones es código muerto: `cargarReputacion` nunca marca `simulada`. |
| `/(deportista)/activities` | player | actividades | GET /activities | OK | 200 probado. |
| `/(deportista)/activity/[id]` | player | actividades, chatGrupal, matchStore | GET /activities/{id}; POST/DELETE /activities/{id}/applications(/me); GET /activities/{id}/participants; PUT /ratings/{id} | OK | Detalle, participantes y postulaciones recibidas probados (200). |
| `/(deportista)/activity/nueva` | player | actividades | POST /activities | OK | 201 probado (se creó y se borró la actividad de prueba). |
| `/(deportista)/athlete/[id]` | player | athletes | GET /users/athletes/{id} | OK | 200 probado. |
| `/(deportista)/buscar` | player | busqueda (filtro local), matchStore, reportes | GET /users/suggestions; GET /users/me/blocks; PUT /users/me/blocks/{id} | OK | Filtra en el teléfono sobre datos reales del backend. |
| `/(deportista)/canal/[id]` | player | canales | GET/POST /clubs/canales/{id}/messages; POST /clubs/canales/{id}/read; PUT /clubs/canales/{id}/mute | OK | Endpoints presentes. Sin canal de prueba con mensajes. |
| `/(deportista)/chat/[id]` | player | chat, reportes, sondeo | GET/POST /chats/{id}/messages; PATCH /chats/{id}/read; PUT /users/me/blocks/{id} | OK | Endpoints presentes. Sin chat 1 a 1 en la cuenta de prueba. |
| `/(deportista)/chat-club/[id]` | player | consultas, clubes, convocatorias | GET /clubs/{id}/consultas/me/messages; POST /clubs/{id}/consultas/me/messages; GET /clubs/{id} | OK | Probado: el club abre el hilo (201), el postulante lee (200) y responde (201). |
| `/(deportista)/chat-grupo/[id]` | player | chatGrupal | GET/POST /activities/{id}/chat/messages; POST /activities/{id}/chat/read; PUT /activities/{id}/chat/mute | OK | Probado: envío 201, lectura 200, marcar leído 204. |
| `/(deportista)/club/[id]` | player | clubes, convocatorias, consultas | GET /clubs/{id}; GET /clubs/announcements?club_id=; POST /clubs/announcements/{id}/applications | OK | Postular probado: 201 en convocatoria con cupos; 409 "La convocatoria no tiene cupos disponibles." se muestra al usuario. |
| `/(deportista)/clubs` | player | clubes | GET /clubs?page= | OK | 200 probado. |
| `/(deportista)/convocatorias` | player | convocatorias | GET /clubs/announcements?estado=ABIERTA | OK | 200 probado (ABIERTA y CERRADA). |
| `/(deportista)/notificaciones` | player | notificaciones, chat, notificationNavigation | GET /notifications; POST /notifications/read | OK | 200 y 204 probados. Abrir: comunicado lleva al club, consulta lleva al chat del club (probado en datos reales). Convocatoria no tiene destino y cae a la lista de notificaciones. |
| `/(deportista)/perfil/[id]` | player | athletes, matchStore, reportes, chat | GET /users/athletes/{id}; PUT/DELETE /users/me/blocks/{id}; POST /users/reports | OK | 200 probado. |
| `/(deportista)/planes` | player | planes | GET /payments/plans?tipo=USUARIO; GET /payments/subscription/me | OK | Planes 200 y suscripción 200 probados. |

## Notas

- Todos los endpoints que usa la app existen en el gateway desplegado, salvo `PATCH /api/v1/clubs/{club_id}/announcements/{convocatoria_id}/chat`. La ruta está en el código fuente del gateway y de Ms-club, así que hay que redeployar.
- `PENDIENTE` en `PATCH /clubs/announcements/applications/{id}` está en el código fuente de Ms-club, pero el backend desplegado responde 400. Hay que redeployar.
- Los servicios que no llaman al backend (busqueda, horarios, comunas, validators, sondeo, deportes, location, biometria, notificationNavigation) son lógica local, no datos simulados.
- Funciones de demo sin uso fuera de su archivo (`simularCambioDelOrganizador`, `useAvisos`, `reiniciarActividades` en services/actividades.ts): no llegan a ninguna ruta.
