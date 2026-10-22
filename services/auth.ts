import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_REPRESENTANTES, validatePassword } from './validators';

const SESSION_KEY = 'sportmatch_session';
const USERS_KEY = 'sportmatch_mock_users';
const CLUBS_KEY = 'sportmatch_mock_clubs';

export type DeporteConNivel = { nombre: string; nivel: number };

/** Tipo de cuenta. Una misma pantalla de ingreso sirve para los dos; el rol decide la vista. */
export type Rol = 'deportista' | 'club';

export type Usuario = {
  id: string;
  /** Deportista: su RUT. Representante de club: el RUT del club. */
  rut: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  /** Si falta (cuentas creadas antes de existir el rol), se trata como deportista. Usa rolDe(). */
  rol?: Rol;
  /** Solo representantes de club. */
  clubId?: string;
  clubNombre?: string;
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

/** Club registrado (simulado). Con el backend viene de Ms_Users / perfil de club (HU-30). */
export type Club = {
  id: string;
  nombre: string;
  rut: string;
  /** Correos de los representantes que administran el club (HU-06). */
  representantes: string[];
};

type RegisterData = {
  rut: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  password: string;
};

export type RepresentanteData = {
  nombre: string;
  apellidoPaterno: string;
  email: string;
  password: string;
};

export type RegisterClubData = {
  clubNombre: string;
  clubRut: string;
  /** Entre 1 y MAX_REPRESENTANTES. El primero es el representante principal. */
  representantes: RepresentanteData[];
};

type UsuarioGuardado = Usuario & { password: string; verificado: boolean };

export class EmailNotVerifiedError extends Error {
  constructor(public email: string) {
    super('Debes verificar tu correo antes de entrar.');
  }
}

/** Rol de una cuenta; las anteriores al rol cuentan como deportista. */
export function rolDe(usuario: Pick<Usuario, 'rol'>): Rol {
  return usuario.rol === 'club' ? 'club' : 'deportista';
}

/** Pantalla de inicio según el rol. Login, huella, verificación de correo e index usan esto. */
export function rutaInicial(usuario: Pick<Usuario, 'rol'>): string {
  return rolDe(usuario) === 'club' ? '/(club)/home' : '/(deportista)/(tabs)';
}

async function getUsuarios(): Promise<Record<string, UsuarioGuardado>> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : {};
}
async function saveUsuarios(usuarios: Record<string, UsuarioGuardado>): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(usuarios));
}

async function getClubes(): Promise<Record<string, Club>> {
  const raw = await AsyncStorage.getItem(CLUBS_KEY);
  return raw ? JSON.parse(raw) : {};
}
async function saveClubes(clubes: Record<string, Club>): Promise<void> {
  await AsyncStorage.setItem(CLUBS_KEY, JSON.stringify(clubes));
}

export async function register(data: RegisterData): Promise<void> {
  const usuarios = await getUsuarios();
  if (usuarios[data.email.toLowerCase()]) {
    throw new Error('Ese correo ya está registrado.');
  }
  usuarios[data.email.toLowerCase()] = {
    id: 'mock-' + Date.now(),
    rol: 'deportista',
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

/**
 * Registra un club con sus representantes (HU-06). Cada representante tiene su propia cuenta
 * (correo y contraseña) con rol "club", ligada al mismo club. Todas quedan sin verificar:
 * cada uno confirma su correo con su código, el principal justo después de registrarse y los
 * demás la primera vez que inician sesión.
 * Con el backend, el RUT del club además se revisa contra el SII y el club queda pendiente de
 * aprobación del administrador (HU-45); acá solo se evita repetir RUT y correos.
 */
export async function registerClub(data: RegisterClubData): Promise<void> {
  const reps = data.representantes;
  if (reps.length < 1 || reps.length > MAX_REPRESENTANTES) {
    throw new Error(`Un club puede tener entre 1 y ${MAX_REPRESENTANTES} representantes.`);
  }

  const correos = reps.map((r) => r.email.trim().toLowerCase());
  if (new Set(correos).size !== correos.length) {
    throw new Error('Cada representante debe tener un correo distinto.');
  }

  const clubes = await getClubes();
  if (Object.values(clubes).some((c) => c.rut === data.clubRut)) {
    throw new Error('Ese RUT de club ya está registrado.');
  }

  const usuarios = await getUsuarios();
  for (const correo of correos) {
    if (usuarios[correo]) throw new Error(`El correo ${correo} ya está registrado.`);
  }

  const ahora = Date.now();
  const clubId = `club-${ahora}`;
  const clubNombre = data.clubNombre.trim();

  reps.forEach((r, i) => {
    usuarios[correos[i]] = {
      id: `mock-${ahora}-${i}`,
      rol: 'club',
      clubId,
      clubNombre,
      rut: data.clubRut,
      nombre: r.nombre.trim(),
      apellidoPaterno: r.apellidoPaterno.trim(),
      email: r.email.trim(),
      password: r.password,
      verificado: false,
    };
  });
  clubes[clubId] = { id: clubId, nombre: clubNombre, rut: data.clubRut, representantes: correos };

  await saveUsuarios(usuarios);
  await saveClubes(clubes);
}

/** Datos del club al que pertenece un representante (null si la cuenta no es de club). */
export async function getClub(clubId: string): Promise<Club | null> {
  const clubes = await getClubes();
  return clubes[clubId] ?? null;
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

/**
 * Entrada con huella: se llama SOLO después de que el sistema verificó la huella
 * (services/biometria.ts). No recibe contraseña.
 * Con el backend real, aquí se renovaría la sesión con un refresh token guardado en
 * expo-secure-store, nunca con la contraseña.
 */
export async function loginConHuella(email: string): Promise<Usuario> {
  const usuarios = await getUsuarios();
  const u = usuarios[email.toLowerCase()];
  if (!u || !u.verificado) {
    throw new Error('No encontramos esa cuenta. Inicia sesión con tu contraseña.');
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

// ---------- Contraseña ----------

/**
 * Cambio de contraseña con la sesión iniciada: pide la actual y la nueva.
 * Cada representante cambia solo la suya (cada uno tiene su propia cuenta).
 */
export async function cambiarPassword(
  email: string,
  actual: string,
  nueva: string
): Promise<void> {
  const usuarios = await getUsuarios();
  const u = usuarios[email.toLowerCase()];
  if (!u) throw new Error('No encontramos esa cuenta.');
  if (u.password !== actual) throw new Error('La contraseña actual no es correcta.');
  const problema = validatePassword(nueva);
  if (problema) throw new Error(problema);
  if (nueva === actual) throw new Error('La nueva contraseña debe ser distinta a la actual.');
  u.password = nueva;
  await saveUsuarios(usuarios);
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