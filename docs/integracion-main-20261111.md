# Integración de SportMatch a main — 2026-11-11

Se integraron y publicaron los cambios en `origin/main` de los ocho repositorios.
La carpeta Sportmach contiene repositorios separados; cada uno conserva su propio `main`.
Los cambios locales pendientes se guardaron en commits antes del merge. Se conservaron
las ramas existentes y los respaldos `respaldo/antes-merge-20261111-190343` y,
donde había cambios locales, `respaldo/cambios-locales-20261111-190343`.

## Ramas integradas

- App: `origin/main`, `origin/feat/chat-respuestas-perfil`, `origin/respaldo-sprint2` y cambios locales de planes, pagos y notificaciones.
- Clubes: `origin/master` en `main`, conservando límites y destacados desde ms-pago.
- Users, Matching y Activities: novedades de `origin/main` junto con los cambios locales de beneficios y límites.
- Web y Gateway: novedades de `origin/main` junto con el trabajo existente.
- Las demás ramas activas ya estaban contenidas en main.
- Las ramas históricas `webpay-simulado`, `webpay-simulado-gw` y `union-github-sprint` se registraron mediante merges de estrategia `ours`: sus funciones ya están implementadas o reemplazadas en main. Estos merges conservan el código actual; no reintroducen pagos en Clubes ni rutas del simulador antiguo.

## Choques y resolución

| Área | Choque | Resolución |
| --- | --- | --- |
| App: pantalla y servicio de chat | Sprint 2 usa conversaciones simuladas y main usa mensajes persistidos en la API. | Se mantuvo el servicio real, autenticación, sondeo, paginación, bloqueo y reportes. Se adaptó la interfaz para responder con `replyTo`, mostrar citas y recuperar el original con `around_id`. Se incorporaron mapas, visor de fotos y acceso al perfil desde el avatar. |
| Web: `scripts/test-bff.mjs` | Ambas ramas agregaron pruebas al final del archivo. | Se conservaron las pruebas de pagos administrativos y las de preselección de postulantes aceptados. |
| Clubes: configuración y dependencias | Ambas ramas retiraron pagos; una conserva consultas de beneficios a ms-pago. | Se mantuvieron `EntitlementsClient`, los límites y la configuración interna de ms-pago. |
| Clubes: documentación | Diferencias en README y eliminación de PENDIENTES. | Se conservó el seguimiento local y se documentó la arquitectura actual. |
| Clubes: pruebas PostgreSQL | Dos módulos de ayuda y distinta cadena de migraciones. | Se usó el módulo de la rama entrante para sus nuevas pruebas y se conservaron los helpers existentes. Se restauraron sin modificar las migraciones 006 y 012–014 desde `origin/master`: las migraciones históricas deben permanecer aunque las tablas antiguas de pagos queden sin uso. |
| App: prueba del catálogo | El helper de apertura de Webpay tenía un parámetro que una prueba de seguridad no reconocía. | Se nombró `urlPago`; se mantiene la apertura de la URL de pago entregada por el backend. |

No quedaron conflictos Git pendientes. El envío de fotos nuevas en el chat sigue dependiendo
de un servicio de subida de adjuntos: el visor permite ampliar fotos que ya llegan del servidor.
Los cambios privados que otra persona no haya subido a GitHub no se pueden incluir.

## Validación

- App: 160 pruebas aprobadas, TypeScript, lint y exportación web de Expo aprobados.
- Web: 67 pruebas aprobadas, TypeScript y compilación de producción aprobados; lint sin errores, con un aviso previo por `clubId` sin uso en `scripts/mock-gateway.mjs`.
- Clubes: 565 aprobadas y 13 omitidas.
- Gateway: 281 aprobadas y 12 omitidas.
- Matching: 13 aprobadas y 190 omitidas.
- Activities: 34 aprobadas y 104 omitidas.
- Users y ms-pago: suites completadas sin fallos, con pruebas de PostgreSQL omitidas.
- No hay Docker ni un PostgreSQL local en ejecución. Las omisiones de integración con base de datos no equivalen a pruebas aprobadas; las respuestas citadas y migraciones deben validarse también con PostgreSQL antes de desplegar.
- No se generó APK ni se hizo una revisión manual en un teléfono.

Logs de app, Expo y Clubes en `artifacts/merge-20261111-*`.

## Pendientes de los dueños de GitHub

La cuenta disponible puede escribir código, pero no tiene permiso de administrador en estos repositorios:

- `benjvvp2001/Ms-club`: cambiar la rama predeterminada de `master` a `main`.
- `jocelyncpg/sportmatch-web`: cambiar la rama predeterminada de `respaldo-sprint5` a `main`.

Los dueños pueden hacerlo en la configuración del repositorio, en la sección de rama predeterminada.
El código integrado ya está en main; este ajuste evita que nuevas contribuciones partan de una rama antigua.

El remoto secundario `mio` de la app (`eritoD/Frontend-SportMatch-APP`) devolvió
“Repository not found”. Se utilizó y publicó en el remoto principal `origin`
(`jocelyncpg/Frontend-SportMatch-APP`). No se alteró ni eliminó ese remoto.

## Trabajo del equipo desde ahora

En cada repositorio, guardar primero cualquier trabajo pendiente y luego ejecutar:

```powershell
git switch main
git pull --ff-only origin main
```

Crear futuras ramas desde main actualizado y dirigir los pull requests a main.
No continuar desarrollando sobre los respaldos de sprint.

## Commits de la integración

La tabla corresponde al código integrado; el commit posterior del informe solo agrega este documento.

| Repositorio | Commit |
| --- | --- |
| Frontend-SportMatch-APP | `43514f2` |
| sportmatch-web | `60575a9` |
| Ms_gateway | `4eea49f` |
| Ms_Users | `90fc1ff` |
| Ms-club | `31bea42` |
| ms-machine | `19a465b` |
| Ms_activities | `9f19af5` |
| ms-pago | `4ad56c7` |
