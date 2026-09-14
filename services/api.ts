import { API_BASE_URL } from './config';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let mensaje = 'Ocurrió un error al conectar con el servidor.';
    try {
      const errorData = await res.json();
      mensaje = errorData.message || errorData.detail || mensaje;
    } catch {
      // el backend no devolvió JSON, se usa el mensaje genérico
    }
    throw new Error(mensaje);
  }

  return res.json();
}