import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { beneficiosDe, confirmarPago, iniciarPago, leerPagoPendiente, olvidarPagoPendiente, precioTexto, type CuentaPlan, type Plan } from '../services/planes';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type Props = {
  visible: boolean;
  /** Plan que se quiere contratar. */
  plan: Plan | null;
  cuenta: CuentaPlan;
  onClose: () => void;
};

/**
 * HU-42/43: resumen del plan y pago con Webpay Plus (Ms-club).
 * Se abre la página de pago en el navegador; al volver, la app confirma el pago con el backend.
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

  // El deep link abre /pago sobre esta pantalla. Cerrar el modal permite
  // ver el comprobante y evita volver a mostrar la compra al regresar.
  useEffect(() => {
    if (visible && !enfocado) onClose();
  }, [visible, enfocado, onClose]);

  // Cada vez que se abre, parte desde el resumen.
  useEffect(() => {
    let activo = true;
    if (visible) {
      setListo(false); setError(null); setPendiente(null); setUrlPendiente(null); setProcesando(true);
      void leerPagoPendiente().then((pago) => {
        if (activo) { setPendiente(pago?.tokenWs ?? null); setUrlPendiente(pago?.urlPago ?? null); }
      }).catch(() => { if (activo) setError('No pudimos recuperar el pago pendiente.'); })
        .finally(() => { if (activo) setProcesando(false); });
    }
    return () => { activo = false; };
  }, [visible]);

  if (!plan) return null;

  async function confirmar(tokenWs: string) {
    const r = await confirmarPago(cuenta, tokenWs);
    if (r.ok) { setListo(true); setPendiente(null); }
    else { setError(r.motivo); if (!r.reintentable) setPendiente(null); }
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

  async function yaPague() {
    if (!pendiente || procesando) return;
    setProcesando(true);
    try { await confirmar(pendiente); } finally { setProcesando(false); }
  }

  return (
    <Modal visible={visible && enfocado} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          {listo ? (
            <View style={styles.centro}>
              <Ionicons name="checkmark-circle" size={54} color={colors.success} />
              <Text style={styles.titulo}>¡Listo!</Text>
              <Text style={styles.texto}>Tu plan ahora es {plan.nombre}. Los beneficios ya están activos.</Text>
              <TouchableOpacity style={styles.botonCerrar} onPress={onClose}>
                <Text style={styles.botonPrimarioTexto}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.titulo}>Contratar plan {plan.nombre}</Text>
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

              <View style={styles.aviso}>
                <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.avisoTexto}>
                  {pendiente
                    ? 'Completa el pago en Webpay. Al regresar verás el resultado; si cerraste el navegador, toca "Consultar pago".'
                    : 'Completarás el pago en el sitio seguro de Webpay Plus. SportMatch no solicita los datos de tu tarjeta.'}
                </Text>
              </View>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {pendiente && urlPendiente ? <TouchableOpacity disabled={procesando} onPress={() => {
                void WebBrowser.openBrowserAsync(urlPendiente).catch(() => setError('No pudimos abrir Webpay.'));
              }}><Text style={[styles.avisoTexto, { marginTop: 12 }]}>Continuar el pago pendiente en Webpay</Text></TouchableOpacity> : null}
              {pendiente && error ? <TouchableOpacity disabled={procesando} onPress={() => {
                void olvidarPagoPendiente().then(() => {
                  setPendiente(null); setUrlPendiente(null);
                  setError('Antes de iniciar otro intento, verifica si el pago anterior fue confirmado.');
                }).catch(() => setError('No pudimos recuperar el resumen. Inténtalo nuevamente.'));
              }}><Text style={[styles.avisoTexto, { marginTop: 12 }]}>Volver al resumen para iniciar otro intento</Text></TouchableOpacity> : null}

              <View style={styles.acciones}>
                <TouchableOpacity style={styles.botonSecundario} onPress={onClose}>
                  <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonPrimario, procesando && { opacity: 0.6 }]}
                  onPress={pendiente ? yaPague : pagar}
                  disabled={procesando}
                >
                  {procesando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.botonPrimarioTexto}>{pendiente ? 'Consultar pago' : 'Pagar con Webpay'}</Text>
                  )}
                </TouchableOpacity>
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
    fondo: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 20 },
    hoja: { backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18, maxHeight: '90%' },
    centro: { alignItems: 'center', gap: 10, paddingVertical: 10 },
    titulo: { color: c.text, fontSize: 17, fontWeight: '800' },
    precio: { color: c.accent, fontSize: 20, fontWeight: '800', marginTop: 4 },
    resumen: { color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 12 },
    texto: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    lista: { flexGrow: 0, marginBottom: 12 },
    beneficio: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    beneficioTexto: { flex: 1, color: c.text, fontSize: 12, lineHeight: 17 },
    aviso: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.chip, borderRadius: 12, padding: 12 },
    avisoTexto: { flex: 1, color: c.textMuted, fontSize: 11.5, lineHeight: 16 },
    error: { color: c.danger, fontSize: 12, marginTop: 10 },
    acciones: { flexDirection: 'row', gap: 10, marginTop: 14 },
    botonSecundario: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
    botonSecundarioTexto: { color: c.text, fontSize: 13, fontWeight: '700' },
    botonPrimario: { flex: 1.4, backgroundColor: c.primary, borderRadius: 13, paddingVertical: 13, alignItems: 'center', minWidth: 120 },
    // Botón de la pantalla "¡Listo!": sin flex, porque está en una columna y flex le quitaría el alto.
    botonCerrar: { backgroundColor: c.primary, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 40, alignItems: 'center', marginTop: 8 },
    botonPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });
