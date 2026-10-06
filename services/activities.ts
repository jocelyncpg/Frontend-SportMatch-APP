import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';

export type Activity = {
  id: string; title: string; sport_code: string; description: string;
  starts_at: string; location: string; created_at: string;
  organizer: { user_id: string; nombre: string; apellido_inicial: string; foto_perfil: string | null };
};
export type ActivityInput = Pick<Activity, 'title' | 'sport_code' | 'description' | 'starts_at' | 'location'>;
export type ActivityPage = { items: Activity[]; next_cursor: string | null };

async function request<T>(path: string, body?: ActivityInput & { client_activity_id: string }): Promise<T> {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) throw new ApiError('Inicia sesión para ver actividades.', 401, '');
  const result = await apiRequest<T>(path, { token, ...(body ? { method: 'POST', body } : {}) });
  if ((await getSession())?.id !== session.id || await getToken() !== token) {
    throw new ApiError('La sesión cambió. Vuelve a iniciar sesión.', 401, '');
  }
  return result;
}

export function listActivities(limit = 20, cursor?: string) {
  return request<ActivityPage>(`/activities?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
}
export function getActivity(id: string) { return request<Activity>(`/activities/${encodeURIComponent(id)}`); }
export function createActivity(body: ActivityInput, clientId: string) {
  return request<Activity>('/activities', { ...body, client_activity_id: clientId });
}

/** Interpret entered date and time in the device's local timezone; send an unambiguous UTC instant. */
export function activityStart(date: string, time: string): string {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) throw new Error('Usa fecha DD/MM/AAAA y hora HH:MM.');
  const [, day, month, year] = d.map(Number);
  const [, hour, minute] = t.map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day ||
      value.getHours() !== hour || value.getMinutes() !== minute) throw new Error('Revisa la fecha y hora ingresadas.');
  if (value.getTime() <= Date.now()) throw new Error('La fecha y hora deben ser futuras.');
  return value.toISOString();
}
export function activityTime(value: string) {
  return new Date(value).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
