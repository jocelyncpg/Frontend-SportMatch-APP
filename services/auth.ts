import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, apiRequest } from './api';

const SESSION_KEY = 'sportmatch_session';
const TOKEN_KEY = 'sportmatch_token';
// Datos que por ahora solo viven en el teléfono (foto, ubicación, deportes del
// perfil), guardados por id de usuario para no perderlos al volver a entrar.
const LOCAL_EXTRAS_KEY = 'sportmatch_local_extras';

export type Usuario = {
  id: string;
  rut: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  fotoPerfil?: string;
  comuna?: string;
  latitud?: number;
  longitud?: number;
  biografia?: string;
  deportes?: string[];
};

type RegisterData = {
  rut: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  password: string;
};

type TokenResponse = {
  access_token: string;
  user: { user_id: string; email: string; nombre: string; apellido_paterno: string; role: string };
};

type ProfileResponse = {
  user_id: string;
  rut: string | null;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  foto_perfil: string | null;
  biografia: string | null;
};

type LocalExtras = Partial<Pick<Usuario, 'fotoPerfil' | 'comuna' | 'latitud' | 'longitud' | 'biografia' | 'deportes'>>;

/** El login falló porque la cuenta aún no confirma su correo. */
export class EmailNotVerifiedError extends Error {
  constructor(public email: string) {
    super('Debes verificar tu correo antes de entrar.');
  }
}

async function getLocalExtras(): Promise<Record<string, LocalExtras>> {
  const raw = await AsyncStorage.getItem(LOCAL_EXTRAS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveLocalExtras(userId: string, datos: LocalExtras): Promise<void> {
  const extras = await getLocalExtras();
  extras[userId] = { ...extras[userId], ...datos };
  await AsyncStorage.setItem(LOCAL_EXTRAS_KEY, JSON.stringify(extras));
}

/** Guarda el token y arma la sesión con el perfil que tiene el backend. */
async function iniciarSesion(tokens: TokenResponse): Promise<Usuario> {
  const perfil = await apiRequest<ProfileResponse>(`/users/${tokens.user.user_id}/profile`, {
    token: tokens.access_token,
  });
  const extras = (await getLocalExtras())[tokens.user.user_id] ?? {};
  const usuario: Usuario = {
    id: tokens.user.user_id,
    rut: perfil.rut ?? '',
    nombre: perfil.nombre,
    apellidoPaterno: perfil.apellido_paterno,
    apellidoMaterno: perfil.apellido_materno ?? undefined,
    email: tokens.user.email,
    fotoPerfil: perfil.foto_perfil ?? undefined,
    biografia: perfil.biografia ?? undefined,
    ...extras,
  };
  await AsyncStorage.multiSet([
    [TOKEN_KEY, tokens.access_token],
    [SESSION_KEY, JSON.stringify(usuario)],
  ]);
  return usuario;
}

/** Crea la cuenta. Queda inactiva hasta confirmar el código que llega al correo. */
export async function register(data: RegisterData): Promise<void> {
  await apiRequest('/users/auth/register', {
    method: 'POST',
    body: {
      email: data.email,
      password: data.password,
      nombre: data.nombre,
      apellido_paterno: data.apellidoPaterno,
      apellido_materno: data.apellidoMaterno || undefined,
      rut: data.rut || undefined,
    },
  });
}

/** Confirma el código del correo; si es correcto, la cuenta queda activa y con sesión iniciada. */
export async function verifyEmail(email: string, code: string): Promise<Usuario> {
  const tokens = await apiRequest<TokenResponse>('/users/auth/email-verification/confirm', {
    method: 'POST',
    body: { email, code },
  });
  return iniciarSesion(tokens);
}

/** Pide un código nuevo (el backend no reenvía si pasaron menos de 60 s). */
export async function resendVerificationCode(email: string): Promise<void> {
  await apiRequest('/users/auth/email-verification/request', { method: 'POST', body: { email } });
}

export async function login(email: string, password: string): Promise<Usuario> {
  try {
    const tokens = await apiRequest<TokenResponse>('/users/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    return await iniciarSesion(tokens);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && e.detail === 'email not verified') {
      throw new EmailNotVerifiedError(email);
    }
    throw e;
  }
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_KEY]);
}

export async function getSession(): Promise<Usuario | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function actualizarLocal(userId: string, datos: LocalExtras): Promise<void> {
  await saveLocalExtras(userId, datos);
  const session = await getSession();
  if (session && session.id === userId) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, ...datos }));
  }
}

// Por ahora solo se guardan en el teléfono (aún no se envían al backend).
export async function updateFotoPerfil(userId: string, fotoUri: string): Promise<void> {
  await actualizarLocal(userId, { fotoPerfil: fotoUri });
}

export async function updateUbicacion(
  userId: string,
  datos: { comuna?: string; latitud?: number; longitud?: number }
): Promise<void> {
  await actualizarLocal(userId, datos);
}

export async function updatePerfilExtra(
  userId: string,
  datos: { biografia?: string; deportes?: string[] }
): Promise<void> {
  await actualizarLocal(userId, datos);
}
