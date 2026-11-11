import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTecladoVisible } from '../../../hooks/use-teclado';
import ReportarModal from '../../../components/ReportarModal';
import Avatar from '../../../components/Avatar';
import { Boton } from '../../../components/ui';
import { cargarActividad, useActividades, visualDeporte } from '../../../services/actividades';
import { horaCorta } from '../../../services/chat';
import {
  MAX_MENSAJE_GRUPAL,
  abrirSala,
  cerrarSala,
  cargarAlrededorDe,
  cargarChatsGrupales,
  enviarMensajeGrupal,
  silenciarSala,
  useChatGrupal,
  useEstadoChatGrupal,
  useSalaGrupal,
  type MensajeGrupal,
} from '../../../services/chatGrupal';
import { Colors, useAppTheme, espacio, radio, tipo } from '../../../theme/ThemeContext';
export default function ChatGrupoScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tecladoVisible = useTecladoVisible();
  const margenInferior = tecladoVisible ? espacio.s : insets.bottom + espacio.m;
  const { id } = useLocalSearchParams<{
    id: string
  }>();
  const actividadId = id ?? '';
  const actividades = useActividades();
  const actividad = actividades.find((x) => x.id === actividadId);
  const chat = useChatGrupal(actividadId);
  const estadoChat = useEstadoChatGrupal();
  const sala = useSalaGrupal(actividadId);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [citando, setCitando] = useState<MensajeGrupal | null>(null);
  const [contextoCita, setContextoCita] = useState<MensajeGrupal[] | null>(null);
  const [destinoCita, setDestinoCita] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ocupado = useRef(false);
  const version = useRef(0);
  useEffect(() => {
    const actual = ++version.current;
    setCitando(null); setContextoCita(null); setDestinoCita(null); setTexto('');
    ocupado.current = false; setEnviando(false);
    return () => { version.current = actual + 1; };
  }, [actividadId]);
  const [reporte, setReporte] = useState<{
    id: string;
    nombre: string
  } | null>(null);
  const ultimoReporte = useRef<{
    id: string;
    nombre: string
  }>({ id: '', nombre: '' });
  if (reporte) ultimoReporte.current = reporte;
  const listaRef = useRef<FlatList<MensajeGrupal>>(null);
  const mensajes = useMemo(() => contextoCita ?? sala?.mensajes ?? [], [contextoCita, sala?.mensajes]);
  useEffect(() => {
    if (!destinoCita) return;
    const index = mensajes.findIndex((m) => m.id === destinoCita);
    if (index < 0) return;
    const timer = setTimeout(() => listaRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 250);
    return () => clearTimeout(timer);
  }, [destinoCita, mensajes]);
  // Los cambios de participación o cancelación cortan el acceso al instante.
  const acceso = sala?.acceso ?? chat?.acceso ?? 'ninguno';
  const hayAcceso = acceso !== 'ninguno';
  // Mientras el chat está abierto, sus mensajes cuentan como leídos.
  useFocusEffect(useCallback(() => {
    if (!actividadId) return;
    void cargarActividad(actividadId);
    void cargarChatsGrupales().catch(() => {});
    abrirSala(actividadId);
    return () => cerrarSala(actividadId);
  }, [actividadId]));
  // ---------- sin acceso (HU-50: se actualiza si te retiras o se cancela) ----------
  if (!sala || !hayAcceso) {
    const cancelada = actividad?.cancelada === true;
    return (
      <View style={[styles.container, { paddingTop: insets.top + espacio.m }]}>
        <View style={styles.topbarSimple}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.sinAcceso}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={styles.sinAccesoTitulo}>{estadoChat.error ?? (cancelada ? 'La actividad fue cancelada' : 'Cargando chat...')}</Text>
          <Text style={styles.sinAccesoTexto}>
            {cancelada
              ? 'El chat grupal se cerró junto con la actividad.'
              : 'Solo quien organiza y las personas aprobadas pueden participar en el chat del grupo.'}
          </Text>
          <TouchableOpacity style={styles.volverBtn} onPress={() => router.back()}>
            <Text style={styles.volverTexto}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  const visual = visualDeporte(actividad?.deporte ?? chat?.deporteCodigo ?? '');
  const participantes = sala.participantes;
  const soloLectura = acceso === 'leer';
  async function enviar() {
    if (ocupado.current || soloLectura) return;
    ocupado.current = true; setEnviando(true);
    const actual = version.current;
    const r = await enviarMensajeGrupal(actividadId, texto, citando?.id);
    if (actual !== version.current) return;
    ocupado.current = false; setEnviando(false);
    if (r.ok) {
      setTexto('');
      setError('');
      setCitando(null); setContextoCita(null); setDestinoCita(null);
    } else {
      setError(r.motivo);
    }
  }
  function abrirOpciones() {
    Alert.alert(chat?.titulo ?? actividad?.titulo ?? 'Chat grupal', undefined, [
      {
        text: sala!.silenciado ? 'Reactivar avisos' : 'Silenciar avisos',
        onPress: () => {
          silenciarSala(actividadId, !sala!.silenciado).then((r) => {
            if (!r.ok) setError(r.motivo);
          });
        },
      },
      { text: 'Ver la actividad', onPress: verActividad },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }
  function verActividad() {
    router.push({ pathname: '/(deportista)/activity/[id]', params: { id: actividadId } });
  }
  function reportarMensaje(m: MensajeGrupal) {
    const resumen = m.texto.length > 60 ? `${m.texto.slice(0, 60)}…` : m.texto;
    setReporte({ id: `grupo-${actividadId}:${m.id}`, nombre: `Mensaje de ${m.autorNombre}: "${resumen}"` });
  }
  function opcionesMensaje(m: MensajeGrupal) {
    Alert.alert('Mensaje', undefined, [
      ...(!soloLectura ? [{ text: 'Responder', onPress: () => setCitando(m) }] : []),
      ...(!m.propio ? [{ text: 'Reportar mensaje', style: 'destructive' as const, onPress: () => reportarMensaje(m) }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }
  async function irAlMensaje(m: MensajeGrupal) {
    const cita = m.cita;
    if (!cita?.disponible || !cita.id) return;
    const actual = version.current;
    try {
      if (!mensajes.some((item) => item.id === cita.id)) {
        const pagina = await cargarAlrededorDe(actividadId, cita.id);
        if (actual !== version.current) return;
        if (!pagina.some((item) => item.id === cita.id)) { setError('Mensaje no disponible.'); return; }
        setContextoCita(pagina);
      }
      setDestinoCita(cita.id);
    } catch (e) {
      if (actual === version.current) setError(e instanceof Error ? e.message : 'No se pudo cargar el mensaje.');
    }
  }
  function mostrarCita(m: MensajeGrupal) {
    if (!m.cita) return null;
    return <TouchableOpacity style={styles.cita} disabled={!m.cita.disponible} onPress={() => irAlMensaje(m)} accessibilityLabel="Ir al mensaje citado">
      <Text style={m.propio ? styles.bubbleTextOwn : styles.autor} numberOfLines={1}>{m.cita.disponible ? m.cita.autorNombre : 'Mensaje no disponible'}</Text>
      {m.cita.disponible ? <Text style={m.propio ? styles.bubbleTextOwn : styles.bubbleTextOther} numberOfLines={2}>{m.cita.texto}</Text> : null}
    </TouchableOpacity>;
  }
  function renderMensaje({ item }: {
    item: MensajeGrupal
  }) {
    if (item.propio) {
      return (
        <TouchableOpacity onLongPress={() => opcionesMensaje(item)} delayLongPress={350} style={[styles.bubble, styles.bubbleOwn]} accessibilityHint="Mantén presionado para responder">
          {mostrarCita(item)}
          <Text style={styles.bubbleTextOwn}>{item.texto}</Text>
          <Text style={styles.horaOwn}>{horaCorta(item.enviadoEn)}</Text>
        </TouchableOpacity>
      );
    }
    return (
      // Mantén presionado un mensaje de otra persona para reportarlo.
      <TouchableOpacity
        activeOpacity={0.8}
        delayLongPress={350}
        onLongPress={() => opcionesMensaje(item)}
        style={[styles.bubble, styles.bubbleOther]}
        accessibilityHint="Mantén presionado para responder o reportar este mensaje"
      >
        <TouchableOpacity style={styles.autorFila} onPress={() => router.push({ pathname: '/(deportista)/perfil/[id]', params: { id: item.autorId } })} accessibilityLabel={`Ver perfil de ${item.autorNombre}`}>
          <Avatar name={item.autorNombre} colorFrom="#7C3AED" uri={item.autorFoto} style={styles.autorFoto} fontSize={10} />
          <Text style={styles.autor}>{item.autorNombre}</Text>
        </TouchableOpacity>
        {mostrarCita(item)}
        <Text style={styles.bubbleTextOther}>{item.texto}</Text>
        <Text style={styles.horaOther}>{horaCorta(item.enviadoEn)}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + espacio.m }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topbarCentro} onPress={verActividad} activeOpacity={0.7}>
          <View style={[styles.iconBox, { backgroundColor: visual.colorBg }]}>
            <MaterialCommunityIcons name={visual.icon} size={24} color={visual.color} />
          </View>
          <View style={styles.topbarTextos}>
            <Text style={styles.name} numberOfLines={1}>{chat?.titulo ?? actividad?.titulo}</Text>
            <View style={styles.subtitulo}>
              <Text style={styles.sport}>{participantes} {participantes === 1 ? 'participante' : 'participantes'}</Text>
              {sala.silenciado ? (
                <View style={styles.etiqueta}>
                  <Ionicons name="notifications-off-outline" size={11} color={colors.textMuted} />
                  <Text style={styles.etiquetaTexto}>Silenciado</Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={abrirOpciones} style={styles.backButton} accessibilityLabel="Opciones del grupo">
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={contextoCita ? <Boton texto="Volver a mensajes recientes" variante="secundario" onPress={() => { setContextoCita(null); setDestinoCita(null); }} /> : null}
        onContentSizeChange={() => {
          const index = destinoCita ? mensajes.findIndex((m) => m.id === destinoCita) : -1;
          if (index >= 0) listaRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
          else if (!contextoCita) listaRef.current?.scrollToEnd({ animated: true });
        }}
        onScrollBeginDrag={() => setDestinoCita(null)}
        onScrollToIndexFailed={({ averageItemLength, index }) => listaRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false })}
        renderItem={renderMensaje}
      />
      <Text style={[styles.errorTexto, { color: colors.textMuted }]}>El chat se borra 7 días después de la actividad</Text>
      {soloLectura ? (
        <View style={[styles.avisoBox, { paddingBottom: margenInferior }]}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={styles.avisoTexto}>La actividad ya finalizó: el chat quedó solo de lectura.</Text>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.errorTexto}>{error}</Text> : null}
          {citando ? <View style={styles.respondiendo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.autor}>{citando.propio ? 'Tú' : citando.autorNombre}</Text>
              <Text style={styles.sport} numberOfLines={1}>{citando.texto}</Text>
            </View>
            <TouchableOpacity onPress={() => setCitando(null)} style={styles.backButton} accessibilityLabel="Cancelar respuesta"><Ionicons name="close" size={18} color={colors.textMuted} /></TouchableOpacity>
          </View> : null}
          <View style={[styles.inputRow, { paddingBottom: margenInferior }]}>
            <TextInput
              placeholder="Escribe al grupo..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                if (error) setError('');
              }}
              onSubmitEditing={enviar}
              returnKeyType="send"
              maxLength={MAX_MENSAJE_GRUPAL}
              editable={!enviando}
            />
            <TouchableOpacity style={[styles.sendButton, (enviando || !texto.trim()) && { opacity: 0.5 }]} disabled={enviando || !texto.trim()} onPress={enviar} accessibilityLabel="Enviar mensaje">
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
      {/* Reportar un mensaje del grupo (HU-42) */}
      <ReportarModal
        visible={reporte !== null}
        onClose={() => setReporte(null)}
        tipo="mensaje"
        objetivoId={ultimoReporte.current.id}
        objetivoNombre={ultimoReporte.current.nombre}
      />
    </KeyboardAvoidingView>
  );
}
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    cita: { borderLeftWidth: 3, borderColor: c.accent, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: radio.control, padding: espacio.s, marginBottom: espacio.s },
    respondiendo: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.chip, borderLeftWidth: 4, borderColor: c.accent, marginHorizontal: espacio.l, paddingLeft: espacio.m, borderRadius: radio.control },
    autorFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.xs },
    autorFoto: { width: 24, height: 24, borderRadius: 12 },
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m, borderBottomWidth: 1, borderColor: c.border },
    topbarSimple: { paddingHorizontal: espacio.l, marginBottom: espacio.l },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topbarCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 44 },
    topbarTextos: { flex: 1 },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 17 },
    name: { color: c.text, ...tipo.seccion },
    subtitulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
    sport: { color: c.textMuted, ...tipo.dato },
    etiqueta: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
    etiquetaTexto: { color: c.textMuted, ...tipo.etiqueta },
    list: { padding: espacio.xl, gap: espacio.m },
    bubble: { maxWidth: '78%', borderRadius: radio.tarjeta, paddingHorizontal: espacio.l - 2, paddingVertical: espacio.m - 1, marginBottom: espacio.xs },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: espacio.xs },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: espacio.xs },
    autor: { color: c.accent, ...tipo.etiqueta, fontWeight: '700', marginBottom: 3 },
    bubbleTextOther: { color: c.text, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    bubbleTextOwn: { color: '#FFFFFF', ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    horaOther: { color: c.textMuted, ...tipo.etiqueta, fontWeight: '400', marginTop: 3, alignSelf: 'flex-end' },
    horaOwn: { color: 'rgba(255,255,255,0.75)', ...tipo.etiqueta, fontWeight: '400', marginTop: 3, alignSelf: 'flex-end' },
    sistema: { alignSelf: 'center', backgroundColor: c.chip, borderRadius: radio.control, paddingHorizontal: espacio.m, paddingVertical: espacio.xs + 1, marginVertical: espacio.xs, maxWidth: '90%' },
    sistemaTexto: { color: c.textMuted, ...tipo.dato, textAlign: 'center' },
    demoLink: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    demoLinkTexto: { color: c.textMuted, ...tipo.etiqueta },
    errorTexto: { color: c.danger, ...tipo.dato, paddingHorizontal: espacio.xl, paddingBottom: espacio.s - 2 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingTop: espacio.m, paddingHorizontal: espacio.l, borderTopWidth: 1, borderColor: c.border },
    input: { flex: 1, minHeight: 44, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: espacio.l, paddingVertical: espacio.s, color: c.text, fontSize: 14, fontWeight: '400' },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avisoBox: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      paddingTop: espacio.m, paddingHorizontal: espacio.l, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    avisoTexto: { flex: 1, color: c.textMuted, ...tipo.dato, lineHeight: 17 },
    sinAcceso: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espacio.xxl + espacio.s, gap: espacio.s },
    sinAccesoTitulo: { color: c.text, ...tipo.seccion, marginTop: espacio.s - 2, textAlign: 'center' },
    sinAccesoTexto: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', lineHeight: 19 },
    volverBtn: { marginTop: espacio.l, alignSelf: 'stretch' },
    volverTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });
