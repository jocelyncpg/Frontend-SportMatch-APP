import { AppState } from 'react-native';

type Opciones = { minMs: number; maxMs: number; factor: number };
type Sondeo = { iniciar(): void; detener(): void; ahora(): void };
type Aviso = { tipo: string; id?: string };

const sondeos = new Map<string, Sondeo>();
const oyentes = new Set<(aviso: Aviso) => void>();

// WebSocket queda para una mejora futura por el costo de mantener su infraestructura.
export function crearSondeo(clave: string, tarea: () => Promise<boolean>, opciones: Opciones): Sondeo {
  const anterior = sondeos.get(clave);
  if (anterior) return anterior;
  let activo = false;
  let referencias = 0;
  let ejecutando = false;
  let pendiente = false;
  let intervalo = opciones.minMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listener: { remove(): void } | undefined;
  const limpiar = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const programar = (ms: number) => {
    limpiar();
    if (activo && AppState.currentState === 'active') timer = setTimeout(() => void ejecutar(), ms);
  };
  const ejecutar = async () => {
    if (!activo || AppState.currentState !== 'active') return;
    if (ejecutando) { pendiente = true; return; }
    limpiar();
    ejecutando = true;
    try {
      const cambios = await tarea();
      intervalo = cambios ? opciones.minMs : Math.min(opciones.maxMs, intervalo * opciones.factor);
    } catch {
      intervalo = Math.min(opciones.maxMs, intervalo * opciones.factor);
    } finally {
      ejecutando = false;
      if (!activo && !referencias) sondeos.delete(clave);
      if (pendiente) {
        pendiente = false;
        intervalo = opciones.minMs;
        programar(0);
      } else {
        programar(intervalo);
      }
    }
  };
  const sondeo: Sondeo = {
    iniciar() {
      referencias++;
      if (activo) return;
      activo = true;
      intervalo = opciones.minMs;
      listener = AppState.addEventListener('change', (estado) => {
        if (estado !== 'active') limpiar();
        else {
          intervalo = opciones.minMs;
          sondeo.ahora();
        }
      });
      programar(0);
    },
    detener() {
      if (!referencias) return;
      referencias--;
      if (referencias) return;
      activo = false;
      pendiente = false;
      limpiar();
      listener?.remove();
      listener = undefined;
      if (!ejecutando) sondeos.delete(clave);
    },
    ahora() {
      intervalo = opciones.minMs;
      if (ejecutando) pendiente = true;
      else programar(0);
    },
  };
  sondeos.set(clave, sondeo);
  return sondeo;
}

export function avisarCambio(tipo: string, id?: string) {
  oyentes.forEach((oyente) => oyente({ tipo, id }));
}

export function alCambiar(oyente: (aviso: Aviso) => void) {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}
