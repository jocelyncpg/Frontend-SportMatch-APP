import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cambiarMiembroCanal, cerrarCanal, decidirInactividad, editarCanal, eliminarCanal, listarMiembrosCanal, abrirCanalClub, enviarMensajeCanal, cargarCanalesClub, useCanales } from '../../../services/canales';
import { horaCorta } from '../../../services/chat';
import { getSession } from '../../../services/auth';
import { alCambiar } from '../../../services/sondeo';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function CanalClubScreen() {
  const { colors } = useAppTheme(); const styles = useMemo(() => makeStyles(colors), [colors]); const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; clubId?: string }>(); const canalId = params.id ?? '';
  const [clubId, setClubId] = useState(params.clubId ?? ''); const [nombre, setNombre] = useState(''); const [texto, setTexto] = useState('');
  const [miembrosEscriben, setMiembrosEscriben] = useState(false); const [miembros, setMiembros] = useState<{ usuarioId: string; nombre: string }[]>([]);
  const [candidatos, setCandidatos] = useState<{ usuarioId: string; nombre: string }[]>([]); const [error, setError] = useState('');
  const estado = useCanales(); const canal = estado.club.find((c) => c.id === canalId); const mensajes = estado.mensajes[canalId] ?? [];
  useEffect(() => { if (!clubId) getSession().then((s) => setClubId(s?.clubId ?? '')); }, [clubId]);
  const cargarPersonas = useCallback(async () => {
    if (!clubId || !canalId) return;
    try { setMiembros(await listarMiembrosCanal(clubId, canalId)); setCandidatos(await listarMiembrosCanal(clubId, canalId, true)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los miembros.'); }
  }, [clubId, canalId]);
  useFocusEffect(useCallback(() => {
    if (!clubId || !canalId) return;
    void cargarCanalesClub(clubId); abrirCanalClub(clubId, canalId); void cargarPersonas();
    const quitar = alCambiar(({ tipo, id }) => { if (tipo === 'canal_inactivo' && id === canalId) void cargarPersonas(); });
    return () => { cerrarCanal(canalId); quitar(); };
  }, [clubId, canalId, cargarPersonas]));
  useEffect(() => { if (canal) { setNombre(canal.nombre); setMiembrosEscriben(canal.miembrosEscriben); } }, [canal]);
  async function enviar() { const r = await enviarMensajeCanal(canalId, clubId, texto); if (r.ok) setTexto(''); else setError(r.motivo); }
  function confirmarEliminar() { Alert.alert('Eliminar canal', 'Se borrarán también sus mensajes y miembros.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => eliminarCanal(clubId, canalId).then(() => router.back()).catch((e) => setError(e.message)) },
  ]); }
  async function guardar() { try { await editarCanal(clubId, canalId, { nombre, miembrosEscriben }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el canal.'); } }
  async function decidir(decision: 'eliminar' | 'mantener') {
    if (decision === 'eliminar') { confirmarEliminar(); return; }
    try { await decidirInactividad(clubId, canalId, decision); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo mantener el canal.'); }
  }
  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.topbar}><TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>{canal?.nombre ?? 'Canal'}</Text><TouchableOpacity onPress={confirmarEliminar}><Text style={styles.danger}>Eliminar</Text></TouchableOpacity></View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {canal?.avisoInactividadEn ? <View style={styles.notice}><Text style={styles.noticeTitle}>Este canal lleva 30 días sin uso y se eliminará</Text>
          <View style={styles.actions}><TouchableOpacity style={styles.dangerButton} onPress={() => decidir('eliminar')}><Text style={styles.white}>Eliminar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => decidir('mantener')}><Text style={styles.white}>Mantener 30 días más</Text></TouchableOpacity></View></View> : null}
        <View style={styles.card}><Text style={styles.label}>Nombre del canal</Text><TextInput style={styles.input} value={nombre} onChangeText={setNombre} maxLength={60} />
          <View style={styles.actions}><Text style={styles.label}>Los miembros también pueden escribir</Text><Switch value={miembrosEscriben} onValueChange={setMiembrosEscriben} /></View>
          <TouchableOpacity style={styles.button} onPress={guardar}><Text style={styles.white}>Guardar cambios</Text></TouchableOpacity></View>
        <Text style={styles.section}>Mensajes</Text>
        {mensajes.map((m) => <View key={m.id} style={styles.message}><Text style={styles.author}>{m.autorNombre}</Text><Text style={styles.label}>{m.texto}</Text><Text style={styles.time}>{horaCorta(m.enviadoEn)}</Text></View>)}
        <Text style={styles.section}>Miembros ({miembros.length})</Text>
        {miembros.map((m) => <View key={m.usuarioId} style={styles.person}><Text style={styles.label}>{m.nombre}</Text><TouchableOpacity onPress={() => cambiarMiembroCanal(clubId, canalId, m.usuarioId, false).then(cargarPersonas).catch((e) => setError(e.message))}><Text style={styles.danger}>Sacar</Text></TouchableOpacity></View>)}
        <Text style={styles.section}>Agregar postulante activo</Text>
        {candidatos.map((m) => <View key={m.usuarioId} style={styles.person}><Text style={styles.label}>{m.nombre}</Text><TouchableOpacity onPress={() => cambiarMiembroCanal(clubId, canalId, m.usuarioId, true).then(cargarPersonas).catch((e) => setError(e.message))}><Text style={styles.link}>Agregar</Text></TouchableOpacity></View>)}
        {error || estado.error ? <Text style={styles.danger}>{error || estado.error}</Text> : null}
      </ScrollView>
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}><TextInput style={styles.messageInput} value={texto} onChangeText={setTexto} maxLength={1000} placeholder="Escribir como club…" placeholderTextColor={colors.textMuted} multiline />
        <TouchableOpacity style={styles.send} onPress={enviar} disabled={!texto.trim()}><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity></View>
    </View>
  );
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg }, topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, color: c.text, fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 8 }, card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 13 },
  input: { color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 9, padding: 9, marginVertical: 7 }, label: { color: c.text, fontSize: 12 }, section: { color: c.text, fontWeight: '700', marginTop: 12 },
  person: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }, link: { color: c.primary, fontWeight: '700', fontSize: 12 }, danger: { color: c.danger, fontWeight: '700', fontSize: 12 },
  message: { alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: c.card, borderRadius: 12, padding: 10, marginVertical: 3 }, author: { color: c.primary, fontSize: 10, fontWeight: '700', marginBottom: 3 }, time: { color: c.textMuted, fontSize: 9, marginTop: 4 },
  notice: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', borderWidth: 1, borderRadius: 12, padding: 12 }, noticeTitle: { color: '#9A3412', fontWeight: '700', fontSize: 13 }, actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  button: { backgroundColor: c.primary, padding: 10, borderRadius: 9, alignItems: 'center', marginTop: 8 }, dangerButton: { backgroundColor: c.danger, padding: 10, borderRadius: 9 }, white: { color: '#fff', fontWeight: '700', fontSize: 11 }, inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, borderTopColor: c.border, padding: 10 },
  messageInput: { flex: 1, maxHeight: 100, color: c.text, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 }, send: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
});
