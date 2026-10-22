import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { horaCorta } from '../../../services/chat';
import { MAX_CONSULTA, marcarLeidoClub, responderConsulta, useConvocatoria, useHilo } from '../../../services/consultas';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ConsultaClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { id } = useLocalSearchParams<{ id: string }>();
  const hiloId = id ?? '';
  const hilo = useHilo(hiloId);
  const convocatoria = useConvocatoria(hilo?.clubId ?? '');
  const [texto, setTexto] = useState('');
  const scroll = useRef<ScrollView>(null);

  // Al abrir (o si llega algo mientras está abierto), el club ya lo vio.
  const noLeidos = hilo?.noLeidosClub ?? 0;
  useEffect(() => {
    if (noLeidos > 0) marcarLeidoClub(hiloId);
  }, [noLeidos, hiloId]);

  const total = hilo?.mensajes.length ?? 0;
  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [total]);

  function enviar() {
    const r = responderConsulta(hiloId, texto);
    if (!r.ok) {
      Alert.alert('No se pudo enviar', r.motivo);
      return;
    }
    setTexto('');
  }

  if (!hilo) {
    return (
      <View style={[styles.container, styles.centro, { paddingTop: insets.top }]}>
        <Text style={styles.vacioTitulo}>No encontramos esta consulta</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.volverBtn}>
          <Text style={styles.volverTexto}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{hilo.postulanteNombre}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {convocatoria ? convocatoria.titulo : 'Consulta de convocatoria'}
          </Text>
        </View>
      </View>

      {convocatoria && !convocatoria.abierta ? (
        <View style={styles.aviso}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={styles.avisoTexto}>La convocatoria está cerrada. Aún puedes responder esta consulta.</Text>
        </View>
      ) : null}

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.mensajes}>
        {hilo.mensajes.map((m) => {
          const propio = m.de === 'club';
          return (
            <View key={m.id} style={[styles.burbuja, propio ? styles.burbujaPropia : styles.burbujaAjena]}>
              <Text style={[styles.texto, propio && styles.textoPropio]}>{m.texto}</Text>
              <Text style={[styles.horaMsg, propio && styles.horaMsgPropia]}>{horaCorta(m.enviadoEn)}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Responde al postulante…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={MAX_CONSULTA}
        />
        <TouchableOpacity
          style={[styles.enviarBtn, !texto.trim() && styles.enviarBtnOff]}
          onPress={enviar}
          disabled={!texto.trim()}
          accessibilityLabel="Enviar respuesta"
        >
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    centro: { alignItems: 'center', justifyContent: 'center', gap: 12 },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 16, fontWeight: '700' },
    sub: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.chip, paddingHorizontal: 20, paddingVertical: 8 },
    avisoTexto: { color: c.textMuted, fontSize: 11.5, flex: 1 },
    mensajes: { padding: 16, gap: 8 },
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
    vacioTitulo: { color: c.text, fontSize: 14, fontWeight: '700' },
    volverBtn: { backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
    volverTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });