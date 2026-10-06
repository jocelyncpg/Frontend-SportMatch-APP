import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activityStart, createActivity } from '../../services/activities';
import { ApiError } from '../../services/api';
import { codigoDeporte } from '../../services/deportes';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function CreateActivityScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(''); const [sport, setSport] = useState('');
  const [date, setDate] = useState(''); const [time, setTime] = useState('');
  const [location, setLocation] = useState(''); const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const busy = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  async function publish() {
    if (busy.current) return;
    setError(''); setExpired(false);
    try {
      const sportCode = codigoDeporte(sport);
      if (title.trim().length < 3 || location.trim().length < 3 || !sportCode) throw new Error('Completa el título, deporte y lugar de encuentro.');
      const body = { title: title.trim(), sport_code: sportCode, starts_at: activityStart(date, time), location: location.trim(), description: description.trim() };
      const signature = JSON.stringify(body);
      if (attempt.current?.signature !== signature) attempt.current = { signature, id: Crypto.randomUUID() };
      busy.current = true; setSaving(true);
      const activity = await createActivity(body, attempt.current.id);
      router.replace({ pathname: '/(deportista)/activity/[id]', params: { id: activity.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar. Inténtalo de nuevo.');
      setExpired(e instanceof ApiError && e.status === 401);
    } finally { busy.current = false; setSaving(false); }
  }
  return <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top + 16 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.topbar}><TouchableOpacity disabled={saving} accessibilityLabel="Volver" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity><Text style={styles.heading}>Crear actividad</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={styles.note}>Invita a otros deportistas a entrenar contigo. Tu actividad será visible para los deportistas de SportMatch.</Text>
      <Text style={styles.label}>Título</Text><TextInput accessibilityLabel="Título" editable={!saving} style={styles.input} value={title} onChangeText={setTitle} maxLength={120} placeholder="Ej. Running en el parque" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Deporte</Text><TextInput accessibilityLabel="Deporte" editable={!saving} style={styles.input} value={sport} onChangeText={setSport} maxLength={50} placeholder="Ej. Running, fútbol, yoga…" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Fecha (DD/MM/AAAA)</Text><TextInput accessibilityLabel="Fecha" editable={!saving} style={styles.input} value={date} onChangeText={setDate} maxLength={10} placeholder="25/12/2026" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Hora (HH:MM, formato 24 horas)</Text><TextInput accessibilityLabel="Hora" editable={!saving} style={styles.input} value={time} onChangeText={setTime} maxLength={5} placeholder="19:30" keyboardType="numbers-and-punctuation" placeholderTextColor={colors.textMuted} />
      <Text style={styles.note}>Usamos la zona horaria de tu dispositivo.</Text>
      <Text style={styles.label}>Lugar de encuentro</Text><TextInput accessibilityLabel="Lugar de encuentro" editable={!saving} style={styles.input} value={location} onChangeText={setLocation} maxLength={200} placeholder="Parque, dirección y comuna" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Descripción (opcional)</Text><TextInput accessibilityLabel="Descripción" editable={!saving} style={[styles.input, styles.description]} value={description} onChangeText={setDescription} multiline maxLength={2000} placeholder="Qué harán, duración estimada y qué llevar…" placeholderTextColor={colors.textMuted} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <TouchableOpacity accessibilityRole="button" disabled={saving} style={[styles.button, saving && { opacity: 0.6 }]} onPress={() => expired ? router.replace('/(auth)/login') : void publish()}>
        {saving ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.buttonText}>{expired ? 'Iniciar sesión' : 'Publicar actividad'}</Text>}
      </TouchableOpacity>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg }, topbar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, marginBottom: 20 },
  heading: { fontSize: 18, color: c.text, fontWeight: '700' }, content: { paddingHorizontal: 20 },
  note: { color: c.textMuted, lineHeight: 21, marginBottom: 16 }, label: { color: c.text, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: c.card, color: c.text, borderColor: c.border, borderWidth: 1, borderRadius: 13, padding: 14, marginBottom: 16 },
  description: { minHeight: 110, textAlignVertical: 'top' }, error: { color: c.danger, marginBottom: 16 },
  button: { backgroundColor: c.card, borderWidth: 1, borderColor: c.accent, borderRadius: 13, padding: 16, alignItems: 'center' }, buttonText: { color: c.accent, fontWeight: '700' },
});
