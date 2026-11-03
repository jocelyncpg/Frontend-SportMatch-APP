import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PAGOS_REALES } from '../services/config';
import {
  beneficiosDe,
  confirmarPago,
  contratarPlan,
  iniciarPago,
  leerPagoPendiente,
  olvidarPagoPendiente,
  precioTexto,
  type CuentaPlan,
  type Plan,
} from '../services/planes';
import { Colors, espacio, radio, tipo, useAppTheme } from '../theme/ThemeContext';
import { Aviso, Boton } from './ui';

type Props = {
  visible: boolean;
  /** Plan que se quiere contratar. */
  plan: Plan | null;
  cuenta: CuentaPlan;
  onClose: () => void;
};

/**
 * HU-42/43: resumen del plan y contratación.
 * - PAGOS_REALES = false: demostración, el plan se activa sin cobro.
 * - PAGOS_REALES = true: pago con Webpay Plus. La página de pago es de Transbank y se abre en el
 *   navegador; la app nunca ve ni guarda datos de tarjeta. Al volver, se confirma el pago con el backend.
 */
export default function ContratarPlanModal({ visible, plan, cuenta, onClose }: Props) {
  const enfocado = useIsFocused();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  /** token_ws del pago en curso: si el navegador se cerró antes de tiempo, se puede volver a confirmar. */
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [urlPendiente, setUrlPendiente] = useState<string | null>(null);

  // El enlace de retorno abre /pago sobre esta pantalla: se cierra el modal para ver el comprobante.
  useEffect(() => {
    if (visible && !enfocado) onClose();
  }, [visible, enfocado, onClose]);

  // Cada vez que se abre, parte desde el resumen (y, con pagos reales, recupera un pago pendiente).
  useEffect(() => {
    let activo = true;
    if (visible) {
      setListo(false);
      setError(null);
      setPendiente(null);
      setUrlPendiente(null);
      if (PAGOS_REALES) {
        setProcesando(true);
        void leerPagoPendiente()
          .then((pago) => {
            if (activo) {
              setPendiente(pago?.tokenWs ?? null);
              setUrlPendiente(pago?.urlPago ?? null);
            }
          })
          .catch(() => { if (activo) setError('No pudimos recuperar el pago pendiente.'); })
          .finally(() => { if (activo) setProcesando(false); });
      }
    }
    return () => { activo = false; };
  }, [visible]);

  if (!plan) return null;

  function confirmarDemo() {
    if (!plan) return;
    const r = contratarPlan(cuenta, plan.id);
    if (r.ok) setListo(true);
    else setError(r.motivo);
  }

  async function confirmar(tokenWs: string) {
    const r = await confirmarPago(cuenta, tokenWs);
    if (r.ok) {
      setListo(true);
      setPendiente(null);
    } else {
      setError(r.motivo);
      if (!r.reintentable) setPendiente(null);
    }
  }

  async function pagar() {
    if (!plan || procesando) return;
    setError(null);
    setProcesando(true);
    try {
      const { tokenWs, urlPago } = await iniciarPago(cuenta, plan);
      setPendiente(tokenWs);
      setUrlPendiente(urlPago);
      // Vuelve cuando la persona cierra el navegador (en Android, apenas se abre).
      await WebBrowser.openBrowserAsync(urlPago);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No pudimos iniciar el pago.');
    } finally {
      setProcesando(false);
    }
  }

  async function consultarPago() {
    if (!pendiente || procesando) return;
    setProcesando(true);
    try {
      await confirmar(pendiente);
    } finally {
      setProcesando(false);
    }
  }

  function abrirPendiente() {
    if (!urlPendiente) return;
    WebBrowser.openBrowserAsync(urlPendiente).catch(() => setError('No pudimos abrir Webpay.'));
  }

  function nuevoIntento() {
    olvidarPagoPendiente()
      .then(() => {
        setPendiente(null);
        setUrlPendiente(null);
        setError('Antes de iniciar otro intento, verifica si el pago anterior fue confirmado.');
      })
      .catch(() => setError('No pudimos recuperar el resumen. Inténtalo nuevamente.'));
  }

  const textoAviso = !PAGOS_REALES
    ? 'Pago de demostración: no se realiza ningún cobro. El pago real con Webpay se activa al conectar el backend.'
    : pendiente
      ? 'Completa el pago en Webpay. Al regresar verás el resultado; si cerraste el navegador, toca "Consultar pago".'
      : 'Completarás el pago en el sitio seguro de Webpay Plus (Transbank). SportMatch no solicita los datos de tu tarjeta.';

  const textoAccion = !PAGOS_REALES ? 'Confirmar' : pendiente ? 'Consultar pago' : 'Pagar con Webpay';
  const alAccionar = !PAGOS_REALES ? confirmarDemo : pendiente ? consultarPago : pagar;

  return (
    <Modal visible={visible && enfocado} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          {listo ? (
            <View style={styles.centro}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
              <Text style={styles.titulo}>¡Listo!</Text>
              <Text style={styles.texto}>Tu plan ahora es {plan.nombre}. Los beneficios ya están activos.</Text>
              <Boton texto="Cerrar" onPress={onClose} style={styles.botonCerrar} />
            </View>
          ) : (
            <>
              <Text style={styles.titulo}>Contratar plan {plan.nombre}</Text>
              <Text style={styles.precio}>{precioTexto(plan)}</Text>
              <Text style={styles.resumen}>{plan.resumen}</Text>

              <ScrollView style={styles.lista} contentContainerStyle={{ gap: espacio.m }}>
                {beneficiosDe(plan.id).map((b) => (
                  <View key={b} style={styles.beneficio}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.beneficioTexto}>{b}</Text>
                  </View>
                ))}
              </ScrollView>

              <Aviso texto={textoAviso} icono={PAGOS_REALES ? 'lock-closed-outline' : 'information-circle-outline'} />

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

              {PAGOS_REALES && pendiente && urlPendiente ? (
                <TouchableOpacity accessibilityRole="button" disabled={procesando} onPress={abrirPendiente} style={styles.enlace}>
                  <Text style={styles.enlaceTexto}>Continuar el pago pendiente en Webpay</Text>
                </TouchableOpacity>
              ) : null}
              {PAGOS_REALES && pendiente && error ? (
                <TouchableOpacity accessibilityRole="button" disabled={procesando} onPress={nuevoIntento} style={styles.enlace}>
                  <Text style={styles.enlaceTexto}>Volver al resumen para iniciar otro intento</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.acciones}>
                <Boton texto="Cancelar" variante="secundario" onPress={onClose} style={styles.accionCancelar} />
                {procesando ? (
                  <View style={[styles.cargando, styles.accionConfirmar]}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <Boton
                    texto={textoAccion}
                    icono={PAGOS_REALES && !pendiente ? 'card-outline' : undefined}
                    onPress={alAccionar}
                    style={styles.accionConfirmar}
                  />
                )}
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
    error: { color: c.danger, ...tipo.cuerpo, marginTop: espacio.m },
    enlace: { minHeight: 44, justifyContent: 'center', marginTop: espacio.s },
    enlaceTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    acciones: { flexDirection: 'row', gap: espacio.m, marginTop: espacio.l },
    accionCancelar: { flex: 1 },
    accionConfirmar: { flex: 1.4 },
    cargando: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    // En la pantalla "¡Listo!" el botón va en columna: no usa flex para no perder su alto.
    botonCerrar: { alignSelf: 'stretch', marginTop: espacio.s },
  });