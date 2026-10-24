import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { ApiError } from '../../services/api';
import { getSession } from '../../services/auth';
import {
  cambiarEstadoPostulacion,
  listarCandidatos,
  listarTodasConvocatoriasClub,
  type Candidato,
  type Convocatoria,
  type EstadoPostulacion,
  type EstadoRevision,
  type PaginaCandidatos,
} from '../../services/convocatorias';
import { iniciarConsultaClub } from '../../services/consultas';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const FILTROS: (EstadoPostulacion | 'TODOS')[] = ['TODOS', 'PENDIENTE', 'PRESELECCIONADO', 'ACEPTADO', 'RECHAZADO'];
const etiquetaEstado: Record<EstadoPostulacion, string> = {
  PENDIENTE: 'Pendiente', PRESELECCIONADO: 'Preseleccionado', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado',
};

export default function PostulacionesClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [clubId, setClubId] = useState('');
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [convocatoriaId, setConvocatoriaId] = useState('');
  const [filtro, setFiltro] = useState<EstadoPostulacion | 'TODOS'>('TODOS');
  const [pagina, setPagina] = useState<PaginaCandidatos | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [contacto, setContacto] = useState<Candidato | null>(null);
  const [mensaje, setMensaje] = useState('');

  const cargarConvocatorias = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const sesion = await getSession();
      if (!sesion?.clubId) throw new Error('Tu sesión expiró o ya no administras un club.');
      setClubId(sesion.clubId);
      const items = await listarTodasConvocatoriasClub(sesion.clubId);
      setConvocatorias(items);
      setConvocatoriaId((actual) => items.some((i) => i.id === actual) ? actual : items[0]?.id ?? '');
      if (items.length === 0) {
        setCandidatos([]);
        setPagina(null);
      }
    } catch (e) {
      setError(detalle(e));
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarCandidatos = useCallback(async (id: string, estado: EstadoPostulacion | 'TODOS', page = 1, anexar = false) => {
    if (!id) return;
    setCargando(true);
    setError('');
    try {
      const resultado = await listarCandidatos(id, estado === 'TODOS' ? undefined : estado, page);
      setPagina(resultado);
      setCandidatos((anteriores) => anexar ? [...anteriores, ...resultado.items] : resultado.items);
    } catch (e) {
      setError(detalle(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void cargarConvocatorias();
  }, [cargarConvocatorias]));

  useFocusEffect(useCallback(() => {
    if (convocatoriaId) void cargarCandidatos(convocatoriaId, filtro);
  }, [convocatoriaId, filtro, cargarCandidatos]));

  function seleccionarConvocatoria(id: string) {
    setConvocatoriaId(id);
    setCandidatos([]);
    setPagina(null);
  }

  async function actualizar(candidato: Candidato, estadoNuevo: EstadoRevision) {
    setOcupado(true);
    setError('');
    try {
      const actualizado = await cambiarEstadoPostulacion(candidato.id, estadoNuevo);
      setCandidatos((lista) => lista.map((item) => item.id === candidato.id ? actualizado : item)
        .filter((item) => filtro === 'TODOS' || item.estado === filtro));
      if (pagina) setPagina({ ...pagina, conteo_por_estado: {
        ...pagina.conteo_por_estado,
        [candidato.estado]: Math.max(0, (pagina.conteo_por_estado[candidato.estado] ?? 0) - 1),
        [actualizado.estado]: (pagina.conteo_por_estado[actualizado.estado] ?? 0) + 1,
      } });
    } catch (e) {
      setError(detalle(e));
    } finally {
      setOcupado(false);
    }
  }

  function confirmarEstado(candidato: Candidato, nuevo: EstadoRevision) {
    if (nuevo === 'RECHAZADO') {
      Alert.alert('Rechazar postulación', 'Se eliminará la conversación con esta persona si no tiene otra postulación activa', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Rechazar', style: 'destructive', onPress: () => { void actualizar(candidato, nuevo); } },
      ]);
      return;
    }
    const accion = nuevo === 'ACEPTADO' ? 'Aceptar' : 'Preseleccionar';
    Alert.alert(accion + ' postulante', `¿${accion} a ${nombreCandidato(candidato)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: accion, onPress: () => { void actualizar(candidato, nuevo); } },
    ]);
  }

  async function escribir() {
    if (!contacto || !clubId) return;
    setOcupado(true);
    setError('');
    const resultado = await iniciarConsultaClub(clubId, contacto.usuario_id, mensaje);
    setOcupado(false);
    if (!resultado.ok) {
      setError(resultado.motivo);
      return;
    }
    setContacto(null);
    setMensaje('');
    router.push({ pathname: '/(club)/consulta/[id]', params: { id: resultado.hiloId } } as never);
  }

  const botonEstado = (titulo: string, candidato: Candidato, nuevo: EstadoRevision, danger = false) => (
    <TouchableOpacity style={[styles.botonSecundario, danger && styles.botonPeligro, ocupado && styles.deshabilitado]}
      disabled={ocupado} onPress={() => confirmarEstado(candidato, nuevo)}>
      <Text style={[styles.botonSecundarioTexto, danger && styles.textoPeligro]}>{titulo}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.contenedor, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.volver} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.expandir}>
          <Text style={styles.titulo}>Postulaciones</Text>
          <Text style={styles.info}>Revisa y gestiona candidatos a tus convocatorias</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 28 }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {cargando && convocatorias.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
        {convocatorias.length === 0 && !cargando && !error ? (
          <View style={styles.vacio}>
            <Text style={styles.subtitulo}>No hay convocatorias abiertas</Text>
            <Text style={styles.info}>Cuando publiques una convocatoria, aquí podrás revisar sus postulaciones.</Text>
          </View>
        ) : null}
        {convocatorias.length > 0 ? <>
          <Text style={styles.subtitulo}>Convocatoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {convocatorias.map((item) => (
              <TouchableOpacity key={item.id} onPress={() => seleccionarConvocatoria(item.id)}
                style={[styles.chip, convocatoriaId === item.id && styles.chipActivo]}>
                <Text style={[styles.chipTexto, convocatoriaId === item.id && styles.chipTextoActivo]}>
                  {item.titulo || `${item.deporte.nombre} · ${item.categoria_edad}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.subtitulo}>Estado de postulación</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTROS.map((estado) => (
              <TouchableOpacity key={estado} onPress={() => setFiltro(estado)}
                style={[styles.chip, filtro === estado && styles.chipActivo]}>
                <Text style={[styles.chipTexto, filtro === estado && styles.chipTextoActivo]}>
                  {estado === 'TODOS' ? 'Todos' : etiquetaEstado[estado]}
                  {estado !== 'TODOS' && pagina?.conteo_por_estado[estado] !== undefined
                    ? ` (${pagina.conteo_por_estado[estado]})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {cargando ? <ActivityIndicator color={colors.primary} /> : null}
          {!cargando && candidatos.length === 0 ? <Text style={styles.info}>No hay postulantes con este estado.</Text> : null}
          {candidatos.map((candidato) => {
            const perfil = candidato.perfil_deportivo;
            return <View key={candidato.id} style={styles.tarjeta}>
              <View style={styles.perfilFila}>
                <Avatar name={nombreCandidato(candidato)} colorFrom="#7C3AED" uri={perfil.foto_perfil} style={styles.avatar} />
                <View style={styles.expandir}>
                  <Text style={styles.nombre}>{nombreCandidato(candidato)}</Text>
                  <Text style={styles.info}>{perfil.edad === null ? 'Edad no indicada' : `${perfil.edad} años`}
                    {' · '}{etiquetaEstado[candidato.estado]}</Text>
                </View>
              </View>
              {perfil.deportes.length > 0 ? <Text style={styles.detalle}>
                Deportes: {perfil.deportes.map((d) => `${d.deporte_codigo} · nivel ${d.nivel}`).join(', ')}
              </Text> : null}
              {perfil.biografia ? <Text style={styles.detalle}>{perfil.biografia}</Text> : null}
              {candidato.mensaje ? <Text style={styles.mensaje}>“{candidato.mensaje}”</Text> : <Text style={styles.info}>Sin mensaje de presentación.</Text>}
              {candidato.antecedentes.map((a, i) => <Text key={`${a.institucion}-${i}`} style={styles.detalle}>
                {a.deporte} · {a.institucion} ({a.anio_inicio}–{a.anio_fin ?? 'actualidad'}){a.logros ? ` · ${a.logros}` : ''}
              </Text>)}
              <View style={styles.acciones}>
                {candidato.estado !== 'PRESELECCIONADO' ? botonEstado('Preseleccionar', candidato, 'PRESELECCIONADO') : null}
                {candidato.estado !== 'ACEPTADO' ? botonEstado('Aceptar', candidato, 'ACEPTADO') : null}
                {candidato.estado !== 'RECHAZADO' ? botonEstado('Rechazar', candidato, 'RECHAZADO', true) : null}
              </View>
              {candidato.estado !== 'RECHAZADO' ? <TouchableOpacity style={styles.botonPrimario}
                onPress={() => { setContacto(candidato); setMensaje(''); }}>
                <Text style={styles.botonPrimarioTexto}>Escribir al postulante</Text>
              </TouchableOpacity> : null}
            </View>;
          })}
          {pagina && pagina.page * pagina.page_size < pagina.total ? (
            <TouchableOpacity style={styles.botonSecundario} disabled={cargando}
              onPress={() => { void cargarCandidatos(convocatoriaId, filtro, pagina.page + 1, true); }}>
              <Text style={styles.botonSecundarioTexto}>Cargar más postulantes</Text>
            </TouchableOpacity>
          ) : null}
        </> : null}
      </ScrollView>
      {contacto ? <View style={styles.modalFondo}>
        <View style={styles.modal}>
          <Text style={styles.subtitulo}>Escribir a {nombreCandidato(contacto)}</Text>
          <Text style={styles.info}>Este primer mensaje abrirá la conversación del club.</Text>
          <TextInput style={styles.campo} placeholder="Escribe un mensaje" placeholderTextColor={colors.textMuted}
            value={mensaje} onChangeText={setMensaje} multiline maxLength={1000} />
          <View style={styles.acciones}>
            <TouchableOpacity style={styles.botonSecundario} onPress={() => setContacto(null)}>
              <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botonPrimario, (!mensaje.trim() || ocupado) && styles.deshabilitado]}
              disabled={!mensaje.trim() || ocupado} onPress={() => { void escribir(); }}>
              <Text style={styles.botonPrimarioTexto}>{ocupado ? 'Enviando...' : 'Iniciar conversación'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View> : null}
    </View>
  );
}

function nombreCandidato(candidato: Candidato) {
  return `${candidato.perfil_deportivo.nombre} ${candidato.perfil_deportivo.apellido_inicial}`.trim();
}

function detalle(error: unknown) {
  if (error instanceof ApiError) return error.detail || error.message;
  return error instanceof Error ? error.message : 'No se pudo completar la solicitud.';
}

const makeStyles = (c: Colors) => StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: c.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  volver: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  contenido: { paddingHorizontal: 20, gap: 12 },
  expandir: { flex: 1 },
  titulo: { color: c.text, fontSize: 21, fontWeight: '700' },
  subtitulo: { color: c.text, fontSize: 14, fontWeight: '700' },
  info: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  error: { color: c.danger, fontSize: 13 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
  chipTexto: { color: c.textMuted, fontSize: 11, fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  tarjeta: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  perfilFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  nombre: { color: c.text, fontSize: 15, fontWeight: '700' },
  detalle: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  mensaje: { color: c.text, fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  botonPrimario: { backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  botonPrimarioTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  botonSecundario: { backgroundColor: c.inputBg, borderColor: c.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  botonSecundarioTexto: { color: c.text, fontSize: 11, fontWeight: '700' },
  botonPeligro: { borderColor: c.danger },
  textoPeligro: { color: c.danger },
  deshabilitado: { opacity: 0.5 },
  vacio: { alignItems: 'center', gap: 8, padding: 24 },
  campo: { minHeight: 110, textAlignVertical: 'top', color: c.text, backgroundColor: c.inputBg, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 12 },
  modalFondo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: c.card, borderRadius: 16, padding: 18, gap: 12 },
});
