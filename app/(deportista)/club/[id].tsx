import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NOMBRES_NIVEL, YO } from '../../../services/actividades';
import { Usuario, getSession } from '../../../services/auth';
import { fechaCorta, idHilo, useConvocatoria, useHilo } from '../../../services/consultas';
import { PerfilPostulante, idPostulacion, postular, retirarPostulacion, usePostulacion } from '../../../services/postulaciones';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ClubProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { id, name, sport, comuna, colorFrom } = useLocalSearchParams<{ id: string; name: string; sport: string; comuna: string; colorFrom: string }>();
  const clubId = id ?? '';

  // Cuenta con la que se inició sesión: de ahí sale el nombre y el nivel con que el club ve tu postulación.
  const [sesion, setSesion] = useState<Usuario | null>(null);
  useEffect(() => {
    getSession().then(setSesion);
  }, []);

  // La convocatoria la publica el club desde su panel (HU-51); aquí se ve la versión actual.
  const convocatoria = useConvocatoria(clubId);
  const abierta = convocatoria?.abierta === true;
  const hilo = useHilo(idHilo(clubId, YO));
  const noLeidos = hilo?.noLeidosPostulante ?? 0;

  // Postulación (HU-33): una retirada se trata como si no hubiera postulado.
  const postulacion = usePostulacion(clubId, YO);
  const estado = postulacion && postulacion.estado !== 'retirada' ? postulacion.estado : null;

  function miPerfil(): PerfilPostulante {
    const deportes = sesion?.deportes ?? [];
    const delClub = deportes.find((d) => d.nombre === sport) ?? deportes[0];
    return {
      id: YO,
      nombre: sesion ? `${sesion.nombre} ${sesion.apellidoPaterno}`.trim() : 'Postulante',
      deporte: sport || delClub?.nombre || 'Sin deporte',
      nivel: delClub ? NOMBRES_NIVEL[delClub.nivel] ?? 'Sin nivel' : 'Sin nivel',
      colorFrom: colorFrom ?? '#7C3AED',
      fotoUri: sesion?.fotoPerfil ?? null,
    };
  }

  function enviarPostulacion() {
    const r = postular(clubId, miPerfil());
    if (!r.ok) {
      Alert.alert('No se pudo postular', r.motivo);
      return;
    }
    const prueba = convocatoria?.fecha ? ` La prueba es el ${fechaCorta(convocatoria.fecha)}.` : '';
    Alert.alert('Postulación enviada', `El club revisará tu perfil y te avisaremos con el resultado.${prueba}`);
  }

  function confirmarRetiro() {
    Alert.alert('Retirar postulación', '¿Quieres retirar tu postulación a esta convocatoria?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Retirar',
        style: 'destructive',
        onPress: () => {
          const r = retirarPostulacion(idPostulacion(clubId, YO));
          if (!r.ok) Alert.alert('No se pudo retirar', r.motivo);
        },
      },
    ]);
  }

  function abrirConsultas() {
    router.push({ pathname: '/(deportista)/chat-club/[id]', params: { id: clubId } } as never);
  }

  // Detalle completo de la convocatoria: lo que necesitas saber antes y después de postular.
  const filas: { etiqueta: string; valor: string }[] = convocatoria
    ? [
        { etiqueta: 'Deporte', valor: convocatoria.deporte ?? '' },
        { etiqueta: 'Categoría / edad', valor: convocatoria.categoria ?? '' },
        { etiqueta: 'Fecha de la prueba', valor: convocatoria.fecha ? fechaCorta(convocatoria.fecha) : '' },
        { etiqueta: 'Cupos', valor: convocatoria.cupos !== undefined ? String(convocatoria.cupos) : '' },
        { etiqueta: 'Requisitos', valor: convocatoria.requisitos ?? '' },
      ].filter((f) => f.valor !== '')
    : [];
  const detalle =
    filas.length > 0 ? (
      <View style={styles.detalle}>
        {filas.map((f) => (
          <View key={f.etiqueta} style={styles.detalleFila}>
            <Text style={styles.detalleEtiqueta}>{f.etiqueta}</Text>
            <Text style={styles.detalleValor}>{f.valor}</Text>
          </View>
        ))}
      </View>
    ) : null;

  // Resultado de tu postulación (se ve aunque la convocatoria ya esté cerrada).
  const bloqueEstado =
    estado === 'pendiente' ? (
      <>
        <View style={styles.pendienteBadge}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.pendienteText}>Postulación enviada · en revisión</Text>
        </View>
        <TouchableOpacity onPress={confirmarRetiro} style={styles.retirarButton} accessibilityLabel="Retirar postulación">
          <Text style={styles.retirarText}>Retirar postulación</Text>
        </TouchableOpacity>
      </>
    ) : estado === 'preseleccionada' ? (
      <>
        <View style={styles.preseleccionBadge}>
          <Ionicons name="star" size={16} color={colors.accent} />
          <Text style={styles.preseleccionText}>El club te preseleccionó · falta su respuesta final</Text>
        </View>
        <TouchableOpacity onPress={confirmarRetiro} style={styles.retirarButton} accessibilityLabel="Retirar postulación">
          <Text style={styles.retirarText}>Retirar postulación</Text>
        </TouchableOpacity>
      </>
    ) : estado === 'aceptada' ? (
      <View style={styles.postuladoBadge}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={styles.postuladoText}>¡El club aceptó tu postulación!</Text>
      </View>
    ) : estado === 'rechazada' ? (
      <View style={styles.rechazadoBadge}>
        <Ionicons name="close-circle" size={16} color={colors.danger} />
        <Text style={styles.rechazadoText}>El club no aceptó tu postulación</Text>
      </View>
    ) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>

      <View style={[styles.avatar, { backgroundColor: colorFrom ?? '#7C3AED' }]}>
        <Ionicons name="shield" size={36} color="#fff" />
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{[sport, comuna].filter(Boolean).join(' · ')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre el club</Text>
        <Text style={styles.sectionText}>
          Club deportivo con entrenamientos regulares y espacio para nuevos integrantes que quieran competir y mejorar su nivel.
        </Text>
      </View>

      {abierta && convocatoria ? (
        <View style={styles.convocatoria}>
          <View style={styles.convocatoriaHeader}>
            <Ionicons name="megaphone-outline" size={16} color={colors.success} />
            <Text style={styles.convocatoriaTitle}>Convocatoria abierta</Text>
          </View>
          <Text style={styles.convocatoriaNombre}>{convocatoria.titulo}</Text>
          {convocatoria.descripcion ? <Text style={styles.convocatoriaText}>{convocatoria.descripcion}</Text> : null}
          {detalle}

          {bloqueEstado ?? (
            <TouchableOpacity style={styles.postularButton} onPress={enviarPostulacion}>
              <Text style={styles.postularButtonText}>Postular a esta convocatoria</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.convocatoria}>
            <View style={styles.convocatoriaHeader}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <Text style={styles.convocatoriaTitle}>Sin convocatoria abierta</Text>
            </View>
            {convocatoria && bloqueEstado ? (
              <>
                <Text style={styles.convocatoriaNombre}>{convocatoria.titulo}</Text>
                <Text style={styles.convocatoriaText}>La convocatoria ya está cerrada. Este es el detalle de tu postulación:</Text>
                {detalle}
              </>
            ) : (
              <Text style={[styles.convocatoriaText, !bloqueEstado && styles.sinMargen]}>
                Este club no tiene una convocatoria abierta por ahora.
              </Text>
            )}
            {bloqueEstado}
          </View>
        </>
      )}

      {/* HU-51: canal de consultas con el club */}
      {abierta || hilo ? (
        <TouchableOpacity style={styles.consultaButton} onPress={abrirConsultas} activeOpacity={0.8} accessibilityLabel="Abrir consultas con el club">
          <View style={styles.consultaIcono}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.consultaTextos}>
            <Text style={styles.consultaTitulo}>{hilo ? 'Mis consultas al club' : 'Hacer una consulta'}</Text>
            <Text style={styles.consultaSub}>
              {hilo ? (abierta ? 'Revisa las respuestas o escribe de nuevo' : 'La convocatoria está cerrada') : 'Resuelve tus dudas sobre pruebas y convocatoria'}
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
    avatar: { width: 84, height: 84, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    name: { color: c.text, fontSize: 19, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 20 },
    section: { width: '100%', marginBottom: 20 },
    sectionTitle: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    sectionText: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    convocatoria: { width: '100%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 14 },
    convocatoriaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    convocatoriaTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    convocatoriaNombre: { color: c.text, fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
    convocatoriaText: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
    sinMargen: { marginBottom: 0 },
    detalle: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 14 },
    detalleFila: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    detalleEtiqueta: { color: c.textMuted, fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
    detalleValor: { color: c.text, fontSize: 13, lineHeight: 18, marginTop: 2 },
    postularButton: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    postularButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    postuladoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.successBg, borderRadius: 12, paddingVertical: 12, justifyContent: 'center' },
    postuladoText: { color: c.success, fontSize: 13, fontWeight: '700' },
    preseleccionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.chip, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
    preseleccionText: { color: c.accent, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
    pendienteBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.chip, borderRadius: 12, paddingVertical: 12, justifyContent: 'center' },
    pendienteText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    rechazadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.dangerBg, borderRadius: 12, paddingVertical: 12, justifyContent: 'center' },
    rechazadoText: { color: c.danger, fontSize: 13, fontWeight: '700' },
    retirarButton: { alignItems: 'center', paddingTop: 12 },
    retirarText: { color: c.danger, fontSize: 12, fontWeight: '700' },
    consultaButton: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12 },
    consultaIcono: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    consultaTextos: { flex: 1 },
    consultaTitulo: { color: c.text, fontSize: 13, fontWeight: '700' },
    consultaSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    consultaBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    consultaBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  });