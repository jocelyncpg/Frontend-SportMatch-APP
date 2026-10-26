import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession } from '../../services/auth';
import { MENSAJE_MAX, TITULO_MAX, cargarAvisosClub, enviarAvisoClub, type AvisoClub } from '../../services/avisosClub';
import { hace } from '../../services/notificaciones';
import { contarPostulantesVigentes, cargarPostulacionesDelClub } from '../../services/postulaciones';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

const plural = (n: number) => `${n} ${n === 1 ? 'postulante' : 'postulantes'}`;

export default function AvisosClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [clubId, setClubId] = useState<string | null>(null);
  useEffect(() => {
    getSession().then((s) => setClubId(s?.clubId ?? null));
  }, []);

  // Reciben el aviso quienes tienen una postulación vigente (pendientes, preseleccionados y aceptados).
  // El backend aplica esa misma audiencia (TODOS); aquí solo se muestra cuántos son.
  const [destinatarios, setDestinatarios] = useState(0);
  const [enviados, setEnviados] = useState<AvisoClub[]>([]);
  const [cargarError, setCargarError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function recargar(id: string) {
    try {
      const [avisos, candidatos] = await Promise.all([cargarAvisosClub(id), cargarPostulacionesDelClub(id)]);
      setEnviados(avisos);
      setDestinatarios(contarPostulantesVigentes(candidatos));
      setCargarError('');
    } catch (e) {
      setCargarError(e instanceof Error ? e.message : 'No se pudieron cargar los avisos.');
    }
  }

  useEffect(() => {
    if (clubId) recargar(clubId);
  }, [clubId]);

  async function enviar() {
    if (!clubId || enviando) return;
    setError('');
    setConfirmacion('');
    setEnviando(true);
    const r = await enviarAvisoClub(clubId, titulo, mensaje);
    setEnviando(false);
    if (!r.ok) {
      setError(r.motivo);
      return;
    }
    setTitulo('');
    setMensaje('');
    setConfirmacion(`Aviso enviado a ${plural(r.destinatarios)}.`);
    recargar(clubId);
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 12 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Avisos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.ayuda}>Envía un comunicado a las personas que postularon a tu convocatoria. Lo verán en sus notificaciones.</Text>

        <View style={styles.destino}>
          <Ionicons name="people-outline" size={16} color={colors.accent} />
          <Text style={styles.destinoTexto}>
            {destinatarios > 0 ? `Se enviará a ${plural(destinatarios)}` : 'Todavía no tienes postulantes a quienes escribirles'}
          </Text>
        </View>

        <Text style={styles.etiqueta}>Título</Text>
        <View style={styles.inputBox}>
          <TextInput
            placeholder="Ej: Cambio de lugar de la prueba"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={titulo}
            onChangeText={setTitulo}
            maxLength={TITULO_MAX}
          />
        </View>

        <Text style={styles.etiqueta}>Mensaje</Text>
        <View style={[styles.inputBox, { height: 120, alignItems: 'flex-start' }]}>
          <TextInput
            placeholder="Escribe el mensaje para tus postulantes"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
            value={mensaje}
            onChangeText={setMensaje}
            maxLength={MENSAJE_MAX}
            multiline
          />
        </View>
        <Text style={styles.contador}>{mensaje.length}/{MENSAJE_MAX}</Text>

        {error || cargarError ? <Text accessibilityRole="alert" style={styles.error}>{error || cargarError}</Text> : null}
        {confirmacion ? <Text style={styles.ok}>{confirmacion}</Text> : null}

        <TouchableOpacity style={[styles.enviar, (destinatarios === 0 || enviando) && { opacity: 0.5 }]} onPress={enviar} disabled={enviando} activeOpacity={0.85}>
          <Ionicons name="paper-plane-outline" size={16} color="#fff" />
          <Text style={styles.enviarTexto}>Enviar aviso</Text>
        </TouchableOpacity>

        <Text style={styles.seccion}>Avisos enviados</Text>
        {enviados.length === 0 ? (
          <Text style={styles.vacio}>Aún no has enviado avisos.</Text>
        ) : (
          enviados.map((a) => (
            <View key={a.id} style={styles.aviso}>
              <View style={styles.avisoCabecera}>
                <Text style={styles.avisoTitulo} numberOfLines={2}>{a.titulo}</Text>
                <Text style={styles.avisoCuando}>{hace(Math.max(0, (Date.now() - a.ts) / 60000))}</Text>
              </View>
              <Text style={styles.avisoPara}>Para {plural(a.destinatarios)}</Text>
              <Text style={styles.avisoMensaje}>{a.mensaje}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    ayuda: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 },
    destino: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.chip, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 16 },
    destinoTexto: { color: c.accent, fontSize: 12.5, fontWeight: '700', flex: 1 },
    etiqueta: { color: c.textMuted, fontSize: 11.5, fontWeight: '600', marginBottom: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
    input: { color: c.text, fontSize: 13, flex: 1 },
    contador: { color: c.textMuted, fontSize: 10.5, textAlign: 'right', marginTop: -6, marginBottom: 12 },
    error: { color: c.danger, fontSize: 12, marginBottom: 12 },
    ok: { color: c.success, fontSize: 12, fontWeight: '700', marginBottom: 12 },
    enviar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 13 },
    enviarTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
    seccion: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 28, marginBottom: 10 },
    vacio: { color: c.textMuted, fontSize: 12 },
    aviso: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    avisoCabecera: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    avisoTitulo: { color: c.text, fontSize: 13, fontWeight: '700', flex: 1 },
    avisoCuando: { color: c.textMuted, fontSize: 10.5 },
    avisoPara: { color: c.textMuted, fontSize: 10.5, marginTop: 3 },
    avisoMensaje: { color: c.text, fontSize: 12, lineHeight: 17, marginTop: 8 },
  });