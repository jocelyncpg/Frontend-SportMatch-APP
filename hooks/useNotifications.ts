import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getSession } from '../services/auth';
import { cargarMatching } from '../services/matchStore';
import { abrirDestino } from '../services/notificationNavigation';
import { cargarNotificaciones, marcarLeida } from '../services/notificaciones';
import { moduloNotificaciones, puedeMostrarPush, sincronizarPush } from '../services/push';

export function useNotifications() {
  const segments = useSegments();
  const area = segments[0];
  useEffect(() => {
    if (area !== '(deportista)') return;
    const refresh = () => { if (AppState.currentState === 'active') void cargarNotificaciones(); };
    refresh();
    void sincronizarPush();
    const interval = setInterval(refresh, 15000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') { refresh(); void sincronizarPush(); }
    });
    let disposed = false;
    const subscriptions: { remove(): void }[] = [];
    void moduloNotificaciones().then(async (notifications) => {
      if (!notifications || disposed) return;
      notifications.setNotificationHandler({ handleNotification: async (notification) => {
        const show = await puedeMostrarPush(notification.request.content.data.userId);
        return { shouldPlaySound: show, shouldSetBadge: false, shouldShowBanner: show, shouldShowList: show };
      } });
      subscriptions.push(notifications.addNotificationReceivedListener(() => {
        refresh(); void cargarMatching();
      }));
      subscriptions.push(notifications.addPushTokenListener(() => { void sincronizarPush(); }));
      let lastId: string | null = null;
      const open = async (response: import('expo-notifications').NotificationResponse) => {
        const id = response.notification.request.identifier;
        if (lastId === id || disposed) return;
        lastId = id;
        const data = response.notification.request.content.data;
        const session = await getSession();
        if (disposed) return;
        await notifications.clearLastNotificationResponseAsync();
        if (!session || data.userId !== session.id) return;
        if (typeof data.notificationId === 'string') void marcarLeida(data.notificationId).catch(() => {});
        abrirDestino(data);
        refresh();
      };
      subscriptions.push(notifications.addNotificationResponseReceivedListener((r) => { void open(r).catch(() => {}); }));
      const last = await notifications.getLastNotificationResponseAsync();
      if (last) await open(last);
    }).catch(() => {});
    return () => { disposed = true; clearInterval(interval); listener.remove(); subscriptions.forEach((s) => s.remove()); };
  }, [area]);
}
