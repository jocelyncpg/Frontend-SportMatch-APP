import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { beneficiosDe, cancelarPagoPendiente, confirmarPago, iniciarPago, leerPagoPendiente, precioTexto, type CuentaPlan, type Plan } from '../services/planes';
import { Colors, useAppTheme, espacio, radio, tipo } from '../theme/ThemeContext';
import { Aviso, Boton } from './ui';

type Props = {
  visible: boolean;
  /** Plan que se quiere contratar. */
  plan: Plan | null;
  cuenta: CuentaPlan;
  onClose: () => void;
  /** HU-55: renovar el plan vigente (desde el aviso de vencimiento); suma su duración al vencimiento. */
  renovar?: boolean;
};

/**
 * HU-42/43: resumen del plan y pago con Webpay Plus (ms-pago).
 * Se abre la página de pago en el navegador; al volver, la app confirma el pago con el backend.
 */
export default function ContratarPlanModal({ visible, plan, cuenta, onClose, renovar = false }: Props) {
  const enfocado = useIsFocused();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  /** token_ws del pago en curso: si el navegador se cerró antes de tiempo, se puede volver a confirmar. */
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const ocupado = useRef(false);
  const version = useRef(0);
  const actual = useRef({ visible, enfocado, pendiente });
  actual.current = { visible, enfocado, pendiente };

  const recuperar = useCallback(async (tokenWs: string): Promise<boolean> => {
    if (ocupado.current || !actual.current.visible || !actual.current.enfocado) return false;
    ocupado.current = true; setProcesando(true); setError(null);
    const generacion = version.current;
    try {
      const estado = await cancelarPagoPendiente(cuenta, tokenWs);
      if (generacion !== version.current) return false;
      setPendiente(null);
      setListo(estado === 'aprobado');
      setMensaje(estado === 'aprobado'
        ? 'Tu pago anterior fue aprobado. Puedes revisar el detalle en Mis pagos.'
        : 'El intento anterior quedó cancelado. Puedes iniciar un nuevo pago.');
      return true;
    } catch (e) {
      if (generacion === version.current) setError(e instanceof Error ? e.message : 'No pudimos revisar el intento anterior. Inténtalo nuevamente.');
      return false;
    } finally {
      if (generacion === version.current) { ocupado.current = false; setProcesando(false); }
    }
  }, [cuenta]);

  // El deep link abre /pago sobre esta pantalla. Cerrar el modal permite
  // ver el comprobante y evita volver a mostrar la compra al regresar.
  useEffect(() => {
    if (visible && !enfocado) onClose();
  }, [visible, enfocado, onClose]);

  // Cada vez que se abre, parte desde el resumen.
  useEffect(() => {
    let activo = true;
    const generacion = ++version.current;
    if (visible) {
      ocupado.current = true;
      setListo(false); setError(null); setMensaje(null); setPendiente(null); setProcesando(true);
      void leerPagoPendiente().then(async (pago) => {
        if (!activo) return;
        ocupado.current = false; setProcesando(false);
        if (pago) { setPendiente(pago.tokenWs); await recuperar(pago.tokenWs); }
      }).catch(() => { if (activo) setError('No pudimos recuperar el pago pendiente.'); })
        .finally(() => { if (activo) { ocupado.current = false; setProcesando(false); } });
    }
    return () => { activo = false; version.current = generacion + 1; };
  }, [visible, recuperar]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const revisarAlVolver = () => {
        if (!actual.current.visible || !actual.current.enfocado) return;
        void leerPagoPendiente().then((pago) => {
          if (pago) { setPendiente(pago.tokenWs); void recuperar(pago.tokenWs); }
        }).catch(() => setError('No pudimos revisar el intento anterior.'));
      };
      window.addEventListener('pageshow', revisarAlVolver);
      return () => window.removeEventListener('pageshow', revisarAlVolver);
    }
    let anterior = AppState.currentState;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && anterior !== 'active') {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const pago = actual.current;
          if (pago.visible && pago.enfocado && pago.pendiente) void recuperar(pago.pendiente);
        }, 800);
      }
      anterior = estado;
    });
    return () => { subscription.remove(); clearTimeout(timer); };
  }, [recuperar]);

  if (!plan) return null;

  async function abrirWebpay(urlPago: string) {
    // Crear la transacción requiere esperar a la API. En web, abrir una ventana
    // después de esa espera puede ser bloqueado y Expo no informa el bloqueo.
    if (Platform.OS === 'web') {
      window.location.assign(urlPago);
      return;
    }
    return WebBrowser.openBrowserAsync(urlPago);
  }

  async function confirmar(tokenWs: string) {
    const r = await confirmarPago(cuenta, tokenWs);
    if (r.ok) { setListo(true); setPendiente(null); }
    else { setError(r.motivo); if (!r.reintentable) setPendiente(null); }
  }

  async function pagar() {
    if (!plan || ocupado.current) return;
    ocupado.current = true;
    const generacion = version.current;
    setError(null); setMensaje(null);
    setProcesando(true);
    let cerrado: string | undefined;
    try {
      const { tokenWs, urlPago } = await iniciarPago(cuenta, plan, { renovar });
      if (generacion !== version.current) return;
      setPendiente(tokenWs);
      const navegador = await abrirWebpay(urlPago);
      if (navegador?.type === 'cancel' || navegador?.type === 'dismiss') cerrado = tokenWs;
    } catch (e) {
      if (generacion === version.current) setError(e instanceof Error && e.message ? e.message : 'No pudimos iniciar el pago.');
    } finally {
      if (generacion === version.current) { ocupado.current = false; setProcesando(false); }
    }
    if (cerrado) await recuperar(cerrado);
  }

  async function yaPague() {
    if (!pendiente || ocupado.current) return;
    ocupado.current = true;
    setProcesando(true);
    try { await confirmar(pendiente); } finally { ocupado.current = false; setProcesando(false); }
  }

  async function cerrar() {
    if (ocupado.current) return;
    if (pendiente && !await recuperar(pendiente)) return;
    onClose();
  }

  function verPagos() {
    onClose();
    router.push(cuenta === 'club' ? '/(club)/mis-pagos' : '/(deportista)/mis-pagos');
  }

  return (
    <Modal visible={visible && enfocado} transparent animationType="fade" onRequestClose={() => { void cerrar(); }}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          {listo ? (
            <View style={styles.centro}>
              <Ionicons name="checkmark-circle" size={54} color={colors.success} />
              <Text style={styles.titulo}>¡Listo!</Text>
              <Text style={styles.texto}>
                {mensaje ?? (renovar
                  ? `Renovaste el plan ${plan.nombre}. Sus beneficios siguen activos.`
                  : `Tu plan ahora es ${plan.nombre}. Los beneficios ya están activos.`)}
              </Text>
              <Boton texto="Ver Mis pagos" onPress={verPagos} style={styles.botonCerrar} />
              <Boton texto="Cerrar" onPress={onClose} style={styles.botonCerrar} />
            </View>
          ) : (
            <>
              <Text style={styles.titulo}>{renovar ? 'Renovar' : 'Contratar'} plan {plan.nombre}</Text>
              <Text style={styles.precio}>{precioTexto(plan)}</Text>
              <Text style={styles.resumen}>{plan.resumen}</Text>

              <ScrollView style={styles.lista} contentContainerStyle={{ gap: 8 }}>
                {beneficiosDe(plan.id).map((b) => (
                  <View key={b} style={styles.beneficio}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.beneficioTexto}>{b}</Text>
                  </View>
                ))}
              </ScrollView>

              <Aviso icono="lock-closed-outline" texto={mensaje ?? (pendiente
                    ? 'Estamos revisando el intento anterior. Puedes consultar el resultado o cancelar ese intento para volver a pagar.'
                    : 'Completarás el pago en el sitio seguro de Webpay Plus. SportMatch no solicita los datos de tu tarjeta.')} />

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {pendiente ? <TouchableOpacity disabled={procesando} onPress={() => { void recuperar(pendiente); }} style={styles.enlace}>
                <Text style={styles.enlaceTexto}>Cancelar intento anterior y volver a pagar</Text>
              </TouchableOpacity> : null}
              <TouchableOpacity disabled={procesando} onPress={verPagos} style={styles.enlace}>
                <Text style={styles.enlaceTexto}>Ver Mis pagos</Text>
              </TouchableOpacity>

              <View style={styles.acciones}>
                <Boton variante="secundario" texto="Cancelar" onPress={() => { void cerrar(); }} deshabilitado={procesando} style={styles.accionCancelar} />
                <Boton texto={procesando ? 'Procesando…' : pendiente ? 'Consultar pago' : 'Pagar con Webpay'}
                  onPress={pendiente ? yaPague : pagar} deshabilitado={procesando} style={styles.accionConfirmar} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    enlace: { minHeight: 44, justifyContent: 'center', marginTop: espacio.s },
    enlaceTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    accionCancelar: { flex: 1 },
    accionConfirmar: { flex: 1.4 },
    cargando: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },

    fondo: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: espacio.xl },
    hoja: {
      backgroundColor: c.card,
      borderRadius: radio.tarjeta,
      borderWidth: 1,
      borderColor: c.border,
      padding: espacio.xl,
      maxHeight: '90%',
    },
    centro: { alignItems: 'center', gap: espacio.m, paddingVertical: espacio.m },
    titulo: { color: c.text, ...tipo.titulo },
    precio: { color: c.accent, fontSize: 24, fontWeight: '800', marginTop: espacio.xs },
    resumen: { color: c.textMuted, ...tipo.cuerpo, marginTop: espacio.xs, marginBottom: espacio.l },
    texto: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', lineHeight: 19 },
    lista: { flexGrow: 0, marginBottom: espacio.l },
    beneficio: { flexDirection: 'row', gap: espacio.m, alignItems: 'flex-start' },
    beneficioTexto: { flex: 1, color: c.text, ...tipo.cuerpo, lineHeight: 19 },
    aviso: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.chip, borderRadius: 12, padding: 12 },
    avisoTexto: { flex: 1, color: c.textMuted, fontSize: 11.5, lineHeight: 16 },
    error: { color: c.danger, ...tipo.cuerpo, marginTop: espacio.m },
    acciones: { flexDirection: 'row', gap: espacio.m, marginTop: espacio.l },
    botonSecundario: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
    botonSecundarioTexto: { color: c.text, fontSize: 13, fontWeight: '700' },
    botonPrimario: { flex: 1.4, backgroundColor: c.primary, borderRadius: 13, paddingVertical: 13, alignItems: 'center', minWidth: 120 },
    // Botón de la pantalla "¡Listo!": sin flex, porque está en una columna y flex le quitaría el alto.
    botonCerrar: { alignSelf: 'stretch', marginTop: espacio.s },
    botonPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });
