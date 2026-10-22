export type PasswordRule = { id: string; label: string; ok: boolean };

/**
 * Largo permitido de la contraseña.
 * IMPORTANTE: debe coincidir con la validación de Ms_Users (backend); si no, el registro
 * pasa en la app y falla al enviarse. Cambiar solo aquí.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 16;

/** Máximo de representantes que puede tener un club (HU-06). */
export const MAX_REPRESENTANTES = 3;

const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';

/** Deja solo dígitos y K, agrega el guion antes del dígito verificador. Ej: "12.345.678-5" -> "12345678-5" */
export function formatRut(input: string): string {
  const limpio = input.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (limpio.length <= 1) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

export function validateRut(rut: string): string | null {
  if (!rut.trim()) return 'Ingresa tu RUT.';
  if (!/^\d{7,8}-[\dK]$/.test(rut)) return 'Formato inválido. Usa 12345678-9 (sin puntos y con guion).';
  const [cuerpo, dv] = rut.split('-');
  if (calcularDv(cuerpo) !== dv) return 'El RUT no es válido (dígito verificador incorrecto).';
  return null;
}

/**
 * RUT de una organización (club). Usa el mismo dígito verificador que el de una persona.
 * Los RUT de personas jurídicas parten desde 50.000.000, así que uno menor es de persona natural.
 * LÍMITE: acá solo se comprueba que esté bien escrito. Que el club exista y esté vigente
 * en el SII solo se puede verificar desde el backend (pendiente con el equipo).
 */
export function validateRutClub(rut: string): string | null {
  if (!rut.trim()) return 'Ingresa el RUT del club.';
  if (!/^\d{7,8}-[\dK]$/.test(rut)) return 'Formato inválido. Usa 76123456-0 (sin puntos y con guion).';
  const [cuerpo, dv] = rut.split('-');
  if (calcularDv(cuerpo) !== dv) return 'El RUT no es válido (dígito verificador incorrecto).';
  if (Number(cuerpo) < 50000000) return 'Ese RUT es de una persona. Ingresa el RUT del club (organización).';
  return null;
}

export function validateNombre(valor: string, campo: string, obligatorio = true): string | null {
  const v = valor.trim();
  if (!v) return obligatorio ? `Ingresa tu ${campo.toLowerCase()}.` : null;
  if (v.length < 2) return `${campo} demasiado corto.`;
  if (v.length > 40) return `${campo} demasiado largo (máx. 40 caracteres).`;
  const patron = new RegExp(`^[${LETRAS}]+(?:[ '-][${LETRAS}]+)*$`);
  if (!patron.test(v)) return `${campo} solo puede contener letras.`;
  return null;
}

/** Nombre del club: permite letras, números y . & ' - (ej: "Club Deportivo 7 Cumbres"). */
export function validateNombreClub(valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'Ingresa el nombre del club.';
  if (v.length < 3) return 'El nombre del club es demasiado corto.';
  if (v.length > 60) return 'El nombre del club es demasiado largo (máx. 60 caracteres).';
  const patron = new RegExp(`^[${LETRAS}0-9]+(?:[ .&'-]+[${LETRAS}0-9]+)*\\.?$`);
  if (!patron.test(v)) return "El nombre solo puede tener letras, números y . & ' -";
  return null;
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Ingresa tu correo electrónico.';
  if (v.length > 100) return 'El correo es demasiado largo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Ingresa un correo válido (ej: nombre@correo.com).';
  return null;
}

/**
 * Cada representante necesita su propio correo (es su usuario de ingreso).
 * Devuelve el error si este correo ya está en la lista de arriba (comparación sin mayúsculas).
 */
export function validateEmailRepetido(email: string, otros: string[]): string | null {
  const v = email.trim().toLowerCase();
  if (!v) return null;
  const repetido = otros.some((o) => o.trim().toLowerCase() === v);
  return repetido ? 'Este correo ya está en otro representante.' : null;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    {
      id: 'largo',
      label: `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`,
      ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    },
    { id: 'mayus', label: 'Una letra mayúscula', ok: /[A-ZÁÉÍÓÚÑ]/.test(password) },
    { id: 'minus', label: 'Una letra minúscula', ok: /[a-záéíóúñ]/.test(password) },
    { id: 'numero', label: 'Un número', ok: /\d/.test(password) },
    { id: 'especial', label: 'Un carácter especial (! @ # $ % & *)', ok: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(password) },
    { id: 'espacios', label: 'Sin espacios', ok: password.length > 0 && !/\s/.test(password) },
  ];
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Ingresa una contraseña.';
  return passwordRules(password).every((r) => r.ok) ? null : 'La contraseña no cumple todos los requisitos.';
}

export function validatePasswordMatch(password: string, confirmar: string): string | null {
  if (!confirmar) return 'Repite tu contraseña.';
  return password === confirmar ? null : 'Las contraseñas no coinciden.';
}