export type PasswordRule = { id: string; label: string; ok: boolean };

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

export function validateNombre(valor: string, campo: string, obligatorio = true): string | null {
  const v = valor.trim();
  if (!v) return obligatorio ? `Ingresa tu ${campo.toLowerCase()}.` : null;
  if (v.length < 2) return `${campo} demasiado corto.`;
  if (v.length > 40) return `${campo} demasiado largo (máx. 40 caracteres).`;
  const patron = new RegExp(`^[${LETRAS}]+(?:[ '-][${LETRAS}]+)*$`);
  if (!patron.test(v)) return `${campo} solo puede contener letras.`;
  return null;
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Ingresa tu correo electrónico.';
  if (v.length > 100) return 'El correo es demasiado largo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Ingresa un correo válido (ej: nombre@correo.com).';
  return null;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    // Mismo mínimo que exige Ms_Users al registrar.
    { id: 'largo', label: 'Entre 12 y 64 caracteres', ok: password.length >= 12 && password.length <= 64 },
    { id: 'mayus', label: 'Una letra mayúscula', ok: /[A-ZÁÉÍÓÚÑ]/.test(password) },
    { id: 'minus', label: 'Una letra minúscula', ok: /[a-záéíóúñ]/.test(password) },
    { id: 'numero', label: 'Un número', ok: /\d/.test(password) },
    { id: 'especial', label: 'Un carácter especial (! @ # $ % & * ...)', ok: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(password) },
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