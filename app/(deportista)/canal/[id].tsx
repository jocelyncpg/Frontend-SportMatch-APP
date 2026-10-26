import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { abrirCanalDeportista, cerrarCanal, enviarMensajeCanal, silenciarCanal, useCanales, type MensajeCanal } from '../../../services/canales';
import { horaCorta } from '../../../services/chat';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function CanalDeportistaScreen() {
  const { colors } = useAppTheme(); const styles = useMemo(() => makeStyles(colors), [colors]); const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>(); const canalId = id ?? ''; const estado = useCanales();
  const canal = estado.deportista.find((c) => c.id === canalId); const mensajes = estado.mensajes[canalId] ?? []; const [texto, setTexto] = useState('');
  useFocusEffect(useCallback(() => { if (!canalId) return; abrirCanalDeportista(canalId); return () => cerrarCanal(canalId); }, [canalId]));
  async function enviar() { const r = await enviarMensajeCanal(canalId, null, texto); if (r.ok) setTexto(''); else Alert.alert('No se pudo enviar', r.motivo); }
  function opciones() { Alert.alert(canal?.nombre ?? 'Canal', undefined, [
    { text: canal?.silenciado ? 'Activar avisos' : 'Silenciar', onPress: () => canal && silenciarCanal(canalId, !canal.silenciado).catch((e) => Alert.alert('No se pudo cambiar el aviso', e.message)) },
    { text: 'Cancelar', style: 'cancel' },
  ]); }
  function render({ item }: { item: MensajeCanal }) { return <View style={[styles.message, item.propio ? styles.own : null]}>
    <Text style={styles.author}>{item.autorNombre}</Text><Text style={styles.text}>{item.texto}</Text><Text style={styles.time}>{horaCorta(item.enviadoEn)}</Text>
  </View>; }
  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.text} /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>{canal?.nombre ?? 'Canal'}</Text><Text style={styles.sub}>{canal?.clubNombre ?? 'Canal del club'}</Text></View>
      <TouchableOpacity onPress={opciones} style={styles.back}><Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} /></TouchableOpacity>
    </View>
    <FlatList data={mensajes} keyExtractor={(m) => m.id} renderItem={render} contentContainerStyle={styles.list} />
    {!canal?.miembrosEscriben ? <View style={[styles.readonly, { paddingBottom: insets.bottom + 12 }]}><Text style={styles.sub}>Solo el club puede escribir en este canal.</Text></View> :
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}><TextInput style={styles.input} value={texto} onChangeText={setTexto} placeholder="Escribir en el canal…" placeholderTextColor={colors.textMuted} maxLength={1000} multiline />
        <TouchableOpacity style={styles.send} onPress={enviar} disabled={!texto.trim()}><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity></View>}
  </KeyboardAvoidingView>;
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg }, topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }, title: { color: c.text, fontSize: 15, fontWeight: '700' }, sub: { color: c.textMuted, fontSize: 11, marginTop: 2 }, list: { padding: 14, gap: 8, flexGrow: 1 },
  message: { alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: c.card, borderRadius: 14, padding: 11 }, own: { alignSelf: 'flex-end', backgroundColor: c.chip }, author: { color: c.primary, fontSize: 10, fontWeight: '700', marginBottom: 3 }, text: { color: c.text, fontSize: 13 }, time: { color: c.textMuted, fontSize: 9, marginTop: 5 },
  readonly: { borderTopWidth: 1, borderTopColor: c.border, padding: 14, alignItems: 'center' }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: c.border, padding: 10 },
  input: { flex: 1, maxHeight: 100, color: c.text, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 }, send: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
});
