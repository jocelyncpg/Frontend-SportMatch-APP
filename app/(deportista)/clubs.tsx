import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizar } from '../../services/comunas';
import { useConvocatoriasAbiertas } from '../../services/consultas';
import { usePerfilesClub } from '../../services/perfilClub';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../theme/ThemeContext';

type ClubItem = { id: string; name: string; sport: string; comuna: string; miembros?: number; colorFrom: string };

const CLUBES: ClubItem[] = [
  { id: '1', name: 'Club Atlético Ñuñoa', sport: 'Atletismo', comuna: 'Ñuñoa', miembros: 84, colorFrom: '#7C3AED' },
  { id: '2', name: 'Fútbol Amateur Maipú', sport: 'Fútbol', comuna: 'Maipú', miembros: 132, colorFrom: '#1F2A5C' },
  { id: '3', name: 'Ciclistas La Florida', sport: 'Ciclismo', comuna: 'La Florida', miembros: 56, colorFrom: '#22C55E' },
];

// Inicial del club para la insignia: la primera letra del nombre.
const inicialDe = (nombre: string) => (nombre.trim()[0] ?? '?').toUpperCase();

export default function ClubsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [busqueda, setBusqueda] = useState('');

  // Clubes que publicaron su convocatoria desde su panel (HU-51) o que ya completaron "Mi club" (HU-31): se suman a los de ejemplo.
  const abiertas = useConvocatoriasAbiertas();
  const perfiles = usePerfilesClub();
  const clubes = useMemo<ClubItem[]>(() => {
    const lista: ClubItem[] = [...CLUBES];
    for (const c of abiertas) {
      if (!lista.some((x) => x.id === c.clubId)) {
        lista.push({ id: c.clubId, name: c.clubNombre, sport: c.deporte ?? 'Club deportivo', comuna: c.comuna ?? '', colorFrom: c.colorFrom });
      }
    }
    for (const [id, p] of Object.entries(perfiles)) {
      if (!lista.some((x) => x.id === id)) {
        lista.push({ id, name: p.nombre, sport: p.deportes[0] ?? 'Club deportivo', comuna: p.zona, colorFrom: '#7C3AED' });
      }
    }
    // Lo que el club edita en "Mi club" manda sobre el nombre y la comuna con que se registró.
    return lista.map((x) => {
      const p = perfiles[x.id];
      return p ? { ...x, name: p.nombre || x.name, comuna: p.zona || x.comuna } : x;
    });
  }, [abiertas, perfiles]);

  const conConvocatoria = useMemo(() => new Set(abiertas.map((c) => c.clubId)), [abiertas]);

  // Se busca por nombre, deporte o comuna, sin distinguir tildes ni mayúsculas.
  const consulta = normalizar(busqueda.trim());
  const visibles = consulta
    ? clubes.filter((c) => normalizar(`${c.name} ${c.sport} ${c.comuna}`).includes(consulta))
    : clubes;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Directorio de clubes</Text>
      </View>

      <View style={styles.buscador}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.buscadorInput}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre, deporte o comuna"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
        />
        {busqueda.length > 0 ? (
          <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Borrar búsqueda">
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.contador}>
        {visibles.length} {visibles.length === 1 ? 'club' : 'clubes'}
      </Text>

      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {visibles.map((club) => (
          <TouchableOpacity
            key={club.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/(deportista)/club/[id]', params: { id: club.id, name: club.name, sport: club.sport, comuna: club.comuna, colorFrom: club.colorFrom } })}
            activeOpacity={0.7}
          >
            <View style={styles.insignia}>
              <Text style={styles.insigniaTexto} allowFontScaling={false}>{inicialDe(club.name)}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={1}>{club.name}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>{[club.sport, club.comuna].filter(Boolean).join(' · ')}</Text>
              <View style={styles.pie}>
                {club.miembros !== undefined ? <Text style={styles.cardMiembros}>{club.miembros} miembros</Text> : null}
                {conConvocatoria.has(club.id) ? (
                  <View style={styles.convocatoria}>
                    <Ionicons name="megaphone-outline" size={12} color={colors.success} />
                    <Text style={styles.convocatoriaTexto}>Convocatoria abierta</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {visibles.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTexto}>{`No encontramos clubes con “${busqueda.trim()}”.`}</Text>
            <TouchableOpacity style={styles.vacioBoton} onPress={() => setBusqueda('')}>
              <Text style={styles.vacioBotonTexto}>Borrar búsqueda</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: espacio.xl, marginBottom: espacio.l },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    title: { ...tipo.seccion, color: c.text },

    buscador: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginHorizontal: espacio.xl, marginBottom: espacio.m,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
      paddingHorizontal: 14, height: 46,
    },
    buscadorInput: { ...tipo.cuerpo, flex: 1, color: c.text, paddingVertical: 0 },
    contador: { ...tipo.dato, color: c.textMuted, paddingHorizontal: espacio.xl, marginBottom: espacio.s },

    list: { paddingHorizontal: espacio.xl, paddingBottom: 30 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, borderRadius: radio.tarjeta, padding: espacio.m, marginBottom: 10,
    },
    insignia: { width: 48, height: 48, borderRadius: radio.control, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    insigniaTexto: { color: c.accent, fontSize: 20, fontWeight: '700', textAlign: 'center' },
    cardInfo: { flex: 1 },
    cardName: { ...tipo.cuerpoFuerte, color: c.text },
    cardMeta: { ...tipo.dato, color: c.textMuted, marginTop: 2 },
    pie: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: espacio.m, rowGap: 2, marginTop: 4 },
    cardMiembros: { ...tipo.etiqueta, color: c.textMuted },
    convocatoria: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    convocatoriaTexto: { ...tipo.etiqueta, color: c.success },

    vacio: { alignItems: 'center', marginTop: 40, gap: espacio.m },
    vacioTexto: { ...tipo.dato, color: c.textMuted, textAlign: 'center' },
    vacioBoton: { borderWidth: 1, borderColor: c.border, borderRadius: radio.control, paddingHorizontal: espacio.l, paddingVertical: 9 },
    vacioBotonTexto: { ...tipo.etiqueta, color: c.accent },
  });