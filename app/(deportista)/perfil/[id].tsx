import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import ReportarModal from '../../../components/ReportarModal';
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
  cargarMatching,
  darLike,
  descartar,
  getEstado,
  rechazarSolicitud,
  useMatches,
} from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function PerfilDeportistaScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const estado = useMatches();

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

  useFocusEffect(useCallback(() => {
    let active = true;
    ++version.current;
    ocupado.current = false; setEnviando(false); setNuevoMatch(null);
    async function load() {
      setPersona(null); setError(null); setExpired(false); setLoading(true);
      try {
        const session = await getSession();
        const athlete = matchId ? (await getChat(matchId)).persona : await getAthleteProfile(id);
        await cargarMatching();
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

  function handleEnviarCalificacion(estrellas: number, comentario: string) {
    calificar(p.id, estrellas, comentario);
    setCalificando(false);
  }

  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={volver} style={[styles.backButton, { top: insets.top + 12 }]} accessibilityLabel="Volver">
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setReportando(true)}
        style={[styles.reportButton, { top: insets.top + 12 }]}
        accessibilityLabel={`Reportar a ${p.name}`}
      >
        <Ionicons name="flag-outline" size={17} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Avatar
          name={p.name}
          colorFrom={p.colorFrom}
          uri={p.fotoUri}
          style={styles.foto}
          fontSize={56}
        >
          <View style={styles.compatBadge}>
            <Text style={styles.compatText}>{p.compatibility}% compatible</Text>
          </View>
        </Avatar>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {p.name}{p.age ? `, ${p.age}` : ''}
            </Text>
            {p.distance ? <Text style={styles.distance}>{p.distance}</Text> : null}
          </View>

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
        </View>
      </ScrollView>

      {/* ACCIONES según la relación con esta persona */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {esMatch ? (
          <>
            <TouchableOpacity style={styles.pillSecundario} onPress={() => setCalificando(true)}>
              <Ionicons
                name={miCalificacion ? 'star' : 'star-outline'}
                size={16}
                color={miCalificacion ? '#FACC15' : colors.accent}
              />
              <Text style={styles.pillSecundarioTexto}>
                {miCalificacion ? `Tu calificación: ${miCalificacion.estrellas}★` : 'Calificar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pillPrimario} onPress={() => irAlChat(false)}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
              <Text style={styles.pillPrimarioTexto}>Enviar mensaje</Text>
            </TouchableOpacity>
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
            <View style={styles.pillSecundario}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.accent} />
              <Text style={styles.pillSecundarioTexto}>Solicitud enviada</Text>
            </View>
            <TouchableOpacity style={styles.pillCancelar} onPress={handleCancelarSolicitud} disabled={enviando}>
              <Text style={styles.pillCancelarTexto}>Cancelar solicitud</Text>
            </TouchableOpacity>
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
    container: { flex: 1, backgroundColor: c.bg },
    backButton: {
      position: 'absolute', left: 20, zIndex: 2,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    reportButton: {
      position: 'absolute', right: 20, zIndex: 2,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingBottom: 30 },
    foto: { width: '100%', height: 320 },
    compatBadge: {
      position: 'absolute', bottom: 16, right: 16,
      backgroundColor: 'rgba(11,15,25,0.75)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    compatText: { color: '#4ADE80', fontSize: 12, fontWeight: '800' },
    info: { padding: 20 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
    name: { color: c.text, fontSize: 22, fontWeight: '700' },
    distance: { color: c.textMuted, fontSize: 12 },
    tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    tag: { backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
    tagText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    bio: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
    actions: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14,
      paddingTop: 16, paddingHorizontal: 20, borderTopWidth: 1, borderColor: c.border,
    },
    rejectButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    acceptButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: '#DB2777',
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
  });