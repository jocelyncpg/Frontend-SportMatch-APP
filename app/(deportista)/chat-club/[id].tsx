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
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.icono, { backgroundColor: convocatoria?.colorFrom ?? '#7C3AED' }]}>
          <Ionicons name="shield" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{nombreClub}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {convocatoria ? convocatoria.titulo : 'Consultas de convocatoria'}
          </Text>
        </View>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.mensajes}>
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
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
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
      ) : (
        <View style={[styles.cerrada, { paddingBottom: insets.bottom + 12 }]}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
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
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    icono: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 15, fontWeight: '700' },
    sub: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    mensajes: { padding: 16, gap: 8, flexGrow: 1 },
    vacio: { alignItems: 'center', paddingHorizontal: 30, marginTop: 50, gap: 8 },
    vacioTitulo: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
    vacioTexto: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
    burbuja: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
    burbujaPropia: { alignSelf: 'flex-end', backgroundColor: c.primary, borderBottomRightRadius: 4 },
    burbujaAjena: { alignSelf: 'flex-start', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4 },
    texto: { color: c.text, fontSize: 13, lineHeight: 18 },
    textoPropio: { color: '#fff' },
    horaMsg: { color: c.textMuted, fontSize: 9.5, marginTop: 3, alignSelf: 'flex-end' },
    horaMsgPropia: { color: 'rgba(255,255,255,0.75)' },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    input: { flex: 1, maxHeight: 110, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 13 },
    enviarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    enviarBtnOff: { opacity: 0.4 },
    cerrada: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.chip },
    cerradaTexto: { color: c.textMuted, fontSize: 12, flex: 1 },
  });