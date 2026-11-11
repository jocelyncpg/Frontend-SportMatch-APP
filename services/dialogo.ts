import { useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

// Diálogos con la visual de la app. Se usan igual que Alert.alert: dialogo(titulo, mensaje, botones).
// Se muestran desde DialogoHost, que está montado una sola vez en el layout raíz.

export type BotonDialogo = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type TonoDialogo = 'exito' | 'error' | 'aviso' | 'info';

export type Dialogo = {
  id: number;
  titulo: string;
  mensaje?: string;
  botones: BotonDialogo[];
  tono: TonoDialogo;
};

let siguienteId = 1;
let actual: Dialogo | null = null;
const cola: Dialogo[] = [];
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => { oyentes.add(o); return () => { oyentes.delete(o); }; };
const getActual = () => actual;

/** Elige el ícono y el color según lo que dice el título y los botones. */
function inferirTono(titulo: string, botones: BotonDialogo[]): TonoDialogo {
  if (/no se pudo|no pudimos|error|inválid|invalid/i.test(titulo)) return 'error';
  if (/permiso/i.test(titulo)) return 'aviso';
  if (botones.some((b) => b.style === 'destructive')) return 'aviso';
  if (/enviad|guardad|listo|aceptad|creada|publicada|actualizad|bloquead|desbloquead|cambiada/i.test(titulo)) return 'exito';
  return 'info';
}

export function dialogo(titulo: string, mensaje?: string, botones?: BotonDialogo[], opciones?: { tono?: TonoDialogo }) {
  // HU-54: el aviso de límite del plan ya se muestra (con su botón al catálogo) desde el layout raíz; no repetirlo.
  if (mensaje?.startsWith('Te quedan 0 de ') && [actual, ...cola].some((x) => x?.mensaje?.includes(mensaje))) return;
  const lista = botones && botones.length > 0 ? botones : [{ text: 'Entendido' }];
  const d: Dialogo = { id: siguienteId++, titulo, mensaje, botones: lista, tono: opciones?.tono ?? inferirTono(titulo, lista) };
  if (actual) {
    cola.push(d);
    return;
  }
  actual = d;
  emitir();
}

/** Cierra el diálogo que se está viendo y muestra el siguiente, si hay. */
export function cerrarDialogo() {
  actual = cola.shift() ?? null;
  emitir();
}

export function useDialogo(): Dialogo | null {
  return useSyncExternalStore(suscribir, getActual, getActual);
}

/**
 * Hace que todos los `Alert.alert` de la app (y de las librerías) se vean con la visual de la app.
 * Se llama una sola vez, al cargar el layout raíz. Las pantallas siguen usando `Alert.alert` o `dialogo` igual.
 */
export function usarDialogosDeLaApp() {
  Alert.alert = (titulo, mensaje, botones) => {
    dialogo(
      titulo,
      mensaje || undefined,
      botones?.map((b) => ({ text: b.text ?? '', style: b.style, onPress: b.onPress ? () => b.onPress?.() : undefined })),
    );
  };
}