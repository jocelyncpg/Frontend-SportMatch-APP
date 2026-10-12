import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FILAS_COMPARATIVA, PLANES, PLAN_ACTUAL_DEMO, formatearCLP, type PlanId } from '../services/planes';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type Props = {
  /** Plan que se resalta. Por defecto, el marcado como `destacado` en PLANES. */
  destacarId?: PlanId;
  /** Plan actual del usuario. `null` = no mostrar "Tu plan". Por defecto, PLAN_ACTUAL_DEMO. */
  planActual?: PlanId | null;
  /** Texto de la etiqueta del plan destacado. */
  etiquetaDestacado?: string;
};

export default function CatalogoPlanes({
  destacarId,
  planActual = PLAN_ACTUAL_DEMO,
  etiquetaDestacado = 'Popular',
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const idDestacado: PlanId | undefined = destacarId ?? PLANES.find((p) => p.destacado)?.id;

  function celda(valor: string | boolean) {
    if (valor === true) return <Ionicons name="checkmark-circle" size={18} color={colors.success} />;
    if (valor === false) return <Ionicons name="remove" size={18} color={colors.textMuted} />;
    return <Text style={styles.celdaTexto}>{valor}</Text>;
  }

  return (
    <View style={styles.tabla}>
      {/* Cabecera: nombre y precio de cada plan */}
      <View style={styles.fila}>
        <View style={styles.colEtiqueta} />
        {PLANES.map((p) => {
          const esActual = p.id === planActual;
          const esDestacado = p.id === idDestacado;
          return (
            <View key={p.id} style={[styles.colPlan, esDestacado && styles.colDestacada, styles.cabeceraPlan]}>
              {esActual || esDestacado ? (
                <View style={[styles.tag, esActual && styles.tagActual]}>
                  <Text style={[styles.tagTexto, esActual && styles.tagTextoActual]}>
                    {esActual ? 'Tu plan' : etiquetaDestacado}
                  </Text>
                </View>
              ) : (
                <View style={styles.tagVacio} />
              )}
              <Text style={styles.planNombre}>{p.nombre}</Text>
              <Text style={styles.planPrecio}>{p.precioMensual === 0 ? '$0' : formatearCLP(p.precioMensual)}</Text>
              <Text style={styles.planPeriodo}>{p.precioMensual === 0 ? 'siempre' : 'al mes'}</Text>
            </View>
          );
        })}
      </View>

      {/* Características */}
      {FILAS_COMPARATIVA.map((f) => (
        <View key={f.etiqueta} style={[styles.fila, styles.filaBorde]}>
          <View style={styles.colEtiqueta}>
            <Text style={styles.etiqueta}>{f.etiqueta}</Text>
          </View>
          {PLANES.map((p) => (
            <View key={p.id} style={[styles.colPlan, p.id === idDestacado && styles.colDestacada, styles.celda]}>
              {celda(f[p.id as PlanId])}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    tabla: { width: '100%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden' },
    fila: { flexDirection: 'row', alignItems: 'stretch' },
    filaBorde: { borderTopWidth: 1, borderTopColor: c.border },
    colEtiqueta: { flex: 1.5, paddingVertical: 12, paddingHorizontal: 12, justifyContent: 'center' },
    colPlan: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    colDestacada: { backgroundColor: c.chip },
    cabeceraPlan: { paddingVertical: 12, paddingHorizontal: 4 },
    etiqueta: { color: c.text, fontSize: 11.5, lineHeight: 15 },
    celda: { paddingVertical: 12, paddingHorizontal: 4 },
    celdaTexto: { color: c.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },

    tag: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 6 },
    tagActual: { backgroundColor: c.successBg },
    tagTexto: { color: '#fff', fontSize: 9, fontWeight: '700' },
    tagTextoActual: { color: c.success },
    tagVacio: { height: 20 },
    planNombre: { color: c.text, fontSize: 13, fontWeight: '700' },
    planPrecio: { color: c.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
    planPeriodo: { color: c.textMuted, fontSize: 9.5, marginTop: 1 },
  });