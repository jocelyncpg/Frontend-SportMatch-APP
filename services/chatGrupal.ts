import { useMemo, useSyncExternalStore } from 'react';
import {
    Actividad,
    EstadoActividad,
    YO,
    estadoActividad,
    getActividades,
    nombreDePersona,
    suscribirActividades,
    useActividades,
} from './actividades';

// Chat grupal de actividad (HU-50): cada actividad tiene su sala. Quien organiza y quienes tienen la
// postulación aprobada entran solos; si te retiras, no te aprueban o se cancela, pierdes el acceso.

export const MAX_MENSAJE_GRUPAL = 500;

export type MensajeGrupal = {
  id: string;
  autorId: string;
  autorNombre: string;
  texto: string;
  propio: boolean;
  enviadoEn: number;
  /** Aviso del sistema ("Diego se unió al grupo"). No cuenta como mensaje sin leer. */
  sistema?: boolean;
};
export type SalaGrupal = { actividadId: string; mensajes: MensajeGrupal[]; noLeidos: number; silenciado: boolean };
/** escribir: participas y la actividad sigue vigente · leer: la actividad ya finalizó · ninguno: no participas o se canceló. */
export type AccesoGrupal = 'escribir' | 'leer' | 'ninguno';
export type ResultadoGrupal = { ok: true } | { ok: false; motivo: string };
export type ChatGrupal = { actividad: Actividad; sala: SalaGrupal; acceso: AccesoGrupal; participantes: number };

// ---------- reglas de acceso ----------
/** Quién está en el grupo: quien organiza y las postulaciones aprobadas. */
export function miembrosDe(a: Actividad): string[] {
  const aprobados = Object.entries(a.postulaciones).filter(([, e]) => e === 'aprobada').map(([id]) => id);
  return [a.organizadorId, ...aprobados.filter((id) => id !== a.organizadorId)];
}

export function nombreMiembro(a: Actividad, id: string): string {
  if (id === YO) return 'Tú';
  if (id === a.organizadorId) return a.organizadorNombre;
  const demo = /^p(\d+)$/.exec(id);
  return demo ? `Deportista ${demo[1]}` : nombreDePersona(id);
}

export function accesoGrupal(a: Actividad, ahora: number = Date.now()): AccesoGrupal {
  const estado: EstadoActividad = estadoActividad(a, ahora);
  if (estado === 'cancelada') return 'ninguno';
  if (!miembrosDe(a).includes(YO)) return 'ninguno';
  return estado === 'vencida' ? 'leer' : 'escribir';
}

// ---------- almacén en memoria ----------
let salas: Record<string, SalaGrupal> = {};
const abiertas = new Set<string>();
let previo: Record<string, { miembros: string[]; cancelada: boolean }> = {};
let contador = 1;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
export const getSalas = () => salas;

const idMensaje = () => `mg-${contador++}`;
const aviso = (texto: string, enviadoEn: number): MensajeGrupal => ({ id: idMensaje(), autorId: 'sistema', autorNombre: 'Sistema', texto, propio: false, enviadoEn, sistema: true });

function salaNueva(a: Actividad, ahora: number): SalaGrupal {
  const mensajes: MensajeGrupal[] = [aviso(`Se creó el grupo de "${a.titulo}"`, ahora - 3 * 60 * 60 * 1000)];
  if (a.organizadorId !== YO) {
    mensajes.push({
      id: idMensaje(), autorId: a.organizadorId, autorNombre: a.organizadorNombre, propio: false, enviadoEn: ahora - 2 * 60 * 60 * 1000,
      texto: `¡Hola a todos! Aquí coordinamos lo de "${a.titulo}". Cualquier duda, avisen.`,
    });
  }
  return { actividadId: a.id, mensajes, noLeidos: 0, silenciado: false };
}

/** Crea las salas que faltan y refleja quién entra o sale (HU-50). Se ejecuta con cada cambio de actividades. */
function sincronizar(ahora: number = Date.now()) {
  let cambio = false;
  const sig = { ...salas };
  const nuevoPrevio: typeof previo = {};
  for (const a of getActividades()) {
    const miembros = miembrosDe(a);
    nuevoPrevio[a.id] = { miembros, cancelada: a.cancelada };
    const antes = previo[a.id];
    if (!sig[a.id]) { sig[a.id] = salaNueva(a, ahora); cambio = true; continue; }
    if (!antes) continue;
    const nuevos: MensajeGrupal[] = [];
    if (a.cancelada && !antes.cancelada) {
      nuevos.push(aviso('Se canceló la actividad. El chat quedó cerrado.', ahora));
    } else if (!a.cancelada) {
      for (const id of miembros.filter((m) => !antes.miembros.includes(m))) {
        nuevos.push(aviso(id === YO ? 'Te uniste al grupo' : `${nombreMiembro(a, id)} se unió al grupo`, ahora));
      }
      for (const id of antes.miembros.filter((m) => !miembros.includes(m))) {
        if (id !== YO) nuevos.push(aviso(`${nombreMiembro(a, id)} salió del grupo`, ahora));
      }
    }
    if (nuevos.length) { sig[a.id] = { ...sig[a.id], mensajes: [...sig[a.id].mensajes, ...nuevos] }; cambio = true; }
  }
  previo = nuevoPrevio;
  if (cambio) { salas = sig; emitir(); }
}
sincronizar();
suscribirActividades(() => sincronizar());

function actualizarSala(id: string, cambio: (s: SalaGrupal) => SalaGrupal) {
  if (!salas[id]) return;
  salas = { ...salas, [id]: cambio(salas[id]) };
  emitir();
}

// ---------- acciones ----------
export function enviarMensajeGrupal(actividadId: string, texto: string, ahora: number = Date.now()): ResultadoGrupal {
  const a = getActividades().find((x) => x.id === actividadId);
  if (!a || !salas[actividadId]) return { ok: false, motivo: 'No encontramos este grupo.' };
  const acceso = accesoGrupal(a, ahora);
  if (acceso === 'ninguno') return { ok: false, motivo: 'Ya no tienes acceso a este chat.' };
  if (acceso === 'leer') return { ok: false, motivo: 'La actividad finalizó: el chat quedó solo de lectura.' };
  const limpio = texto.trim();
  if (!limpio) return { ok: false, motivo: 'Escribe un mensaje.' };
  if (limpio.length > MAX_MENSAJE_GRUPAL) return { ok: false, motivo: `El mensaje no puede pasar de ${MAX_MENSAJE_GRUPAL} caracteres.` };
  actualizarSala(actividadId, (s) => ({
    ...s,
    mensajes: [...s.mensajes, { id: idMensaje(), autorId: YO, autorNombre: 'Tú', texto: limpio, propio: true, enviadoEn: ahora }],
  }));
  return { ok: true };
}

const RESPUESTAS = ['¡Dale, ahí estaré!', 'Perfecto, gracias por avisar 👍', 'Yo llevo agua para todos', '¿Alguien necesita que lo pasemos a buscar?', 'Nos vemos entonces 💪'];

/** SOLO DEMO: otro participante responde en el grupo. En la app real llegan por el servidor. */
export function simularRespuestaGrupal(actividadId: string, ahora: number = Date.now()): ResultadoGrupal {
  const a = getActividades().find((x) => x.id === actividadId);
  const sala = salas[actividadId];
  if (!a || !sala) return { ok: false, motivo: 'No encontramos este grupo.' };
  if (accesoGrupal(a, ahora) !== 'escribir') return { ok: false, motivo: 'El chat no está disponible.' };
  const otros = miembrosDe(a).filter((m) => m !== YO);
  if (otros.length === 0) return { ok: false, motivo: 'Aún no hay más participantes.' };
  const autor = otros[sala.mensajes.length % otros.length];
  const texto = RESPUESTAS[sala.mensajes.length % RESPUESTAS.length];
  actualizarSala(actividadId, (s) => ({
    ...s,
    mensajes: [...s.mensajes, { id: idMensaje(), autorId: autor, autorNombre: nombreMiembro(a, autor), texto, propio: false, enviadoEn: ahora }],
    noLeidos: abiertas.has(actividadId) ? 0 : s.noLeidos + 1,
  }));
  return { ok: true };
}

export function abrirSala(actividadId: string) {
  abiertas.add(actividadId);
  actualizarSala(actividadId, (s) => (s.noLeidos === 0 ? s : { ...s, noLeidos: 0 }));
}
export function cerrarSala(actividadId: string) { abiertas.delete(actividadId); }
export function silenciarSala(actividadId: string, silenciado: boolean) {
  actualizarSala(actividadId, (s) => ({ ...s, silenciado }));
}

/** Último mensaje de persona (los avisos del sistema no cuentan como actividad del chat). */
export function ultimoMensajeGrupal(s: SalaGrupal): MensajeGrupal | undefined {
  for (let i = s.mensajes.length - 1; i >= 0; i--) if (!s.mensajes[i].sistema) return s.mensajes[i];
  return undefined;
}

/** Solo para pruebas y para reiniciar la demo. */
export function reiniciarChatGrupal() {
  salas = {}; previo = {}; abiertas.clear(); contador = 1;
  sincronizar();
  emitir();
}

// ---------- hooks ----------
export function useSalaGrupal(actividadId: string): SalaGrupal | undefined {
  return useSyncExternalStore(suscribir, getSalas, getSalas)[actividadId];
}

/** Grupos a los que puedes entrar (o leer), del más reciente al más antiguo. Para la lista de Chats. */
export function useChatsGrupales(): ChatGrupal[] {
  const actividades = useActividades();
  const todas = useSyncExternalStore(suscribir, getSalas, getSalas);
  return useMemo(() => {
    const ahora = Date.now();
    return actividades
      .map((actividad) => ({ actividad, sala: todas[actividad.id], acceso: accesoGrupal(actividad, ahora), participantes: miembrosDe(actividad).length }))
      .filter((c): c is ChatGrupal => !!c.sala && c.acceso !== 'ninguno')
      .sort((x, y) => (ultimoMensajeGrupal(y.sala)?.enviadoEn ?? 0) - (ultimoMensajeGrupal(x.sala)?.enviadoEn ?? 0));
  }, [actividades, todas]);
}

export function useNoLeidosGrupales(): number {
  return useChatsGrupales().reduce((n, c) => n + (c.sala.silenciado ? 0 : c.sala.noLeidos), 0);
}