import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CambioActividad, reiniciarActividades, simularCambioDelOrganizador } from '../../services/actividades';
import {
  Notificacion,
  TipoNotificacion,
  marcarLeida,
  marcarTodasLeidas,
  reiniciarNotificaciones,
  useNotificaciones,
} from '../../services/notificaciones';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const ICONO: Record<TipoNotificacion, keyof typeof Ionicons.glyphMap> = {
  solicitud: 'person-add-outline',
  match: 'heart',
  calificacion: 'star',
  actividad: 'calendar-outline',
};

export default function NotificacionesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { lista, noLeidas } = useNotificaciones();
  const [verDemo, setVerDemo] = useState(false);

  const nuevas = lista.filter((n) => !n.leida);
  const anteriores = lista.filter((n) => n.leida);

  const colorDe = (tipo: TipoNotificacion) =>
    tipo === 'match' ? '#DB2777' : tipo === 'calificacion' ? '#FACC15' : tipo === 'actividad' ? '#38BDF8' : colors.accent;

  /** SOLO DEMO: simula que quien organiza cambia o cancela una actividad en la que participas. */
  function simular(id: string, cambio: CambioActividad) {
    const r = simularCambioDelOrganizador(id, cambio);
    if (!r.ok) Alert.alert('No se pudo simular', r.motivo);
  }

  function restablecer() {
    reiniciarActividades();
    reiniciarNotificaciones();
  }

  /** Al tocar un aviso se marca como leído y se abre lo que corresponde. */
  function abrir(n: Notificacion) {
    marcarLeida(n.id);
    const p = n.persona;
    if (n.tipo === 'solicitud' && p) {
      router.push({
        pathname: '/(deportista)/perfil/[id]',
        params: {
          id: p.id,
          name: p.name,
          sport: p.sport,
          level: p.level,
          age: p.age?.toString() ?? '',
          compatibility: p.compatibility.toString(),
          distance: p.distance ?? '',
          bio: p.bio ?? '',
          colorFrom: p.colorFrom,
          fotoUri: p.fotoUri ?? '',
        },
      });
    } else if (n.tipo === 'actividad' && n.actividadId) {
      router.push({ pathname: '/(deportista)/activity/[id]', params: { id: n.actividadId } });
    } else if (n.tipo === 'match' && p) {
      router.push({
        pathname: '/(deportista)/chat/[id]',
        params: { id: p.id, name: p.name, sport: p.sport, colorFrom: p.colorFrom },
      });
    } else {
      router.push('/(deportista)/(tabs)/profile');
    }
  }

  const fila = (n: Notificacion) => (
    <TouchableOpacity
      key={n.id}
      style={[styles.fila, !n.leida && styles.filaNueva]}
      onPress={() => abrir(n)}
      activeOpacity={0.7}
    >
      <View style={[styles.icono, { backgroundColor: colors.chip }]}>
        <Ionicons name={ICONO[n.tipo]} size={17} color={colorDe(n.tipo)} />
      </View>
      <View style={styles.textos}>
        <Text style={[styles.titulo, !n.leida && styles.tituloNuevo]} numberOfLines={2}>{n.titulo}</Text>
        <Text style={styles.detalle} numberOfLines={2}>{n.detalle}</Text>
        <Text style={styles.cuando}>{n.cuando}</Text>
      </View>
      {!n.leida ? <View style={styles.punto} /> : <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        {noLeidas > 0 ? (
          <TouchableOpacity style={styles.marcarTodas} onPress={marcarTodasLeidas}>
            <Ionicons name="checkmark-done-outline" size={15} color={colors.accent} />
            <Text style={styles.marcarTodasTexto}>Marcar todas</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {nuevas.length > 0 ? (
          <>
            <Text style={styles.seccion}>Nuevas ({nuevas.length})</Text>
            {nuevas.map(fila)}
          </>
        ) : null}

        {anteriores.length > 0 ? (
          <>
            <Text style={[styles.seccion, nuevas.length > 0 && { marginTop: 18 }]}>Anteriores</Text>
            {anteriores.map(fila)}
          </>
        ) : null}

        {lista.length === 0 ? (
          <View style={styles.vacio}>
            <Ionicons name="notifications-off-outline" size={34} color={colors.textMuted} />
            <Text style={styles.vacioTitulo}>No tienes notificaciones</Text>
            <Text style={styles.vacioTexto}>Aquí verás solicitudes, matches, calificaciones y cambios en tus actividades.</Text>
          </View>
        ) : null}

        {/* DEMO: quitar cuando los avisos lleguen desde el backend */}
        <TouchableOpacity style={styles.demoToggle} onPress={() => setVerDemo((v) => !v)}>
          <Ionicons name="flask-outline" size={14} color={colors.textMuted} />
          <Text style={styles.demoToggleTexto}>Demo: simular cambio del organizador</Text>
        </TouchableOpacity>
        {verDemo ? (
          <View style={styles.demoBox}>
            <TouchableOpacity style={styles.demoBtn} onPress={() => simular('act-yoga', 'horario')}>
              <Text style={styles.demoBtnTexto}>Cambiar el horario de Yoga al aire libre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoBtn} onPress={() => simular('act-natacion', 'lugar')}>
              <Text style={styles.demoBtnTexto}>Cambiar el lugar de Natación</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoBtn} onPress={() => simular('act-yoga', 'cancelada')}>
              <Text style={styles.demoBtnTexto}>Cancelar Yoga al aire libre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.demoBtn} onPress={restablecer}>
              <Text style={styles.demoBtnTexto}>Restablecer la demo</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
    backButton: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },
    marcarTodas: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    marcarTodasTexto: { color: c.accent, fontSize: 11.5, fontWeight: '700' },

    list: { paddingHorizontal: 20, paddingBottom: 30 },
    seccion: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8 },

    fila: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, padding: 12, marginBottom: 8,
    },
    filaNueva: { borderColor: c.accent },
    icono: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    textos: { flex: 1 },
    titulo: { color: c.text, fontSize: 12.5, fontWeight: '600' },
    tituloNuevo: { fontWeight: '800' },
    detalle: { color: c.textMuted, fontSize: 11, marginTop: 2, lineHeight: 15 },
    cuando: { color: c.textMuted, fontSize: 10, marginTop: 4 },
    punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },

    demoToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, paddingVertical: 8 },
    demoToggleTexto: { color: c.textMuted, fontSize: 11 },
    demoBox: { gap: 8, marginTop: 4 },
    demoBtn: { borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
    demoBtnTexto: { color: c.text, fontSize: 12 },

    vacio: { alignItems: 'center', marginTop: 70, gap: 8 },
    vacioTitulo: { color: c.text, fontSize: 14, fontWeight: '700' },
    vacioTexto: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
  });