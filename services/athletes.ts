import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';
import { aPersona, getEstado, SugerenciaApi } from './matchStore';

/** Resolve public profiles by ID; never trust profile data from route parameters. */
export async function getAthleteProfile(id: string) {
  const [session, token] = await Promise.all([getSession(), getToken()]);
  if (!session || !token) throw new ApiError('Inicia sesión para ver el perfil.', 401, '');
  const card = await apiRequest<SugerenciaApi>(`/users/athletes/${encodeURIComponent(id)}`, { token });
  if ((await getSession())?.id !== session.id || await getToken() !== token) throw new ApiError('La sesión cambió.', 401, '');
  const state = getEstado();
  const known = state.usuarioId === session.id ? state.catalogo.find((person) => person.id === id) : undefined;
  return { ...aPersona(card), distance: known?.distance, distanceKm: known?.distanceKm };
}
