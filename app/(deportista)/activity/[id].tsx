import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, getActivity } from '../../../services/activities';
import { ApiError } from '../../../services/api';
import { nombreDeporte } from '../../../services/deportes';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ActivityDetailScreen() {
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme(); const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState(''); const [expired, setExpired] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!focused) return;
    let active = true; setActivity(null); setError(''); setExpired(false);
    getActivity(id).then((value) => { if (active) setActivity(value); }).catch((e) => {
      if (active) { setError(e instanceof Error ? e.message : 'Actividad no disponible.'); setExpired(e instanceof ApiError && e.status === 401); }
    });
    return () => { active = false; };
  }, [id, retry, focused]);
  return <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
    <View style={styles.topbar}><TouchableOpacity accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace('/(deportista)/activities')}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={styles.heading}>Detalle de actividad</Text></View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {error ? <><Text style={styles.body}>{error}</Text><TouchableOpacity onPress={() => expired ? router.replace('/(auth)/login') : setRetry((value) => value + 1)}><Text style={styles.link}>{expired ? 'Iniciar sesión' : 'Reintentar'}</Text></TouchableOpacity></> : !activity ? <ActivityIndicator color={colors.accent} /> : <View style={styles.card}>
        <Text style={styles.sport}>{nombreDeporte(activity.sport_code)}</Text>
        <Text style={styles.title}>{activity.title}</Text>
        <Text style={styles.label}>Fecha y hora</Text><Text style={styles.body}>{new Date(activity.starts_at).toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short' })}</Text>
        <Text style={styles.label}>Lugar de encuentro</Text><Text style={styles.body}>{activity.location}</Text>
        <Text style={styles.label}>Organiza</Text><Text style={styles.body}>{activity.organizer.nombre} {activity.organizer.apellido_inicial}</Text>
        <Text style={styles.label}>Descripción</Text><Text style={styles.body}>{activity.description || 'Sin descripción adicional.'}</Text>
      </View>}
    </ScrollView>
  </View>;
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg }, topbar: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  heading: { color: c.text, fontSize: 18, fontWeight: '700' }, content: { paddingHorizontal: 20 },
  card: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 20 },
  sport: { color: c.accent, fontWeight: '700', marginBottom: 8 }, title: { color: c.text, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  label: { color: c.text, fontWeight: '700', marginTop: 16, marginBottom: 6 }, body: { color: c.textMuted, lineHeight: 22 }, link: { color: c.accent, marginTop: 14 },
});
