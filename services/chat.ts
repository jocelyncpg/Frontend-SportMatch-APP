import { useSyncExternalStore } from 'react';

/** Punto geolocalizado que se comparte en un chat (HU-58). */
export type UbicacionChat = {
  latitud: number;
  longitud: number;
  comuna?: string;
};

export type MensajeChat = {
  id: string;
  /** Texto del mensaje. En ubicaciones e imágenes es una descripción corta ("📷 Foto") que usan la lista de chats y los avisos. */
  texto: string;
  /** true = lo escribiste tú. */
  propio: boolean;
  /** Momento en que se envió (milisegundos, como Date.now()). */
  enviadoEn: number;
  /** Ubicación compartida (HU-58). */
  ubicacion?: UbicacionChat;
  /** Imagen adjunta (HU-58). Hoy es una ruta local del teléfono; con el backend será un enlace. */
  imagenUri?: string;
};

export type Conversacion = {
  personaId: string;
  mensajes: MensajeChat[];
  /** Mensajes de la otra persona que aún no has visto. */
  noLeidos: number;
  /** Silenciado (HU-59): los mensajes llegan, pero sin aviso ni contador. */
  silenciado: boolean;
  /** Bloqueado (HU-59): no puedes enviar ni recibir mensajes de esta persona. */
  bloqueado: boolean;
};

/** Aviso que se muestra dentro de la app cuando llega un mensaje y no estás en ese chat (HU-60). */
export type AvisoEntrante = {
  id: string;
  personaId: string;
  texto: string;
};

type Estado = {
  conversaciones: Record<string, Conversacion>;
  /** Chat que tienes abierto ahora (null = ninguno). */
  chatAbierto: string | null;
  aviso: AvisoEntrante | null;
  /** Cuántas respuestas simuladas ha dado cada persona (para variar el texto). */
  respuestasSimuladas: Record<string, number>;
};

// DATOS DE EJEMPLO: conversaciones que ya existían en la demo (Camila y Diego).
// Se reemplaza por la API de chat. Las horas se calculan para que "hoy" y "ayer" siempre cuadren.
function enDia(diasAtras: number, hora: number, minuto: number): number {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, minuto, 0, 0);
  return d.getTime();
}

function estadoInicial(): Estado {
  return {
    conversaciones: {
      camila: {
        personaId: 'camila',
        noLeidos: 0,
        silenciado: false,
        bloqueado: false,
        mensajes: [
          { id: 'c1', texto: '¡Hola! Vi que también corres los fines de semana 🏃‍♀️', propio: false, enviadoEn: enDia(0, 18, 30) },
          { id: 'c2', texto: '¡Sí! Estoy entrenando para una media maratón. ¿Salimos mañana?', propio: true, enviadoEn: enDia(0, 18, 36) },
          { id: 'c3', texto: '¡Dale, nos vemos a las 19:30!', propio: false, enviadoEn: enDia(0, 18, 42) },
        ],
      },
      diego: {
        personaId: 'diego',
        noLeidos: 0,
        silenciado: false,
        bloqueado: false,
        mensajes: [
          { id: 'd1', texto: '¡Buenas! ¿Juegas fútbol los fines de semana?', propio: false, enviadoEn: enDia(1, 20, 0) },
          { id: 'd2', texto: 'Sí, los sábados en la mañana. ¿Te sumas?', propio: true, enviadoEn: enDia(1, 20, 5) },
          { id: 'd3', texto: 'Perfecto, cualquier cosa avísame', propio: false, enviadoEn: enDia(1, 20, 10) },
        ],
      },
    },
    chatAbierto: null,
    aviso: null,
    respuestasSimuladas: {},
  };
}

let estado: Estado = estadoInicial();
let contador = 0;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
};
const nuevoId = () => `m${Date.now()}-${++contador}`;

// Conversaciones vacías: se reutiliza el mismo objeto para que React no vea un cambio donde no lo hay.
const vacias: Record<string, Conversacion> = {};

/** Conversación con una persona (vacía si aún no se han escrito). */
export function getConversacion(id: string): Conversacion {
  const c = estado.conversaciones[id];
  if (c) return c;
  return (vacias[id] ??= { personaId: id, mensajes: [], noLeidos: 0, silenciado: false, bloqueado: false });
}

const conversacionDe = getConversacion;

function guardar(c: Conversacion) {
  estado = { ...estado, conversaciones: { ...estado.conversaciones, [c.personaId]: c } };
}

// ---------- lectura ----------

export function useConversacion(id: string): Conversacion {
  return useSyncExternalStore(suscribir, () => getConversacion(id), () => getConversacion(id));
}

export function useConversaciones(): Record<string, Conversacion> {
  return useSyncExternalStore(suscribir, () => estado.conversaciones, () => estado.conversaciones);
}

/** Total de mensajes sin leer en todos los chats (para el globo de la pestaña). */
export function totalNoLeidos(conversaciones: Record<string, Conversacion>): number {
  return Object.values(conversaciones).reduce((suma, c) => suma + c.noLeidos, 0);
}

export function useNoLeidosTotal(): number {
  return useSyncExternalStore(
    suscribir,
    () => totalNoLeidos(estado.conversaciones),
    () => totalNoLeidos(estado.conversaciones),
  );
}

export function useAvisoEntrante(): AvisoEntrante | null {
  return useSyncExternalStore(suscribir, () => estado.aviso, () => estado.aviso);
}

export function ultimoMensaje(c: Conversacion): MensajeChat | null {
  return c.mensajes.length > 0 ? c.mensajes[c.mensajes.length - 1] : null;
}

/** "18:42" si es de hoy, "Ayer" si es de ayer, "05/10" si es más antiguo. */
export function horaCorta(enviadoEn: number, ahora: number = Date.now()): string {
  const d = new Date(enviadoEn);
  const hoy = new Date(ahora);
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  const DIA = 24 * 60 * 60 * 1000;
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  if (enviadoEn >= inicioHoy) return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
  if (enviadoEn >= inicioHoy - DIA) return 'Ayer';
  return `${dosDigitos(d.getDate())}/${dosDigitos(d.getMonth() + 1)}`;
}

// ---------- acciones ----------

function enviarPropio(id: string, contenido: Pick<MensajeChat, 'texto' | 'ubicacion' | 'imagenUri'>): boolean {
  const c = conversacionDe(id);
  if (c.bloqueado) return false;
  guardar({ ...c, mensajes: [...c.mensajes, { id: nuevoId(), propio: true, enviadoEn: Date.now(), ...contenido }] });
  emitir();
  return true;
}

/** Envía un mensaje tuyo. Devuelve false si el texto está vacío o si la persona está bloqueada. */
export function enviarMensaje(id: string, texto: string): boolean {
  const t = texto.trim();
  if (!t) return false;
  return enviarPropio(id, { texto: t });
}

/** Comparte un punto geolocalizado (HU-58). Devuelve false si las coordenadas no son válidas o si la persona está bloqueada. */
export function enviarUbicacion(id: string, ubicacion: UbicacionChat): boolean {
  const { latitud, longitud } = ubicacion;
  const valida = Number.isFinite(latitud) && Number.isFinite(longitud) && Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180;
  if (!valida) return false;
  const texto = ubicacion.comuna ? `📍 Ubicación: ${ubicacion.comuna}` : '📍 Ubicación compartida';
  return enviarPropio(id, { texto, ubicacion });
}

/** Adjunta una imagen, por ejemplo del recinto o la cancha (HU-58). Devuelve false si no hay imagen o si la persona está bloqueada. */
export function enviarImagen(id: string, uri: string): boolean {
  if (!uri) return false;
  return enviarPropio(id, { texto: '📷 Foto', imagenUri: uri });
}

/**
 * Registra un mensaje de la otra persona (HU-60).
 * Si la persona está bloqueada, el mensaje se descarta (HU-59).
 * Si ese chat está abierto, queda leído; si está silenciado, llega sin aviso ni contador (HU-59);
 * si no, suma un no leído y deja un aviso para mostrar dentro de la app.
 * Hoy lo llama simularRespuesta; con el backend lo llamará la llegada real del mensaje.
 */
export function recibirMensaje(id: string, texto: string): MensajeChat | null {
  const t = texto.trim();
  if (!t) return null;
  const mensaje: MensajeChat = { id: nuevoId(), texto: t, propio: false, enviadoEn: Date.now() };
  const c = conversacionDe(id);
  if (c.bloqueado) return null;
  const abierto = estado.chatAbierto === id;
  const conAlertas = !abierto && !c.silenciado;
  guardar({ ...c, mensajes: [...c.mensajes, mensaje], noLeidos: abierto ? 0 : conAlertas ? c.noLeidos + 1 : c.noLeidos });
  if (conAlertas) estado = { ...estado, aviso: { id: mensaje.id, personaId: id, texto: t } };
  emitir();
  return mensaje;
}

/** Entras a un chat: queda marcado como abierto y sus mensajes, como leídos. */
export function abrirChat(id: string) {
  const c = conversacionDe(id);
  estado = {
    ...estado,
    chatAbierto: id,
    aviso: estado.aviso?.personaId === id ? null : estado.aviso,
    conversaciones: c.noLeidos > 0 ? { ...estado.conversaciones, [id]: { ...c, noLeidos: 0 } } : estado.conversaciones,
  };
  emitir();
}

/** Sales del chat. Solo cierra si sigue siendo ese chat (evita pisar uno recién abierto). */
export function cerrarChat(id: string) {
  if (estado.chatAbierto !== id) return;
  estado = { ...estado, chatAbierto: null };
  emitir();
}

/** Silencia o reactiva los avisos y contadores de un chat (HU-59). */
export function silenciarChat(id: string, silenciado: boolean) {
  const c = conversacionDe(id);
  if (c.silenciado === silenciado) return;
  guardar({ ...c, silenciado });
  emitir();
}

/** Bloquea a una persona (HU-59): no se envían ni reciben mensajes, y se limpian sus avisos pendientes. */
export function bloquearUsuario(id: string) {
  const c = conversacionDe(id);
  if (c.bloqueado) return;
  guardar({ ...c, bloqueado: true, noLeidos: 0 });
  if (estado.aviso?.personaId === id) estado = { ...estado, aviso: null };
  emitir();
}

export function desbloquearUsuario(id: string) {
  const c = conversacionDe(id);
  if (!c.bloqueado) return;
  guardar({ ...c, bloqueado: false });
  emitir();
}

export function descartarAviso() {
  if (estado.aviso === null) return;
  estado = { ...estado, aviso: null };
  emitir();
}

const RESPUESTAS_DEMO = [
  '¡Genial! ¿A qué hora te acomoda?',
  'Perfecto, yo llevo agua 💧',
  '¿Nos juntamos en el parque?',
  'Dale, quedamos así 👍',
];

/**
 * SOLO DEMO: hace que la otra persona te escriba, para probar los avisos sin backend.
 * Con el backend, los mensajes llegan solos y esto se quita.
 */
export function simularRespuesta(id: string): MensajeChat | null {
  const n = estado.respuestasSimuladas[id] ?? 0;
  const texto = RESPUESTAS_DEMO[n % RESPUESTAS_DEMO.length];
  estado = { ...estado, respuestasSimuladas: { ...estado.respuestasSimuladas, [id]: n + 1 } };
  return recibirMensaje(id, texto);
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarChat() {
  estado = estadoInicial();
  contador = 0;
  emitir();
}

/** Marca como leídos los mensajes de todos tus chats (lo usa "Marcar todas" en Notificaciones). */
export function marcarTodasLeidasEnChats() {
  const hayPendientes = Object.values(estado.conversaciones).some((c) => c.noLeidos > 0);
  if (!hayPendientes) return;
  const conversaciones: Record<string, Conversacion> = {};
  for (const [id, c] of Object.entries(estado.conversaciones)) conversaciones[id] = c.noLeidos > 0 ? { ...c, noLeidos: 0 } : c;
  estado = { ...estado, conversaciones, aviso: null };
  emitir();
}