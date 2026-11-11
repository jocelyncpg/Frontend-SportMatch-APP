import { API_BASE_URL } from './config';
import { leerSuspension, type Suspension } from './suspension';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
  responseType?: 'json' | 'text';
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
    /** Con 'LIMITE_PLAN' (HTTP 402, HU-54): qué límite del plan gratuito se alcanzó. */
    public limitePlan?: LimitePlan,
  ) {
    super(message);
  }
}

export type { Suspension };

/**
 * La foto de perfil llega del servidor como una ruta del gateway ("/api/v1/users/photos/<clave>.jpg"), igual para la
 * app y la web. Aquí se completa con la dirección del gateway; sin foto (o con un valor que no es una ruta nuestra)
 * devuelve undefined y cada pantalla muestra su avatar de siempre.
 */
export function urlFoto(valor?: string | null): string | undefined {
  if (!valor || !valor.startsWith('/api/')) return undefined;
  return `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}${valor}`;
}

export const CUENTA_SUSPENDIDA = 'account_suspended';

// ---------- HU-54: límites del plan gratuito (HTTP 402 {codigo: "LIMITE_PLAN", ...}) ----------

export const LIMITE_PLAN = 'LIMITE_PLAN';

/** Lo que responde un servicio al llegar al límite del plan gratuito. */
export type LimitePlan = {
  recurso: string;
  limite: number;
  usado: number;
  /** Cuándo se libera un cupo (ventana móvil); null si se libera al cerrar algo (p. ej. una convocatoria). */
  se_libera_en: string | null;
};

const RECURSOS_LIMITE: Record<string, { texto: string; cuenta: 'deportista' | 'club' }> = {
  solicitudes_match: { texto: 'solicitudes de match hoy', cuenta: 'deportista' },
  postulaciones_actividades: { texto: 'postulaciones a actividades hoy', cuenta: 'deportista' },
  postulaciones_convocatorias: { texto: 'postulaciones a convocatorias hoy', cuenta: 'deportista' },
  actividades_organizadas: { texto: 'actividades para organizar este mes', cuenta: 'deportista' },
  convocatorias_abiertas: { texto: 'convocatorias abiertas a la vez', cuenta: 'club' },
  comunicados: { texto: 'comunicados hoy', cuenta: 'club' },
  canales: { texto: 'canales', cuenta: 'club' },
};

/** "solicitudes de match hoy", "comunicados hoy"…; "usos" si el recurso no se conoce. */
export function textoRecursoLimite(recurso: string): string {
  return RECURSOS_LIMITE[recurso]?.texto ?? 'usos';
}

/** Qué cuenta debe contratar un plan para ese recurso (para abrir el catálogo correcto). */
export function cuentaDelLimite(limite: LimitePlan): 'deportista' | 'club' {
  return RECURSOS_LIMITE[limite.recurso]?.cuenta ?? 'deportista';
}

/** "Te quedan 0 de 6 solicitudes de match hoy · Pásate a Pro". */
export function mensajeLimitePlan(limite: LimitePlan): string {
  const que = RECURSOS_LIMITE[limite.recurso]?.texto ?? 'usos';
  const plan = cuentaDelLimite(limite) === 'club' ? 'Contrata el plan Club' : 'Pásate a Pro';
  return `Te quedan 0 de ${limite.limite} ${que} · ${plan}`;
}

function leerLimitePlan(data: any): LimitePlan | null {
  if (data?.codigo !== LIMITE_PLAN || typeof data.limite !== 'number') return null;
  return {
    recurso: typeof data.recurso === 'string' ? data.recurso : '',
    limite: data.limite,
    usado: typeof data.usado === 'number' ? data.usado : data.limite,
    se_libera_en: typeof data.se_libera_en === 'string' ? data.se_libera_en : null,
  };
}

// Quien quiera ofrecer el catálogo de planes al llegar a un límite (el layout raíz muestra el aviso con el botón).
const oyentesLimite = new Set<(e: ApiError) => void>();
export function alLlegarAlLimite(oyente: (e: ApiError) => void): () => void {
  oyentesLimite.add(oyente);
  return () => { oyentesLimite.delete(oyente); };
}

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

  // Un FormData (subir la foto) lo arma fetch con su propio Content-Type y límite; el resto va como JSON.
  const esFormulario = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(esFormulario ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? (esFormulario ? (body as FormData) : JSON.stringify(body)) : undefined,
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
    const limite = res.status === 402 ? leerLimitePlan(data) : null;
    if (limite) {
      const error = new ApiError(mensajeLimitePlan(limite), 402, detail, LIMITE_PLAN, undefined, limite);
      oyentesLimite.forEach((oyente) => oyente(error));
      throw error;
    }
    throw new ApiError(mensaje, res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  if (options.responseType === 'text') return await res.text() as T;
  return res.json();
}
