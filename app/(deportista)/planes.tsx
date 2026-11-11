import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, Chip, EncabezadoPantalla, Tarjeta } from '../../components/ui';
import ContratarPlanModal from '../../components/ContratarPlanModal';
import { planDeParametro } from '../../services/renovarPlan';
import { textoUso, useUsoPlan } from '../../services/usoPlan';
import { beneficiosDe, cargarPlanes, formatearCLP, usePlanActual, usePlanes, type Plan } from '../../services/planes';
import { Colors, useAppTheme, espacio, tipo } from '../../theme/ThemeContext';

const RECURSOS_USO = ['solicitudes_match', 'postulaciones_actividades', 'postulaciones_convocatorias', 'actividades_organizadas'] as const;

/** HU-39: consultar el catálogo de planes y beneficios. HU-42: contratar un plan. */
export default function PlanesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const planActual = usePlanActual('deportista');
  const planes = usePlanes();
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [renovar, setRenovar] = useState(false);
  // HU-54: "Te quedan X de N hoy" de cada acción limitada del plan gratuito.
  const { uso } = useUsoPlan(RECURSOS_USO);
  const usoTextos = uso.map((u) => ({ recurso: u.recurso, texto: textoUso(u) })).filter((u) => u.texto);
  // HU-55: /pago?plan=<id> (aviso de vencimiento) llega aquí con ?plan= y abre directo el pago de ese plan.
  const pedido = planDeParametro(useLocalSearchParams<{ plan?: string }>().plan);
  const atendido = useRef<string | null>(null);

  useFocusEffect(useCallback(() => {
    cargarPlanes('deportista').then(() => { setError(null); setCargado(true); }).catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar los planes.'));
  }, []));

  useEffect(() => {
    if (!pedido || !cargado || atendido.current === pedido) return;
    atendido.current = pedido;
    const plan = planes.find((p) => p.backendId === Number(pedido) && p.paraCuenta === 'deportista');
    if (!plan) {
      setError('El plan de tu suscripción ya no está disponible. Elige uno de los planes vigentes.');
      return;
    }
    setRenovar(planActual === plan.id);
    setElegido(plan);
  }, [pedido, cargado, planes, planActual]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + espacio.m, paddingBottom: insets.bottom + espacio.xxl }]}>
      <EncabezadoPantalla titulo="Planes y beneficios" subtitulo="Elige el plan que se ajuste a cómo entrenas. Puedes cambiarlo cuando quieras." />

      {usoTextos.length ? (
        <View style={styles.uso} accessibilityLabel="Uso de tu plan">
          <Text style={styles.usoTitulo}>Tu uso del plan gratuito</Text>
          {usoTextos.map((u) => <Text key={u.recurso} style={styles.usoTexto}>{u.texto}</Text>)}
        </View>
      ) : null}

      {planes.map((p) => {
        const esActual = planActual === p.id;
        const esGratis = p.precioMensual === 0;
        const disponible = p.backendId !== undefined && p.paraCuenta === 'deportista';
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
              {beneficiosDe(p.id).map((b) => <View key={b} style={styles.beneficio}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.beneficioTexto}>{b}</Text>
              </View>)}
            </View>
            {!esGratis ? <Boton texto={esActual ? 'Es tu plan actual' : p.paraCuenta === 'club' ? 'Para cuentas de club' : disponible ? 'Contratar plan ' + p.nombre : 'Disponible pronto'}
              deshabilitado={esActual || !disponible} onPress={() => { setRenovar(false); setElegido(p); }} style={styles.cta} /> : null}
          </Tarjeta>
        );
      })}
      <Aviso texto="Los precios están en pesos chilenos (CLP). El pago se hace en el sitio seguro de Webpay Plus." />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ContratarPlanModal
        visible={elegido !== null} plan={elegido} cuenta="deportista" renovar={renovar}
        onClose={() => { setElegido(null); setRenovar(false); }}
      />
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
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

    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: espacio.xl },
    volver: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    titulo: { color: c.text, fontSize: 20, fontWeight: '800' },
    subtitulo: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 18 },
    aviso: {
      flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16,
      backgroundColor: c.chip, borderRadius: 12, padding: 12,
    },
    avisoTexto: { flex: 1, color: c.textMuted, fontSize: 11.5, lineHeight: 16 },
    uso: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, marginBottom: 16, gap: 4 },
    usoTitulo: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
    usoTexto: { color: c.textMuted, fontSize: 12.5, lineHeight: 18 },
    boton: {
      marginTop: 16, backgroundColor: c.primary, borderRadius: 13,
      paddingVertical: 13, alignItems: 'center',
    },
    botonInactivo: { opacity: 0.45 },
    botonTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
    error: { color: c.danger, ...tipo.cuerpo, marginBottom: espacio.l },
  });
