import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import ReportarModal from '../../../components/ReportarModal';
import { ApiError } from '../../../services/api';
import {
  abrirChat, cerrarChat, ENVIO_DE_FOTOS_DISPONIBLE, enviarMensaje, enviarUbicacion, getChat, getMensajes, MensajeApi,
  silenciarChat, useSilenciados, type UbicacionChat,
} from '../../../services/chat';
import { solicitarUbicacion } from '../../../services/location';
import { Persona } from '../../../services/matchStore';
import { bloquear, desbloquear, useBloqueados, type TipoReporte } from '../../../services/reportes';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

/** Lo que se está reportando desde el chat (HU-42): la persona o un mensaje suyo. */
type ObjetivoReporte = { tipo: TipoReporte; id: string; nombre: string };

function fusionar(actuales: MensajeApi[], nuevos: MensajeApi[]) {
  return [...new Map([...actuales, ...nuevos].map((m) => [m.id, m])).values()]
    .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
}

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  // id = match; personaId = la otra persona (lo manda la lista, para poder desbloquear aunque el chat no abra).
  const { id, personaId: personaParam } = useLocalSearchParams<{ id: string; personaId?: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const personaId = persona?.id ?? personaParam ?? '';
  const silenciado = useSilenciados().includes(personaId);
  const bloqueado = useBloqueados().includes(personaId);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [miId, setMiId] = useState('');
  const [mensajes, setMensajes] = useState<MensajeApi[]>([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [anteriores, setAnteriores] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const actualizarRef = useRef<() => void>(() => {});
  const listaRef = useRef<FlatList<MensajeApi>>(null);
  const ultimoId = useRef<string | undefined>(undefined);
  const generacion = useRef(0);
  const envioPendiente = useRef<{ text: string; clientId: string } | null>(null);
  const envioEnCurso = useRef(false);
  const desplazar = useRef(true);
  const [reporte, setReporte] = useState<ObjetivoReporte | null>(null);
  // Se recuerda el último objetivo para que el formulario no cambie de texto mientras se cierra.
  const ultimoReporte = useRef<ObjetivoReporte>({ tipo: 'usuario', id: '', nombre: '' });
  if (reporte) ultimoReporte.current = reporte;

  const mostrarError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'No se pudo conectar con el chat.');
    if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
      setDisponible(false);
      setMensajes([]);
      ultimoId.current = undefined;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const version = ++generacion.current;
    let activo = true;
    let consultando = false;
    setPersona(null); setMensajes([]); setDisponible(false); setCargando(true); setError(null);
    setCargandoAnteriores(false); desplazar.current = true;
    setTexto(''); setEnviando(false); envioEnCurso.current = false; envioPendiente.current = null;
    ultimoId.current = undefined;
    async function actualizar() {
      if (!activo || consultando || AppState.currentState !== 'active') return;
      consultando = true;
      try {
        const chat = await getChat(id);
        const nuevos = await getMensajes(id, { after: ultimoId.current });
        if (!activo || version !== generacion.current) return;
        setPersona(chat.persona); setMiId(chat.userId); setDisponible(true); setError(null);
        if (!ultimoId.current) setAnteriores(nuevos.length === 50);
        if (nuevos.length) {
          ultimoId.current = nuevos[nuevos.length - 1].id;
          setMensajes((prev) => fusionar(prev, nuevos));
        }
      } catch (e) {
        if (activo && version === generacion.current) mostrarError(e);
      } finally {
        consultando = false;
        if (activo && version === generacion.current) setCargando(false);
      }
    }
    actualizarRef.current = () => { void actualizar(); };
    // Mientras este chat está abierto, sus mensajes cuentan como leídos y no llegan avisos de él.
    abrirChat(id);
    void actualizar();
    const timer = setInterval(() => void actualizar(), 4000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void actualizar(); });
    return () => {
      activo = false; ++generacion.current; actualizarRef.current = () => {}; clearInterval(timer); listener.remove();
      cerrarChat(id);
    };
  }, [id, mostrarError]));

  async function enviar(contenido?: string) {
    const t = (contenido ?? texto).trim();
    if (!disponible || !t || envioEnCurso.current) return;
    envioEnCurso.current = true; setEnviando(true);
    const version = generacion.current;
    // A failed request keeps the same id for a retry; the server deduplicates it.
    if (envioPendiente.current?.text !== t) envioPendiente.current = { text: t, clientId: Crypto.randomUUID() };
    try {
      const mensaje = await enviarMensaje(id, t, envioPendiente.current.clientId);
      if (version !== generacion.current) return;
      setMensajes((prev) => fusionar(prev, [mensaje]));
      // The polling cursor only advances from reads, so simultaneous peer messages are not skipped.
      envioPendiente.current = null; setTexto(''); setError(null); desplazar.current = true;
    } catch (e) {
      if (version === generacion.current) { setTexto(t); mostrarError(e); }
    } finally {
      if (version === generacion.current) { envioEnCurso.current = false; setEnviando(false); }
    }
  }

  /** Comparte tu ubicación actual (HU-58). Usa el mismo reintento sin duplicar que el texto. */
  async function compartirUbicacion() {
    if (!disponible || obteniendoUbicacion || envioEnCurso.current) return;
    setObteniendoUbicacion(true);
    const version = generacion.current;
    try {
      const r = await solicitarUbicacion();
      if (!r.ok || !r.ubicacion) {
        Alert.alert(
          'Permiso necesario',
          r.motivo === 'permiso_denegado'
            ? 'Necesitamos acceso a tu ubicación para compartirla. Puedes activarlo en los ajustes del teléfono.'
            : 'No pudimos obtener tu ubicación.',
        );
        return;
      }
      envioEnCurso.current = true; setEnviando(true);
      const mensaje = await enviarUbicacion(id, r.ubicacion, Crypto.randomUUID());
      if (version !== generacion.current) return;
      setMensajes((prev) => fusionar(prev, [mensaje])); setError(null); desplazar.current = true;
    } catch (e) {
      if (version === generacion.current) mostrarError(e);
    } finally {
      if (version === generacion.current) { envioEnCurso.current = false; setEnviando(false); setObteniendoUbicacion(false); }
    }
  }

  function abrirAdjuntos() {
    Alert.alert('Adjuntar', `¿Qué quieres compartir con ${primerNombre}?`, [
      { text: 'Mi ubicación', onPress: compartirUbicacion },
      { text: 'Foto', onPress: avisarFotos },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function avisarFotos() {
    if (ENVIO_DE_FOTOS_DISPONIBLE) return;
    Alert.alert('Fotos no disponibles todavía', 'Para enviar fotos falta habilitar el almacenamiento de archivos en el servidor. Mientras tanto puedes compartir tu ubicación.');
  }

  /** Menú del chat (HU-59): silenciar o bloquear a la persona. */
  function abrirOpciones() {
    if (!personaId) return;
    Alert.alert(nombre, undefined, [
      {
        text: silenciado ? 'Reactivar avisos' : 'Silenciar avisos',
        onPress: () => silenciarChat(personaId, !silenciado).catch((e) =>
          Alert.alert('No se pudo completar', e instanceof Error ? e.message : 'Inténtalo de nuevo.')),
      },
      bloqueado
        ? { text: `Desbloquear a ${primerNombre}`, onPress: cambiarBloqueo }
        : { text: `Bloquear a ${primerNombre}`, style: 'destructive', onPress: confirmarBloqueo },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function confirmarBloqueo() {
    Alert.alert(
      `¿Bloquear a ${primerNombre}?`,
      'No podrán enviarse mensajes mientras esté bloqueado. Puedes desbloquearlo cuando quieras desde este chat.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: cambiarBloqueo },
      ],
    );
  }

  async function cambiarBloqueo() {
    const r = bloqueado ? await desbloquear(personaId) : await bloquear(personaId);
    if (!r.ok) Alert.alert('No se pudo completar', r.motivo);
    else if (bloqueado) actualizarRef.current();
  }

  /** Abre el punto en la app de mapas del teléfono. */
  function abrirEnMapas(u: UbicacionChat) {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${u.latitud},${u.longitud}`).catch(() =>
      Alert.alert('No pudimos abrir el mapa', 'Intenta de nuevo o abre tu app de mapas manualmente.'),
    );
  }

  /** Lo que va dentro de la burbuja: foto, ubicación, archivo o texto. */
  function contenido(m: MensajeApi, propio: boolean) {
    const color = propio ? '#fff' : colors.text;
    if (m.message_type === 'IMAGE' && m.attachment_url) {
      return (
        <View style={{ gap: 6 }}>
          <Image source={{ uri: m.attachment_url }} style={styles.imagen} resizeMode="cover" accessibilityLabel="Foto enviada" />
          {m.text ? <Text style={propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{m.text}</Text> : null}
        </View>
      );
    }
    if (m.message_type === 'LOCATION' && m.latitude != null && m.longitude != null) {
      const u = { latitud: m.latitude, longitud: m.longitude, comuna: m.location_name ?? undefined };
      return (
        <TouchableOpacity style={styles.ubicacion} onPress={() => abrirEnMapas(u)} accessibilityLabel="Abrir ubicación en mapas">
          <View style={styles.ubicacionFila}>
            <Ionicons name="location" size={18} color={color} />
            <Text style={[styles.ubicacionTitulo, { color }]}>{u.comuna || 'Ubicación compartida'}</Text>
          </View>
          <Text style={[styles.ubicacionAccion, { color }]}>Abrir en mapas</Text>
        </TouchableOpacity>
      );
    }
    if (m.message_type === 'FILE' && m.attachment_url) {
      const url = m.attachment_url;
      return (
        <TouchableOpacity style={styles.ubicacionFila} onPress={() => Linking.openURL(url).catch(() => {})} accessibilityLabel="Abrir archivo">
          <Ionicons name="document-attach-outline" size={18} color={color} />
          <Text style={[styles.ubicacionTitulo, { color }]} numberOfLines={1}>{m.attachment_name || m.text || 'Archivo'}</Text>
        </TouchableOpacity>
      );
    }
    return <Text style={propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{m.text}</Text>;
  }

  async function cargarAnteriores() {
    if (!mensajes.length || cargandoAnteriores) return;
    setCargandoAnteriores(true);
    const version = generacion.current;
    try {
      const pagina = await getMensajes(id, { before: mensajes[0].id });
      if (version !== generacion.current) return;
      desplazar.current = false;
      setMensajes((prev) => fusionar(prev, pagina)); setAnteriores(pagina.length === 50);
    } catch (e) {
      if (version === generacion.current) mostrarError(e);
    } finally {
      if (version === generacion.current) setCargandoAnteriores(false);
    }
  }

  const nombre = persona?.name ?? 'Chat';
  const primerNombre = nombre.split(' ')[0];
  const deporte = persona && persona.sport !== 'Sin deporte aún' ? persona.sport : null;
  const sugerencias = [
    '¡Hola! 👋',
    `¿Entrenamos ${deporte ? deporte.toLowerCase() : 'juntos'}?`,
    '¿Qué días te acomodan?',
  ];

  function reportarMensaje(m: MensajeApi) {
    const texto = m.text || (m.message_type === 'LOCATION' ? 'Ubicación compartida' : m.message_type === 'IMAGE' ? 'Foto' : 'Archivo');
    const resumen = texto.length > 60 ? `${texto.slice(0, 60)}…` : texto;
    setReporte({ tipo: 'mensaje', id: `${id}:${m.id}`, nombre: `Mensaje de ${primerNombre}: "${resumen}"` });
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Avatar name={nombre} colorFrom={persona?.colorFrom ?? '#7C3AED'} uri={persona?.fotoUri} style={styles.avatar} fontSize={13} />
        <TouchableOpacity style={styles.topbarTextos} disabled={!disponible} accessibilityLabel={`Ver perfil de ${nombre}`}
          onPress={() => router.push({ pathname: '/(deportista)/athlete/[id]', params: { id } })}>
          <Text style={styles.name}>{nombre}</Text>
          <View style={styles.subtitulo}>
            <Text style={styles.sport}>{persona ? `${deporte ?? 'Deportista'} · Ver perfil` : ''}</Text>
            {silenciado && !bloqueado ? (
              <View style={styles.etiqueta}>
                <Ionicons name="notifications-off-outline" size={11} color={colors.textMuted} />
                <Text style={styles.etiquetaTexto}>Silenciado</Text>
              </View>
            ) : null}
            {bloqueado ? (
              <View style={styles.etiqueta}>
                <Ionicons name="ban-outline" size={11} color={colors.danger} />
                <Text style={[styles.etiquetaTexto, { color: colors.danger }]}>Bloqueado</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        {personaId ? (
          <TouchableOpacity onPress={abrirOpciones} style={styles.reportButton} accessibilityLabel={`Opciones de ${nombre}`}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
        {persona ? (
          <TouchableOpacity
            onPress={() => setReporte({ tipo: 'usuario', id: persona.id, nombre })}
            style={styles.reportButton}
            accessibilityLabel={`Reportar a ${nombre}`}
          >
            <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && !bloqueado && <TouchableOpacity onPress={() => actualizarRef.current()}><Text style={styles.introTexto}>{error} · Reintentar</Text></TouchableOpacity>}
      <FlatList ref={listaRef} data={mensajes} keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, mensajes.length === 0 && styles.listVacia]}
        onContentSizeChange={() => { if (desplazar.current) listaRef.current?.scrollToEnd({ animated: true }); }}
        ListHeaderComponent={anteriores ? <TouchableOpacity disabled={cargandoAnteriores} onPress={cargarAnteriores}><Text style={styles.introTexto}>{cargandoAnteriores ? 'Cargando...' : 'Ver mensajes anteriores'}</Text></TouchableOpacity> : null}
        ListEmptyComponent={
          <View style={styles.intro}>
            {cargando ? <Text style={styles.introTexto}>Cargando conversación...</Text> : disponible ? <>
              <View style={styles.introIcono}><Ionicons name="heart" size={22} color="#fff" /></View>
              <Text style={styles.introTitulo}>Hiciste match con {primerNombre}</Text>
              <Text style={styles.introTexto}>Rompe el hielo y coordinen su primer entrenamiento.</Text>
              <View style={styles.sugerencias}>{sugerencias.map((s) => <TouchableOpacity key={s} disabled={enviando} style={styles.sugerencia} onPress={() => enviar(s)}><Text style={styles.sugerenciaTexto}>{s}</Text></TouchableOpacity>)}</View>
            </> : bloqueado ? null : <Text style={styles.introTexto}>El chat estará disponible cuando ambos tengan un match aceptado.</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const multimedia = item.message_type === 'IMAGE' || item.message_type === 'LOCATION';
          return item.sender_id === miId ? (
            <View style={[styles.bubble, styles.bubbleOwn, multimedia && styles.bubbleMedia]}>
              {contenido(item, true)}
            </View>
          ) : (
            // Mantén presionado un mensaje de la otra persona para reportarlo.
            <TouchableOpacity
              activeOpacity={0.8}
              delayLongPress={350}
              onLongPress={() => reportarMensaje(item)}
              style={[styles.bubble, styles.bubbleOther, multimedia && styles.bubbleMedia]}
              accessibilityHint="Mantén presionado para reportar este mensaje"
            >
              {contenido(item, false)}
            </TouchableOpacity>
          );
        }}
      />
      {bloqueado ? (
        // Persona bloqueada (HU-59): no se puede escribir hasta desbloquearla.
        <View style={[styles.bloqueadoBox, { paddingBottom: insets.bottom + 12 }]}>
          <Ionicons name="ban-outline" size={18} color={colors.danger} />
          <Text style={styles.bloqueadoTexto}>Bloqueaste a {primerNombre}. No pueden enviarse mensajes.</Text>
          <TouchableOpacity style={styles.desbloquearBtn} onPress={cambiarBloqueo}>
            <Text style={styles.desbloquearTexto}>Desbloquear</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.adjuntarButton, !disponible && { opacity: 0.5 }]}
          onPress={abrirAdjuntos}
          disabled={!disponible || obteniendoUbicacion || enviando}
          accessibilityLabel="Adjuntar ubicación o foto"
        >
          {obteniendoUbicacion ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Ionicons name="add" size={20} color={colors.textMuted} />}
        </TouchableOpacity>
        <TextInput placeholder="Escribe un mensaje..." placeholderTextColor={colors.textMuted} style={styles.input} value={texto} onChangeText={setTexto} onSubmitEditing={() => enviar()} returnKeyType="send" editable={disponible && !enviando} maxLength={2000} />
        <TouchableOpacity style={[styles.sendButton, (!disponible || enviando) && { opacity: 0.5 }]} disabled={!disponible || enviando || !texto.trim()} onPress={() => enviar()} accessibilityLabel="Enviar mensaje"><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity>
      </View>
      )}

      {/* Reportar persona o mensaje (HU-42) */}
      <ReportarModal
        visible={reporte !== null}
        onClose={() => setReporte(null)}
        tipo={ultimoReporte.current.tipo}
        objetivoId={ultimoReporte.current.id}
        objetivoNombre={ultimoReporte.current.nombre}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: c.border },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    topbarTextos: { flex: 1 },
    reportButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    name: { color: c.text, fontSize: 14, fontWeight: '700' },
    sport: { color: c.textMuted, fontSize: 11 },
    subtitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    etiquetaTexto: { color: c.textMuted, fontSize: 10.5, fontWeight: '600' },
    list: { padding: 20, gap: 10 },
    listVacia: { flexGrow: 1, justifyContent: 'center' },
    bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleTextOther: { color: c.text, fontSize: 13 },
    bubbleTextOwn: { color: '#fff', fontSize: 13 },
    bubbleMedia: { padding: 6 },
    imagen: { width: 200, height: 150, borderRadius: 12 },
    ubicacion: { paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
    ubicacionFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ubicacionTitulo: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
    ubicacionAccion: { fontSize: 11.5, textDecorationLine: 'underline' },
    intro: { alignItems: 'center', paddingHorizontal: 12 },
    introIcono: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EC4899', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    introTitulo: { color: c.text, fontSize: 16, fontWeight: '700' },
    introTexto: { color: c.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
    sugerencias: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
    sugerencia: { backgroundColor: c.chip, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
    sugerenciaTexto: { color: c.accent, fontSize: 12, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border },
    input: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.text, fontSize: 13 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    adjuntarButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    bloqueadoBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    bloqueadoTexto: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 17 },
    desbloquearBtn: { borderWidth: 1, borderColor: c.accent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
    desbloquearTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });
