import { API_BASE_URL } from './config';
import { leerSuspension, type Suspension } from './suspension';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

/** Error del backend con su código HTTP y el `detail` original, para decidir qué hacer. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail: string,
    /** Código estable del backend, p. ej. 'account_suspended'. */
    public code?: string,
    /** Con 'account_suspended': lo que la persona puede ver de su sanción. */
    public suspension?: Suspension,
  ) {
    super(message);
  }
}

export type { Suspension };

export const CUENTA_SUSPENDIDA = 'account_suspended';

// Quien quiera enterarse de que la sesión actual fue suspendida (p. ej. el layout, que cierra la sesión).
const oyentesSuspension = new Set<(e: ApiError) => void>();
export function alSuspenderse(oyente: (e: ApiError) => void): () => void {
  oyentesSuspension.add(oyente);
  return () => { oyentesSuspension.delete(oyente); };
}

// Mensajes del backend (en inglés) traducidos para mostrarlos en la app.
const MENSAJES: Record<string, string> = {
  'email already registered': 'Ya existe una cuenta con ese correo.',
  'rut already registered': 'Ya existe una cuenta con ese RUT.',
  'invalid email or password': 'Correo o contraseña incorrectos.',
  'email not verified': 'Debes verificar tu correo antes de entrar.',
  'invalid or expired verification code': 'El código es incorrecto o venció. Pide uno nuevo.',
  'invalid or expired reset code': 'El código es incorrecto o venció. Pide uno nuevo.',
  'invalid or expired access token': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'authentication required': 'Tu sesión expiró. Vuelve a iniciar sesión.',
};

function leerDetail(data: any): string {
  const detail = data?.detail ?? data?.message;
  if (typeof detail === 'string') return detail;
  // FastAPI devuelve los errores de validación (422) como una lista.
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d?.msg === 'string' ? d.msg.replace(/^Value error, /, '') : ''))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs } = options;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeout = timeoutMs ? setTimeout(() => controller?.abort(), timeoutMs) : undefined;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Revisa tu conexión y que el backend esté encendido.',
      0,
      '',
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!res.ok) {
    let detail = '';
    let data: any = null;
    try {
      data = await res.json();
      detail = leerDetail(data);
    } catch {
      // el backend no devolvió JSON, se usa el mensaje genérico
    }
    const mensaje = MENSAJES[detail] ?? (detail || 'Ocurrió un error al conectar con el servidor.');
    if (res.status === 403 && data?.code === CUENTA_SUSPENDIDA) {
      // El mensaje es el que ya manda el backend (con el motivo y la duración), igual que antes.
      const error = new ApiError(mensaje, res.status, detail, CUENTA_SUSPENDIDA, leerSuspension(data));
      // Con sesión abierta (había token) la app avisa y cierra la sesión; en el login solo se muestra el mensaje.
      if (token) oyentesSuspension.forEach((oyente) => oyente(error));
      throw error;
    }
    throw new ApiError(mensaje, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
