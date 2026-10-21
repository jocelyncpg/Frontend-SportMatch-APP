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
import ReportarModal from '../../../components/ReportarModal';
import {
  abrirChat,
  bloquearUsuario,
  cerrarChat,
  desbloquearUsuario,
  enviarImagen,
  enviarMensaje,
  enviarUbicacion,
  silenciarChat,
  simularRespuesta,
  useConversacion,
  type MensajeChat,
  type UbicacionChat,
} from '../../../services/chat';
import { solicitarUbicacion } from '../../../services/location';
import type { TipoReporte } from '../../../services/reportes';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

/** Lo que se está reportando desde el chat (HU-42): la persona o un mensaje suyo. */
type ObjetivoReporte = { tipo: TipoReporte; id: string; nombre: string };

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { id, name, sport, colorFrom } = useLocalSearchParams<{ id: string; name: string; sport: string; colorFrom: string }>();
  const personaId = id ?? '';
  const nombre = name ?? 'Deportista';
  const primerNombre = nombre.split(' ')[0];

  // Los mensajes viven en services/chat.ts (HU-60), así no se pierden al salir del chat.
  const { mensajes, silenciado, bloqueado } = useConversacion(personaId);
  const [texto, setTexto] = useState('');
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const listaRef = useRef<FlatList<MensajeChat>>(null);
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
    if (enviarMensaje(personaId, contenido ?? texto)) setTexto('');
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

  /** Lo que va dentro de la burbuja: foto, ubicación o texto. */
  function contenido(m: MensajeChat) {
    if (m.imagenUri) {
      return <Image source={{ uri: m.imagenUri }} style={styles.imagen} resizeMode="cover" accessibilityLabel="Foto enviada" />;
    }
    if (m.ubicacion) {
      const u = m.ubicacion;
      const color = m.propio ? '#fff' : colors.text;
      return (
        <TouchableOpacity style={styles.ubicacion} onPress={() => abrirEnMapas(u)} accessibilityLabel="Abrir ubicación en mapas">
          <View style={styles.ubicacionFila}>
            <Ionicons name="location" size={18} color={color} />
            <Text style={[styles.ubicacionTitulo, { color }]}>{u.comuna ? u.comuna : 'Ubicación compartida'}</Text>
          </View>
          <Text style={[styles.ubicacionAccion, { color }]}>Abrir en mapas</Text>
        </TouchableOpacity>
      );
    }
    return <Text style={m.propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{m.texto}</Text>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Avatar name={nombre} colorFrom={colorFrom ?? '#7C3AED'} style={styles.avatar} fontSize={13} />
        <View style={styles.topbarTextos}>
          <Text style={styles.name}>{nombre}</Text>
          <View style={styles.subtitulo}>
            <Text style={styles.sport}>{sport ?? ''}</Text>
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
        </View>
        <TouchableOpacity onPress={abrirOpciones} style={styles.reportButton} accessibilityLabel={`Opciones de ${nombre}`}>
          <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setReporte({ tipo: 'usuario', id: personaId, nombre })}
          style={styles.reportButton}
          accessibilityLabel={`Reportar a ${nombre}`}
        >
          <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, mensajes.length === 0 && styles.listVacia]}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.intro}>
            <View style={styles.introIcono}>
              <Ionicons name="heart" size={22} color="#fff" />
            </View>
            <Text style={styles.introTitulo}>Hiciste match con {primerNombre}</Text>
            <Text style={styles.introTexto}>Rompe el hielo y coordinen su primer entrenamiento.</Text>
            {!bloqueado ? (
              <View style={styles.sugerencias}>
                {sugerencias.map((s) => (
                  <TouchableOpacity key={s} style={styles.sugerencia} onPress={() => enviar(s)}>
                    <Text style={styles.sugerenciaTexto}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const multimedia = item.imagenUri !== undefined || item.ubicacion !== undefined;
          return item.propio ? (
            <View style={[styles.bubble, styles.bubbleOwn, multimedia && styles.bubbleMedia]}>{contenido(item)}</View>
          ) : (
            // Mantén presionado un mensaje de la otra persona para reportarlo.
            <TouchableOpacity
              activeOpacity={0.8}
              delayLongPress={350}
              onLongPress={() => reportarMensaje(item)}
              style={[styles.bubble, styles.bubbleOther, multimedia && styles.bubbleMedia]}
              accessibilityHint="Mantén presionado para reportar este mensaje"
            >
              {contenido(item)}
            </TouchableOpacity>
          );
        }}
      />

      {bloqueado ? (
        // Persona bloqueada (HU-59): no se puede escribir hasta desbloquearla.
        <View style={[styles.bloqueadoBox, { paddingBottom: insets.bottom + 12 }]}>
          <Ionicons name="ban-outline" size={18} color={colors.danger} />
          <Text style={styles.bloqueadoTexto}>Bloqueaste a {primerNombre}. No pueden enviarse mensajes.</Text>
          <TouchableOpacity style={styles.desbloquearBtn} onPress={() => desbloquearUsuario(personaId)}>
            <Text style={styles.desbloquearTexto}>Desbloquear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* DEMO: quitar cuando los mensajes lleguen del backend */}
          {personaId !== '' && (
            <TouchableOpacity style={styles.demoLink} onPress={() => simularRespuesta(personaId)}>
              <Text style={styles.demoLinkTexto}>Demo: simular que {primerNombre} te responde</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={styles.adjuntarButton}
              onPress={abrirAdjuntos}
              disabled={obteniendoUbicacion}
              accessibilityLabel="Adjuntar ubicación o foto"
            >
              {obteniendoUbicacion ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Ionicons name="add" size={20} color={colors.textMuted} />
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
            />
            <TouchableOpacity style={styles.sendButton} onPress={() => enviar()}>
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
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
    subtitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sport: { color: c.textMuted, fontSize: 11 },
    etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    etiquetaTexto: { color: c.textMuted, fontSize: 10.5, fontWeight: '600' },
    list: { padding: 20, gap: 10 },
    listVacia: { flexGrow: 1, justifyContent: 'center' },
    bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
    bubbleMedia: { padding: 6 },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleTextOther: { color: c.text, fontSize: 13 },
    bubbleTextOwn: { color: '#fff', fontSize: 13 },
    imagen: { width: 200, height: 150, borderRadius: 12 },
    ubicacion: { paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
    ubicacionFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ubicacionTitulo: { fontSize: 13, fontWeight: '700' },
    ubicacionAccion: { fontSize: 11.5, textDecorationLine: 'underline' },
    intro: { alignItems: 'center', paddingHorizontal: 12 },
    introIcono: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EC4899', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    introTitulo: { color: c.text, fontSize: 16, fontWeight: '700' },
    introTexto: { color: c.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
    sugerencias: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
    sugerencia: { backgroundColor: c.chip, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
    sugerenciaTexto: { color: c.accent, fontSize: 12, fontWeight: '600' },
    demoLink: { alignItems: 'center', paddingVertical: 6 },
    demoLinkTexto: { color: c.textMuted, fontSize: 11 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border },
    adjuntarButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    input: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.text, fontSize: 13 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    bloqueadoBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    bloqueadoTexto: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 17 },
    desbloquearBtn: { borderWidth: 1, borderColor: c.accent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
    desbloquearTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });