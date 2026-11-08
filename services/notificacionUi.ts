import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { abrirDestino } from './notificationNavigation';
import type { Colors } from '../theme/ThemeContext';
import { marcarLeida, useNotificaciones, type Notificacion, type TipoNotificacion } from './notificaciones';

const ICONO: Record<TipoNotificacion, keyof typeof Ionicons.glyphMap> = {
  solicitud: 'person-add-outline',
  match: 'heart',
  calificacion: 'star',
  actividad: 'calendar-outline',
  mensaje: 'chatbubble-ellipses',
  canal: 'megaphone-outline',
};

/** Ícono y color de un aviso; los usan la bandeja y el banner para verse igual. */
export function estiloNotificacion(n: Notificacion, colors: Colors): { icono: keyof typeof Ionicons.glyphMap; color: string } {
  const color =
    n.resultado === 'aprobada' ? colors.success
      : n.resultado === 'rechazada' ? colors.danger
      : n.tipo === 'match' ? '#DB2777'
      : n.tipo === 'calificacion' ? '#FACC15'
      : n.tipo === 'actividad' ? '#38BDF8'
      : n.tipo === 'mensaje' ? colors.primary
      : n.tipo === 'canal' ? colors.success
      : colors.accent;
  const icono = n.resultado === 'aprobada' ? 'checkmark-circle' : n.resultado === 'rechazada' ? 'close-circle' : ICONO[n.tipo];
  return { icono, color };
}

/** Marca el aviso como leído y abre lo que corresponde (perfil, chat, actividad, club o tu perfil). */
export function abrirNotificacion(n: Notificacion) {
  void marcarLeida(n.id).catch(() => {});
  abrirDestino(n.data);
}

export function useVibrarAlLlegarAvisos(mensajesNoLeidos: number) {
  const { noLeidas, usuarioId } = useNotificaciones();
  const anterior = useRef({ noLeidas, mensajesNoLeidos, usuarioId });
  useEffect(() => {
    const previo = anterior.current;
    anterior.current = { noLeidas, mensajesNoLeidos, usuarioId };
    if (previo.usuarioId === usuarioId && usuarioId && (noLeidas > previo.noLeidas || mensajesNoLeidos > previo.mensajesNoLeidos)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [noLeidas, mensajesNoLeidos, usuarioId]);
}
