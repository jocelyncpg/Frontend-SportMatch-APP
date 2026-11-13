import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PAGOS_REALES } from '../services/config';
import {
    beneficiosDe,
    cargarPlanes,
    formatearCLP,
    reiniciarPlanes,
    usePlanActual,
    usePlanes,
    type CuentaPlan,
    type Plan,
    type PlanId,
} from '../services/planes';
import { Colors, espacio, tipo, useAppTheme } from '../theme/ThemeContext';
import ContratarPlanModal from './ContratarPlanModal';
import { Aviso, Boton, Chip, EncabezadoPantalla, Tarjeta } from './ui';

type Props = { cuenta: CuentaPlan };

/**
 * Catálogo de planes (HU-41) y contratación (HU-42). Es la misma pantalla para el deportista y para el club:
 * se ven los tres planes y solo se puede contratar el que corresponde a la cuenta.
 */
export default function VistaPlanes({ cuenta }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const planActual = usePlanActual(cuenta);
  const planes = usePlanes();
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Plan que se recomienda según el tipo de cuenta.
  const recomendado: PlanId = cuenta === 'club' ? 'club' : 'pro';

  // Con pagos reales, trae precios y plan vigente desde el backend cada vez que se abre la pantalla.
  useFocusEffect(useCallback(() => {
    if (!PAGOS_REALES) return;
    cargarPlanes(cuenta)
      .then(() => setErrorCarga(null))
      .catch((e) => setErrorCarga(e instanceof Error ? e.message : 'No pudimos cargar los planes.'));
  }, [cuenta]));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + espacio.m, paddingBottom: insets.bottom + espacio.xxl }]}
    >
      <EncabezadoPantalla
        titulo="Planes y beneficios"
        subtitulo={
          cuenta === 'club'
            ? 'El plan Club suma el panel web, las convocatorias y la gestión de postulantes.'
            : 'Elige el plan que se ajuste a cómo entrenas. Puedes cambiarlo cuando quieras.'
        }
      />

      {planes.map((p) => {
        const esActual = planActual === p.id;
        const esGratis = p.precioMensual === 0;
        const esDeOtraCuenta = p.paraCuenta !== cuenta;
        const esRecomendado = p.id === recomendado;
        return (
          <Tarjeta key={p.id} resaltada={esRecomendado} style={styles.plan}>
            <View style={styles.etiquetas}>
              {esActual ? <Chip texto="Tu plan" tono="exito" icono="checkmark-circle" /> : null}
              {!esActual && esRecomendado ? <Chip texto="Recomendado" tono="acento" icono="star-outline" /> : null}
              {!esActual && esDeOtraCuenta ? (
                <Chip texto={p.paraCuenta === 'club' ? 'Para clubes' : 'Para deportistas'} icono="people-outline" />
              ) : null}
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

            {!esGratis && !esDeOtraCuenta ? (
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
          <Text style={styles.demoLinkTexto}>
            {cuenta === 'club' ? 'Demo: quitar el plan contratado' : 'Demo: volver al plan Gratuito'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <ContratarPlanModal visible={elegido !== null} plan={elegido} cuenta={cuenta} onClose={() => setElegido(null)} />
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