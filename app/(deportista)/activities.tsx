import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Actividad,
  FILTROS_ACTIVIDADES_VACIOS,
  FiltrosActividades,
  comunasDisponibles,
  cuposTomados,
  estadoActividad,
  filtrarActividades,
  formatearCuando,
  pendientesDe,
  relacionConActividad,
  useActividades,
  visualDeporte,
} from '../../services/actividades';
import { Usuario, getSession } from '../../services/auth';
import { normalizar } from '../../services/comunas';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Pestana = 'explorar' | 'mias';
type Insignia = { texto: string; tipo: 'ok' | 'info' | 'mal' | 'apagada' };

const FECHAS: { key: FiltrosActividades['fecha']; label: string }[] = [
  { key: 'todas', label: 'Cualquier día' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'manana', label: 'Mañana' },
  { key: 'semana', label: 'Esta semana' },
];

function insigniaDe(a: Actividad, ahora: number): Insignia | null {
  const estado = estadoActividad(a, ahora);
  if (estado === 'vencida') return { texto: 'Finalizada', tipo: 'apagada' };
  if (estado === 'cancelada') return { texto: 'Cancelada', tipo: 'apagada' };
  const relacion = relacionConActividad(a);
  if (relacion === 'organizador') {
    const n = pendientesDe(a);
    return { texto: n > 0 ? `${n} por revisar` : 'Organizas', tipo: 'info' };
  }
  if (relacion === 'aprobada') return { texto: 'Aprobado', tipo: 'ok' };
  if (relacion === 'pendiente') return { texto: 'Postulado', tipo: 'info' };
  if (relacion === 'rechazada') return { texto: 'Rechazada', tipo: 'mal' };
  if (estado === 'llena') return { texto: 'Completa', tipo: 'apagada' };
  return null;
}

export default function ActivitiesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const actividades = useActividades();
  const ahora = Date.now();

  const [pestana, setPestana] = useState<Pestana>('explorar');
  const [filtros, setFiltros] = useState<FiltrosActividades>(FILTROS_ACTIVIDADES_VACIOS);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  const abiertas = actividades.filter((a) => estadoActividad(a, ahora) === 'abierta');
  const deportesDisponibles = [...new Set(abiertas.map((a) => a.deporte))].sort((a, b) => (normalizar(a) < normalizar(b) ? -1 : 1));
  const miComuna = usuario?.comuna;
  // "Mi comuna" resuelve la cercanía; se quita de la lista para no repetirla.
  const comunas = comunasDisponibles(actividades, ahora).filter((c) => c !== miComuna);
  const resultados = filtrarActividades(actividades, filtros, ahora);
  const activos = (filtros.deporte ? 1 : 0) + (filtros.fecha !== 'todas' ? 1 : 0) + (filtros.comuna ? 1 : 0);

  const mias = actividades.filter((a) => relacionConActividad(a) !== null);
  const vigente = (a: Actividad) => ['abierta', 'llena'].includes(estadoActividad(a, ahora));
  const organizo = mias.filter((a) => relacionConActividad(a) === 'organizador' && vigente(a)).sort((x, y) => x.fecha - y.fecha);
  const participo = mias.filter((a) => relacionConActividad(a) !== 'organizador' && vigente(a)).sort((x, y) => x.fecha - y.fecha);
  const historial = mias.filter((a) => !vigente(a)).sort((x, y) => y.fecha - x.fecha);

  function abrir(a: Actividad) {
    router.push({ pathname: '/(deportista)/activity/[id]', params: { id: a.id } });
  }

  const chip = (key: string, label: string, activo: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} style={[styles.chip, activo && styles.chipActivo]} onPress={onPress}>
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </TouchableOpacity>
  );

  const grupo = (titulo: string, chips: ReactNode) => (
    <View style={styles.grupo}>
      <Text style={styles.grupoTitulo}>{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
        {chips}
      </ScrollView>
    </View>
  );

  const fila = (a: Actividad) => {
    const visual = visualDeporte(a.deporte);
    const insignia = insigniaDe(a, ahora);
    return (
      <TouchableOpacity key={a.id} style={styles.fila} onPress={() => abrir(a)} activeOpacity={0.7}>
        <View style={[styles.iconBox, { backgroundColor: visual.colorBg }]}>
          <Text style={styles.icon}>{visual.icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.filaTitulo} numberOfLines={1}>{a.titulo}</Text>
          <Text style={styles.filaMeta} numberOfLines={1}>{formatearCuando(a.fecha, ahora)} · {a.comuna}</Text>
          <Text style={styles.filaMeta} numberOfLines={1}>{a.lugar}</Text>
        </View>
        <View style={styles.derecha}>
          {insignia ? (
            <View style={[styles.insignia, insignia.tipo === 'ok' && styles.insigniaOk, insignia.tipo === 'mal' && styles.insigniaMal]}>
              <Text style={[styles.insigniaTexto, insignia.tipo === 'ok' && styles.insigniaTextoOk, insignia.tipo === 'info' && styles.insigniaTextoInfo, insignia.tipo === 'mal' && styles.insigniaTextoMal]}>
                {insignia.texto}
              </Text>
            </View>
          ) : null}
          <Text style={styles.cupos}>{cuposTomados(a)}/{a.cupos} cupos</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const seccion = (titulo: string, lista: Actividad[], primera = false) =>
    lista.length > 0 ? (
      <View key={titulo}>
        <Text style={[styles.seccion, !primera && { marginTop: 18 }]}>{titulo}</Text>
        {lista.map(fila)}
      </View>
    ) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Actividades</Text>
        <TouchableOpacity
          style={styles.crearBtn}
          onPress={() => router.push('/(deportista)/activity/nueva')}
          accessibilityLabel="Crear actividad"
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.crearTexto}>Crear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, pestana === 'explorar' && styles.tabActive]} onPress={() => setPestana('explorar')}>
          <Text style={[styles.tabText, pestana === 'explorar' && styles.tabTextActive]}>Explorar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, pestana === 'mias' && styles.tabActive]} onPress={() => setPestana('mias')}>
          <Text style={[styles.tabText, pestana === 'mias' && styles.tabTextActive]}>Mis actividades</Text>
        </TouchableOpacity>
      </View>

      {pestana === 'explorar' ? (
        <>
          <View style={styles.filtrosHeader}>
            <TouchableOpacity style={styles.filtrosToggle} onPress={() => setMostrarFiltros((v) => !v)}>
              <Ionicons name="options-outline" size={16} color={colors.accent} />
              <Text style={styles.filtrosTitulo}>Filtros{activos > 0 ? ` (${activos})` : ''}</Text>
              <Ionicons name={mostrarFiltros ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
            </TouchableOpacity>
            {activos > 0 ? (
              <TouchableOpacity onPress={() => setFiltros(FILTROS_ACTIVIDADES_VACIOS)}>
                <Text style={styles.limpiarLink}>Limpiar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {mostrarFiltros ? (
            <View style={styles.filtrosPanel}>
              {grupo(
                'Deporte',
                <>
                  {chip('dep-todos', 'Todos', filtros.deporte === null, () => setFiltros((f) => ({ ...f, deporte: null })))}
                  {deportesDisponibles.map((d) =>
                    chip(`dep-${d}`, d, filtros.deporte === d, () => setFiltros((f) => ({ ...f, deporte: f.deporte === d ? null : d })))
                  )}
                </>
              )}
              {grupo('Fecha', FECHAS.map((x) => chip(`fec-${x.key}`, x.label, filtros.fecha === x.key, () => setFiltros((f) => ({ ...f, fecha: x.key })))))}
              {grupo(
                'Ubicación',
                <>
                  {chip('com-todas', 'Todas', filtros.comuna === null, () => setFiltros((f) => ({ ...f, comuna: null })))}
                  {miComuna
                    ? chip('com-mia', 'Mi comuna', filtros.comuna === miComuna, () => setFiltros((f) => ({ ...f, comuna: f.comuna === miComuna ? null : miComuna })))
                    : null}
                  {comunas.map((c) =>
                    chip(`com-${c}`, c, filtros.comuna === c, () => setFiltros((f) => ({ ...f, comuna: f.comuna === c ? null : c })))
                  )}
                </>
              )}
            </View>
          ) : null}

          <Text style={styles.contador}>
            {resultados.length} {resultados.length === 1 ? 'actividad abierta' : 'actividades abiertas'}
          </Text>

          <ScrollView contentContainerStyle={styles.list}>
            {resultados.map(fila)}
            {resultados.length === 0 ? (
              <View style={styles.vacio}>
                <Text style={styles.emptyText}>
                  {activos > 0 ? 'No hay actividades abiertas con esos filtros.' : 'No hay actividades abiertas por ahora.'}
                </Text>
                {activos > 0 ? (
                  <TouchableOpacity style={styles.vacioBoton} onPress={() => setFiltros(FILTROS_ACTIVIDADES_VACIOS)}>
                    <Text style={styles.vacioBotonTexto}>Limpiar filtros</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {seccion('Organizo', organizo, true)}
          {seccion('Participo y postulaciones', participo, organizo.length === 0)}
          {seccion('Historial', historial, organizo.length === 0 && participo.length === 0)}
          {mias.length === 0 ? (
            <View style={styles.vacio}>
              <Text style={styles.emptyText}>Aún no participas en ninguna actividad.</Text>
              <TouchableOpacity style={styles.vacioBoton} onPress={() => setPestana('explorar')}>
                <Text style={styles.vacioBotonTexto}>Explorar actividades</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 16 },
    backButton: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 17, fontWeight: '700', flex: 1 },
    crearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
    crearTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },

    tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
    tab: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: '#fff' },

    filtrosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
    filtrosToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    filtrosTitulo: { color: c.text, fontSize: 13, fontWeight: '700' },
    limpiarLink: { color: c.accent, fontSize: 11.5, fontWeight: '700' },
    filtrosPanel: { marginBottom: 6 },
    grupo: { marginBottom: 8 },
    grupoTitulo: { color: c.textMuted, fontSize: 10.5, fontWeight: '600', paddingHorizontal: 20, marginBottom: 5 },
    chipsFila: { paddingHorizontal: 20, gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7 },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipTexto: { color: c.textMuted, fontSize: 11.5, fontWeight: '600' },
    chipTextoActivo: { color: '#fff' },
    contador: { color: c.textMuted, fontSize: 11.5, paddingHorizontal: 20, marginBottom: 8 },

    list: { paddingHorizontal: 20, paddingBottom: 30 },
    seccion: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8 },
    fila: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 13, padding: 12, marginBottom: 9,
    },
    iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 18 },
    info: { flex: 1 },
    filaTitulo: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    filaMeta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    derecha: { alignItems: 'flex-end', gap: 5 },
    cupos: { color: c.textMuted, fontSize: 10 },
    insignia: { backgroundColor: c.chip, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
    insigniaOk: { backgroundColor: c.badgeBg },
    insigniaMal: { backgroundColor: c.chip },
    insigniaTexto: { color: c.textMuted, fontSize: 9.5, fontWeight: '700' },
    insigniaTextoOk: { color: c.success },
    insigniaTextoInfo: { color: c.accent },
    insigniaTextoMal: { color: c.danger },

    vacio: { alignItems: 'center', marginTop: 40, gap: 12 },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
    vacioBoton: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
    vacioBotonTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });