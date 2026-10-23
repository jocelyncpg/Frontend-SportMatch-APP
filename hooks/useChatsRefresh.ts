import { useEffect } from 'react';
import { AppState } from 'react-native';
import { cargarChats } from '../services/chat';
import { cargarChatsGrupales } from '../services/chatGrupal';
import { cargarHilosDeportista } from '../services/consultas';
import { cargarBloqueados } from '../services/reportes';

/**
 * Lista de chats y no leídos mientras la app está activa (HU-49, HU-60). Se monta una vez en las
 * pestañas del deportista para que el globo y el aviso de mensaje nuevo funcionen en todas.
 * Ms_Matching también ofrece un WebSocket (/api/v1/chats/ws); por ahora basta con consultar.
 */
export function useChatsRefresh(intervaloMs = 6000) {
  useEffect(() => {
    const refresh = () => {
      if (AppState.currentState !== 'active') return;
      cargarChats().catch(() => {});
      cargarChatsGrupales().catch(() => {});
      cargarHilosDeportista().catch(() => {});
    };
    refresh();
    // Para marcar "Bloqueado" en la lista; cambia solo cuando bloqueas o desbloqueas desde la app.
    cargarBloqueados().catch(() => {});
    const timer = setInterval(refresh, intervaloMs);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [intervaloMs]);
}
