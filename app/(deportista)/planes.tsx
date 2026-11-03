import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ContratarPlanModal from '../../components/ContratarPlanModal';
import { Aviso, Boton, Chip, EncabezadoPantalla, Tarjeta } from '../../components/ui';
import { PAGOS_REALES } from '../../services/config';
import {
  beneficiosDe,
  cargarPlanes,
  formatearCLP,
  reiniciarPlanes,
  usePlanActual,
  usePlanes,
  type Plan,
} from '../../services/planes';
import { Colors, espacio, tipo, useAppTheme } from '../../theme/ThemeContext';

/** HU-41: consultar el catálogo de planes y beneficios. HU-42: contratar un plan. */
export default function PlanesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const planActual = usePlanActual('deportista');
  const todos = usePlanes();
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Con pagos reales, trae precios y plan vigente desde el backend cada vez que se abre la pantalla.
  useFocusEffect(useCallback(() => {
    if (!PAGOS_REALES) return;
    cargarPlanes('deportista')
      .then(() => setErrorCarga(null))
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'No pudimos cargar los planes.'));
  }, []));

  const planes = todos.filter((p) => p.paraCuenta === 'deportista');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + espacio.m, paddingBottom: insets.bottom + espacio.xxl }]}
    >
      <EncabezadoPantalla
        titulo="Planes y beneficios"
        subtitulo="Elige el plan que se ajuste a cómo entrenas. Puedes cambiarlo cuando quieras."
      />

      {planes.map((p) => {
        const esActual = planActual === p.id;
        const esGratis = p.precioMensual === 0;
        return (
          <Tarjeta key={p.id} resaltada={p.destacado} style={styles.plan}>
            <View style={styles.etiquetas}>
              {esActual ? <Chip texto="Tu plan" tono="exito" icono="checkmark-circle" /> : null}
              {p.destacado && !esActual ? <Chip texto="Recomendado" tono="acento" icono="star-outline" /> : null}
            </View>

            <Text style={styles.nombre}>{p.nombre}</Text>
            <Text style={styles.resumen}>{p.resumen}</Text>

            <View style={styles.precioFila}>
              <Text style={styles.precio}>{esGratis ? '$0' : formatearCLP(p.precioMensual)}</Text>
              <Text style={styles.periodo}>{esGratis ? 'para siempre' : 'al mes'}</Text>
            </View>

            <View style={styles.separador} />

            <View style={styles.beneficios}>
              {beneficiosDe(p.id).map((b) => (
                <View key={b} style={styles.beneficio}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.beneficioTexto}>{b}</Text>
                </View>
              ))}
            </View>

            {!esGratis ? (
              <Boton
                texto={esActual ? 'Es tu plan actual' : `Contratar plan ${p.nombre}`}
                deshabilitado={esActual}
                onPress={() => setElegido(p)}
                style={styles.cta}
              />
            ) : null}
          </Tarjeta>
        );
      })}

      {errorCarga ? <Text accessibilityRole="alert" style={styles.error}>{errorCarga}</Text> : null}

      <Aviso
        texto={
          PAGOS_REALES
            ? 'Los precios están en pesos chilenos (CLP). El pago se hace en el sitio seguro de Webpay Plus.'
            : 'Los precios son referenciales y están en pesos chilenos (CLP). Por ahora el pago es de demostración: no se realiza ningún cobro.'
        }
      />

      {/* DEMO: solo visible mientras los pagos no sean reales */}
      {!PAGOS_REALES ? (
        <TouchableOpacity style={styles.demoLink} onPress={reiniciarPlanes} accessibilityRole="button">
          <Text style={styles.demoLinkTexto}>Demo: volver al plan Gratuito</Text>
        </TouchableOpacity>
      ) : null}

      <ContratarPlanModal visible={elegido !== null} plan={elegido} cuenta="deportista" onClose={() => setElegido(null)} />
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: espacio.xl },
    plan: { marginBottom: espacio.l },
    etiquetas: { flexDirection: 'row', gap: espacio.s, minHeight: 24, marginBottom: espacio.s },
    nombre: { color: c.text, ...tipo.titulo },
    resumen: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, marginTop: espacio.xs },
    precioFila: { flexDirection: 'row', alignItems: 'baseline', gap: espacio.s, marginTop: espacio.l },
    precio: { color: c.text, fontSize: 32, fontWeight: '800' },
    periodo: { color: c.textMuted, ...tipo.cuerpo },
    separador: { height: 1, backgroundColor: c.border, marginVertical: espacio.l },
    beneficios: { gap: espacio.m },
    beneficio: { flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m },
    beneficioTexto: { flex: 1, color: c.text, ...tipo.cuerpo, lineHeight: 19 },
    cta: { marginTop: espacio.xl },
    error: { color: c.danger, ...tipo.cuerpo, marginBottom: espacio.l },
    demoLink: { alignItems: 'center', marginTop: espacio.xl, paddingVertical: espacio.m },
    demoLinkTexto: { color: c.textMuted, ...tipo.etiqueta },
  });