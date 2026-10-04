import { apiRequest, ApiError } from './api';
import { getSession, getToken } from './auth';
import { ConexionApi, personaConexion } from './matchStore';

export type MensajeApi = {
  id: string; match_id: string; sender_id: string; client_message_id: string;
  text: string; created_at: string;
};

async function chatRequest<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}) {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) throw new ApiError('Inicia sesión para abrir el chat.', 401, '');
  const data = await apiRequest<T>(path, { ...options, token });
  const [current, currentToken] = await Promise.all([getSession(), getToken()]);
  if (current?.id !== session.id || currentToken !== token) throw new ApiError('La sesión cambió.', 401, '');
  return { data, userId: session.id };
}

export async function getChat(matchId: string) {
  const result = await chatRequest<ConexionApi>(`/matching/matches/${encodeURIComponent(matchId)}`);
  return { persona: personaConexion(result.data), userId: result.userId };
}

export async function getMensajes(matchId: string, cursor: { after?: string; before?: string } = {}) {
  const query = cursor.after ? `&after_id=${cursor.after}` : cursor.before ? `&before_id=${cursor.before}` : '';
  return (await chatRequest<MensajeApi[]>(`/matching/matches/${encodeURIComponent(matchId)}/messages?limit=50${query}`)).data;
}

export async function enviarMensaje(matchId: string, text: string, clientId: string) {
  return (await chatRequest<MensajeApi>(`/matching/matches/${encodeURIComponent(matchId)}/messages`, {
    method: 'POST', body: { text, client_message_id: clientId },
  })).data;
}
