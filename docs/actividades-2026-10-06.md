# Actividades deportivas — 6 de octubre de 2026

La pantalla principal y el listado de actividades ahora consultan el microservicio Ms_Activities a través del gateway. Se eliminaron las actividades y distancias de ejemplo de esas dos vistas.

## Recorrido

1. En Inicio, tocar **Crear actividad**, o entrar por **Ver todos** en Próximas actividades.
2. Completar título, deporte, fecha, hora y lugar. La descripción es opcional.
3. Publicar. La app abre el detalle confirmado por el servidor.
4. Otro deportista puede entrar a Actividades y ver la publicación; al regresar a la pantalla o deslizar hacia abajo se actualiza el listado.
5. Tocar una tarjeta para consultar fecha, lugar, descripción y organizador.

Se mantiene el tema y la tarjeta `TrainingRow` existentes mediante `ActivityCard`. Las fechas se interpretan en la zona horaria del dispositivo y se guardan como instantes UTC. La lista muestra próximas actividades por fecha, con paginación, estados de carga, vacío y reintento. Los errores de sesión ofrecen volver al login.

`services/activities.ts` concentra el contrato HTTP y evita entregar respuestas de una sesión anterior. El formulario mantiene una clave de reintento por contenido y bloquea envíos simultáneos. El servidor también protege la identidad del organizador y evita publicaciones duplicadas.

## Verificación

- `npm run test:activities`: 6 pruebas del contrato HTTP, autenticación, respuestas obsoletas, fallos de red y fechas.
- `npm run test:discovery`: 27 pruebas existentes correctas.
- Integración real con Docker y PostgreSQL: publicar con una cuenta y consultar con otra, completada; datos de prueba eliminados.
- TypeScript y ESLint de los archivos modificados: sin errores.
- Exportación web: completada. Expo conserva advertencias previas del layout raíz sobre grupos sin `_layout`; no impiden la exportación.

No se realizó revisión visual interactiva en dispositivo. No se añadieron inscripción, cupos, chat grupal ni cálculo de distancia de actividades en esta entrega.

Documentación del backend: [Ms_Activities](../../Ms_Activities/README.md).
