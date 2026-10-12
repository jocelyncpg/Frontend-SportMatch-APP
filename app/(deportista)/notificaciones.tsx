import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationPreferences } from '../../components/NotificationPreferences';
import { abrirDestino } from '../../services/notificationNavigation';
import { cargarNotificaciones, marcarLeida, marcarTodasLeidas, Notificacion, TipoNotificacion, useNotificaciones } from '../../services/notificaciones';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const ICONO: Record<TipoNotificacion, keyof typeof Ionicons.glyphMap> = {
  solicitud: 'person-add-outline', match: 'heart', mensaje: 'chatbubble-outline', calificacion: 'star', actividad: 'calendar-outline',
};

export default function NotificacionesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { lista, noLeidas, cargando, error, siguiente } = useNotificaciones();
  useFocusEffect(useCallback(() => { void cargarNotificaciones(); }, []));
  const nuevas = lista.filter((n) => !n.leida);
  const anteriores = lista.filter((n) => n.leida);

  function abrir(n: Notificacion) {
    void marcarLeida(n.id).catch(() => Alert.alert('Aviso sin leer', 'No se pudo guardar la lectura. Puedes volver a intentarlo.'));
    abrirDestino(n.data);
  }

  const fila = (n: Notificacion) => (
    <TouchableOpacity key={n.id} style={[styles.fila, !n.leida && styles.filaNueva]} onPress={() => abrir(n)} activeOpacity={0.7}>
      <View style={[styles.icono, { backgroundColor: colors.chip }]}>
        <Ionicons name={ICONO[n.tipo] ?? 'notifications-outline'} size={17} color={colors.accent} />
      </View>
      <View style={styles.textos}>
        <Text style={[styles.titulo, !n.leida && styles.tituloNuevo]} numberOfLines={2}>{n.titulo}</Text>
        <Text style={styles.detalle} numberOfLines={2}>{n.detalle}</Text>
        <Text style={styles.cuando}>{n.cuando}</Text>
      </View>
      {!n.leida ? <View style={styles.punto} /> : <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Notificaciones</Text>
      {nuevas.length > 0 ? <TouchableOpacity style={styles.marcarTodas} onPress={() => {
        void marcarTodasLeidas().catch(() => Alert.alert('No se pudo guardar', 'Revisa tu conexión y vuelve a intentarlo.'));
      }}>
        <Ionicons name="checkmark-done-outline" size={15} color={colors.accent} />
        <Text style={styles.marcarTodasTexto}>Leer visibles</Text>
      </TouchableOpacity> : null}
    </View>
    <ScrollView contentContainerStyle={styles.list} refreshControl={
      <RefreshControl refreshing={cargando} onRefresh={() => { void cargarNotificaciones(); }} tintColor={colors.accent} />
    }>
      <NotificationPreferences />
      {error ? <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>
        <TouchableOpacity onPress={() => { void cargarNotificaciones(); }}><Text style={{ color: colors.accent }}>Reintentar</Text></TouchableOpacity>
      </View> : null}
      {nuevas.length > 0 ? <><Text style={styles.seccion}>Sin leer ({noLeidas})</Text>{nuevas.map(fila)}</> : null}
      {anteriores.length > 0 ? <><Text style={[styles.seccion, { marginTop: 18 }]}>Anteriores</Text>{anteriores.map(fila)}</> : null}
      {!lista.length && !cargando && !error ? <View style={styles.vacio}>
        <Ionicons name="notifications-outline" size={34} color={colors.textMuted} />
        <Text style={styles.vacioTitulo}>No tienes notificaciones</Text>
        <Text style={styles.vacioTexto}>Aquí verás tus nuevos avisos de solicitudes, matches, mensajes, calificaciones y actividades.</Text>
      </View> : null}
      {cargando ? <ActivityIndicator color={colors.accent} /> : null}
      {siguiente ? <TouchableOpacity disabled={cargando} style={{ padding: 16, alignItems: 'center' }}
        onPress={() => { void cargarNotificaciones(true); }}><Text style={{ color: colors.accent }}>Ver anteriores</Text></TouchableOpacity> : null}
    </ScrollView>
  </View>;
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },
  marcarTodas: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  marcarTodasTexto: { color: c.accent, fontSize: 11.5, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  seccion: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1,
    borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 8 },
  filaNueva: { borderColor: c.accent },
  icono: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1 }, titulo: { color: c.text, fontSize: 12.5, fontWeight: '600' }, tituloNuevo: { fontWeight: '800' },
  detalle: { color: c.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 }, cuando: { color: c.textMuted, fontSize: 10, marginTop: 4 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },
  vacio: { alignItems: 'center', marginTop: 30, gap: 8 }, vacioTitulo: { color: c.text, fontSize: 14, fontWeight: '700' },
  vacioTexto: { color: c.textMuted, fontSize: 12, textAlign: 'center' }, errorBox: { gap: 10, marginBottom: 16 },
});
