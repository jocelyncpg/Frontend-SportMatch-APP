import { API_BASE_URL } from './config';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

/** Error del backend con su código HTTP y el `detail` original, para decidir qué hacer. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail: string,
  ) {
    super(message);
  }
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
  const { method = 'GET', body, token } = options;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Revisa tu conexión y que el backend esté encendido.',
      0,
      '',
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = leerDetail(await res.json());
    } catch {
      // el backend no devolvió JSON, se usa el mensaje genérico
    }
    const mensaje = MENSAJES[detail] ?? (detail || 'Ocurrió un error al conectar con el servidor.');
    throw new ApiError(mensaje, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
