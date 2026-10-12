import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CatalogoPlanes from '../../components/CatalogoPlanes';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

/** HU-39 (versión club): consultar el catálogo de planes y beneficios. */
export default function PlanesClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.volver} onPress={() => router.back()} accessibilityLabel="Volver">
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.titulo}>Planes y beneficios</Text>
      <Text style={styles.subtitulo}>
        Revisa lo que incluye cada plan. El plan Club suma el panel web, las convocatorias y la gestión de postulantes.
      </Text>

      <CatalogoPlanes destacarId="club" planActual={null} etiquetaDestacado="Para clubes" />

      <View style={styles.aviso}>
        <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
        <Text style={styles.avisoTexto}>
          Los precios son referenciales y están en pesos chilenos (CLP). Próximamente podrás contratar un plan desde aquí.
        </Text>
      </View>

      <TouchableOpacity style={styles.boton} disabled accessibilityState={{ disabled: true }}>
        <Text style={styles.botonTexto}>Contratar plan Club · Disponible pronto</Text>
      </TouchableOpacity>
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
      paddingVertical: 13, alignItems: 'center', opacity: 0.45,
    },
    botonTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });