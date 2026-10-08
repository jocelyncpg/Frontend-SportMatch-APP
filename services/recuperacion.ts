import AsyncStorage from '@react-native-async-storage/async-storage';

// Misma clave que usa services/auth.ts (versión simulada) para guardar las cuentas.
const USERS_KEY = 'sportmatch_mock_users';

type CuentaGuardada = { password: string; [campo: string]: unknown };

async function leerCuentas(): Promise<Record<string, CuentaGuardada>> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : {};
}

/**
 * Pide el código de recuperación (HU-04). Por seguridad responde igual exista o no la cuenta,
 * así nadie puede averiguar qué correos están registrados.
 * SIMULADO: no envía nada. En la app real, aquí el backend manda el link/código al correo.
 */
export async function solicitarCodigoRecuperacion(email: string): Promise<void> {
  void email;
}

/**
 * Define la nueva contraseña con el código recibido (HU-04).
 * SIMULADO: cualquier código de 6 dígitos sirve, igual que al verificar el correo.
 * Quien llama debe validar antes las reglas de la contraseña (validatePassword).
 */
export async function restablecerPassword(email: string, codigo: string, nueva: string): Promise<void> {
  const generico = 'No pudimos restablecer tu contraseña. Revisa el código o pide uno nuevo.';
  if (!/^\d{6}$/.test(codigo.trim())) throw new Error('El código tiene 6 dígitos.');
  const cuentas = await leerCuentas();
  const cuenta = cuentas[email.trim().toLowerCase()];
  if (!cuenta) throw new Error(generico);
  cuenta.password = nueva;
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(cuentas));
}