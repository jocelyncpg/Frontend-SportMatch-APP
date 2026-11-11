import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { YO } from '../../../services/actividades';
import MapaEstatico from '../../../components/MapaEstatico';
import { cargarPerfilClub, type PerfilClub } from '../../../services/perfilClub';
import { idHilo, puedeConsultarClub, useHilo } from '../../../services/consultas';
import { cargarClub, useClub } from '../../../services/clubes';
import { listarTodasConvocatoriasClub, mensajeErrorPostulacion, misPostulaciones, postularConvocatoria, presentacionConvocatoria, type Convocatoria, type Postulacion } from '../../../services/convocatorias';
import { Colors, useAppTheme, espacio, radio, tipo } from '../../../theme/ThemeContext';
import { textoUso, useUsoPlan } from '../../../services/usoPlan';

const RECURSO_POSTULAR = ['postulaciones_convocatorias'] as const;

export default function ClubProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id, colorFrom } = useLocalSearchParams<{ id: string; colorFrom?: string }>();
  const clubId = id ?? '';
  const club = useClub(clubId);
  const [perfil, setPerfil] = useState<PerfilClub | null>(null);
  const [error, setError] = useState('');
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [errorConvocatorias, setErrorConvocatorias] = useState('');
  const [errorPostulaciones, setErrorPostulaciones] = useState('');
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([]);
  const [cargandoConvocatorias, setCargandoConvocatorias] = useState(true);
  const [postulandoId, setPostulandoId] = useState('');
  const [puedeEscribir, setPuedeEscribir] = useState(false);
  // HU-54: "Te quedan X de 5 postulaciones a convocatorias hoy" (plan gratuito).
  const { uso: usoPostular, recargar: recargarUso } = useUsoPlan(RECURSO_POSTULAR);
  const quedanPostular = textoUso(usoPostular[0]);
  const cargarConvocatorias = useCallback(async () => {
    setCargandoConvocatorias(true);
    try {
      const [lista, misDatos] = await Promise.all([listarTodasConvocatoriasClub(clubId), misPostulaciones()]);
      setConvocatorias(lista);
      setErrorConvocatorias('');
      setPostulaciones(misDatos.items);
      setErrorPostulaciones('');
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudieron cargar las convocatorias.';
      setErrorConvocatorias(mensaje);
      setErrorPostulaciones(mensaje);
    } finally {
      setCargandoConvocatorias(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    setPerfil(null);
    void cargarPerfilClub(clubId).then(setPerfil).catch(() => {});
    setConvocatorias([]);
    setPostulaciones([]);
    cargarClub(clubId).catch((e) => {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el club.');
    });
    cargarConvocatorias();
    puedeConsultarClub(clubId).then(() => setPuedeEscribir(true)).catch(() => setPuedeEscribir(false));
  }, [clubId, cargarConvocatorias]);
  function confirmarPostulacion(convocatoria: Convocatoria) {
    const titulo = convocatoria.titulo || `${convocatoria.deporte.nombre} · ${convocatoria.categoria_edad}`;
    Alert.alert('Confirmar postulación', `¿Quieres postular a «${titulo}»?${quedanPostular ? `
${quedanPostular}.` : ''}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Postular', onPress: () => { void enviarPostulacion(convocatoria); } },
    ]);
  }
  async function enviarPostulacion(convocatoria: Convocatoria) {
    setPostulandoId(convocatoria.id);
    try {
      await postularConvocatoria(convocatoria.id);
      const data = await misPostulaciones();
      setPostulaciones(data.items);
      setErrorPostulaciones('');
    } catch (e) {
      Alert.alert('No se pudo postular', mensajeErrorPostulacion(e));
    } finally {
      setPostulandoId('');
      recargarUso();
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

      <View style={[styles.avatar, { backgroundColor: colorFrom ?? '#7C3AED' }]}>
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
      {perfil && (perfil.direccion || perfil.zona) ? <Text style={styles.meta}>{[perfil.direccion, perfil.zona].filter(Boolean).join(' · ')}</Text> : null}
      {perfil?.latitud != null && perfil.longitud != null ? (
        <View style={styles.section}><MapaEstatico latitud={perfil.latitud} longitud={perfil.longitud} /></View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre el club</Text>
        <Text style={styles.sectionText}>{club?.descripcion || 'Sin descripción.'}</Text>
      </View>

      <View style={styles.convocatoria}>
        <View style={styles.convocatoriaHeader}>
          <Ionicons
            name={convocatorias.length > 0 ? 'megaphone-outline' : 'lock-closed-outline'}
            size={16}
            color={convocatorias.length > 0 ? colors.success : colors.textMuted}
          />
          <Text style={styles.convocatoriaTitle}>
            {convocatorias.length > 0 ? 'Convocatorias' : 'Sin convocatoria abierta'}
          </Text>
        </View>
        {cargandoConvocatorias ? <Text style={styles.convocatoriaText}>Cargando convocatorias…</Text> : null}
        {errorConvocatorias ? <Text style={styles.convocatoriaText}>{errorConvocatorias}</Text> : null}
        {errorConvocatorias ? (
          <TouchableOpacity onPress={cargarConvocatorias}>
            <Text style={styles.consultaTitulo}>Reintentar convocatorias</Text>
          </TouchableOpacity>
        ) : null}
        {convocatorias.length === 0 && !errorConvocatorias && !cargandoConvocatorias ? (
          <Text style={styles.convocatoriaText}>Este club no tiene una convocatoria abierta por ahora.</Text>
        ) : null}

        {convocatorias.map((convocatoria) => {
          const titulo = convocatoria.titulo || `${convocatoria.deporte.nombre} · ${convocatoria.categoria_edad}`;
          const filas = [
            { etiqueta: 'Deporte', valor: convocatoria.deporte.nombre },
            { etiqueta: 'Categoría / edad', valor: convocatoria.categoria_edad },
            { etiqueta: 'Fecha de la prueba', valor: new Date(convocatoria.fecha_prueba).toLocaleString('es-CL') },
            { etiqueta: 'Cupos', valor: String(convocatoria.cupos_disponibles) },
            { etiqueta: 'Lugar', valor: [convocatoria.direccion, convocatoria.comuna].filter(Boolean).join(' · ') },
            { etiqueta: 'Requisitos', valor: convocatoria.requisitos.join(', ') },
          ].filter((f) => f.valor !== '');
          const mia = postulaciones.find((item) => item.convocatoria.id === convocatoria.id);
          const vista = presentacionConvocatoria(convocatoria.estado, mia?.estado);
          return (
            <View key={convocatoria.id} style={styles.convocatoriaItem}>
              <Text style={styles.convocatoriaNombre}>{titulo}</Text>
              {convocatoria.descripcion ? <Text style={styles.convocatoriaText}>{convocatoria.descripcion}</Text> : null}
              <View style={styles.detalle}>
                {filas.map((f) => (
                  <View key={f.etiqueta} style={styles.detalleFila}>
                    <Text style={styles.detalleEtiqueta}>{f.etiqueta}</Text>
                    <Text style={styles.detalleValor}>{f.valor}</Text>
                  </View>
                ))}
              </View>
              {(() => {
                if (vista.tipo === 'estado') {
                  return (
                    <View style={styles.pendienteBadge}>
                      <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.pendienteText}>{vista.texto}</Text>
                    </View>
                  );
                }
                if (vista.tipo === 'cerrada') return <Text style={styles.convocatoriaText}>{vista.texto}</Text>;
                if (errorPostulaciones) return <Text style={styles.convocatoriaText}>No se pudo comprobar tu postulación.</Text>;
                return (
                  <TouchableOpacity style={styles.postularButton} disabled={postulandoId === convocatoria.id}
                    onPress={() => confirmarPostulacion(convocatoria)}>
                    <Text style={styles.postularButtonText}>{postulandoId === convocatoria.id ? 'Enviando…' : vista.texto}</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          );
        })}
      </View>

      {/* HU-51: canal de consultas con el club */}
      {hilo || puedeEscribir ? (
        <TouchableOpacity style={styles.consultaButton} onPress={abrirConsultas} activeOpacity={0.8} accessibilityLabel="Abrir consultas con el club">
          <View style={styles.consultaIcono}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.consultaTextos}>
            <Text style={styles.consultaTitulo}>{hilo ? 'Mis consultas al club' : 'Hacer una consulta'}</Text>
            <Text style={styles.consultaSub}>
              {hilo ? 'Revisa las respuestas o escribe de nuevo' : 'Resuelve tus dudas sobre pruebas y convocatoria'}
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
    backButton: { position: 'absolute', top: 60, left: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    avatar: {
      width: 84, height: 84, borderRadius: 22, backgroundColor: c.chip,
      alignItems: 'center', justifyContent: 'center', marginBottom: espacio.m + 2,
    },
    name: { color: c.text, ...tipo.titulo },
    meta: { color: c.textMuted, ...tipo.dato, marginTop: 2, marginBottom: espacio.xl },
    section: { width: '100%', marginBottom: espacio.xl },
    sectionTitle: { color: c.text, ...tipo.cuerpoFuerte, marginBottom: espacio.s - 2 },
    sectionText: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19 },
    convocatoria: {
      width: '100%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.tarjeta, padding: espacio.l, marginBottom: espacio.m + 2,
    },
    convocatoriaHeader: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.s },
    convocatoriaTitle: { color: c.text, ...tipo.cuerpoFuerte },
    convocatoriaItem: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, marginTop: 12 },
    convocatoriaNombre: { color: c.text, ...tipo.seccion, marginBottom: espacio.xs },
    convocatoriaText: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, marginBottom: espacio.m + 2 },
    detalle: { marginBottom: espacio.m + 2 },
    detalleFila: { paddingVertical: espacio.m - 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    detalleEtiqueta: { color: c.textMuted, ...tipo.etiqueta, textTransform: 'uppercase', letterSpacing: 0.3 },
    detalleValor: { color: c.text, ...tipo.cuerpo, lineHeight: 19, marginTop: 2 },
    postularButton: { backgroundColor: c.primary, borderRadius: radio.control, paddingVertical: 13, alignItems: 'center' },
    postularButtonText: { color: '#fff', ...tipo.cuerpoFuerte },
    pendienteBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.chip, borderRadius: radio.control, paddingVertical: espacio.m, justifyContent: 'center' },
    pendienteText: { color: c.textMuted, ...tipo.cuerpoFuerte },
    consultaButton: {
      width: '100%', flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radio.tarjeta, padding: espacio.m,
    },
    consultaIcono: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    consultaTextos: { flex: 1 },
    consultaTitulo: { color: c.text, ...tipo.cuerpoFuerte },
    consultaSub: { color: c.textMuted, fontSize: 11, fontWeight: '400', marginTop: 2 },
    consultaBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    consultaBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  });
