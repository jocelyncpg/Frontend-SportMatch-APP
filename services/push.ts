import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { apiRequest } from './api';
import { getSession, getToken } from './auth';

const KEY = 'sportmatch_push_device_v1';
type Registro = { device_id: string; revoke_secret: string; userId?: string; enabled: boolean; registered: boolean; confirmed?: boolean };
type Estado = { enabled: boolean; busy: boolean; denied: boolean; error: string | null };
let estado: Estado = { enabled: false, busy: false, denied: false, error: null };
const oyentes = new Set<() => void>();
const update = (patch: Partial<Estado>) => { estado = { ...estado, ...patch }; oyentes.forEach((fn) => fn()); };
const subscribe = (fn: () => void) => { oyentes.add(fn); return () => { oyentes.delete(fn); }; };
export const usePush = () => useSyncExternalStore(subscribe, () => estado, () => estado);
let cola: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const task = cola.then(action, action);
  cola = task.catch(() => {});
  return task;
}

export function soportePush(): string | null {
  if (Platform.OS === 'web') return 'Las alertas al celular se activan desde la app móvil.';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'Esta versión de prueba permite ver los avisos aquí. Las alertas al celular requieren la app instalada de SportMatch.';
  if (!Device.isDevice) return 'Activa las alertas desde tu celular.';
  return null;
}
export async function moduloNotificaciones() {
  return soportePush() ? null : import('expo-notifications');
}
async function registro(): Promise<Registro> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
  const value = { device_id: Crypto.randomUUID(), revoke_secret: Crypto.randomUUID(), enabled: false, registered: false };
  await guardar(value);
  return value;
}
const guardar = (value: Registro) => AsyncStorage.setItem(KEY, JSON.stringify(value));

async function revocar(value: Registro) {
  if (value.registered) {
    await apiRequest('/notifications/devices/revoke', { method: 'POST',
      body: { device_id: value.device_id, revoke_secret: value.revoke_secret }, timeoutMs: 15000 });
  }
  await guardar({ ...value, enabled: false, registered: false, confirmed: false, userId: undefined });
  update({ enabled: false });
  const notifications = await moduloNotificaciones();
  if (notifications) await notifications.dismissAllNotificationsAsync().catch(() => {});
}

/** Explicit button only. Resume/sync never opens the operating-system prompt. */
export function activarPush() {
  return serial(async () => {
    update({ busy: true, error: null });
    try { await sincronizar(true); }
    catch (error) { update({ error: error instanceof Error ? error.message : 'No se pudieron activar las alertas.' }); }
    finally { update({ busy: false }); }
  });
}

export function sincronizarPush() {
  return serial(async () => {
    try { await sincronizar(false); }
    catch (error) { update({ error: error instanceof Error ? error.message : 'No se pudieron actualizar las alertas.' }); }
  });
}

async function sincronizar(solicitar: boolean) {
  const value = await registro();
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token || (value.userId && value.userId !== session.id)) {
    await revocar(value);
    return;
  }
  update({ enabled: value.enabled && !!value.confirmed && value.userId === session.id, error: null });
  if (!solicitar && !value.enabled) return;
  const notifications = await moduloNotificaciones();
  if (!notifications) { if (solicitar) throw new Error(soportePush()!); return; }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Las alertas al celular todavía no están disponibles en esta versión. Puedes consultar tus avisos aquí.');
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('sportmatch', { name: 'Matches y actividades',
      importance: notifications.AndroidImportance.HIGH, sound: 'default' });
  }
  let permission = await notifications.getPermissionsAsync();
  if (solicitar && !permission.granted && permission.canAskAgain) {
    permission = await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: true } });
  }
  const allowed = permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
  update({ denied: !allowed });
  if (!allowed) { await revocar(value); return; }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let pushToken: string;
  try {
    pushToken = (await Promise.race([
      notifications.getExpoPushTokenAsync({ projectId }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('No se pudo conectar para activar las alertas. Revisa tu conexión y vuelve a intentarlo.')), 15000); }),
    ])).data;
  } finally { if (timeout) clearTimeout(timeout); }
  if ((await getSession())?.id !== session.id || await getToken() !== token) return;
  // Save before request: even an ambiguous network failure must be revoked on logout.
  const pending = { ...value, userId: session.id, enabled: true, registered: true, confirmed: false };
  await guardar(pending);
  await apiRequest('/notifications/devices', { method: 'PUT', token, timeoutMs: 15000,
    body: { device_id: value.device_id, revoke_secret: value.revoke_secret, token: pushToken, consent: true } });
  await guardar({ ...pending, confirmed: true });
  update({ enabled: true, error: null });
}

export function desactivarPush() {
  return serial(async () => {
    update({ busy: true, error: null });
    try { await revocar(await registro()); }
    catch (error) { update({ error: error instanceof Error ? error.message : 'No se pudieron desactivar las alertas.' }); throw error; }
    finally { update({ busy: false }); }
  });
}

export async function puedeMostrarPush(userId: unknown) {
  const [value, session] = await Promise.all([registro(), getSession()]);
  return value.enabled && value.userId === session?.id && session?.id === userId;
}
