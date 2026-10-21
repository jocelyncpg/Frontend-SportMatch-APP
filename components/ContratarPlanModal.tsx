import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { beneficiosDe, confirmarPago, iniciarPago, precioTexto, type CuentaPlan, type Plan } from '../services/planes';
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  /** token_ws del pago en curso: si el navegador se cerró antes de tiempo, se puede volver a confirmar. */
  const [pendiente, setPendiente] = useState<string | null>(null);

  // Cada vez que se abre, parte desde el resumen.
  useEffect(() => {
    if (visible) { setListo(false); setError(null); setPendiente(null); setProcesando(false); }
  }, [visible]);

  if (!plan) return null;

  async function confirmar(tokenWs: string) {
    const r = await confirmarPago(cuenta, tokenWs);
    if (r.ok) { setListo(true); setPendiente(null); }
    else { setError(r.motivo); setPendiente(null); }
  }

  async function pagar() {
    if (!plan || procesando) return;
    setError(null);
    setProcesando(true);
    try {
      const { tokenWs, urlPago } = await iniciarPago(cuenta, plan);
      setPendiente(tokenWs);
      // Vuelve cuando la persona cierra el navegador (en Android, apenas se abre).
      await WebBrowser.openBrowserAsync(urlPago);
      if (Platform.OS === 'ios') await confirmar(tokenWs);
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <View style={styles.hoja}>
          {listo ? (
            <View style={styles.centro}>
              <Ionicons name="checkmark-circle" size={54} color={colors.success} />
              <Text style={styles.titulo}>¡Listo!</Text>
              <Text style={styles.texto}>Tu plan ahora es {plan.nombre}. Los beneficios ya están activos.</Text>
              <TouchableOpacity style={styles.botonPrimario} onPress={onClose}>
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
                    ? 'Completa el pago en Webpay y luego toca "Ya pagué" para activar tu plan.'
                    : 'El pago se hace en Webpay Plus. En el ambiente de desarrollo es simulado: no se realiza ningún cobro.'}
                </Text>
              </View>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

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
                    <Text style={styles.botonPrimarioTexto}>{pendiente ? 'Ya pagué' : 'Ir a pagar'}</Text>
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
    botonPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });