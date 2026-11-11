# Integraci?n de SportMatch a main ? 2026-11-11

Se integraron y publicaron los cambios en `origin/main` de los ocho repositorios.
La carpeta Sportmach contiene repositorios separados; cada uno conserva su propio `main`.
Los cambios locales pendientes se guardaron en commits antes del merge. Se conservaron
las ramas existentes y los respaldos `respaldo/antes-merge-20261111-190343` y,
donde hab?a cambios locales, `respaldo/cambios-locales-20261111-190343`.

## Ramas integradas

- App: `origin/main`, `origin/feat/chat-respuestas-perfil`, `origin/respaldo-sprint2` y cambios locales de planes, pagos y notificaciones.
- Clubes: `origin/master` en `main`, conservando l?mites y destacados desde ms-pago.
- Users, Matching y Activities: novedades de `origin/main` junto con los cambios locales de beneficios y l?mites.
- Web y Gateway: novedades de `origin/main` junto con el trabajo existente.
- Las dem?s ramas activas ya estaban contenidas en main.
- Las ramas hist?ricas `webpay-simulado`, `webpay-simulado-gw` y `union-github-sprint` se registraron mediante merges de estrategia `ours`: sus funciones ya est?n implementadas o reemplazadas en main. Estos merges conservan el c?digo actual; no reintroducen pagos en Clubes ni rutas del simulador antiguo.

## Choques y resoluci?n

| ?rea | Choque | Resoluci?n |
| --- | --- | --- |
| App: pantalla y servicio de chat | Sprint 2 usa conversaciones simuladas y main usa mensajes persistidos en la API. | Se mantuvo el servicio real, autenticaci?n, sondeo, paginaci?n, bloqueo y reportes. Se adapt? la interfaz para responder con `replyTo`, mostrar citas y recuperar el original con `around_id`. Se incorporaron mapas, visor de fotos y acceso al perfil desde el avatar. |
| Web: `scripts/test-bff.mjs` | Ambas ramas agregaron pruebas al final del archivo. | Se conservaron las pruebas de pagos administrativos y las de preselecci?n de postulantes aceptados. |
| Clubes: configuraci?n y dependencias | Ambas ramas retiraron pagos; una conserva consultas de beneficios a ms-pago. | Se mantuvieron `EntitlementsClient`, los l?mites y la configuraci?n interna de ms-pago. |
| Clubes: documentaci?n | Diferencias en README y eliminaci?n de PENDIENTES. | Se conserv? el seguimiento local y se document? la arquitectura actual. |
| Clubes: pruebas PostgreSQL | Dos m?dulos de ayuda y distinta cadena de migraciones. | Se us? el m?dulo de la rama entrante para sus nuevas pruebas y se conservaron los helpers existentes. Se restauraron sin modificar las migraciones 006 y 012?014 desde `origin/master`: las migraciones hist?ricas deben permanecer aunque las tablas antiguas de pagos queden sin uso. |
| App: prueba del cat?logo | El helper de apertura de Webpay ten?a un par?metro que una prueba de seguridad no reconoc?a. | Se nombr? `urlPago`; se mantiene la apertura de la URL de pago entregada por el backend. |

No quedaron conflictos Git pendientes. El env?o de fotos nuevas en el chat sigue dependiendo
de un servicio de subida de adjuntos: el visor permite ampliar fotos que ya llegan del servidor.
Los cambios privados que otra persona no haya subido a GitHub no se pueden incluir.

## Validaci?n

- App: 160 pruebas aprobadas, TypeScript, lint y exportaci?n web de Expo aprobados.
- Web: 67 pruebas aprobadas, TypeScript y compilaci?n de producci?n aprobados; lint sin errores, con un aviso previo por `clubId` sin uso en `scripts/mock-gateway.mjs`.
- Clubes: 565 aprobadas y 13 omitidas.
- Gateway: 281 aprobadas y 12 omitidas.
- Matching: 13 aprobadas y 190 omitidas.
- Activities: 34 aprobadas y 104 omitidas.
- Users y ms-pago: suites completadas sin fallos, con pruebas de PostgreSQL omitidas.
- No hay Docker ni un PostgreSQL local en ejecuci?n. Las omisiones de integraci?n con base de datos no equivalen a pruebas aprobadas; las respuestas citadas y migraciones deben validarse tambi?n con PostgreSQL antes de desplegar.
- No se gener? APK ni se hizo una revisi?n manual en un tel?fono.

Logs de app, Expo y Clubes en `artifacts/merge-20261111-*`.

## Pendientes de los due?os de GitHub

La cuenta disponible puede escribir c?digo, pero no tiene permiso de administrador en estos repositorios:

- `benjvvp2001/Ms-club`: cambiar la rama predeterminada de `master` a `main`.
- `jocelyncpg/sportmatch-web`: cambiar la rama predeterminada de `respaldo-sprint5` a `main`.

Los due?os pueden hacerlo en la configuraci?n del repositorio, en la secci?n de rama predeterminada.
El c?digo integrado ya est? en main; este ajuste evita que nuevas contribuciones partan de una rama antigua.

El remoto secundario `mio` de la app (`eritoD/Frontend-SportMatch-APP`) devolvi?
?Repository not found?. Se utiliz? y public? en el remoto principal `origin`
(`jocelyncpg/Frontend-SportMatch-APP`). No se alter? ni elimin? ese remoto.

## Trabajo del equipo desde ahora

En cada repositorio, guardar primero cualquier trabajo pendiente y luego ejecutar:

```powershell
git switch main
git pull --ff-only origin main
```

Crear futuras ramas desde main actualizado y dirigir los pull requests a main.
No continuar desarrollando sobre los respaldos de sprint.

## Commits de la integraci?n

La tabla corresponde al c?digo integrado; el commit posterior del informe solo agrega este documento.

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
