import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../services/api';
import { logout } from '../../services/auth';
import { EstadoReporte, Reporte, TipoReporte, listarReportes, revisarReporte } from '../../services/reportes';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const PESTANAS: { estado: EstadoReporte; titulo: string }[] = [
  { estado: 'pendiente', titulo: 'Pendientes' },
  { estado: 'revisado', titulo: 'Revisados' },
  { estado: 'descartado', titulo: 'Descartados' },
];

const ICONO_TIPO: Record<TipoReporte, keyof typeof Ionicons.glyphMap> = {
  usuario: 'person-outline',
  actividad: 'calendar-outline',
  mensaje: 'chatbubble-outline',
};

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Panel de moderación (HU-43): reportes enviados desde la app, guardados en Ms_Users. */
export default function AdminHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [pestana, setPestana] = useState<EstadoReporte>('pendiente');
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState<string | null>(null);

  const cargar = useCallback(async (estado: EstadoReporte) => {
    setCargando(true);
    setError(null);
    try {
      setReportes(await listarReportes(estado));
    } catch (e) {
      setReportes([]);
      if (e instanceof ApiError && e.status === 401) {
        await salir();
        return;
      }
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los reportes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void cargar(pestana); }, [cargar, pestana]));

  async function salir() {
    await logout();
    router.replace('/(auth)/login');
  }

  async function decidir(reporte: Reporte, estado: 'revisado' | 'descartado') {
    setRevisando(reporte.id);
    try {
      await revisarReporte(reporte.id, estado);
      setReportes((lista) => lista.filter((r) => r.id !== reporte.id));
    } catch (e) {
      Alert.alert('No se pudo actualizar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setRevisando(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Moderación</Text>
          <Text style={styles.subtitulo}>Reportes de usuarios, actividades y mensajes</Text>
        </View>
        <TouchableOpacity onPress={salir} style={styles.salir} accessibilityLabel="Cerrar sesión">
          <Ionicons name="log-out-outline" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.pestanas}>
        {PESTANAS.map((p) => (
          <TouchableOpacity key={p.estado} style={[styles.pestana, pestana === p.estado && styles.pestanaOn]}
            onPress={() => setPestana(p.estado)}>
            <Text style={[styles.pestanaTexto, pestana === p.estado && styles.pestanaTextoOn]}>{p.titulo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={reportes}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={cargando && reportes.length > 0} onRefresh={() => cargar(pestana)} />}
        ListEmptyComponent={cargando ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : (
          <Text style={styles.vacio}>
            {pestana === 'pendiente' ? 'No hay reportes pendientes.' : 'No hay reportes en esta lista.'}
          </Text>
        )}
        renderItem={({ item: r }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name={ICONO_TIPO[r.tipo]} size={16} color={colors.accent} />
              <Text style={styles.objetivo} numberOfLines={2}>{r.objetivoNombre}</Text>
            </View>
            <Text style={styles.motivo}>{r.motivo}</Text>
            {r.detalle ? <Text style={styles.detalle}>“{r.detalle}”</Text> : null}
            <Text style={styles.meta}>
              {r.reportante ? `Reportado por ${r.reportante}` : 'Cuenta eliminada'} · {formatearFecha(r.fecha)}
            </Text>
            {r.estado === 'pendiente' ? (
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnSecundario} onPress={() => decidir(r, 'descartado')}
                  disabled={revisando === r.id}>
                  <Text style={styles.btnSecundarioTexto}>Descartar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimario} onPress={() => decidir(r, 'revisado')}
                  disabled={revisando === r.id}>
                  <Text style={styles.btnPrimarioTexto}>{revisando === r.id ? 'Guardando…' : 'Marcar revisado'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    titulo: { color: c.text, fontSize: 22, fontWeight: '800' },
    subtitulo: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    salir: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    pestanas: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    pestana: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: c.border },
    pestanaOn: { backgroundColor: c.primary, borderColor: c.primary },
    pestanaTexto: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    pestanaTextoOn: { color: '#fff' },
    error: { color: c.danger, fontSize: 12, marginBottom: 8 },
    vacio: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 40 },
    card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 10 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    objetivo: { color: c.text, fontSize: 14, fontWeight: '700', flex: 1 },
    motivo: { color: c.danger, fontSize: 12.5, fontWeight: '700' },
    detalle: { color: c.text, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    meta: { color: c.textMuted, fontSize: 11, marginTop: 8 },
    acciones: { flexDirection: 'row', gap: 8, marginTop: 12 },
    btnSecundario: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    btnSecundarioTexto: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    btnPrimario: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center' },
    btnPrimarioTexto: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  });
