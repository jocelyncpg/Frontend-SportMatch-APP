import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { YO } from '../../../services/actividades';
import { idHilo, useHilo } from '../../../services/consultas';
import { cargarClub, useClub } from '../../../services/clubes';
import { listarConvocatorias, type Convocatoria } from '../../../services/convocatorias';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';
export default function ClubProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{
    id: string
  }>();
  const clubId = id ?? '';
  const club = useClub(clubId);
  const [error, setError] = useState('');
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [errorConvocatorias, setErrorConvocatorias] = useState('');
  const cargarConvocatorias = useCallback(async () => {
    try {
      const data = await listarConvocatorias(clubId);
      setConvocatorias(data.items);
      setTotal(data.total);
      setPagina(data.page);
      setErrorConvocatorias('');
    } catch (e) {
      setErrorConvocatorias(e instanceof Error ? e.message : 'No se pudieron cargar las convocatorias.');
    }
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    setConvocatorias([]);
    setTotal(0);
    setPagina(1);
    cargarClub(clubId).catch((e) => {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el club.');
    });
    cargarConvocatorias();
  }, [clubId, cargarConvocatorias]);
  async function cargarMas() {
    try {
      const data = await listarConvocatorias(clubId, 'ABIERTA', pagina + 1);
      setConvocatorias((actuales) => [...actuales, ...data.items]);
      setPagina(data.page);
      setErrorConvocatorias('');
    } catch (e) {
      setErrorConvocatorias(e instanceof Error ? e.message : 'No se pudieron cargar las convocatorias.');
    }
  }
  const hilo = useHilo(idHilo(clubId, YO));
  const noLeidos = hilo?.noLeidosPostulante ?? 0;
  function abrirConsultas() {
    router.push({ pathname: '/(deportista)/chat-club/[id]', params: { id: clubId } } as never);
  }
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Ionicons name="shield" size={36} color="#fff" />
      </View>
      <Text style={styles.name}>{club?.nombre ?? (error || 'Cargando club...')}</Text>
      {error ? (
        <TouchableOpacity onPress={() => cargarClub(clubId).then(() => setError('')).catch((e) => {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el club.');
        })}>
          <Text style={styles.consultaTitulo}>Reintentar</Text>
        </TouchableOpacity>
      ) : null}
      {club?.rut ? <Text style={styles.meta}>RUT {club.rut}</Text> : null}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre el club</Text>
        <Text style={styles.sectionText}>{club?.descripcion || 'Sin descripción.'}</Text>
      </View>
      <View style={styles.convocatoria}>
        <Text style={styles.convocatoriaTitle}>Convocatorias</Text>
        {errorConvocatorias ? <Text style={styles.convocatoriaText}>{errorConvocatorias}</Text> : null}
        {errorConvocatorias ? (
          <TouchableOpacity onPress={cargarConvocatorias}>
            <Text style={styles.consultaTitulo}>Reintentar convocatorias</Text>
          </TouchableOpacity>
        ) : null}
        {convocatorias.length === 0 && !errorConvocatorias ? (
          <Text style={styles.convocatoriaText}>No hay convocatorias abiertas.</Text>
        ) : null}
        {convocatorias.map((convocatoria) => (
          <View key={convocatoria.id} style={styles.convocatoriaItem}>
            <Text style={styles.convocatoriaNombre}>
              {convocatoria.titulo || `${convocatoria.deporte.nombre} · ${convocatoria.categoria_edad}`}
            </Text>
            <Text style={styles.convocatoriaText}>
              {convocatoria.deporte.nombre} · {convocatoria.categoria_edad} · {convocatoria.cupos_disponibles} cupos
            </Text>
            <Text style={styles.convocatoriaText}>
              {new Date(convocatoria.fecha_prueba).toLocaleString('es-CL')} · {convocatoria.direccion}
            </Text>
            {convocatoria.comuna ? <Text style={styles.convocatoriaText}>{convocatoria.comuna}</Text> : null}
            {convocatoria.descripcion ? <Text style={styles.convocatoriaText}>{convocatoria.descripcion}</Text> : null}
            <Text style={styles.convocatoriaText}>Requisitos: {convocatoria.requisitos.join(', ')}</Text>
          </View>
        ))}
        {convocatorias.length < total ? (
          <TouchableOpacity onPress={cargarMas}>
            <Text style={styles.consultaTitulo}>Cargar más convocatorias</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {/* HU-51: canal de consultas con el club */}
      {club || hilo ? (
        <TouchableOpacity
          style={styles.consultaButton}
          onPress={abrirConsultas}
          activeOpacity={0.8}
          accessibilityLabel="Abrir consultas con el club"
        >
          <View style={styles.consultaIcono}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.consultaTextos}>
            <Text style={styles.consultaTitulo}>{hilo ? 'Mis consultas al club' : 'Hacer una consulta'}</Text>
            <Text style={styles.consultaSub}>
              {hilo ? 'Revisa las respuestas o escribe de nuevo' : 'Escribe al club'}
            </Text>
          </View>
          {noLeidos > 0 ? (
            <View style={styles.consultaBadge}>
              <Text style={styles.consultaBadgeTexto}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 60, alignItems: 'center' },
    backButton: {
      position: 'absolute',
      top: 60,
      left: 20,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    name: { color: c.text, fontSize: 19, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 20 },
    section: { width: '100%', marginBottom: 20 },
    sectionTitle: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    sectionText: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    convocatoria: {
      width: '100%',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 14
    },
    convocatoriaItem: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, marginTop: 12 },
    convocatoriaTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    convocatoriaNombre: { color: c.text, fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
    convocatoriaText: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
    consultaButton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12
    },
    consultaIcono: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: c.chip,
      alignItems: 'center',
      justifyContent: 'center'
    },
    consultaTextos: { flex: 1 },
    consultaTitulo: { color: c.text, fontSize: 13, fontWeight: '700' },
    consultaSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    consultaBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center'
    },
    consultaBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  });
