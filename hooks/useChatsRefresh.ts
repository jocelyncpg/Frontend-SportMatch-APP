import { useEffect } from 'react';
import { cargarChats } from '../services/chat';
import { cargarChatsGrupales } from '../services/chatGrupal';
import { cargarHilosDeportista } from '../services/consultas';
import { cargarBloqueados } from '../services/reportes';
import { alCambiar, crearSondeo } from '../services/sondeo';
/**
 * Lista de chats y no leídos mientras la app está activa (HU-49, HU-60). Se monta una vez en las
 * pestañas del deportista para que el globo y el aviso de mensaje nuevo funcionen en todas.
 */

export function useChatsRefresh() {
  useEffect(() => {
    const sondeo = crearSondeo('listas:deportista', async () => {
      const resultados = await Promise.allSettled([cargarChats(), cargarChatsGrupales(), cargarHilosDeportista()]);
      return resultados.some((resultado) => resultado.status === 'fulfilled' && resultado.value);
    }, { minMs: 10000, maxMs: 60000, factor: 1.5 });
    sondeo.iniciar();
    const quitarAviso = alCambiar(({ tipo }) => {
      if (['activity_chat', 'consulta', 'consulta_club', 'chat', 'listas'].includes(tipo)) sondeo.ahora();
    });
    // Para marcar "Bloqueado" en la lista; cambia solo cuando bloqueas o desbloqueas desde la app.
    cargarBloqueados().catch(() => { });
    return () => {
      sondeo.detener();
      quitarAviso();
    };
  }, []);
}
