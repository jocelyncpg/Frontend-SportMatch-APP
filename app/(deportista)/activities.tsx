import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TrainingRow from '../../components/TrainingRow';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const ACTIVIDADES = [
  { icon: '🏃', title: 'Running en Parque Bicentenario', time: 'Hoy, 19:30', distance: '1.2 km', colorBg: '#1B3324' },
  { icon: '⚽', title: 'Fútbol 7 — Maipú', time: 'Mañana, 20:00', distance: '2.8 km', colorBg: '#1B2144' },
  { icon: '🧘', title: 'Yoga al aire libre', time: 'Sábado, 09:00', distance: '3.4 km', colorBg: '#2B1B44' },
  { icon: '🚴', title: 'Ciclismo ruta costera', time: 'Domingo, 08:00', distance: '4.1 km', colorBg: '#1B2A2E' },
  { icon: '🏊', title: 'Natación piscina municipal', time: 'Lunes, 18:00', distance: '2.0 km', colorBg: '#1B2440' },
  { icon: '🥊', title: 'Box grupal Ñuñoa', time: 'Martes, 19:00', distance: '3.6 km', colorBg: '#2A1B1E' },
];

export default function ActivitiesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Entrenamientos cerca de ti</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {ACTIVIDADES.map((a, i) => (
          <TrainingRow key={i} icon={a.icon} title={a.title} time={a.time} distance={a.distance} colorBg={a.colorBg} />
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60 },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 20 },
    backButton: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 17, fontWeight: '700' },
    list: { paddingHorizontal: 20, paddingBottom: 30 },
  });