import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, apiRequest } from './api';
import { codigoDeporte, nombreDeporte } from './deportes';

const SESSION_KEY = 'sportmatch_session';
const TOKEN_KEY = 'sportmatch_token';
// La foto de perfil es un archivo del teléfono (file://...) que otros no pueden
// abrir, así que por ahora solo vive aquí, guardada por id de usuario.
const LOCAL_EXTRAS_KEY = 'sportmatch_local_extras';
// Un deporte nuevo comienza en intermedio; el usuario puede elegir su nivel.
const NIVEL_POR_DEFECTO = 3;

export type DeporteConNivel = { nombre: string; nivel: number };

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
  deportes?: DeporteConNivel[];
  nivelesDeportes?: Record<string, number>;
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
  fecha_nacimiento: string | null;
  telefono: string | null;
  foto_perfil: string | null;
  biografia: string | null;
};

type Zona = { comuna: string; latitud: number | null; longitud: number | null };

/** GET/PUT /users/{id}/preferences. El PUT reemplaza todo, así que se envía completo. */
type Preferences = {
  deportes: { deporte_codigo: string; nivel: number }[];
  zona: Zona | null;
  [otros: string]: unknown;
};

type LocalExtras = Partial<Pick<Usuario, 'fotoPerfil'>>;

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

/** Guarda el token y arma la sesión con el perfil y las preferencias del backend. */
async function iniciarSesion(tokens: TokenResponse): Promise<Usuario> {
  const userId = tokens.user.user_id;
  const [perfil, preferencias] = await Promise.all([
    apiRequest<ProfileResponse>(`/users/${userId}/profile`, { token: tokens.access_token }),
    apiRequest<Preferences>(`/users/${userId}/preferences`, { token: tokens.access_token }),
  ]);
  // De lo guardado en el teléfono solo se usa la foto; lo demás manda el backend.
  const fotoLocal = (await getLocalExtras())[userId]?.fotoPerfil;
  const usuario: Usuario = {
    id: userId,
    rut: perfil.rut ?? '',
    nombre: perfil.nombre,
    apellidoPaterno: perfil.apellido_paterno,
    apellidoMaterno: perfil.apellido_materno ?? undefined,
    email: tokens.user.email,
    fotoPerfil: fotoLocal ?? perfil.foto_perfil ?? undefined,
    biografia: perfil.biografia ?? undefined,
    deportes: preferencias.deportes.map((d) => ({ nombre: nombreDeporte(d.deporte_codigo), nivel: d.nivel })),
    nivelesDeportes: Object.fromEntries(preferencias.deportes.map((d) => [d.deporte_codigo, d.nivel])),
    comuna: preferencias.zona?.comuna,
    latitud: preferencias.zona?.latitud ?? undefined,
    longitud: preferencias.zona?.longitud ?? undefined,
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
  if (!raw) return null;
  const saved = JSON.parse(raw) as Omit<Usuario, 'deportes'> & { deportes?: (string | DeporteConNivel)[] };
  // Sessions from before the merge stored sport names and levels separately.
  return { ...saved, deportes: saved.deportes?.map((sport) => typeof sport === 'string'
    ? { nombre: sport, nivel: saved.nivelesDeportes?.[codigoDeporte(sport)] ?? NIVEL_POR_DEFECTO }
    : sport) };
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function actualizarSesion(userId: string, datos: Partial<Usuario>): Promise<void> {
  const session = await getSession();
  if (session && session.id === userId) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, ...datos }));
  }
}

async function tokenActual(): Promise<string> {
  const token = await getToken();
  if (!token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  return token;
}

/** Lee las preferencias, aplica el cambio y las guarda completas (el PUT reemplaza todo). */
async function cambiarPreferencias(
  userId: string,
  token: string,
  cambio: (actuales: Preferences) => Preferences
): Promise<void> {
  const actuales = await apiRequest<Preferences>(`/users/${userId}/preferences`, { token });
  await apiRequest(`/users/${userId}/preferences`, { method: 'PUT', token, body: cambio(actuales) });
}

// Solo en el teléfono: ver LOCAL_EXTRAS_KEY.
export async function updateFotoPerfil(userId: string, fotoUri: string): Promise<void> {
  await saveLocalExtras(userId, { fotoPerfil: fotoUri });
  await actualizarSesion(userId, { fotoPerfil: fotoUri });
}

/** Guarda la comuna (y las coordenadas, si hay) como zona en Ms_Users. */
export async function updateUbicacion(
  userId: string,
  datos: { comuna?: string; latitud?: number; longitud?: number }
): Promise<void> {
  const token = await tokenActual();
  const redondear = (n?: number) => (n === undefined ? null : Math.round(n * 1e5) / 1e5);
  await cambiarPreferencias(userId, token, (actuales) => ({
    ...actuales,
    zona: datos.comuna
      ? { comuna: datos.comuna, latitud: redondear(datos.latitud), longitud: redondear(datos.longitud) }
      : null,
  }));
  await actualizarSesion(userId, { ...datos, latitud: datos.latitud, longitud: datos.longitud });
}

/** Guarda la biografía en el perfil y los deportes en las preferencias de Ms_Users. */
export async function updatePerfilExtra(
  userId: string,
  datos: { biografia?: string; deportes?: (string | DeporteConNivel)[]; nivelesDeportes?: Record<string, number> }
): Promise<void> {
  const token = await tokenActual();

  if (datos.biografia !== undefined) {
    // PUT /profile reemplaza el perfil completo: se reenvía lo que ya tiene.
    const p = await apiRequest<ProfileResponse>(`/users/${userId}/profile`, { token });
    await apiRequest(`/users/${userId}/profile`, {
      method: 'PUT',
      token,
      body: {
        nombre: p.nombre,
        apellido_paterno: p.apellido_paterno,
        apellido_materno: p.apellido_materno,
        fecha_nacimiento: p.fecha_nacimiento,
        telefono: p.telefono,
        foto_perfil: p.foto_perfil,
        biografia: datos.biografia || null,
      },
    });
  }

  const deportes = datos.deportes;
  let deportesGuardados: DeporteConNivel[] | undefined;
  let nivelesGuardados: Record<string, number> | undefined;
  if (deportes !== undefined) {
    await cambiarPreferencias(userId, token, (actuales) => {
      const niveles = new Map(actuales.deportes.map((d) => [d.deporte_codigo, d.nivel]));
      const elegidos = new Map(deportes.map((sport) => [codigoDeporte(typeof sport === 'string' ? sport : sport.nombre), sport]));
      const codigos = [...elegidos.keys()].filter(Boolean);
      nivelesGuardados = Object.fromEntries(codigos.map((c) => {
        const sport = elegidos.get(c)!;
        return [c, typeof sport === 'string' ? datos.nivelesDeportes?.[c] ?? niveles.get(c) ?? NIVEL_POR_DEFECTO : sport.nivel];
      }));
      deportesGuardados = codigos.map((c) => ({ nombre: nombreDeporte(c), nivel: nivelesGuardados![c] }));
      return {
        ...actuales,
        deportes: codigos.map((c) => ({ deporte_codigo: c, nivel: nivelesGuardados![c] })),
      };
    });
  }

  await actualizarSesion(userId, { ...(datos.biografia !== undefined ? { biografia: datos.biografia } : {}),
    ...(deportesGuardados ? { deportes: deportesGuardados, nivelesDeportes: nivelesGuardados } : {}) });
}

/** Refresh saved sports, levels and location without replacing unrelated profile fields. */
export async function refrescarPreferencias(): Promise<Usuario | null> {
  const session = await getSession();
  if (!session) return null;
  const token = await tokenActual();
  const preferences = await apiRequest<Preferences>(`/users/${session.id}/preferences`, { token });
  if ((await getSession())?.id !== session.id || await getToken() !== token) return null;
  await actualizarSesion(session.id, {
    deportes: preferences.deportes.map((d) => ({ nombre: nombreDeporte(d.deporte_codigo), nivel: d.nivel })),
    nivelesDeportes: Object.fromEntries(preferences.deportes.map((d) => [d.deporte_codigo, d.nivel])),
    comuna: preferences.zona?.comuna,
    latitud: preferences.zona?.latitud ?? undefined,
    longitud: preferences.zona?.longitud ?? undefined,
  });
  return getSession();
}
