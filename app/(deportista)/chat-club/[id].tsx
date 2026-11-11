import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTecladoVisible } from '../../../hooks/use-teclado';
import { YO } from '../../../services/actividades';
import { getSession } from '../../../services/auth';
import { horaCorta } from '../../../services/chat';
import {
  MAX_CONSULTA,
  abrirConsultaDeportista,
  cerrarConsulta,
  enviarConsulta,
  idHilo,
  useEstadoConsultas,
  useHilo,
} from '../../../services/consultas';
import { cargarClub, useClub } from '../../../services/clubes';
import { chatPostulantesHabilitado, misPostulaciones } from '../../../services/convocatorias';
import { Colors, useAppTheme, espacio, radio, tipo } from '../../../theme/ThemeContext';
export default function ChatClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tecladoVisible = useTecladoVisible();
  const margenInferior = tecladoVisible ? espacio.s : insets.bottom + espacio.m;
  const { id } = useLocalSearchParams<{
    id: string
  }>();
  const clubId = id ?? '';
  const hiloId = idHilo(clubId, YO);
  const club = useClub(clubId);
  const estado = useEstadoConsultas();
  const hilo = useHilo(hiloId);
  const sinPermiso = estado.error?.includes('Solo puedes escribir a clubes a los que postulaste.') ?? false;
  const nombreClub = club?.nombre ?? hilo?.clubNombre ?? 'Club';
  const [texto, setTexto] = useState('');
  const scroll = useRef<ScrollView>(null);
  // Nombre con el que el club verá esta consulta: el de la cuenta con la que se inició sesión.
  const [miNombre, setMiNombre] = useState('');
  // Si el club deshabilitó el chat en todas las convocatorias donde el deportista está postulado, solo puede leer.
  const [soloLectura, setSoloLectura] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!clubId) return;
    cargarClub(clubId).catch(() => { });
    abrirConsultaDeportista(clubId);
    misPostulaciones().then(({ items }) => {
      const activas = items.filter((p) => p.convocatoria.club.id === clubId && p.estado !== 'RECHAZADO');
      setSoloLectura(activas.length > 0 && activas.every((p) => !chatPostulantesHabilitado(p.convocatoria)));
    }).catch(() => setSoloLectura(false));
    getSession().then((s) => {
      if (s?.nombre) setMiNombre(s.nombre);
    });
    return () => cerrarConsulta(hiloId);
  }, [clubId, hiloId]));
  // Al abrir (o si llega una respuesta mientras está abierto), ya la vio.
  const total = hilo?.mensajes.length ?? 0;
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [total]);
  async function enviar() {
    const r = await enviarConsulta(clubId, YO, miNombre, texto);
    if (!r.ok) {
      Alert.alert('No se pudo enviar', r.motivo);
      return;
    }
    setTexto('');
  }
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: insets.top + espacio.m }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.icono, { backgroundColor: '#7C3AED' }]}>
          <Ionicons name="shield" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{nombreClub}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            Consultas con el club
          </Text>
        </View>
      </View>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.mensajes}>
        {estado.error ? <Text style={styles.cerradaTexto}>{estado.error}</Text> : null}
        {total === 0 ? (
          <View style={styles.vacio}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
            <Text style={styles.vacioTitulo}>Escríbele al club</Text>
            <Text style={styles.vacioTexto}>
              Pregunta por pruebas, horarios o requisitos de la convocatoria. El club te responde por aquí.
            </Text>
          </View>
        ) : null}
        {hilo?.mensajes.map((m) => {
          const propio = m.de === 'postulante';
          return (
            <View key={m.id} style={[styles.burbuja, propio ? styles.burbujaPropia : styles.burbujaAjena]}>
              <Text style={[styles.texto, propio && styles.textoPropio]}>{m.texto}</Text>
              <Text style={[styles.horaMsg, propio && styles.horaMsgPropia]}>{horaCorta(m.enviadoEn)}</Text>
            </View>
          );
        })}
      </ScrollView>
      {soloLectura ? (
        <View style={[styles.inputBar, { paddingBottom: margenInferior }]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <Text style={styles.cerradaTexto}>
            Solo puedes leer: el club deshabilitó el chat para postulantes en esta convocatoria.
          </Text>
        </View>
      ) : !sinPermiso ? (
        <View style={[styles.inputBar, { paddingBottom: margenInferior }]}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe tu consulta…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CONSULTA}
          />
          <TouchableOpacity
            style={[styles.enviarBtn, !texto.trim() && styles.enviarBtnOff]}
            onPress={enviar}
            disabled={!texto.trim()}
            accessibilityLabel="Enviar consulta"
          >
            <Ionicons name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m, borderBottomWidth: 1, borderBottomColor: c.border },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    icono: { width: 40, height: 40, borderRadius: radio.control, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, ...tipo.seccion },
    sub: { color: c.textMuted, ...tipo.dato, marginTop: 2 },
    mensajes: { padding: espacio.xl, gap: espacio.m, flexGrow: 1 },
    vacio: { alignItems: 'center', paddingHorizontal: espacio.xxl + espacio.s, marginTop: 50, gap: espacio.s },
    vacioTitulo: { color: c.text, ...tipo.seccion, marginTop: espacio.s - 2 },
    vacioTexto: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', lineHeight: 19 },
    burbuja: { maxWidth: '80%', borderRadius: radio.tarjeta, paddingHorizontal: espacio.l - 2, paddingVertical: espacio.m - 1 },
    burbujaPropia: { alignSelf: 'flex-end', backgroundColor: c.primary, borderBottomRightRadius: espacio.xs },
    burbujaAjena: { alignSelf: 'flex-start', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: espacio.xs },
    texto: { color: c.text, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    textoPropio: { color: '#FFFFFF' },
    horaMsg: { color: c.textMuted, ...tipo.etiqueta, fontWeight: '400', marginTop: 3, alignSelf: 'flex-end' },
    horaMsgPropia: { color: 'rgba(255,255,255,0.75)' },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s, paddingHorizontal: espacio.l, paddingTop: espacio.m, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    input: { flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: espacio.l, paddingVertical: espacio.s + 1, color: c.text, fontSize: 14, fontWeight: '400' },
    enviarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    enviarBtnOff: { opacity: 0.4 },
    cerrada: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.xl, paddingTop: espacio.m, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.chip },
    cerradaTexto: { color: c.textMuted, ...tipo.dato, flex: 1 },
  });
