import { router } from 'expo-router';
import type { DestinoNotificacion } from './notificaciones';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Allowlisted destinations: a push payload never supplies an arbitrary URL. */
export function abrirDestino(data: DestinoNotificacion) {
  if (data.screen === 'activity' && data.activityId && uuid.test(data.activityId)) {
    router.push({ pathname: '/(deportista)/activity/[id]', params: { id: data.activityId } });
  } else if (data.screen === 'activity_chat' && data.activityId && uuid.test(data.activityId)) {
    router.push({ pathname: '/(deportista)/chat-grupo/[id]', params: { id: data.activityId } });
  } else if (data.screen === 'consulta' && data.clubId && uuid.test(data.clubId)
    && data.hiloId && uuid.test(data.hiloId)) {
    router.push({ pathname: '/(deportista)/chat-club/[id]', params: { id: data.clubId } });
  } else if (data.screen === 'consulta_club' && data.clubId && uuid.test(data.clubId)
    && data.hiloId && uuid.test(data.hiloId)) {
    router.push({
      pathname: '/(club)/consulta/[id]',
      params: { id: data.hiloId, clubId: data.clubId },
    });
  } else if (data.screen === 'canal_inactivo' && data.clubId && uuid.test(data.clubId)
    && data.canalId && uuid.test(data.canalId)) {
    router.push({ pathname: '/(club)/canal/[id]', params: { id: data.canalId, clubId: data.clubId } } as never);
  } else if (data.screen === 'chat' && data.matchId && uuid.test(data.matchId)) {
    router.push({ pathname: '/(deportista)/chat/[id]', params: { id: data.matchId } });
  } else if (data.screen === 'matches') {
    router.push('/(deportista)/(tabs)/matches');
  } else if (data.screen === 'profile') {
    router.push('/(deportista)/(tabs)/profile');
  } else {
    router.push('/(deportista)/notificaciones');
  }
}
