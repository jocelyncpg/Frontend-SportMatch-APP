import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const CLAVE_EMAIL = 'sportmatch_bio_email';
const CLAVE_PASSWORD = 'sportmatch_bio_password';
const CLAVE_RECHAZADO = 'sportmatch_bio_rechazado';

/**
 * Ms_Users no entrega refresh token (el access token dura 30 min), así que la huella no puede
 * "reanudar" una sesión: lo que hace es desbloquear las credenciales guardadas en el llavero
 * del sistema (Keychain / Keystore, cifrado y solo en este dispositivo) para un login normal.
 * Cuando exista un refresh token, guardar ese token aquí en vez de la contraseña.
 */
const OPCIONES_LLAVERO: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** True si el celular tiene sensor y al menos una huella/cara configurada. */
export async function biometriaDisponible(): Promise<boolean> {
  try {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    if (!hardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/** "huella" o "reconocimiento facial", según lo que tenga el celular. */
export async function nombreBiometria(): Promise<string> {
  try {
    const tipos = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const tieneHuella = tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const tieneCara = tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    if (tieneCara && !tieneHuella) return 'reconocimiento facial';
    return 'huella';
  } catch {
    return 'huella';
  }
}

/** Pide al sistema que verifique la huella o la cara. El celular guarda los datos biométricos; la app nunca los ve. */
export async function autenticar(motivo = 'Confirma tu identidad para entrar'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: 'Cancelar',
    });
    return r.success;
  } catch {
    return false;
  }
}

/** Correo que tiene activado el acceso con huella en este celular (o null). */
export async function emailActivado(): Promise<string | null> {
  try {
    // Sin contraseña guardada (activación de la versión simulada) la huella no sirve: se ofrece de nuevo.
    return (await credencialesGuardadas())?.email ?? null;
  } catch {
    return null;
  }
}

/** Credenciales para entrar con huella; solo se leen después de autenticar(). */
export async function credencialesGuardadas(): Promise<{ email: string; password: string } | null> {
  try {
    const [email, password] = await Promise.all([
      SecureStore.getItemAsync(CLAVE_EMAIL, OPCIONES_LLAVERO),
      SecureStore.getItemAsync(CLAVE_PASSWORD, OPCIONES_LLAVERO),
    ]);
    return email && password ? { email, password } : null;
  } catch {
    return null;
  }
}

export async function activarBiometria(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_EMAIL, email.trim().toLowerCase(), OPCIONES_LLAVERO);
  await SecureStore.setItemAsync(CLAVE_PASSWORD, password, OPCIONES_LLAVERO);
  await SecureStore.deleteItemAsync(CLAVE_RECHAZADO);
}

export async function desactivarBiometria(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_EMAIL, OPCIONES_LLAVERO);
  await SecureStore.deleteItemAsync(CLAVE_PASSWORD, OPCIONES_LLAVERO);
}

/** Para no volver a preguntar en cada login si la persona dijo "Ahora no". */
export async function yaRechazo(email: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(CLAVE_RECHAZADO)) === email.trim().toLowerCase();
  } catch {
    return false;
  }
}

export async function marcarRechazo(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLAVE_RECHAZADO, email.trim().toLowerCase());
  } catch {
    // sin almacenamiento seguro (ej. web): simplemente se vuelve a preguntar la próxima vez
  }
}