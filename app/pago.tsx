import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { confirmarPago, leerRetornoWebpay, type RetornoWebpay } from '../services/planes';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type Estado = { tipo: 'procesando' } | { tipo: 'aceptado' } | { tipo: 'error'; motivo: string; reintentar: boolean };

/** Regreso de Webpay (sportmatchapp://pago o exp://…/--/pago): confirma el pago y muestra el resultado. */
export default function PagoScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ token_ws?: string; tbk_token?: string; tbk_orden_compra?: string; tbk_id_sesion?: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: 'procesando' });
  const retorno = useRef<RetornoWebpay | null>(null);
  const procesado = useRef(false);

  useEffect(() => {
    const query = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) if (typeof valor === 'string') query.set(clave, valor);
    const payload = leerRetornoWebpay(`sportmatchapp://pago?${query.toString()}`);
    retorno.current = payload;
    if (!payload) {
      setEstado({ tipo: 'error', motivo: 'No encontramos los datos del pago. Revisa tu plan en Planes.', reintentar: false });
      return;
    }
    if (procesado.current) return;
    procesado.current = true;
    void confirmar(payload);
  }, [params]);

  async function confirmar(payload: RetornoWebpay) {
    setEstado({ tipo: 'procesando' });
    const r = await confirmarPago('deportista', payload);
    if (r.ok) setEstado({ tipo: 'aceptado' });
    else setEstado({ tipo: 'error', motivo: r.motivo, reintentar: r.reintentar });
  }

  const volver = () => router.replace('/(deportista)/planes');

  return (
    <View style={styles.container}>
      {estado.tipo === 'procesando' ? (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.titulo}>Confirmando tu pago…</Text>
        </>
      ) : null}

      {estado.tipo === 'aceptado' ? (
        <>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <Text style={styles.titulo}>Pago aceptado</Text>
          <Text style={styles.texto}>Tu plan ya está activo.</Text>
          <TouchableOpacity style={styles.boton} onPress={volver}>
            <Text style={styles.botonTexto}>Ver mis planes</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {estado.tipo === 'error' ? (
        <>
          <Ionicons name="close-circle" size={72} color={colors.danger} />
          <Text style={styles.titulo}>Pago rechazado</Text>
          <Text style={styles.texto}>{estado.motivo}</Text>
          {estado.reintentar && retorno.current ? (
            <TouchableOpacity style={styles.boton} onPress={() => retorno.current && void confirmar(retorno.current)}>
              <Text style={styles.botonTexto}>Reintentar confirmación</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.botonSecundario} onPress={volver}>
            <Text style={styles.botonSecundarioTexto}>Volver a planes</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  titulo: { color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  texto: { color: c.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  boton: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  botonTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
  botonSecundario: { paddingVertical: 12 },
  botonSecundarioTexto: { color: c.accent, fontSize: 15, fontWeight: '700' },
});
