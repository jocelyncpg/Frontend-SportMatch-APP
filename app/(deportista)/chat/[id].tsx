import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MapaEstatico from '../../../components/MapaEstatico';
import ReportarModal from '../../../components/ReportarModal';
import VisorFoto from '../../../components/VisorFoto';
import { Boton } from '../../../components/ui';
import { useTecladoVisible } from '../../../hooks/use-teclado';
import {
  abrirChat,
  bloquearUsuario,
  cerrarChat,
  citaDe,
  desbloquearUsuario,
  enviarImagen,
  enviarMensaje,
  enviarUbicacion,
  silenciarChat,
  simularRespuesta,
  useConversacion,
  type CitaChat,
  type MensajeChat,
  type UbicacionChat,
} from '../../../services/chat';
import { solicitarUbicacion } from '../../../services/location';
import { useMatches } from '../../../services/matchStore';
import type { TipoReporte } from '../../../services/reportes';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Texto e íconos sobre fondos de color fuerte (burbuja propia, botón enviar).
const SOBRE_COLOR = '#FFFFFF';

// DEMO: segundos que tarda en llegar la respuesta simulada, para alcanzar a salir del chat y ver el aviso y la vibración.
const DEMO_RETRASO_MS = 5000;

/** Lo que se está reportando desde el chat (HU-42): la persona o un mensaje suyo. */
type ObjetivoReporte = { tipo: TipoReporte; id: string; nombre: string };

/** Foto dentro de la burbuja: respeta su proporción (sin cortarla demasiado) y se ve completa al tocarla. */
function FotoChat({ uri, estilo }: { uri: string; estilo: object }) {
  const [proporcion, setProporcion] = useState(1);
  useEffect(() => {
    let vigente = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (vigente && w > 0 && h > 0) setProporcion(Math.min(1.5, Math.max(0.7, w / h)));
      },
      () => {},
    );
    return () => {
      vigente = false;
    };
  }, [uri]);
  return <Image source={{ uri }} style={[estilo, { aspectRatio: proporcion }]} resizeMode="cover" accessibilityLabel="Foto enviada. Toca para ampliar" />;
}

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  // Con el teclado abierto no hace falta el margen del borde inferior: dejaba un hueco sobre el teclado.
  const tecladoAbierto = useTecladoVisible();
  const margenInferior = tecladoAbierto ? espacio.m : insets.bottom + espacio.m;

  const { id, name, sport, colorFrom } = useLocalSearchParams<{ id: string; name: string; sport: string; colorFrom: string }>();
  const personaId = id ?? '';
  const nombre = name ?? 'Deportista';
  const primerNombre = nombre.split(' ')[0];

  // La foto se busca por id en los datos de matches, así se ve venga el chat de donde venga
  // (Matches, Chats, Descubrir, avisos, búsqueda...) sin tener que pasarla como parámetro.
  const { confirmados, solicitudes, catalogo } = useMatches();
  const fotoUri =
    [...confirmados, ...solicitudes, ...catalogo].find((p) => p.id === personaId)?.fotoUri ?? null;

  // Los mensajes viven en services/chat.ts (HU-60), así no se pierden al salir del chat.
  const { mensajes, silenciado, bloqueado } = useConversacion(personaId);
  const [texto, setTexto] = useState('');
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const listaRef = useRef<FlatList<MensajeChat>>(null);
  // Mensaje que estás respondiendo (HU-64).
  const [citando, setCitando] = useState<MensajeChat | null>(null);
  // Foto abierta a pantalla completa.
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);
  const [reporte, setReporte] = useState<ObjetivoReporte | null>(null);
  // Se recuerda el último objetivo para que el formulario no cambie de texto mientras se cierra.
  const ultimoReporte = useRef<ObjetivoReporte>({ tipo: 'usuario', id: personaId, nombre: nombre });
  if (reporte) ultimoReporte.current = reporte;

  // Mientras este chat está abierto, sus mensajes cuentan como leídos y no llegan avisos de él.
  useEffect(() => {
    if (!personaId) return;
    abrirChat(personaId);
    return () => cerrarChat(personaId);
  }, [personaId]);

  const sugerencias = [
    '¡Hola! 👋',
    `¿Entrenamos ${sport ? sport.toLowerCase() : 'juntos'}?`,
    '¿Qué días te acomodan?',
  ];

  function enviar(contenido?: string) {
    if (enviarMensaje(personaId, contenido ?? texto, citando ? citaDe(citando) : undefined)) {
      setTexto('');
      setCitando(null);
    }
  }

  /** Abre el perfil de la persona desde la barra superior (HU-64). */
  function verPerfil() {
    router.push({
      pathname: '/(deportista)/perfil/[id]',
      params: { id: personaId, name: nombre, sport: sport ?? '', colorFrom: colorFrom ?? '#7C3AED' },
    });
  }

  /** Mantén presionado un mensaje: responderlo o, si es de la otra persona, reportarlo (HU-64). */
  function opcionesMensaje(m: MensajeChat) {
    const botones = [
      { text: 'Responder', onPress: () => setCitando(m) },
      ...(m.propio ? [] : [{ text: 'Reportar mensaje', style: 'destructive' as const, onPress: () => reportarMensaje(m) }]),
      { text: 'Cancelar', style: 'cancel' as const },
    ];
    Alert.alert('Mensaje', undefined, botones);
  }

  /** Lleva la lista hasta el mensaje citado (HU-64). Si ya no está, no hace nada. */
  function irAlMensaje(cita: CitaChat) {
    const i = mensajes.findIndex((x) => x.id === cita.id);
    if (i >= 0) listaRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.5 });
  }

  function reportarMensaje(m: MensajeChat) {
    const resumen = m.texto.length > 60 ? `${m.texto.slice(0, 60)}…` : m.texto;
    setReporte({ tipo: 'mensaje', id: `${personaId}:${m.id}`, nombre: `Mensaje de ${primerNombre}: "${resumen}"` });
  }

  /** Menú del chat (HU-59): silenciar o bloquear a la persona. */
  function abrirOpciones() {
    Alert.alert(nombre, undefined, [
      {
        text: silenciado ? 'Reactivar avisos' : 'Silenciar avisos',
        onPress: () => silenciarChat(personaId, !silenciado),
      },
      { text: `Bloquear a ${primerNombre}`, style: 'destructive', onPress: confirmarBloqueo },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function confirmarBloqueo() {
    Alert.alert(
      `¿Bloquear a ${primerNombre}?`,
      'No podrán enviarse mensajes mientras esté bloqueado. Puedes desbloquearlo cuando quieras desde este chat.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: () => bloquearUsuario(personaId) },
      ],
    );
  }

  // ---------- Adjuntos (HU-58) ----------

  function abrirAdjuntos() {
    Alert.alert('Adjuntar', '¿Qué quieres compartir con ' + primerNombre + '?', [
      { text: 'Mi ubicación', onPress: compartirUbicacion },
      { text: 'Foto de la galería', onPress: elegirFoto },
      { text: 'Tomar una foto', onPress: tomarFoto },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function compartirUbicacion() {
    if (obteniendoUbicacion) return;
    setObteniendoUbicacion(true);
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
      enviarUbicacion(personaId, r.ubicacion);
    } catch {
      Alert.alert('No pudimos obtener tu ubicación', 'Revisa que el GPS esté activado e inténtalo de nuevo.');
    } finally {
      setObteniendoUbicacion(false);
    }
  }

  async function elegirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para adjuntar una imagen.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    enviarSiHayImagen(resultado);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu cámara para tomar la foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    enviarSiHayImagen(resultado);
  }

  function enviarSiHayImagen(resultado: ImagePicker.ImagePickerResult) {
    if (!resultado.canceled && resultado.assets[0]?.uri) enviarImagen(personaId, resultado.assets[0].uri);
  }

  /** Abre el punto en la app de mapas del teléfono. */
  function abrirEnMapas(u: UbicacionChat) {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${u.latitud},${u.longitud}`).catch(() =>
      Alert.alert('No pudimos abrir el mapa', 'Intenta de nuevo o abre tu app de mapas manualmente.'),
    );
  }

  /** Recuadro con el mensaje al que se responde, arriba de la burbuja (HU-64). */
  function cita(m: MensajeChat) {
    if (!m.respondeA) return null;
    const c = m.respondeA;
    return (
      <TouchableOpacity
        style={[styles.cita, m.propio ? styles.citaPropia : styles.citaAjena]}
        onPress={() => irAlMensaje(c)}
        accessibilityRole="button"
        accessibilityLabel="Ir al mensaje citado"
      >
        <View style={[styles.citaBarra, { backgroundColor: m.propio ? SOBRE_COLOR : colors.accent }]} />
        <View style={styles.citaCuerpo}>
          <Text style={[styles.citaAutor, { color: m.propio ? SOBRE_COLOR : colors.accent }]} numberOfLines={1}>{c.propio ? 'Tú' : primerNombre}</Text>
          <Text style={[styles.citaTexto, { color: m.propio ? 'rgba(255,255,255,0.85)' : colors.textMuted }]} numberOfLines={2}>{c.texto}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  /** Lo que va dentro de la burbuja: foto, ubicación o texto. */
  function contenido(m: MensajeChat) {
    if (m.imagenUri) return <FotoChat uri={m.imagenUri} estilo={styles.imagen} />;
    if (m.ubicacion) {
      const u = m.ubicacion;
      return (
        <View>
          <MapaEstatico latitud={u.latitud} longitud={u.longitud} alto={130} />
          <View style={styles.ubicacionPie}>
            <Ionicons name="location" size={20} color={colors.accent} />
            <View style={styles.ubicacionTextos}>
              <Text style={styles.ubicacionTitulo} numberOfLines={1}>{u.comuna ? u.comuna : 'Ubicación compartida'}</Text>
              <Text style={styles.ubicacionAccion}>Abrir en mapas</Text>
            </View>
          </View>
        </View>
      );
    }
    return <Text style={m.propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{m.texto}</Text>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + espacio.m }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={verPerfil} accessibilityRole="button" accessibilityLabel={`Ver perfil de ${nombre}`}>
          <Avatar name={nombre} colorFrom={colorFrom ?? '#7C3AED'} uri={fotoUri} style={styles.avatar} fontSize={13} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topbarTextos} onPress={verPerfil} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Ver perfil de ${nombre}`}>
          <Text style={styles.name} numberOfLines={1}>{nombre}</Text>
          <View style={styles.subtitulo}>
            <Text style={styles.sport}>{sport ?? ''}</Text>
            {silenciado && !bloqueado ? (
              <View style={styles.etiqueta}>
                <Ionicons name="notifications-off-outline" size={13} color={colors.textMuted} />
                <Text style={styles.etiquetaTexto}>Silenciado</Text>
              </View>
            ) : null}
            {bloqueado ? (
              <View style={styles.etiqueta}>
                <Ionicons name="ban-outline" size={13} color={colors.danger} />
                <Text style={[styles.etiquetaTexto, { color: colors.danger }]}>Bloqueado</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={abrirOpciones} style={styles.reportButton} accessibilityRole="button" accessibilityLabel={`Opciones de ${nombre}`}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setReporte({ tipo: 'usuario', id: personaId, nombre })}
          style={styles.reportButton}
          accessibilityRole="button"
          accessibilityLabel={`Reportar a ${nombre}`}
        >
          <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, mensajes.length === 0 && styles.listVacia]}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        onScrollToIndexFailed={(info) => setTimeout(() => listaRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 250)}
        ListEmptyComponent={
          <View style={styles.intro}>
            <View style={styles.introIcono}>
              <Ionicons name="heart" size={22} color={SOBRE_COLOR} />
            </View>
            <Text style={styles.introTitulo}>Hiciste match con {primerNombre}</Text>
            <Text style={styles.introTexto}>Rompe el hielo y coordinen su primer entrenamiento.</Text>
            {!bloqueado ? (
              <View style={styles.sugerencias}>
                {sugerencias.map((s) => (
                  <TouchableOpacity key={s} style={styles.sugerencia} onPress={() => enviar(s)} accessibilityRole="button" accessibilityLabel={`Enviar: ${s}`}>
                    <Text style={styles.sugerenciaTexto}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const foto = item.imagenUri !== undefined;
          const mapa = item.ubicacion !== undefined;
          // Toca una foto para ampliarla o una ubicación para abrirla en mapas.
          // Mantén presionado cualquier mensaje para responderlo (o reportarlo, si es de la otra persona).
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              delayLongPress={350}
              onPress={foto ? () => setFotoAbierta(item.imagenUri ?? null) : mapa && item.ubicacion ? () => abrirEnMapas(item.ubicacion as UbicacionChat) : undefined}
              onLongPress={() => !bloqueado && opcionesMensaje(item)}
              style={[styles.bubble, item.propio ? styles.bubbleOwn : styles.bubbleOther, foto && styles.bubbleFoto, mapa && styles.bubbleMapa]}
              accessibilityHint="Mantén presionado para responder este mensaje"
            >
              {cita(item)}
              {contenido(item)}
            </TouchableOpacity>
          );
        }}
      />

      {bloqueado ? (
        // Persona bloqueada (HU-59): no se puede escribir hasta desbloquearla.
        <View style={[styles.bloqueadoBox, { paddingBottom: margenInferior }]}>
          <Ionicons name="ban-outline" size={18} color={colors.danger} />
          <Text style={styles.bloqueadoTexto}>Bloqueaste a {primerNombre}. No pueden enviarse mensajes.</Text>
          <Boton texto="Desbloquear" variante="secundario" onPress={() => desbloquearUsuario(personaId)} style={styles.desbloquearBtn} />
        </View>
      ) : (
        <>
          {/* DEMO: quitar cuando los mensajes lleguen del backend */}
          {personaId !== '' && (
            <TouchableOpacity style={styles.demoLink} onPress={() => setTimeout(() => simularRespuesta(personaId), DEMO_RETRASO_MS)} accessibilityRole="button">
              <Text style={styles.demoLinkTexto}>Demo: simular que {primerNombre} te responde (en 5 s)</Text>
            </TouchableOpacity>
          )}

          <View style={styles.pie}>
            {citando ? (
              <View style={styles.respondiendo}>
                <View style={styles.respondiendoBarra} />
                <View style={styles.respondiendoTextos}>
                  <Text style={styles.respondiendoAutor}>{citando.propio ? 'Tú' : primerNombre}</Text>
                  <Text style={styles.respondiendoTexto} numberOfLines={1}>{citando.texto}</Text>
                </View>
                <TouchableOpacity onPress={() => setCitando(null)} style={styles.respondiendoCerrar} accessibilityRole="button" accessibilityLabel="Cancelar respuesta">
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[styles.inputRow, { paddingBottom: margenInferior }]}>
              <TouchableOpacity
                style={styles.adjuntarButton}
                accessibilityRole="button"
                onPress={abrirAdjuntos}
                disabled={obteniendoUbicacion}
                accessibilityLabel="Adjuntar ubicación o foto"
              >
                {obteniendoUbicacion ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Ionicons name="add" size={22} color={colors.textMuted} />
                )}
              </TouchableOpacity>
              <TextInput
                placeholder="Escribe un mensaje..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={texto}
                onChangeText={setTexto}
                onSubmitEditing={() => enviar()}
                returnKeyType="send"
                accessibilityLabel="Escribe un mensaje"
              />
              <TouchableOpacity style={styles.sendButton} onPress={() => enviar()} accessibilityRole="button" accessibilityLabel="Enviar mensaje">
                <Ionicons name="send" size={18} color={SOBRE_COLOR} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Foto a pantalla completa */}
      <VisorFoto uri={fotoAbierta} onClose={() => setFotoAbierta(null)} />

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
    topbar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m, borderBottomWidth: 1, borderColor: c.border },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topbarTextos: { flex: 1 },
    reportButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    name: { color: c.text, ...tipo.seccion },
    subtitulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
    sport: { color: c.textMuted, ...tipo.dato },
    etiqueta: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
    etiquetaTexto: { color: c.textMuted, ...tipo.etiqueta },
    list: { padding: espacio.xl, gap: espacio.m },
    listVacia: { flexGrow: 1, justifyContent: 'center' },
    bubble: { maxWidth: '78%', borderRadius: radio.tarjeta, paddingHorizontal: espacio.l - 2, paddingVertical: espacio.m - 1, marginBottom: espacio.xs },
    bubbleFoto: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, overflow: 'hidden' },
    bubbleMapa: { width: 240, maxWidth: '78%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 0, overflow: 'hidden' },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: espacio.xs },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: espacio.xs },
    bubbleTextOther: { color: c.text, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    bubbleTextOwn: { color: SOBRE_COLOR, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    cita: { flexDirection: 'row', borderRadius: radio.control, overflow: 'hidden', marginBottom: espacio.xs },
    citaPropia: { backgroundColor: 'rgba(0,0,0,0.22)' },
    citaAjena: { backgroundColor: c.chip },
    citaBarra: { width: 4 },
    citaCuerpo: { flexShrink: 1, paddingHorizontal: espacio.s, paddingVertical: espacio.xs, gap: 1 },
    citaAutor: { ...tipo.etiqueta },
    citaTexto: { ...tipo.dato },
    pie: { borderTopWidth: 1, borderColor: c.border },
    respondiendo: { flexDirection: 'row', alignItems: 'center', marginHorizontal: espacio.l, marginTop: espacio.s, borderRadius: radio.control, overflow: 'hidden', backgroundColor: c.chip },
    respondiendoBarra: { alignSelf: 'stretch', width: 4, backgroundColor: c.accent },
    respondiendoTextos: { flex: 1, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
    respondiendoAutor: { color: c.accent, ...tipo.etiqueta },
    respondiendoTexto: { color: c.textMuted, ...tipo.dato },
    respondiendoCerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    imagen: { width: 240, borderRadius: radio.tarjeta },
    ubicacionPie: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.s, minHeight: 48 },
    ubicacionTextos: { flex: 1 },
    ubicacionTitulo: { color: c.text, ...tipo.cuerpoFuerte },
    ubicacionAccion: { color: c.accent, ...tipo.dato },
    intro: { alignItems: 'center', paddingHorizontal: espacio.m },
    introIcono: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: espacio.m },
    introTitulo: { color: c.text, ...tipo.titulo },
    introTexto: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, marginTop: espacio.xs, textAlign: 'center' },
    sugerencias: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: espacio.s, marginTop: espacio.xl },
    sugerencia: { backgroundColor: c.chip, borderRadius: radio.control, paddingHorizontal: espacio.l, minHeight: 44, justifyContent: 'center' },
    sugerenciaTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    demoLink: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    demoLinkTexto: { color: c.textMuted, ...tipo.etiqueta },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingTop: espacio.m, paddingHorizontal: espacio.l },
    adjuntarButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, minHeight: 44, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: espacio.l, paddingVertical: espacio.s, color: c.text, fontSize: 14, fontWeight: '400' },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    bloqueadoBox: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m, flexWrap: 'wrap',
      paddingTop: espacio.m, paddingHorizontal: espacio.l, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    bloqueadoTexto: { flex: 1, color: c.textMuted, ...tipo.dato, lineHeight: 17 },
    desbloquearBtn: { minHeight: 44, paddingHorizontal: espacio.l },
  });