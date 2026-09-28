import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const CLUBES = [
  { id: '1', name: 'Club Atlético Ñuñoa', sport: 'Atletismo', comuna: 'Ñuñoa', miembros: 84, colorFrom: '#7C3AED' },
  { id: '2', name: 'Fútbol Amateur Maipú', sport: 'Fútbol', comuna: 'Maipú', miembros: 132, colorFrom: '#1F2A5C' },
  { id: '3', name: 'Ciclistas La Florida', sport: 'Ciclismo', comuna: 'La Florida', miembros: 56, colorFrom: '#22C55E' },
];

export default function ClubsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Directorio de clubes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {CLUBES.map((club) => (
          <TouchableOpacity
            key={club.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/(deportista)/club/[id]', params: { id: club.id, name: club.name, sport: club.sport, comuna: club.comuna, colorFrom: club.colorFrom } })}
          >
            <View style={[styles.avatar, { backgroundColor: club.colorFrom }]}>
              <Ionicons name="shield" size={22} color="#fff" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{club.name}</Text>
              <Text style={styles.cardMeta}>{club.sport} · {club.comuna}</Text>
              <Text style={styles.cardMembers}>{club.miembros} miembros</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60 },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 20 },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 17, fontWeight: '700' },
    list: { paddingHorizontal: 20, paddingBottom: 30 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    avatar: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    cardMembers: { color: c.accent, fontSize: 10, marginTop: 2, fontWeight: '600' },
  });