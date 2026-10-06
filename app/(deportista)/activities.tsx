import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityCard from '../../components/ActivityCard';
import { useActivities } from '../../hooks/useActivities';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function ActivitiesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const data = useActivities();
  return <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
    <View style={styles.topbar}>
      <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Actividades deportivas</Text>
    </View>
    <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(deportista)/create-activity')}>
      <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
      <Text style={styles.link}>Crear actividad</Text>
    </TouchableOpacity>
    <FlatList data={data.items} keyExtractor={(item) => item.id} renderItem={({ item }) => <ActivityCard activity={item} />}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.refresh} tintColor={colors.accent} />}
      ListHeaderComponent={<Text style={styles.note}>Próximas actividades, ordenadas por fecha. Toca una para ver el detalle.</Text>}
      ListEmptyComponent={!data.loading && !data.error ? <Text style={styles.note}>Todavía no hay actividades próximas. ¡Publica la primera!</Text> : null}
      ListFooterComponent={<View style={styles.footer}>
        {data.error && <><Text style={styles.note}>{data.error}</Text><TouchableOpacity onPress={() => data.sessionExpired ? router.replace('/(auth)/login') : void (data.cursor ? data.more() : data.refresh())}>
          <Text style={styles.link}>{data.sessionExpired ? 'Iniciar sesión' : 'Reintentar'}</Text></TouchableOpacity></>}
        {data.loading ? <ActivityIndicator color={colors.accent} /> : data.cursor && !data.error ?
          <TouchableOpacity onPress={data.more}><Text style={styles.link}>Ver más actividades</Text></TouchableOpacity> : null}
      </View>} />
  </View>;
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 20 },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, fontSize: 17, fontWeight: '700', flex: 1 },
  createButton: { marginHorizontal: 20, marginBottom: 16, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { color: c.accent, fontWeight: '700' },
  note: { color: c.textMuted, marginBottom: 14, lineHeight: 21 },
  list: { paddingHorizontal: 20 }, footer: { paddingVertical: 16 },
});
