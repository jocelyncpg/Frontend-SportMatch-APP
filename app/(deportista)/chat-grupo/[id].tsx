import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import InsigniaDeporte from '../../../components/InsigniaDeporte';
import ReportarModal from '../../../components/ReportarModal';
import { Boton } from '../../../components/ui';
import { useTecladoVisible } from '../../../hooks/use-teclado';
import { useActividades } from '../../../services/actividades';
import { horaCorta } from '../../../services/chat';
import {
  MAX_MENSAJE_GRUPAL,
  abrirSala,
  accesoGrupal,
  cerrarSala,
  enviarMensajeGrupal,
  miembrosDe,
  silenciarSala,
  simularRespuestaGrupal,
  useSalaGrupal,
  type MensajeGrupal,
} from '../../../services/chatGrupal';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Texto e íconos sobre fondos de color fuerte (burbuja propia, botón enviar) y la hora dentro de esa burbuja.
const SOBRE_COLOR = '#FFFFFF';
const SOBRE_COLOR_SUAVE = 'rgba(255,255,255,0.75)';

// DEMO: segundos que tarda en llegar el mensaje simulado, para alcanzar a salir del chat y ver el aviso y la vibración.
const DEMO_RETRASO_MS = 5000;

export default function ChatGrupoScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  // Con el teclado abierto no hace falta el margen del borde inferior: dejaba un hueco sobre el teclado.
  const tecladoAbierto = useTecladoVisible();
  const margenInferior = tecladoAbierto ? espacio.m : insets.bottom + espacio.m;

  const { id } = useLocalSearchParams<{ id: string }>();
  const actividadId = id ?? '';
  const actividades = useActividades();
  const actividad = actividades.find((x) => x.id === actividadId);
  const sala = useSalaGrupal(actividadId);

  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [reporte, setReporte] = useState<{ id: string; nombre: string } | null>(null);
  const ultimoReporte = useRef<{ id: string; nombre: string }>({ id: '', nombre: '' });
  if (reporte) ultimoReporte.current = reporte;
  const listaRef = useRef<FlatList<MensajeGrupal>>(null);

  // Se vuelve a calcular con cada cambio de la actividad: retirarte, ser rechazado o que se cancele corta el acceso al instante.
  const acceso = actividad ? accesoGrupal(actividad) : 'ninguno';
  const hayAcceso = acceso !== 'ninguno';

  // Mientras el chat está abierto, sus mensajes cuentan como leídos.
  useEffect(() => {
    if (!actividadId || !hayAcceso) return;
    abrirSala(actividadId);
    return () => cerrarSala(actividadId);
  }, [actividadId, hayAcceso]);

  // ---------- sin acceso (HU-50: se actualiza si te retiras o se cancela) ----------
  if (!actividad || !sala || !hayAcceso) {
    const cancelada = actividad?.cancelada === true;
    return (
      <View style={[styles.container, { paddingTop: insets.top + espacio.m }]}>
        <View style={styles.topbarSimple}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.sinAcceso}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={styles.sinAccesoTitulo}>{cancelada ? 'La actividad fue cancelada' : 'Ya no tienes acceso a este chat'}</Text>
          <Text style={styles.sinAccesoTexto}>
            {cancelada
              ? 'El chat grupal se cerró junto con la actividad.'
              : 'Solo quien organiza y las personas aprobadas pueden participar en el chat del grupo.'}
          </Text>
          <Boton texto="Volver" variante="secundario" onPress={() => router.back()} style={styles.volverBtn} />
        </View>
      </View>
    );
  }

  const participantes = miembrosDe(actividad).length;
  const soloLectura = acceso === 'leer';

  function enviar() {
    const r = enviarMensajeGrupal(actividadId, texto);
    if (r.ok) {
      setTexto('');
      setError('');
    } else {
      setError(r.motivo);
    }
  }

  function abrirOpciones() {
    Alert.alert(actividad!.titulo, undefined, [
      {
        text: sala!.silenciado ? 'Reactivar avisos' : 'Silenciar avisos',
        onPress: () => silenciarSala(actividadId, !sala!.silenciado),
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

  function renderMensaje({ item }: { item: MensajeGrupal }) {
    if (item.sistema) {
      return (
        <View style={styles.sistema}>
          <Text style={styles.sistemaTexto}>{item.texto}</Text>
        </View>
      );
    }
    if (item.propio) {
      return (
        <View style={[styles.bubble, styles.bubbleOwn]}>
          <Text style={styles.bubbleTextOwn}>{item.texto}</Text>
          <Text style={styles.horaOwn}>{horaCorta(item.enviadoEn)}</Text>
        </View>
      );
    }
    return (
      // Mantén presionado un mensaje de otra persona para reportarlo.
      <TouchableOpacity
        activeOpacity={0.8}
        delayLongPress={350}
        onLongPress={() => reportarMensaje(item)}
        style={[styles.bubble, styles.bubbleOther]}
        accessibilityHint="Mantén presionado para reportar este mensaje"
      >
        <Text style={styles.autor}>{item.autorNombre}</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topbarCentro}
          onPress={verActividad}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Ver la actividad ${actividad.titulo}`}
        >
          <InsigniaDeporte deporte={actividad.deporte} tamano={40} />
          <View style={styles.topbarTextos}>
            <Text style={styles.name} numberOfLines={1}>{actividad.titulo}</Text>
            <View style={styles.subtitulo}>
              <Text style={styles.sport}>{participantes} {participantes === 1 ? 'participante' : 'participantes'}</Text>
              {sala.silenciado ? (
                <View style={styles.etiqueta}>
                  <Ionicons name="notifications-off-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.etiquetaTexto}>Silenciado</Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={abrirOpciones} style={styles.opcionesButton} accessibilityRole="button" accessibilityLabel="Opciones del grupo">
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listaRef}
        data={sala.mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderMensaje}
      />

      {soloLectura ? (
        <View style={[styles.avisoBox, { paddingBottom: margenInferior }]}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={styles.avisoTexto}>La actividad ya finalizó: el chat quedó solo de lectura.</Text>
        </View>
      ) : (
        <>
          {/* DEMO: quitar cuando los mensajes lleguen del backend */}
          {participantes > 1 ? (
            <TouchableOpacity style={styles.demoLink} onPress={() => setTimeout(() => simularRespuestaGrupal(actividadId), DEMO_RETRASO_MS)} accessibilityRole="button">
              <Text style={styles.demoLinkTexto}>Demo: simular que otro participante escribe (en 5 s)</Text>
            </TouchableOpacity>
          ) : null}

          {error ? <Text accessibilityRole="alert" style={styles.errorTexto}>{error}</Text> : null}

          <View style={[styles.inputRow, { paddingBottom: margenInferior }]}>
            <TextInput
              placeholder="Escribe al grupo..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={texto}
              onChangeText={(t) => { setTexto(t); if (error) setError(''); }}
              onSubmitEditing={enviar}
              returnKeyType="send"
              maxLength={MAX_MENSAJE_GRUPAL}
              accessibilityLabel="Escribe al grupo"
            />
            <TouchableOpacity style={styles.sendButton} onPress={enviar} accessibilityRole="button" accessibilityLabel="Enviar mensaje">
              <Ionicons name="send" size={18} color={SOBRE_COLOR} />
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
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m, borderBottomWidth: 1, borderColor: c.border },
    topbarSimple: { paddingHorizontal: espacio.l, marginBottom: espacio.l },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    opcionesButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topbarCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 44 },
    topbarTextos: { flex: 1 },
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
    bubbleTextOwn: { color: SOBRE_COLOR, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    horaOther: { color: c.textMuted, ...tipo.etiqueta, fontWeight: '400', marginTop: 3, alignSelf: 'flex-end' },
    horaOwn: { color: SOBRE_COLOR_SUAVE, ...tipo.etiqueta, fontWeight: '400', marginTop: 3, alignSelf: 'flex-end' },
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
  });