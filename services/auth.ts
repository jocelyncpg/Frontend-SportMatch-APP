import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'sportmatch_session';
const USERS_KEY = 'sportmatch_mock_users';

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
  /** Texto libre: "Lunes y miércoles en la tarde, sábados en la mañana". */
  disponibilidad?: string;
  objetivos?: string[];
};

type RegisterData = {
  rut: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  password: string;
};

type UsuarioGuardado = Usuario & { password: string; verificado: boolean };

export class EmailNotVerifiedError extends Error {
  constructor(public email: string) {
    super('Debes verificar tu correo antes de entrar.');
  }
}

async function getUsuarios(): Promise<Record<string, UsuarioGuardado>> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : {};
}
async function saveUsuarios(usuarios: Record<string, UsuarioGuardado>): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(usuarios));
}

export async function register(data: RegisterData): Promise<void> {
  const usuarios = await getUsuarios();
  if (usuarios[data.email.toLowerCase()]) {
    throw new Error('Ese correo ya está registrado.');
  }
  usuarios[data.email.toLowerCase()] = {
    id: 'mock-' + Date.now(),
    rut: data.rut,
    nombre: data.nombre,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    email: data.email,
    password: data.password,
    verificado: false,
  };
  await saveUsuarios(usuarios);
}

// En modo simulado, cualquier código de 6 dígitos verifica la cuenta.
export async function verifyEmail(email: string, code: string): Promise<Usuario> {
  if (!/^\d{6}$/.test(code)) throw new Error('Código inválido.');
  const usuarios = await getUsuarios();
  const u = usuarios[email.toLowerCase()];
  if (!u) throw new Error('No encontramos esa cuenta.');
  u.verificado = true;
  await saveUsuarios(usuarios);
  const { password, verificado, ...usuario } = u;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
  return usuario;
}

export async function resendVerificationCode(email: string): Promise<void> {
  // Simulado: no hace falta enviar nada de verdad.
}

export async function login(email: string, password: string): Promise<Usuario> {
  const usuarios = await getUsuarios();
  const u = usuarios[email.toLowerCase()];
  if (!u || u.password !== password) {
    throw new Error('Correo o contraseña incorrectos.');
  }
  if (!u.verificado) {
    throw new EmailNotVerifiedError(email);
  }
  const { password: _p, verificado: _v, ...usuario } = u;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
  return usuario;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSession(): Promise<Usuario | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function getToken(): Promise<string | null> {
  return 'mock-token';
}

async function actualizarSesionYUsuario(userId: string, datos: Partial<Usuario>): Promise<void> {
  const session = await getSession();
  if (session && session.id === userId) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, ...datos }));
  }
  const usuarios = await getUsuarios();
  const entry = Object.values(usuarios).find((u) => u.id === userId);
  if (entry) {
    Object.assign(entry, datos);
    await saveUsuarios(usuarios);
  }
}

export async function updateFotoPerfil(userId: string, fotoUri: string): Promise<void> {
  await actualizarSesionYUsuario(userId, { fotoPerfil: fotoUri });
}

export async function updateUbicacion(
  userId: string,
  datos: { comuna?: string; latitud?: number; longitud?: number }
): Promise<void> {
  await actualizarSesionYUsuario(userId, datos);
}

export async function updatePerfilExtra(
  userId: string,
  datos: {
    biografia?: string;
    deportes?: DeporteConNivel[];
    disponibilidad?: string;
    objetivos?: string[];
  }
): Promise<void> {
  await actualizarSesionYUsuario(userId, datos);
}

// ---------- Recuperar contraseña (simulado) ----------

export async function requestPasswordReset(email: string): Promise<void> {
  // No revela si el correo existe o no, igual que haría el backend real.
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  nuevaPassword: string
): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error('Código inválido.');
  const usuarios = await getUsuarios();
  const u = usuarios[email.toLowerCase()];
  if (!u) throw new Error('No encontramos esa cuenta.');
  u.password = nuevaPassword;
  await saveUsuarios(usuarios);
}