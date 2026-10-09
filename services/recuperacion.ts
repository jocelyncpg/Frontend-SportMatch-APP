import { apiRequest } from './api';

/**
 * Pide el código de recuperación (HU-04). Ms_Users responde igual exista o no la cuenta,
 * así nadie puede averiguar qué correos están registrados.
 */
export async function solicitarCodigoRecuperacion(email: string): Promise<void> {
  await apiRequest('/users/auth/password-reset/request', { method: 'POST', body: { email } });
}

/**
 * Define la nueva contraseña con el código que llegó al correo (HU-04).
 * Quien llama debe validar antes las reglas de la contraseña (validatePassword).
 */
export async function restablecerPassword(email: string, codigo: string, nueva: string): Promise<void> {
  if (!/^\d{6}$/.test(codigo.trim())) throw new Error('El código tiene 6 dígitos.');
  await apiRequest('/users/auth/password-reset/confirm', {
    method: 'POST',
    body: { email, code: codigo.trim(), new_password: nueva },
  });
}
