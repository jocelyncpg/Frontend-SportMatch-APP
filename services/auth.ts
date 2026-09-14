import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'sportmatch_session';
const USERS_KEY = 'sportmatch_users';

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

async function getUsers(): Promise<(Usuario & { password: string })[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveUsers(users: (Usuario & { password: string })[]) {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// --- Simulado por ahora: aquí se reemplaza por fetch() real cuando el backend esté listo ---

export async function register(data: RegisterData): Promise<Usuario> {
  const users = await getUsers();

  if (users.some((u) => u.email === data.email)) {
    throw new Error('Ya existe una cuenta con ese correo.');
  }

  const usuario: Usuario & { password: string } = {
    id: Date.now().toString(),
    rut: data.rut,
    nombre: data.nombre,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    email: data.email,
    password: data.password,
  };

  await saveUsers([...users, usuario]);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
  return usuario;
}

export async function login(email: string, password: string): Promise<Usuario> {
  const users = await getUsers();
  const encontrado = users.find((u) => u.email === email && u.password === password);

  if (!encontrado) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(encontrado));
  return encontrado;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSession(): Promise<Usuario | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function updateFotoPerfil(userId: string, fotoUri: string): Promise<void> {
  const users = await getUsers();
  const actualizados = users.map((u) => (u.id === userId ? { ...u, fotoPerfil: fotoUri } : u));
  await saveUsers(actualizados);

  const session = await getSession();
  if (session && session.id === userId) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, fotoPerfil: fotoUri }));
  }
}

export async function updateUbicacion(
  userId: string,
  datos: { comuna?: string; latitud?: number; longitud?: number }
): Promise<void> {
  const users = await getUsers();
  const actualizados = users.map((u) => (u.id === userId ? { ...u, ...datos } : u));
  await saveUsers(actualizados);

  const session = await getSession();
  if (session && session.id === userId) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, ...datos }));
  }
}

export async function updatePerfilExtra(
  userId: string,
  datos: { biografia?: string; deportes?: string[] }
): Promise<void> {
  const users = await getUsers();
  const actualizados = users.map((u) => (u.id === userId ? { ...u, ...datos } : u));
  await saveUsers(actualizados);

  const session = await getSession();
  if (session && session.id === userId) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, ...datos }));
  }
}