import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, Tarjeta } from '../components/ui';
import { getSession, rolDe } from '../services/auth';
import { confirmarPago, type ResultadoPlan, type RetornoPago } from '../services/planes';
import { Colors, espacio, tipo, useAppTheme } from '../theme/ThemeContext';

/**
 * Pantalla de retorno de Webpay (enlace sportmatchapp://pago?...). Lee lo que devuelve Transbank
 * y le pide al backend confirmar el pago: solo un pago APPROVED deja el plan activo.
 */
export default function Pago() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [resultado, setResultado] = useState<ResultadoPlan | null>(null);
  const [intento, setIntento] = useState(0);

  const retorno: RetornoPago = {};
  for (const key of ['token_ws', 'tbk_token', 'tbk_orden_compra', 'tbk_id_sesion'] as const) {
    const value = params[key];
    if (typeof value === 'string') retorno[key] = value;
  }
  const payload = JSON.stringify(retorno);

  useEffect(() => {
    let activo = true;
    if (Platform.OS === 'ios') void WebBrowser.dismissBrowser().catch(() => undefined);

    async function confirmar(): Promise<ResultadoPlan> {
      const datos = JSON.parse(payload) as RetornoPago;
      if (!datos.token_ws && !datos.tbk_token && !datos.tbk_orden_compra) {
        return { ok: false, motivo: 'El enlace de retorno no contiene un pago válido.', reintentable: false };
      }
      const session = await getSession();
      return confirmarPago(session && rolDe(session) === 'club' ? 'club' : 'deportista', datos);
    }

    confirmar()
      .then((r) => { if (activo) setResultado(r); })
      .catch(() => {
        if (activo) setResultado({ ok: false, motivo: 'No pudimos consultar el pago. Puedes reintentar.', reintentable: true });
      });
    return () => { activo = false; };
  }, [payload, intento]);

  async function volver() {
    const session = await getSession();
    router.replace(
      !session ? '/(auth)/login' : rolDe(session) === 'club' ? '/(club)/home' : '/(deportista)/(tabs)/profile',
    );
  }

  const aprobado = resultado?.ok === true;

  return (
    <View style={[styles.container, { paddingTop: insets.top + espacio.xl, paddingBottom: insets.bottom + espacio.xl }]}>
      <Text accessibilityRole="header" style={styles.titulo}>Resultado del pago</Text>

      <Tarjeta style={styles.tarjeta}>
        {!resultado ? (
          <View style={styles.centro}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.texto}>Confirmando tu pago con Webpay…</Text>
          </View>
        ) : (
          <View style={styles.centro}>
            <Ionicons
              name={aprobado ? 'checkmark-circle' : 'alert-circle-outline'}
              size={56}
              color={aprobado ? colors.success : colors.danger}
            />
            <Text accessibilityRole="alert" style={styles.texto}>
              {resultado.ok ? 'Pago aprobado. Tu suscripción está activa.' : resultado.motivo}
            </Text>
          </View>
        )}
      </Tarjeta>

      {resultado && !resultado.ok && resultado.reintentable ? (
        <Boton
          texto="Reintentar confirmación"
          variante="secundario"
          icono="refresh-outline"
          onPress={() => { setResultado(null); setIntento((n) => n + 1); }}
          style={styles.boton}
        />
      ) : null}
      <Boton texto="Volver a SportMatch" onPress={volver} style={styles.boton} />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: espacio.xl, justifyContent: 'center' },
    titulo: { color: c.text, ...tipo.titulo, marginBottom: espacio.xl },
    tarjeta: { marginBottom: espacio.xl },
    centro: { alignItems: 'center', gap: espacio.m, paddingVertical: espacio.l },
    texto: { color: c.text, ...tipo.cuerpo, textAlign: 'center', lineHeight: 20 },
    boton: { marginBottom: espacio.m },
  });