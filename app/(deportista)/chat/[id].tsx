import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import ReportarModal from '../../../components/ReportarModal';
import { ApiError } from '../../../services/api';
import { enviarMensaje, getChat, getMensajes, MensajeApi } from '../../../services/chat';
import { Persona } from '../../../services/matchStore';
import type { TipoReporte } from '../../../services/reportes';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
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
    void actualizar();
    const timer = setInterval(() => void actualizar(), 4000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void actualizar(); });
    return () => { activo = false; ++generacion.current; actualizarRef.current = () => {}; clearInterval(timer); listener.remove(); };
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
    const resumen = m.text.length > 60 ? `${m.text.slice(0, 60)}…` : m.text;
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
          <Text style={styles.sport}>{persona ? `${deporte ?? 'Deportista'} · Ver perfil` : ''}</Text>
        </TouchableOpacity>
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
      {error && <TouchableOpacity onPress={() => actualizarRef.current()}><Text style={styles.introTexto}>{error} · Reintentar</Text></TouchableOpacity>}
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
            </> : <Text style={styles.introTexto}>El chat estará disponible cuando ambos tengan un match aceptado.</Text>}
          </View>
        }
        renderItem={({ item }) =>
          item.sender_id === miId ? (
            <View style={[styles.bubble, styles.bubbleOwn]}>
              <Text style={styles.bubbleTextOwn}>{item.text}</Text>
            </View>
          ) : (
            // Mantén presionado un mensaje de la otra persona para reportarlo.
            <TouchableOpacity
              activeOpacity={0.8}
              delayLongPress={350}
              onLongPress={() => reportarMensaje(item)}
              style={[styles.bubble, styles.bubbleOther]}
              accessibilityHint="Mantén presionado para reportar este mensaje"
            >
              <Text style={styles.bubbleTextOther}>{item.text}</Text>
            </TouchableOpacity>
          )
        }
      />
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput placeholder="Escribe un mensaje..." placeholderTextColor={colors.textMuted} style={styles.input} value={texto} onChangeText={setTexto} onSubmitEditing={() => enviar()} returnKeyType="send" editable={disponible && !enviando} maxLength={2000} />
        <TouchableOpacity style={[styles.sendButton, (!disponible || enviando) && { opacity: 0.5 }]} disabled={!disponible || enviando || !texto.trim()} onPress={() => enviar()} accessibilityLabel="Enviar mensaje"><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity>
      </View>

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
    list: { padding: 20, gap: 10 },
    listVacia: { flexGrow: 1, justifyContent: 'center' },
    bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleTextOther: { color: c.text, fontSize: 13 },
    bubbleTextOwn: { color: '#fff', fontSize: 13 },
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
  });
