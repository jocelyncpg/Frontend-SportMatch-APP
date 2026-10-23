import * as Crypto from 'expo-crypto';
import { useMemo, useSyncExternalStore } from 'react';
import { ApiError, apiRequest } from './api';
import { getSession, getToken } from './auth';
import { alCambiar, crearSondeo } from './sondeo';

export const MAX_CONSULTA = 1000;
export type Resultado = {
  ok: true;
} | {
  ok: false;
  motivo: string;
};
export type MensajeConsulta = {
  id: string;
  de: 'postulante' | 'club';
  texto: string;
  enviadoEn: number;
  propio: boolean;
};
export type Hilo = {
  id: string;
  clubId: string;
  clubNombre: string;
  postulanteId: string;
  postulanteNombre: string;
  mensajes: MensajeConsulta[];
  noLeidosClub: number;
  noLeidosPostulante: number;
};
type MensajeApi = {
  id: number;
  de: 'deportista' | 'club';
  texto: string;
  enviado_en: string;
  propio: boolean;
};
type HiloDeportistaApi = {
  hilo_id: string;
  club_id: string;
  club_nombre: string;
  club_logo: string | null;
  ultimo: MensajeApi | null;
  no_leidos: number;
};
type HiloClubApi = {
  hilo_id: string;
  deportista_id: string;
  deportista_nombre: string;
  ultimo: MensajeApi | null;
  no_leidos: number;
};
type MensajesApi = {
  hilo_id: string | null;
  mensajes: MensajeApi[];
};
type Estado = {
  usuarioId: string | null;
  hilos: Record<string, Hilo>;
  cargando: boolean;
  error: string | null;
};
let estado: Estado = { usuarioId: null, hilos: {}, cargando: false, error: null };
const oyentes = new Set<() => void>();
const intervalos = new Map<string, { detener(): void; ahora(): void; aviso(): void }>();
const leidos = new Map<string, number>();
const intentos = new Map<string, string>();
const cargadas = new Set<string>();
const cursores = new Map<string, string>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
};
const getEstado = () => estado;
const motivo = (e: unknown) => e instanceof Error ? e.message : 'No se pudo conectar con el servidor.';
const convertir = (m: MensajeApi): MensajeConsulta => ({
  id: String(m.id),
  de: m.de === 'deportista' ? 'postulante' : 'club',
  texto: m.texto,
  enviadoEn: Date.parse(m.enviado_en),
  propio: m.propio
});
export const idHilo = (clubId: string, _postulanteId: string) => clubId + '__me';

async function credenciales() {
  const [sesion, token] = await Promise.all([getSession(), getToken()]);
  if (!sesion || !token) throw new ApiError('Tu sesión expiró. Vuelve a iniciar sesión.', 401, '');
  if (estado.usuarioId && estado.usuarioId !== sesion.id) {
    cargadas.clear();
    cursores.clear();
    leidos.clear();
    estado = { usuarioId: sesion.id, hilos: {}, cargando: false, error: null };
  }
  return { usuarioId: sesion.id, token };
}

function guardar(h: Hilo) {
  estado = { ...estado, hilos: { ...estado.hilos, [h.id]: h } };
  emitir();
}

export async function cargarHilosDeportista(): Promise<boolean> {
  estado = { ...estado, cargando: true, error: null };
  emitir();
  try {
    const { usuarioId, token } = await credenciales();
    const lista = await apiRequest<HiloDeportistaApi[]>('/clubs/consultas/me', { token });
    if ((await getSession())?.id !== usuarioId) return false;
    const cambios = lista.some((h) => {
      const previo = estado.hilos[idHilo(h.club_id, usuarioId)];
      return previo?.mensajes.at(-1)?.id !== (h.ultimo ? String(h.ultimo.id) : undefined)
        || previo?.noLeidosPostulante !== h.no_leidos;
    }) || lista.length !== Object.keys(estado.hilos).filter((id) => id.endsWith('__me')).length;
    const hilos = { ...estado.hilos };
    for (const h of lista) {
      const id = idHilo(h.club_id, usuarioId);
      const ultimo = h.ultimo ? convertir(h.ultimo) : undefined;
      const cambio = ultimo && hilos[id]?.mensajes.at(-1)?.id !== ultimo.id;
      if (cambio && !intervalos.has(id)) {
        cargadas.delete(id);
        cursores.delete(id);
      }
      const mensajes = cambio && !intervalos.has(id) ? [ultimo] : hilos[id]?.mensajes ?? (ultimo ? [ultimo] : []);
      hilos[id] = {
        id,
        clubId: h.club_id,
        clubNombre: h.club_nombre,
        postulanteId: usuarioId,
        postulanteNombre: '',
        mensajes,
        noLeidosClub: 0,
        noLeidosPostulante: h.no_leidos
      };
    }
    estado = { usuarioId, hilos, cargando: false, error: null };
    emitir();
    return cambios;
  } catch (e) {
    estado = { ...estado, cargando: false, error: motivo(e) };
    emitir();
    throw e;
  }
}

export async function cargarHilosClub(clubId: string, clubNombre: string): Promise<boolean> {
  estado = { ...estado, cargando: true, error: null };
  emitir();
  try {
    const { usuarioId, token } = await credenciales();
    const lista = await apiRequest<HiloClubApi[]>('/clubs/' + encodeURIComponent(clubId) + '/consultas', { token });
    if ((await getSession())?.id !== usuarioId) return false;
    const cambios = lista.some((h) => {
      const previo = estado.hilos[h.hilo_id];
      return previo?.mensajes.at(-1)?.id !== (h.ultimo ? String(h.ultimo.id) : undefined)
        || previo?.noLeidosClub !== h.no_leidos;
    }) || lista.length !== Object.values(estado.hilos)
      .filter((h) => h.clubId === clubId && !h.id.endsWith('__me')).length;
    const hilos = { ...estado.hilos };
    for (const h of lista) {
      const id = h.hilo_id;
      const ultimo = h.ultimo ? convertir(h.ultimo) : undefined;
      const cambio = ultimo && hilos[id]?.mensajes.at(-1)?.id !== ultimo.id;
      if (cambio && !intervalos.has(id)) {
        cargadas.delete(id);
        cursores.delete(id);
      }
      const mensajes = cambio && !intervalos.has(id) ? [ultimo] : hilos[id]?.mensajes ?? (ultimo ? [ultimo] : []);
      hilos[id] = {
        id,
        clubId,
        clubNombre,
        postulanteId: h.deportista_id,
        postulanteNombre: h.deportista_nombre,
        mensajes,
        noLeidosClub: h.no_leidos,
        noLeidosPostulante: 0
      };
    }
    estado = { usuarioId, hilos, cargando: false, error: null };
    emitir();
    return cambios;
  } catch (e) {
    estado = { ...estado, cargando: false, error: motivo(e) };
    emitir();
    throw e;
  }
}

async function cargarMensajes(clave: string, ruta: string): Promise<boolean> {
  const { usuarioId, token } = await credenciales();
  const anterior = estado.hilos[clave];
  const cursor = cargadas.has(clave) ? cursores.get(clave) : undefined;
  const query = cursor ? '?after_id=' + encodeURIComponent(cursor) + '&limit=50' : '?limit=50';
  const data = await apiRequest<MensajesApi>(ruta + '/messages' + query, { token });
  if ((await getSession())?.id !== usuarioId) return false;
  const mensajes = [
    ...(cargadas.has(clave) ? anterior?.mensajes ?? [] : []),
    ...data.mensajes.map(convertir),
  ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  cargadas.add(clave);
  const nuevoCursor = data.mensajes.at(-1)?.id;
  if (nuevoCursor && nuevoCursor > Number(cursores.get(clave) ?? 0)) cursores.set(clave, String(nuevoCursor));
  const h: Hilo = anterior ?? {
    id: clave,
    clubId: clave.split('__')[0],
    clubNombre: '',
    postulanteId: usuarioId,
    postulanteNombre: '',
    mensajes: [],
    noLeidosClub: 0,
    noLeidosPostulante: 0
  };
  guardar({ ...h, mensajes });
  const ultimoId = mensajes.at(-1)?.id;
  if (intervalos.has(clave) && ultimoId && Number(ultimoId) > (leidos.get(clave) ?? 0)) {
    await apiRequest<void>(ruta + '/read', { method: 'POST', token, body: { hasta_id: Number(ultimoId) } });
    leidos.set(clave, Number(ultimoId));
    guardar({ ...estado.hilos[clave], noLeidosClub: 0, noLeidosPostulante: 0 });
  }
  return data.mensajes.some((m) => !anterior?.mensajes.some((viejo) => viejo.id === String(m.id)));
}

export function abrirConsultaDeportista(clubId: string) {
  const clave = idHilo(clubId, '');
  const ruta = '/clubs/' + encodeURIComponent(clubId) + '/consultas/me';
  abrir(clave, ruta);
}

export function abrirConsultaClub(clubId: string, hiloId: string) {
  abrir(hiloId, '/clubs/' + encodeURIComponent(clubId) + '/consultas/' + encodeURIComponent(hiloId));
}

function abrir(clave: string, ruta: string) {
  if (intervalos.has(clave)) return;
  const sondeo = crearSondeo('consulta:' + clave, () => cargarMensajes(clave, ruta).catch((e) => {
    estado = { ...estado, error: motivo(e) };
    emitir();
    return false;
  }), { minMs: 3000, maxMs: 15000, factor: 1.5 });
  const quitarAviso = alCambiar(({ tipo, id }) => {
    if ((tipo === 'consulta' && clave === idHilo(id ?? '', '')) || (tipo === 'consulta_club' && id === clave)) {
      sondeo.ahora();
    }
  });
  intervalos.set(clave, { ...sondeo, aviso: quitarAviso });
  sondeo.iniciar();
}

export function cerrarConsulta(clave: string) {
  const timer = intervalos.get(clave);
  timer?.detener();
  timer?.aviso();
  intervalos.delete(clave);
}

async function enviar(ruta: string, clave: string, texto: string): Promise<Resultado> {
  const limpio = texto.trim();
  if (!limpio || limpio.length > MAX_CONSULTA) return { ok: false, motivo: 'Escribe entre 1 y 1000 caracteres.' };
  const intento = clave + ':' + limpio;
  if (!intentos.has(intento)) intentos.set(intento, Crypto.randomUUID());
  try {
    const { token } = await credenciales();
    const m = await apiRequest<MensajeApi>(ruta + '/messages', {
      method: 'POST',
      token,
      body: { texto: limpio, client_message_id: intentos.get(intento) },
    });
    intentos.delete(intento);
    const h = estado.hilos[clave];
    if (h) guardar({ ...h, mensajes: [...h.mensajes.filter((x) => x.id !== String(m.id)), convertir(m)] });
    else await cargarMensajes(clave, ruta).catch(() => { });
    intervalos.get(clave)?.ahora();
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: motivo(e) };
  }
}

export function enviarConsulta(clubId: string, _postulanteId: string, _postulanteNombre: string, texto: string) {
  return enviar('/clubs/' + encodeURIComponent(clubId) + '/consultas/me', idHilo(clubId, ''), texto);
}

export function responderConsulta(hiloId: string, texto: string) {
  const h = estado.hilos[hiloId];
  if (!h) return Promise.resolve({ ok: false, motivo: 'No encontramos esta consulta.' } as Resultado);
  return enviar('/clubs/' + encodeURIComponent(h.clubId) + '/consultas/' + encodeURIComponent(hiloId), hiloId, texto);
}

export function reiniciarConsultas() {
  intervalos.forEach((timer) => {
    timer.detener();
    timer.aviso();
  });
  intervalos.clear();
  leidos.clear();
  intentos.clear();
  cargadas.clear();
  cursores.clear();
  estado = { usuarioId: null, hilos: {}, cargando: false, error: null };
  emitir();
}

export function useEstadoConsultas() {
  return useSyncExternalStore(suscribir, getEstado, getEstado);
}

export function useHilo(id: string) {
  return useEstadoConsultas().hilos[id];
}

export function useHilosDelClub(clubId: string) {
  const hilos = useEstadoConsultas().hilos;
  return useMemo(() => Object.values(hilos)
    .filter((h) => h.clubId === clubId && !h.id.endsWith('__me'))
    .sort((a, b) => (b.mensajes.at(-1)?.enviadoEn ?? 0) - (a.mensajes.at(-1)?.enviadoEn ?? 0)),
  [hilos, clubId]);
}

export function useHilosDePostulante(_id: string) {
  const hilos = useEstadoConsultas().hilos;
  return useMemo(() => Object.values(hilos)
    .filter((h) => h.id.endsWith('__me'))
    .sort((a, b) => (b.mensajes.at(-1)?.enviadoEn ?? 0) - (a.mensajes.at(-1)?.enviadoEn ?? 0)),
  [hilos]);
}

export function useConsultasPendientes(clubId: string) {
  return useHilosDelClub(clubId).filter((h) => h.mensajes.at(-1)?.de === 'postulante').length;
}

export function useNoLeidosConsultas(id: string) {
  return useHilosDePostulante(id).reduce((n, h) => n + h.noLeidosPostulante, 0);
}

export function sinResponder(lista: Hilo[]) {
  return lista.filter((h) => h.mensajes.at(-1)?.de === 'postulante');
}
