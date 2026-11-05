import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Colors } from '../theme/ThemeContext';
import { marcarLeida, type Notificacion, type TipoNotificacion } from './notificaciones';

const ICONO: Record<TipoNotificacion, keyof typeof Ionicons.glyphMap> = {
  solicitud: 'person-add-outline',
  match: 'heart',
  calificacion: 'star',
  actividad: 'calendar-outline',
  mensaje: 'chatbubble-ellipses',
  club: 'megaphone-outline',
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
      : n.tipo === 'club' ? colors.success
      : colors.accent;
  const icono = n.resultado === 'aprobada' ? 'checkmark-circle' : n.resultado === 'rechazada' ? 'close-circle' : ICONO[n.tipo];
  return { icono, color };
}

/** Marca el aviso como leído y abre lo que corresponde (perfil, chat, actividad, club o tu perfil). */
export function abrirNotificacion(n: Notificacion) {
  marcarLeida(n.id);
  const p = n.persona;
  if (n.tipo === 'solicitud' && p) {
    router.push({
      pathname: '/(deportista)/perfil/[id]',
      params: {
        id: p.id,
        name: p.name,
        sport: p.sport,
        level: p.level,
        age: p.age?.toString() ?? '',
        compatibility: p.compatibility.toString(),
        distance: p.distance ?? '',
        bio: p.bio ?? '',
        colorFrom: p.colorFrom,
        fotoUri: p.fotoUri ?? '',
      },
    });
  } else if (n.tipo === 'club' && n.clubId) {
    router.push({ pathname: '/(deportista)/club/[id]', params: { id: n.clubId, name: n.clubNombre ?? '' } });
  } else if (n.tipo === 'actividad' && n.actividadId) {
    router.push({ pathname: '/(deportista)/activity/[id]', params: { id: n.actividadId } });
  } else if ((n.tipo === 'match' || n.tipo === 'mensaje') && p) {
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: p.id, name: p.name, sport: p.sport, colorFrom: p.colorFrom },
    });
  } else {
    router.push('/(deportista)/(tabs)/profile');
  }
}