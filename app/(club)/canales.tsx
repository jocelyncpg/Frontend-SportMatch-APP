import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { crearCanal, cargarCanalesClub, useCanales } from '../../services/canales';
import { getSession } from '../../services/auth';
import { alCambiar, crearSondeo } from '../../services/sondeo';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function CanalesClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const canales = useCanales();
  const [clubId, setClubId] = useState('');
  const [nombre, setNombre] = useState('');
  const [miembrosEscriben, setMiembrosEscriben] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { getSession().then((s) => setClubId(s?.clubId ?? '')); }, []);
  useFocusEffect(useCallback(() => {
    if (!clubId) return;
    const sondeo = crearSondeo(`listas:canales:${clubId}`, () => cargarCanalesClub(clubId).then(() => false).catch(() => false),
      { minMs: 10000, maxMs: 60000, factor: 1.5 });
    const quitar = alCambiar(({ tipo }) => { if (tipo === 'canales' || tipo === 'canal_inactivo') sondeo.ahora(); });
    sondeo.iniciar();
    return () => { sondeo.detener(); quitar(); };
  }, [clubId]));
  async function crear() {
    if (!clubId || ocupado) return;
    setOcupado(true); setError('');
    try { const id = await crearCanal(clubId, nombre, miembrosEscriben); setNombre(''); setMiembrosEscriben(false); router.push({ pathname: '/(club)/canal/[id]', params: { id, clubId } } as never); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el canal.'); }
    finally { setOcupado(false); }
  }
  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.text} /></TouchableOpacity>
        <View><Text style={styles.title}>Canales del club</Text><Text style={styles.sub}>Anuncios para deportistas postulantes y aceptados</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.card}>
          <Text style={styles.heading}>Crear canal</Text>
          <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre (máximo 60 caracteres)" placeholderTextColor={colors.textMuted} maxLength={60} style={styles.input} />
          <View style={styles.switchRow}><Text style={styles.body}>Los miembros también pueden escribir</Text><Switch value={miembrosEscriben} onValueChange={setMiembrosEscriben} /></View>
          <Text style={styles.sub}>Los postulantes aceptados entran automáticamente al crear el canal.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={crear} disabled={!nombre.trim() || ocupado}><Text style={styles.buttonText}>{ocupado ? 'Creando…' : 'Crear canal'}</Text></TouchableOpacity>
        </View>
        <Text style={styles.heading}>Canales ({canales.club.length})</Text>
        {canales.club.map((c) => (
          <TouchableOpacity key={c.id} style={styles.card} onPress={() => router.push({ pathname: '/(club)/canal/[id]', params: { id: c.id, clubId } } as never)}>
            <View style={styles.row}><Text style={styles.name}>{c.nombre}</Text>{c.noLeidos > 0 ? <Text style={styles.badge}>{c.noLeidos > 9 ? '9+' : c.noLeidos}</Text> : null}</View>
            <Text style={styles.sub}>{c.miembros} miembros · {c.miembrosEscriben ? 'pueden escribir' : 'solo administradores escriben'}</Text>
            {c.avisoInactividadEn ? <Text style={styles.alert}>Este canal lleva 30 días sin uso y se eliminará</Text> : null}
          </TouchableOpacity>
        ))}
        {canales.error ? <Text style={styles.error}>{canales.error}</Text> : null}
      </ScrollView>
    </View>
  );
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg }, topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card },
  title: { color: c.text, fontSize: 18, fontWeight: '700' }, sub: { color: c.textMuted, fontSize: 11, marginTop: 3 }, list: { padding: 18, paddingBottom: 35, gap: 10 },
  card: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
  heading: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 7 }, name: { flex: 1, color: c.text, fontWeight: '700' }, body: { flex: 1, color: c.text, fontSize: 12 },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 11, color: c.text, marginVertical: 8 }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, badge: { color: '#fff', backgroundColor: c.primary, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, fontSize: 10 },
  button: { alignSelf: 'flex-start', backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10, marginTop: 10 }, buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  error: { color: c.danger, fontSize: 12, marginTop: 7 }, alert: { color: c.danger, fontSize: 12, fontWeight: '700', marginTop: 8 },
});
