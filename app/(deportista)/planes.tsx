import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CatalogoPlanes from '../../components/CatalogoPlanes';
import ContratarPlanModal from '../../components/ContratarPlanModal';
import { cargarPlanes, nombreDelPlan, planesParaContratar, precioTexto, usePlanActual, usePlanes, type Plan } from '../../services/planes';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

/** HU-39: consultar el catálogo de planes y beneficios. HU-42: contratar un plan. */
export default function PlanesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const planActual = usePlanActual('deportista');
  const planes = usePlanes();
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    cargarPlanes('deportista').then(() => setError(null)).catch((e) => setError(e instanceof Error ? e.message : 'No pudimos cargar los planes.'));
  }, []));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.volver} onPress={() => router.back()} accessibilityLabel="Volver">
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.titulo}>Planes y beneficios</Text>
      <Text style={styles.subtitulo}>Compara los planes y elige el que se ajuste a cómo entrenas.</Text>

      <CatalogoPlanes />

      <View style={styles.aviso}>
        <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
        <Text style={styles.avisoTexto}>
          Los precios son referenciales y están en pesos chilenos (CLP). El pago se hace con Webpay Plus.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {planesParaContratar('deportista', planes).map((p) => {
        const yaLoTienes = planActual === p.id;
        const disponible = p.backendId !== undefined;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.boton, (yaLoTienes || !disponible) && styles.botonInactivo]}
            disabled={yaLoTienes || !disponible}
            accessibilityState={{ disabled: yaLoTienes || !disponible }}
            onPress={() => setElegido(p)}
          >
            <Text style={styles.botonTexto}>
              {yaLoTienes ? `Tu plan actual: ${nombreDelPlan(p.id)}` : disponible ? `Contratar plan ${p.nombre} · ${precioTexto(p)}` : `Plan ${p.nombre} · Disponible pronto`}
            </Text>
          </TouchableOpacity>
        );
      })}

      <ContratarPlanModal visible={elegido !== null} plan={elegido} cuenta="deportista" onClose={() => setElegido(null)} />
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
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
    boton: {
      marginTop: 16, backgroundColor: c.primary, borderRadius: 13,
      paddingVertical: 13, alignItems: 'center',
    },
    botonInactivo: { opacity: 0.45 },
    botonTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
    error: { color: c.danger, fontSize: 12, marginTop: 12, textAlign: 'center' },
  });