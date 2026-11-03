import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YO } from '../../../services/actividades';
import { getSession } from '../../../services/auth';
import { horaCorta } from '../../../services/chat';
import {
  MAX_CONSULTA,
  enviarConsulta,
  idHilo,
  marcarLeidoPostulante,
  simularRespuestaClub,
  useConvocatoria,
  useHilo,
} from '../../../services/consultas';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Texto e íconos sobre fondos de color fuerte (ícono del club, burbuja propia, botón enviar) y la hora dentro de esa burbuja.
const SOBRE_COLOR = '#FFFFFF';
const SOBRE_COLOR_SUAVE = 'rgba(255,255,255,0.75)';
// Color del ícono del club cuando la convocatoria no trae uno propio.
const COLOR_CLUB_BASE = '#7C3AED';

export default function ChatClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const clubId = id ?? '';
  const hiloId = idHilo(clubId, YO);
  const convocatoria = useConvocatoria(clubId);
  const hilo = useHilo(hiloId);
  const abierta = convocatoria?.abierta === true;
  const nombreClub = convocatoria?.clubNombre ?? hilo?.clubNombre ?? 'Club';

  const [texto, setTexto] = useState('');
  const scroll = useRef<ScrollView>(null);

  // Nombre con el que el club verá esta consulta: el de la cuenta con la que se inició sesión.
  const [miNombre, setMiNombre] = useState('Postulante');
  useEffect(() => {
    getSession().then((s) => {
      if (s?.nombre) setMiNombre(s.nombre);
    });
  }, []);

  // Al abrir (o si llega una respuesta mientras está abierto), ya la vio.
  const noLeidos = hilo?.noLeidosPostulante ?? 0;
  useEffect(() => {
    if (noLeidos > 0) marcarLeidoPostulante(hiloId);
  }, [noLeidos, hiloId]);

  const total = hilo?.mensajes.length ?? 0;
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [total]);

  function enviar() {
    const r = enviarConsulta(clubId, YO, miNombre, texto);
    if (!r.ok) {
      Alert.alert('No se pudo enviar', r.motivo);
      return;
    }
    setTexto('');
    // SOLO DEMO: el club responde solo. En la app real responde quien administra el club.
    setTimeout(() => simularRespuestaClub(hiloId), 2500);
  }

  const sinTexto = !texto.trim();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: insets.top + espacio.m }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.icono, { backgroundColor: convocatoria?.colorFrom ?? COLOR_CLUB_BASE }]}>
          <Ionicons name="shield" size={20} color={SOBRE_COLOR} />
        </View>
        <View style={styles.topbarTextos}>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{nombreClub}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {convocatoria ? convocatoria.titulo : 'Consultas de convocatoria'}
          </Text>
        </View>
      </View>

      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.mensajes}>
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

      {abierta ? (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + espacio.m }]}>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe tu consulta…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CONSULTA}
            accessibilityLabel="Escribe tu consulta"
          />
          <TouchableOpacity
            style={[styles.enviarBtn, sinTexto && styles.enviarBtnOff]}
            onPress={enviar}
            disabled={sinTexto}
            accessibilityRole="button"
            accessibilityState={{ disabled: sinTexto }}
            accessibilityLabel="Enviar consulta"
          >
            <Ionicons name="send" size={18} color={SOBRE_COLOR} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.cerrada, { paddingBottom: insets.bottom + espacio.m }]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <Text style={styles.cerradaTexto}>
            La convocatoria está cerrada: ya no se pueden enviar consultas nuevas.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m, borderBottomWidth: 1, borderBottomColor: c.border },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    icono: { width: 40, height: 40, borderRadius: radio.control, alignItems: 'center', justifyContent: 'center' },
    topbarTextos: { flex: 1, marginLeft: espacio.xs },
    title: { color: c.text, ...tipo.seccion },
    sub: { color: c.textMuted, ...tipo.dato, marginTop: 2 },
    scroll: { flex: 1 },
    mensajes: { padding: espacio.xl, gap: espacio.m, flexGrow: 1 },
    vacio: { alignItems: 'center', paddingHorizontal: espacio.xxl + espacio.s, marginTop: 50, gap: espacio.s },
    vacioTitulo: { color: c.text, ...tipo.seccion, marginTop: espacio.s - 2 },
    vacioTexto: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', lineHeight: 19 },
    burbuja: { maxWidth: '80%', borderRadius: radio.tarjeta, paddingHorizontal: espacio.l - 2, paddingVertical: espacio.m - 1 },
    burbujaPropia: { alignSelf: 'flex-end', backgroundColor: c.primary, borderBottomRightRadius: espacio.xs },
    burbujaAjena: { alignSelf: 'flex-start', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: espacio.xs },
    texto: { color: c.text, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    textoPropio: { color: SOBRE_COLOR },
    horaMsg: { color: c.textMuted, ...tipo.etiqueta, fontWeight: '400', marginTop: 3, alignSelf: 'flex-end' },
    horaMsgPropia: { color: SOBRE_COLOR_SUAVE },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: espacio.s, paddingHorizontal: espacio.l, paddingTop: espacio.m, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    input: { flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: espacio.l, paddingVertical: espacio.s + 1, color: c.text, fontSize: 14, fontWeight: '400' },
    enviarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    enviarBtnOff: { opacity: 0.4 },
    cerrada: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.xl, paddingTop: espacio.m, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.chip },
    cerradaTexto: { color: c.textMuted, ...tipo.dato, flex: 1 },
  });