import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import ReportarModal from '../../../components/ReportarModal';
import { Boton } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getAthleteProfile } from '../../../services/athletes';
import { Usuario, getSession } from '../../../services/auth';
import { getChat } from '../../../services/chat';
import {
  Persona,
  aceptarSolicitud,
  calificacionDe,
  calificar,
  cancelarSolicitud,
  cargarCalificaciones,
  cargarMatching,
  darLike,
  descartar,
  getEstado,
  rechazarSolicitud,
  useMatches,
} from '../../../services/matchStore';
import { bloquear, cargarBloqueados, desbloquear, useBloqueados } from '../../../services/reportes';
import { Colors, useAppTheme, espacio, radio, tipo } from '../../../theme/ThemeContext';

export default function PerfilDeportistaScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const estado = useMatches();
  const bloqueados = useBloqueados();

  // Solo el id viaja en la ruta; nombre, bio y foto los entrega el servidor (no se confía en la URL).
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId?: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [calificando, setCalificando] = useState(false);
  const [reportando, setReportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const reload = useRef<() => void>(() => {});
  const ocupado = useRef(false);
  const version = useRef(0);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const [proporcion, setProporcion] = useState(0.8);
  useEffect(() => {
    let activo = true;
    setProporcion(0.8);
    if (persona?.fotoUri) Image.getSize(persona.fotoUri, (ancho, alto) => {
      if (activo && ancho > 0 && alto > 0) setProporcion(Math.min(1.3, Math.max(0.7, ancho / alto)));
    }, () => {});
    return () => { activo = false; };
  }, [persona?.fotoUri]);

  useFocusEffect(useCallback(() => {
    let active = true;
    ++version.current;
    ocupado.current = false; setEnviando(false); setNuevoMatch(null);
    async function load() {
      setPersona(null); setError(null); setExpired(false); setLoading(true);
      try {
        const session = await getSession();
        const athlete = matchId ? (await getChat(matchId)).persona : await getAthleteProfile(id);
        await Promise.all([cargarMatching(), cargarCalificaciones().catch(() => {}), cargarBloqueados().catch(() => {})]);
        const currentSession = await getSession();
        if (!active) return;
        if (currentSession?.id !== session?.id) throw new ApiError('La sesión cambió.', 401, '');
        if (getEstado().matchingError) throw new Error(getEstado().matchingError!);
        setUsuario(session); setPersona(athlete);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil.');
          setExpired(e instanceof ApiError && e.status === 401);
        }
      } finally { if (active) setLoading(false); }
    }
    reload.current = () => { void load(); };
    void load();
    return () => { active = false; ++version.current; reload.current = () => {}; };
  }, [id, matchId]));

  function volver() {
    if (router.canGoBack()) router.back();
    else router.replace('/(deportista)/(tabs)/discover');
  }

  if (!persona) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={volver} style={[styles.backButton, { top: insets.top + 12 }]} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ padding: 30, marginTop: 60 }}>
          {loading ? <ActivityIndicator color={colors.accent} /> : (
            <>
              <Text style={styles.bio}>{error}</Text>
              <TouchableOpacity onPress={() => expired ? router.replace('/(auth)/login') : reload.current()}>
                <Text style={styles.tagText}>{expired ? 'Iniciar sesión' : 'Reintentar'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }
  const p = persona;

  const matchAceptado = p.matchId ?? estado.confirmados.find((x) => x.id === p.id)?.matchId;
  const esMatch = matchAceptado !== undefined;
  const esSolicitud = estado.solicitudes.some((x) => x.id === p.id);
  const esEnviada = estado.enviadas.includes(p.id);
  const cerrada = estado.ocultos.includes(p.id);
  const miCalificacion = calificacionDe(estado, p.id);

  function irAlChat(reemplazar: boolean, conversacion = matchAceptado) {
    if (!conversacion) return;
    const destino = { pathname: '/(deportista)/chat/[id]' as const, params: { id: conversacion } };
    if (reemplazar) router.replace(destino);
    else router.push(destino);
  }

  /** Ejecuta una acción del servidor una sola vez a la vez, y descarta el resultado si cambió la pantalla. */
  async function accion(titulo: string, hacer: () => Promise<void>) {
    if (ocupado.current) return;
    const actual = version.current;
    ocupado.current = true; setEnviando(true);
    try {
      await hacer();
    } catch (e) {
      if (actual === version.current) Alert.alert(titulo, e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      if (actual === version.current) { ocupado.current = false; setEnviando(false); }
    }
  }

  function handlePasar() {
    if (ocupado.current) return;
    descartar(p.id);
    volver();
  }

  function handleMeGusta() {
    void accion('No se pudo enviar la solicitud', async () => {
      const resultado = await darLike(p);
      // Si la otra persona ya te había dado like, el servidor responde con el match.
      if (resultado.matchId) setNuevoMatch(resultado);
    });
  }

  function handleAceptar() {
    void accion('No se pudo aceptar', async () => {
      setNuevoMatch(await aceptarSolicitud(p.id));
    });
  }

  function handleRechazar() {
    void accion('No se pudo rechazar', async () => {
      await rechazarSolicitud(p.id);
      volver();
    });
  }

  function handleCancelarSolicitud() {
    const primerNombre = p.name.split(' ')[0];
    Alert.alert('Cancelar solicitud', `¿Quieres cancelar tu solicitud a ${primerNombre}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          void accion('No se pudo cancelar', async () => {
            await cancelarSolicitud(p.id);
            volver();
          });
        },
      },
    ]);
  }

  async function handleEnviarCalificacion(estrellas: number, comentario: string) {
    try {
      await calificar(p.id, estrellas, comentario);
      setCalificando(false);
    } catch (e) {
      Alert.alert('No se pudo calificar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';
  const bloqueado = bloqueados.includes(p.id);

  function confirmarBloqueo() {
    const nombre = p.name.split(' ')[0];
    Alert.alert(
      bloqueado ? `Desbloquear a ${nombre}` : `Bloquear a ${nombre}`,
      bloqueado
        ? 'Volverán a aparecer en Descubrir para ambos.'
        : 'Ninguno de los dos verá al otro en Descubrir ni podrá escribirle. Sus matches, mensajes y actividades se conservan y vuelven al desbloquear.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: bloqueado ? 'Desbloquear' : 'Bloquear',
          style: bloqueado ? 'default' : 'destructive',
          onPress: async () => {
            const r = bloqueado ? await desbloquear(p.id) : await bloquear(p.id);
            if (!r.ok) Alert.alert('No se pudo completar', r.motivo);
            else if (!bloqueado) descartar(p.id);
          },
        },
      ]
    );
  }
  const tieneFoto = !!persona.fotoUri;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={volver} style={[styles.backButton, { top: insets.top + 12 }]} accessibilityLabel="Volver">
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setReportando(true)}
        style={[styles.reportButton, { top: insets.top + 12 }]}
        accessibilityLabel={`Reportar a ${p.name}`}
      >
        <Ionicons name="flag-outline" size={19} color="#fff" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Tocar la foto la abre completa, sin recortar */}
        <TouchableOpacity
          activeOpacity={tieneFoto ? 0.9 : 1}
          onPress={() => tieneFoto && setFotoAmpliada(true)}
          accessibilityLabel={tieneFoto ? `Ampliar foto de ${persona.name}` : undefined}
        >
          <Avatar
            name={persona.name}
            colorFrom={persona.colorFrom}
            uri={persona.fotoUri}
            style={[styles.foto, { aspectRatio: tieneFoto ? proporcion : 1 }]}
            fontSize={56}
          >
            {tieneFoto ? (
              <View style={styles.ampliarBadge} pointerEvents="none">
                <Ionicons name="expand-outline" size={16} color="#fff" />
              </View>
            ) : null}
            <View style={styles.compatBadge}>
              <Text style={styles.compatText}>{persona.compatibility}% compatible</Text>
            </View>
          </Avatar>
        </TouchableOpacity>

        <View style={styles.info}>
            <Text style={styles.name}>
              {p.name}{p.age ? `, ${p.age}` : ''}
            </Text>
            {p.distance ? <View style={styles.distanciaFila}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.distance}>A {p.distance} de ti</Text>
            </View> : null}

          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{p.sport}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{p.level}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Sobre {p.name.split(' ')[0]}</Text>
          <Text style={styles.bio}>
            {p.bio || 'Todavía no agregó una biografía.'}
          </Text>

          <TouchableOpacity style={styles.bloquear} onPress={confirmarBloqueo}
            accessibilityLabel={bloqueado ? `Desbloquear a ${p.name}` : `Bloquear a ${p.name}`}>
            <Ionicons name={bloqueado ? 'lock-open-outline' : 'ban-outline'} size={15}
              color={bloqueado ? colors.textMuted : colors.danger} />
            <Text style={[styles.bloquearTexto, bloqueado && { color: colors.textMuted }]}>
              {bloqueado ? 'Bloqueado · Desbloquear' : `Bloquear a ${p.name.split(' ')[0]}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ACCIONES según la relación con esta persona */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {esMatch ? (
          <>
            <Boton variante="secundario" icono={miCalificacion ? 'star' : 'star-outline'}
              texto={miCalificacion ? `Tu calificación: ${miCalificacion.estrellas}★` : 'Calificar'}
              onPress={() => setCalificando(true)} style={styles.accionFlex} />
            <Boton icono="chatbubble-ellipses" texto="Enviar mensaje" onPress={() => irAlChat(false)} style={styles.accionFlex} />
          </>
        ) : esSolicitud ? (
          <>
            <TouchableOpacity style={styles.rejectButton} onPress={handleRechazar} disabled={enviando}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.aceptarButton} onPress={handleAceptar} disabled={enviando}>
              <Ionicons name="checkmark" size={26} color="#fff" />
            </TouchableOpacity>
          </>
        ) : esEnviada ? (
          <>
            <View style={styles.enviada}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.accent} />
              <Text style={styles.enviadaTexto}>Solicitud enviada</Text>
            </View>
            <Boton variante="peligro" texto="Cancelar solicitud" onPress={handleCancelarSolicitud} deshabilitado={enviando} style={styles.accionFlex} />
          </>
        ) : cerrada ? (
          <Text style={styles.bio}>Esta solicitud ya se cerró.</Text>
        ) : (
          <>
            <TouchableOpacity style={styles.rejectButton} onPress={handlePasar} disabled={enviando}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={handleMeGusta} disabled={enviando}>
              <Ionicons name="heart" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* FOTO AMPLIADA: se ve completa (contain), se cierra tocando en cualquier parte o con la X */}
      <Modal
        visible={fotoAmpliada}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFotoAmpliada(false)}
      >
        <Pressable style={styles.visorFondo} onPress={() => setFotoAmpliada(false)}>
          {persona.fotoUri ? (
            <Image source={{ uri: persona.fotoUri }} style={styles.visorImagen} resizeMode="contain" />
          ) : null}

          <TouchableOpacity
            onPress={() => setFotoAmpliada(false)}
            style={[styles.visorCerrar, { top: insets.top + 12 }]}
            accessibilityLabel="Cerrar foto"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={[styles.visorPie, { paddingBottom: insets.bottom + 20 }]} pointerEvents="none">
            <Text style={styles.visorNombre}>
              {persona.name}{persona.age ? `, ${persona.age}` : ''}
            </Text>
          </View>
        </Pressable>
      </Modal>

      <MatchModal
        visible={nuevoMatch !== null}
        miNombre={miNombre}
        miFoto={usuario?.fotoPerfil}
        nombre={nuevoMatch?.name ?? ''}
        colorFrom={nuevoMatch?.colorFrom ?? '#7C3AED'}
        fotoUri={nuevoMatch?.fotoUri}
        onEnviarMensaje={() => {
          const conversacion = nuevoMatch?.matchId;
          setNuevoMatch(null);
          irAlChat(true, conversacion);
        }}
        onCerrar={() => setNuevoMatch(null)}
      />

      <RatingModal
        visible={calificando}
        nombre={p.name}
        calificacionActual={miCalificacion}
        onEnviar={handleEnviarCalificacion}
        onCerrar={() => setCalificando(false)}
      />

      {/* Reportar usuario (HU-42) */}
      <ReportarModal
        visible={reportando}
        onClose={() => setReportando(false)}
        tipo="usuario"
        objetivoId={p.id}
        objetivoNombre={p.name}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    distanciaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2, marginTop: espacio.xs + 2 },
    accionFlex: { flex: 1 },
    enviada: {
      flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
    },
    enviadaTexto: { color: c.text, ...tipo.cuerpoFuerte },

    container: { flex: 1, backgroundColor: c.bg },
    backButton: {
      position: 'absolute', left: espacio.l, zIndex: 2,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(11,15,25,0.6)',
      alignItems: 'center', justifyContent: 'center',
    },
    reportButton: {
      position: 'absolute', right: espacio.l, zIndex: 2,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(11,15,25,0.6)',
      alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingBottom: espacio.xxl + espacio.s },
    foto: { width: '100%' },
    compatBadge: {
      position: 'absolute', bottom: espacio.l, right: espacio.l,
      backgroundColor: 'rgba(11,15,25,0.6)', paddingHorizontal: espacio.m, paddingVertical: espacio.s - 2, borderRadius: radio.tarjeta + 4,
    },
    compatText: { color: '#4ADE80', ...tipo.cuerpoFuerte, fontWeight: '800' },
    ampliarBadge: {
      position: 'absolute', bottom: espacio.l, left: espacio.l,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: 'rgba(11,15,25,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    info: { padding: espacio.xl },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
    name: { color: c.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
    distance: { color: c.textMuted, ...tipo.cuerpo, flexShrink: 1 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginTop: espacio.l, marginBottom: espacio.xl },
    tag: { backgroundColor: c.chip, borderRadius: radio.control, paddingHorizontal: espacio.m, paddingVertical: espacio.s - 1 },
    tagText: { color: c.accent, ...tipo.cuerpoFuerte },
    sectionTitle: { color: c.text, ...tipo.seccion, marginBottom: espacio.s },
    bio: { color: c.textMuted, ...tipo.cuerpo, fontSize: 14, lineHeight: 21 },
    bloquear: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, alignSelf: 'flex-start', paddingVertical: 6 },
    bloquearTexto: { color: c.danger, fontSize: 12.5, fontWeight: '700' },
    actions: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: espacio.l,
      paddingTop: espacio.l, paddingHorizontal: espacio.xl, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.bg,
    },
    rejectButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    acceptButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    aceptarButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: '#16A34A',
      alignItems: 'center', justifyContent: 'center',
    },
    pillPrimario: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14,
    },
    pillPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
    pillSecundario: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14,
    },
    pillSecundarioTexto: { color: c.text, fontSize: 13, fontWeight: '700' },
    pillCancelar: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.danger, borderRadius: 14, paddingVertical: 14,
    },
    pillCancelarTexto: { color: c.danger, fontSize: 13, fontWeight: '700' },

    // Visor de foto (siempre oscuro, como un visor de imágenes)
    visorFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
    visorImagen: { width: '100%', height: '100%' },
    visorCerrar: {
      position: 'absolute', right: espacio.xl,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
    },
    visorPie: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: espacio.m },
    visorNombre: { color: '#FFFFFF', ...tipo.seccion },
  });
