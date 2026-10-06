import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import { Usuario, getSession } from '../../../services/auth';
import { Persona, cargarMatching, darLike, descartar, getEstado, useMatches } from '../../../services/matchStore';
import { getAthleteProfile } from '../../../services/athletes';
import { getChat } from '../../../services/chat';
import { ApiError } from '../../../services/api';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function PerfilDeportistaScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { id, matchId } = useLocalSearchParams<{ id: string; matchId?: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const reload = useRef<() => void>(() => {});
  const requestBusy = useRef(false);
  const version = useRef(0);
  const estado = useMatches();

  useFocusEffect(useCallback(() => {
    let active = true;
    ++version.current;
    requestBusy.current = false; setSending(false); setNuevoMatch(null);
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

  function handlePasar() {
    if (!persona || requestBusy.current) return;
    descartar(persona.id);
    volver();
  }

  async function handleMeGusta() {
    if (!persona || requestBusy.current) return;
    const currentVersion = version.current;
    requestBusy.current = true; setSending(true);
    try {
      const resultado = await darLike(persona);
      if (currentVersion === version.current && resultado.matchId) setNuevoMatch(resultado);
    } catch (e) {
      if (currentVersion === version.current) Alert.alert('No se pudo enviar la solicitud', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      if (currentVersion === version.current) { requestBusy.current = false; setSending(false); }
    }
  }

  const accepted = persona?.matchId ?? estado.confirmados.find((p) => p.id === persona?.id)?.matchId;
  const outgoing = estado.enviadas.includes(persona?.id ?? '');
  const incoming = estado.solicitudes.some((p) => p.id === persona?.id);
  const closed = estado.ocultos.includes(persona?.id ?? '');

  function enviarMensajeDesdeMatch() {
    const conversationId = nuevoMatch?.matchId ?? accepted;
    setNuevoMatch(null);
    if (conversationId) router.navigate({ pathname: '/(deportista)/chat/[id]', params: { id: conversationId } });
  }

  if (!persona) return <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
    <TouchableOpacity onPress={volver} style={[styles.backButton, { top: insets.top + 12 }]} accessibilityLabel="Volver">
      <Ionicons name="arrow-back" size={18} color={colors.text} />
    </TouchableOpacity>
    <View style={{ padding: 30, marginTop: 60 }}>
      {loading ? <ActivityIndicator color={colors.accent} /> : <>
        <Text style={styles.bio}>{error}</Text>
        <TouchableOpacity onPress={() => expired ? router.replace('/(auth)/login') : reload.current()}>
          <Text style={styles.tagText}>{expired ? 'Iniciar sesión' : 'Reintentar'}</Text>
        </TouchableOpacity>
      </>}
    </View>
  </View>;

  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={volver} style={[styles.backButton, { top: insets.top + 12 }]} accessibilityLabel="Volver">
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Avatar
          name={persona.name}
          colorFrom={persona.colorFrom}
          uri={persona.fotoUri}
          style={styles.foto}
          fontSize={56}
        >
          <View style={styles.compatBadge}>
            <Text style={styles.compatText}>{persona.compatibility}% compatible</Text>
          </View>
        </Avatar>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {persona.name}{persona.age ? `, ${persona.age}` : ''}
            </Text>
            {persona.distance ? <Text style={styles.distance}>{persona.distance}</Text> : null}
          </View>

          {accepted && <Text style={[styles.tagText, { marginBottom: 12 }]}>♥ Tienen un match</Text>}
          <View style={[styles.tagsRow, { flexWrap: 'wrap' }]}>
            {(persona.deportes?.length ? persona.deportes : [{ nombre: persona.sport, nivel: persona.level }]).map((sport) => (
              <View key={sport.nombre} style={styles.tag}>
                <Text style={styles.tagText}>{sport.nombre} · {sport.nivel}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Sobre {persona.name.split(' ')[0]}</Text>
          <Text style={styles.bio}>
            {persona.bio || 'Todavía no agregó una biografía.'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        {accepted ? <TouchableOpacity style={styles.messageButton} onPress={enviarMensajeDesdeMatch}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" /><Text style={styles.messageText}>Enviar mensaje</Text>
        </TouchableOpacity> : outgoing ? <Text style={styles.tagText}>Solicitud enviada · pendiente de respuesta</Text>
        : incoming ? <TouchableOpacity onPress={() => router.navigate('/(deportista)/(tabs)/matches')}><Text style={styles.tagText}>Ver solicitud recibida</Text></TouchableOpacity>
        : closed ? <Text style={styles.bio}>Esta solicitud ya se cerró.</Text> : <>
          <TouchableOpacity style={styles.rejectButton} onPress={handlePasar} disabled={sending} accessibilityLabel="Pasar deportista">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.acceptButton, sending && { opacity: 0.5 }]} onPress={handleMeGusta} disabled={sending} accessibilityLabel="Enviar solicitud de match">
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="heart" size={24} color="#fff" />}
          </TouchableOpacity>
        </>}
      </View>

      <MatchModal
        visible={nuevoMatch !== null}
        miNombre={miNombre}
        miFoto={usuario?.fotoPerfil}
        nombre={nuevoMatch?.name ?? ''}
        colorFrom={nuevoMatch?.colorFrom ?? '#7C3AED'}
        fotoUri={nuevoMatch?.fotoUri}
        onEnviarMensaje={enviarMensajeDesdeMatch}
        onCerrar={() => setNuevoMatch(null)}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backButton: {
      position: 'absolute', left: 20, zIndex: 2, top: 60,
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
      flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 20,
      borderTopWidth: 1, borderColor: c.border,
    },
    messageButton: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: c.primary },
    messageText: { color: '#fff', fontWeight: '700' },
    rejectButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    acceptButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: '#DB2777',
      alignItems: 'center', justifyContent: 'center',
    },
  });
