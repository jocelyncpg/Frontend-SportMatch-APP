import { apiRequest } from './api';
import { getToken } from './auth';
import { listarDeportesClub } from './clubes';
import type { Resultado } from './consultas';

// Perfil público del club (HU-31): lo que el club edita en "Mi club" y verán los deportistas.
// Lee con GET /clubs/{id} y guarda con PATCH /clubs/{id} (solo administradores del club).

export type PerfilClub = {
  nombre: string;
  descripcion: string;
  zona: string;
  /** Nombres de los deportes del catálogo (GET /clubs/deportes); al guardar se envían sus ids. */
  deportes: string[];
  email: string;
  telefono: string;
  instagram: string;
  web: string;
};

export const MAX_NOMBRE_CLUB = 60;
export const MAX_DESCRIPCION_CLUB = 500;

/** Forma del perfil que devuelve el backend (solo los campos que usa la pantalla). */
type ClubApi = {
  id: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: { comuna: string | null };
  email_contacto: string | null;
  telefono: string | null;
  sitio_web: string | null;
  redes_sociales: Record<string, string>;
  deportes: { id: number; nombre: string }[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_RE = /^(https?:\/\/)?(www\.)?instagram\.com\//i;

/** Muestra el enlace de Instagram como "@usuario" para editarlo. */
function instagramDesdeApi(url: string | undefined): string {
  if (!url) return '';
  const usuario = url.replace(INSTAGRAM_RE, '').replace(/\/+$/, '');
  return usuario ? `@${usuario}` : url;
}

/** "@tuclub" o "tuclub" -> https://instagram.com/tuclub. Un enlace completo se conserva (http -> https). */
function normalizarInstagram(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t.replace(/^http:\/\//i, 'https://');
  return `https://instagram.com/${t.replace(/^@/, '').replace(/\/+$/, '')}`;
}

/** El sitio web necesita http:// o https://; si el club escribe solo el dominio, se agrega https://. */
function normalizarWeb(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

async function tokenActual() {
  const token = await getToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return token;
}

/** Perfil guardado del club, tal como lo edita su panel. */
export async function cargarPerfilClub(clubId: string): Promise<PerfilClub> {
  const c = await apiRequest<ClubApi>(`/clubs/${encodeURIComponent(clubId)}`);
  return {
    nombre: c.nombre,
    descripcion: c.descripcion ?? '',
    zona: c.ubicacion?.comuna ?? '',
    deportes: c.deportes.map((d) => d.nombre),
    email: c.email_contacto ?? '',
    telefono: c.telefono ?? '',
    instagram: instagramDesdeApi(c.redes_sociales?.instagram),
    web: c.sitio_web ?? '',
  };
}

/** Guarda el perfil. Valida lo mismo que el panel web y envía los campos vacíos como null. */
export async function guardarPerfilClub(clubId: string, datos: PerfilClub): Promise<Resultado> {
  const nombre = datos.nombre.trim();
  if (nombre.length < 2) return { ok: false, motivo: 'Escribe el nombre del club.' };
  if (nombre.length > MAX_NOMBRE_CLUB) return { ok: false, motivo: `El nombre admite hasta ${MAX_NOMBRE_CLUB} caracteres.` };
  if (datos.descripcion.trim().length > MAX_DESCRIPCION_CLUB) {
    return { ok: false, motivo: `La descripción admite hasta ${MAX_DESCRIPCION_CLUB} caracteres.` };
  }
  if (datos.deportes.length === 0) return { ok: false, motivo: 'Selecciona al menos un deporte.' };
  const email = datos.email.trim();
  if (email && !EMAIL.test(email)) return { ok: false, motivo: 'El correo de contacto no tiene un formato válido.' };
  const telefono = datos.telefono.trim();
  if (telefono && telefono.replace(/\D/g, '').length < 8) return { ok: false, motivo: 'El teléfono debe tener al menos 8 dígitos.' };
  const instagram = datos.instagram.trim();
  if (/\s/.test(instagram)) return { ok: false, motivo: 'El usuario de Instagram no puede tener espacios.' };

  try {
    // Los deportes se envían por id del catálogo: el club solo puede publicar los que existen.
    const catalogo = await listarDeportesClub();
    const deporteIds = datos.deportes.map((nombreDeporte) => {
      const encontrado = catalogo.find((d) => d.nombre === nombreDeporte);
      if (!encontrado) throw new Error(`El deporte "${nombreDeporte}" no está disponible.`);
      return encontrado.id;
    });

    await apiRequest<ClubApi>(`/clubs/${encodeURIComponent(clubId)}`, {
      method: 'PATCH',
      token: await tokenActual(),
      body: {
        nombre,
        descripcion: datos.descripcion.trim() || null,
        comuna: datos.zona.trim() || null,
        email_contacto: email || null,
        telefono: telefono || null,
        sitio_web: normalizarWeb(datos.web),
        // redes_sociales se reemplaza completo por el backend: aquí solo se maneja Instagram.
        redes_sociales: { instagram: normalizarInstagram(instagram) },
        deporte_ids: deporteIds,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo guardar el perfil del club.' };
  }
}
