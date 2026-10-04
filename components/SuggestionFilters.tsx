import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { getSession, updateUbicacion } from '../services/auth';
import { nombreDeporte } from '../services/deportes';
import { solicitarUbicacion } from '../services/location';
import { aplicarFiltros, FiltrosSugerencias, useMatches } from '../services/matchStore';
import { Colors, useAppTheme } from '../theme/ThemeContext';

const ALL: FiltrosSugerencias = { radioKm: null, deporte: 'todos', nivelMin: 1, nivelMax: 5, nivelSimilar: false };

export default function SuggestionFilters() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { filtros, ubicacionDisponible, misDeportes, cargando } = useMatches();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<FiltrosSugerencias>(ALL);
  const [locating, setLocating] = useState(false);
  const active = filtros ?? ALL;
  const sports = [...new Set([...misDeportes, 'running', 'futbol', 'ciclismo', 'yoga', 'tennis', 'natacion', 'trekking', 'padel', 'basquetbol', 'voleibol'])];
  const resumen = `${active.radioKm ? `Hasta ${active.radioKm} km` : 'Sin límite de distancia'} · ${active.deporte === 'mis_deportes' ? 'Mis deportes' : active.deporte === 'todos' ? 'Todos los deportes' : nombreDeporte(active.deporte)} · Niveles ${active.nivelMin}–${active.nivelMax}${active.nivelSimilar ? ' · similares al mío (±1)' : ''}`;

  async function activarUbicacion() {
    setLocating(true);
    try {
      const session = await getSession();
      if (!session) { router.replace('/(auth)/login'); return; }
      const result = await solicitarUbicacion();
      if (!result.ok || !result.ubicacion) {
        Alert.alert('Ubicación no disponible', 'Permite el acceso a la ubicación para buscar a 5 o 10 km. Puedes seguir buscando sin límite de distancia.');
        return;
      }
      // Do not apply a location captured for a different signed-in account.
      if ((await getSession())?.id !== session.id) return;
      await updateUbicacion(session.id, { ...result.ubicacion, comuna: result.ubicacion.comuna ?? 'Ubicación detectada' });
      setDraft((previous) => ({ ...previous, radioKm: 10 }));
      await aplicarFiltros({ ...active, radioKm: 10 });
    } catch (e) {
      Alert.alert('No se pudo actualizar la ubicación', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally { setLocating(false); }
  }

  function chip(label: string, selected: boolean, onPress: () => void, disabled = false) {
    return <TouchableOpacity key={label} style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
      accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.selectedText]}>{label}</Text>
    </TouchableOpacity>;
  }

  return <View style={styles.container}>
    <TouchableOpacity style={styles.open} onPress={() => { setDraft(active); setVisible(true); }} accessibilityLabel="Filtrar deportistas">
      <Ionicons name="options-outline" size={20} color={colors.accent} />
      <View style={styles.summary}><Text style={styles.title}>Filtrar deportistas</Text><Text style={styles.help}>{resumen}</Text></View>
    </TouchableOpacity>
    {!ubicacionDisponible && <TouchableOpacity onPress={activarUbicacion} disabled={locating}>
      <Text style={styles.location}>{locating ? 'Obteniendo ubicación...' : 'Activa tu ubicación para encontrar deportistas a 5 o 10 km'}</Text>
    </TouchableOpacity>}
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}><View style={styles.modal}>
        <View style={styles.row}><Text style={styles.heading}>Tus recomendaciones</Text>
          <TouchableOpacity onPress={() => setVisible(false)} accessibilityLabel="Cerrar filtros" style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.fields}>
          <Text style={styles.title}>Distancia desde tu ubicación guardada</Text>
          <View style={styles.wrap}>
            {([5, 10, null] as const).map((radius) => chip(radius ? `${radius} km` : 'Sin límite', draft.radioKm === radius,
              () => setDraft({ ...draft, radioKm: radius }), radius != null && !ubicacionDisponible))}
          </View>
          <Text style={styles.help}>Distancia aproximada en línea recta. Con un radio activo solo aparecen deportistas con ubicación.</Text>
          <TouchableOpacity onPress={activarUbicacion} disabled={locating}>
            <Text style={styles.location}>{locating ? 'Obteniendo ubicación...' : ubicacionDisponible ? 'Actualizar mi ubicación' : 'Activar mi ubicación'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Deporte</Text>
          <View style={styles.wrap}>
            {chip('Mis deportes', draft.deporte === 'mis_deportes', () => setDraft({ ...draft, deporte: 'mis_deportes', nivelSimilar: true }), !misDeportes.length)}
            {chip('Todos', draft.deporte === 'todos', () => setDraft({ ...draft, deporte: 'todos', nivelSimilar: false }))}
            {sports.map((sport) => chip(nombreDeporte(sport), draft.deporte === sport, () => setDraft({ ...draft, deporte: sport, nivelSimilar: false })))}
          </View>
          {!misDeportes.length && <TouchableOpacity onPress={() => { setVisible(false); router.push('/(deportista)/(tabs)/profile'); }}><Text style={styles.location}>Agrega tus deportes y niveles en el perfil</Text></TouchableOpacity>}
          <Text style={styles.title}>Nivel del otro deportista</Text>
          <Text style={styles.help}>1–2 principiante · 3 intermedio · 4–5 avanzado. El rango se aplica al deporte seleccionado.</Text>
          <Text style={styles.help}>Desde {draft.nivelMin}</Text>
          <View style={styles.wrap}>{[1, 2, 3, 4, 5].map((level) => chip(String(level), draft.nivelMin === level,
            () => setDraft({ ...draft, nivelMin: level, nivelMax: Math.max(level, draft.nivelMax) })))}</View>
          <Text style={styles.help}>Hasta {draft.nivelMax}</Text>
          <View style={styles.wrap}>{[1, 2, 3, 4, 5].map((level) => chip(String(level), draft.nivelMax === level,
            () => setDraft({ ...draft, nivelMax: level, nivelMin: Math.min(level, draft.nivelMin) })))}</View>
          <View style={styles.row}><Text style={[styles.help, styles.summary]}>Solo deportes en común con nivel similar al mío (±1)</Text>
            <Switch value={draft.nivelSimilar} disabled={!misDeportes.length} onValueChange={(value) => setDraft({ ...draft, nivelSimilar: value })} accessibilityLabel="Solo nivel similar al mío" />
          </View>
          <Text style={styles.help}>Los resultados se ordenan por cercanía. Sin ubicación se prioriza la coincidencia de deportes y niveles.</Text>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.reset} disabled={locating} onPress={() => setDraft(ALL)}><Text style={styles.location}>Quitar filtros</Text></TouchableOpacity>
          <TouchableOpacity style={styles.apply} disabled={locating || cargando} onPress={() => { setVisible(false); void aplicarFiltros(draft); }}><Text style={styles.selectedText}>Aplicar filtros</Text></TouchableOpacity>
        </View>
      </View></View>
    </Modal>
  </View>;
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { marginBottom: 12 }, open: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
  summary: { flex: 1 }, title: { color: c.text, fontWeight: '700', fontSize: 14 }, help: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  location: { color: c.accent, fontSize: 12, lineHeight: 18, paddingVertical: 8 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: c.bg, borderRadius: 20, padding: 18, width: '100%', maxWidth: 560, maxHeight: '90%' }, heading: { color: c.text, fontSize: 19, fontWeight: '700', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, close: { padding: 8 }, fields: { gap: 12, paddingVertical: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }, selected: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.text, fontSize: 13 }, selectedText: { color: '#fff', fontWeight: '600', fontSize: 13 }, disabled: { opacity: 0.4 }, footer: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingTop: 12 },
  reset: { flex: 1 }, apply: { backgroundColor: c.primary, borderRadius: 12, padding: 14 },
});
