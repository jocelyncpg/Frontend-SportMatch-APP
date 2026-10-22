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
import ReportarModal from '../../../components/ReportarModal';
import { useActividades, visualDeporte } from '../../../services/actividades';
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
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ChatGrupoScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

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
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topbarSimple}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
          <TouchableOpacity style={styles.volverBtn} onPress={() => router.back()}>
            <Text style={styles.volverTexto}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const visual = visualDeporte(actividad.deporte);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.topbarCentro} onPress={verActividad} activeOpacity={0.7}>
          <View style={[styles.iconBox, { backgroundColor: visual.colorBg }]}>
            <Text style={styles.icon}>{visual.icon}</Text>
          </View>
          <View style={styles.topbarTextos}>
            <Text style={styles.name} numberOfLines={1}>{actividad.titulo}</Text>
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
        data={sala.mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderMensaje}
      />

      {soloLectura ? (
        <View style={[styles.avisoBox, { paddingBottom: insets.bottom + 12 }]}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={styles.avisoTexto}>La actividad ya finalizó: el chat quedó solo de lectura.</Text>
        </View>
      ) : (
        <>
          {/* DEMO: quitar cuando los mensajes lleguen del backend */}
          {participantes > 1 ? (
            <TouchableOpacity style={styles.demoLink} onPress={() => simularRespuestaGrupal(actividadId)}>
              <Text style={styles.demoLinkTexto}>Demo: simular que otro participante escribe</Text>
            </TouchableOpacity>
          ) : null}

          {error ? <Text style={styles.errorTexto}>{error}</Text> : null}

          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
            <TextInput
              placeholder="Escribe al grupo..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={texto}
              onChangeText={(t) => { setTexto(t); if (error) setError(''); }}
              onSubmitEditing={enviar}
              returnKeyType="send"
              maxLength={MAX_MENSAJE_GRUPAL}
            />
            <TouchableOpacity style={styles.sendButton} onPress={enviar} accessibilityLabel="Enviar mensaje">
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
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: c.border },
    topbarSimple: { paddingHorizontal: 20, marginBottom: 16 },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    topbarCentro: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    topbarTextos: { flex: 1 },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 17 },
    name: { color: c.text, fontSize: 14, fontWeight: '700' },
    subtitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sport: { color: c.textMuted, fontSize: 11 },
    etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    etiquetaTexto: { color: c.textMuted, fontSize: 10.5, fontWeight: '600' },

    list: { padding: 20, gap: 6 },
    bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 4 },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    autor: { color: c.accent, fontSize: 11, fontWeight: '700', marginBottom: 3 },
    bubbleTextOther: { color: c.text, fontSize: 13 },
    bubbleTextOwn: { color: '#fff', fontSize: 13 },
    horaOther: { color: c.textMuted, fontSize: 9.5, marginTop: 3, alignSelf: 'flex-end' },
    horaOwn: { color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 3, alignSelf: 'flex-end' },
    sistema: { alignSelf: 'center', backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, marginVertical: 4, maxWidth: '90%' },
    sistemaTexto: { color: c.textMuted, fontSize: 11, textAlign: 'center' },

    demoLink: { alignItems: 'center', paddingVertical: 6 },
    demoLinkTexto: { color: c.textMuted, fontSize: 11 },
    errorTexto: { color: c.danger, fontSize: 11.5, paddingHorizontal: 20, paddingBottom: 6 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border },
    input: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.text, fontSize: 13 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avisoBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    avisoTexto: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 17 },

    sinAcceso: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 8 },
    sinAccesoTitulo: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: 6, textAlign: 'center' },
    sinAccesoTexto: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
    volverBtn: { marginTop: 14, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
    volverTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });