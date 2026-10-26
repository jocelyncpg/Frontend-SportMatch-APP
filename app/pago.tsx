import { useLocalSearchParams, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { getSession } from '../services/auth';
import { confirmarPago, type ResultadoPlan, type RetornoPago } from '../services/planes';
import { useAppTheme } from '../theme/ThemeContext';

export default function Pago() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const { colors } = useAppTheme();
  const [resultado, setResultado] = useState<ResultadoPlan | null>(null);
  const [intento, setIntento] = useState(0);
  const retorno: RetornoPago = {};
  for (const key of ['token_ws', 'tbk_token', 'tbk_orden_compra', 'tbk_id_sesion'] as const) {
    const value = params[key];
    if (typeof value === 'string') retorno[key] = value;
  }
  const payload = JSON.stringify(retorno);
  useEffect(() => {
    let active = true;
    if (Platform.OS === 'ios') void WebBrowser.dismissBrowser().catch(() => undefined);
    async function confirmar() {
      const datos = JSON.parse(payload) as RetornoPago;
      if (!datos.token_ws && !datos.tbk_token && !datos.tbk_orden_compra) {
        return { ok: false, motivo: 'El enlace de retorno no contiene un pago válido.', reintentable: false } as const;
      }
      const session = await getSession();
      return confirmarPago(session?.rol === 'club_admin' ? 'club' : 'deportista', datos);
    }
    void confirmar().then((r) => { if (active) setResultado(r); }).catch(() => {
      if (active) setResultado({ ok: false, motivo: 'No pudimos consultar el pago. Puedes reintentar.', reintentable: true });
    });
    return () => { active = false; };
  }, [payload, intento]);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: '700' }}>Resultado del pago</Text>
      {!resultado ? <ActivityIndicator color={colors.accent} /> : <Text accessibilityRole="alert" style={{ color: colors.text }}>
        {resultado.ok ? 'Pago aprobado. Tu suscripción está activa.' : resultado.motivo}
      </Text>}
      {resultado && !resultado.ok && resultado.reintentable ? <Pressable onPress={() => { setResultado(null); setIntento((n) => n + 1); }}>
        <Text style={{ color: colors.accent, padding: 12 }}>Reintentar confirmación</Text>
      </Pressable> : null}
      <Pressable onPress={async () => {
        const session = await getSession();
        router.replace(session?.rol === 'club_admin' ? '/(club)/home' : session ? '/(deportista)/(tabs)/profile' : '/(auth)/login');
      }}><Text style={{ color: colors.accent, padding: 12 }}>Volver a SportMatch</Text></Pressable>
    </View>
  );
}
