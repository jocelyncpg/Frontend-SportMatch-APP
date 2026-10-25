import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fechaCorta, useConvocatoriasAbiertas, type Convocatoria } from '../../services/consultas';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

/** Convocatorias abiertas de todos los clubes. Al tocar una se abre el perfil del club con el detalle y el botón de postular. */
export default function ConvocatoriasScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const abiertas = useConvocatoriasAbiertas();
  const [deporte, setDeporte] = useState<string>('');

  // Solo se ofrecen los deportes que hoy tienen alguna convocatoria abierta.
  const deportes = useMemo(
    () => Array.from(new Set(abiertas.map((c) => c.deporte).filter((d): d is string => !!d))).sort((a, b) => a.localeCompare(b)),
    [abiertas],
  );
  const lista = useMemo(
    () => abiertas.filter((c) => !deporte || c.deporte === deporte),
    [abiertas, deporte],
  );

  function abrir(c: Convocatoria) {
    router.push({
      pathname: '/(deportista)/club/[id]',
      params: { id: c.clubId, name: c.clubNombre, sport: c.deporte ?? '', comuna: c.comuna ?? '', colorFrom: c.colorFrom },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Convocatorias abiertas</Text>
          <Text style={styles.subtitle}>
            {lista.length} {lista.length === 1 ? 'convocatoria' : 'convocatorias'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(deportista)/clubs')} accessibilityLabel="Ver el directorio de clubes">
          <Text style={styles.link}>Ver clubes</Text>
        </TouchableOpacity>
      </View>

      {deportes.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtros} contentContainerStyle={styles.filtrosFila}>
          <Chip activo={deporte === ''} onPress={() => setDeporte('')} styles={styles}>Todos</Chip>
          {deportes.map((d) => (
            <Chip key={d} activo={deporte === d} onPress={() => setDeporte(d)} styles={styles}>{d}</Chip>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {lista.length === 0 ? (
          <Text style={styles.vacio}>No hay convocatorias abiertas con este filtro.</Text>
        ) : null}
        {lista.map((c) => (
          <TouchableOpacity key={c.clubId} style={styles.card} onPress={() => abrir(c)} activeOpacity={0.85} accessibilityLabel={`Ver convocatoria de ${c.clubNombre}`}>
            <View style={styles.cardTop}>
              <View style={[styles.avatar, { backgroundColor: c.colorFrom }]}>
                <Ionicons name="shield" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.club} numberOfLines={1}>{c.clubNombre}</Text>
                <Text style={styles.comuna} numberOfLines={1}>{c.comuna ?? ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>

            <Text style={styles.titulo}>{c.titulo}</Text>
            <View style={styles.datos}>
              {c.deporte ? <Text style={styles.dato}>{c.deporte}</Text> : null}
              {c.categoria ? <Text style={styles.dato}>{c.categoria}</Text> : null}
              {c.fecha ? <Text style={styles.dato}>Prueba: {fechaCorta(c.fecha)}</Text> : null}
              {c.cupos !== undefined ? <Text style={styles.dato}>{c.cupos} {c.cupos === 1 ? 'cupo' : 'cupos'}</Text> : null}
            </View>
            {c.requisitos ? <Text style={styles.requisitos} numberOfLines={2}>Requisitos: {c.requisitos}</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({ activo, onPress, children, styles }: { activo: boolean; onPress: () => void; children: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <TouchableOpacity
      style={[styles.chip, activo && styles.chipActivo]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
    >
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{children}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60 },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 16 },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 17, fontWeight: '700' },
    subtitle: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    link: { color: c.accent, fontSize: 12, fontWeight: '700' },
    filtros: { flexGrow: 0, marginBottom: 14 },
    filtrosFila: { paddingHorizontal: 20, gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipTexto: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    chipTextoActivo: { color: '#fff' },
    list: { paddingHorizontal: 20, paddingBottom: 30 },
    vacio: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 30 },
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14, marginBottom: 12 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatar: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    club: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    comuna: { color: c.textMuted, fontSize: 10.5, marginTop: 1 },
    titulo: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    datos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    dato: { color: c.accent, backgroundColor: c.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
    requisitos: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 8 },
  });