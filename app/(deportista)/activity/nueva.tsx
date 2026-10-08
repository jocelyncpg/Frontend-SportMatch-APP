import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    DEPORTES_ACTIVIDAD,
    DatosActividad,
    HORARIOS,
    NOMBRES_NIVEL,
    combinarFecha,
    comunasDisponibles,
    crearActividad,
    editarActividad,
    formatearDia,
    formatearHora,
    inicioDelDia,
    minutosDelDia,
    opcionesDias,
    useActividades,
    visualDeporte,
} from '../../../services/actividades';
import { Usuario, getSession } from '../../../services/auth';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

/** Sirve para crear una actividad (HU-23) y, si recibe un id, para editar una tuya (HU-28). */
export default function NuevaActividadScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const actividades = useActividades();
  const existente = id ? actividades.find((x) => x.id === id) : undefined;
  const editando = existente !== undefined;
  const ahora = Date.now();

  const dias = useMemo(() => {
    const lista = opcionesDias(ahora);
    return existente && !lista.includes(inicioDelDia(existente.fecha)) ? [inicioDelDia(existente.fecha), ...lista] : lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente?.fecha]);

  const [titulo, setTitulo] = useState(existente?.titulo ?? '');
  const [deporte, setDeporte] = useState(existente?.deporte ?? '');
  const [nivel, setNivel] = useState<number | null>(existente?.nivelMinimo ?? null);
  const [dia, setDia] = useState<number>(existente ? inicioDelDia(existente.fecha) : dias[1]);
  const [minutos, setMinutos] = useState<number>(existente ? minutosDelDia(existente.fecha) : 19 * 60);
  const [lugar, setLugar] = useState(existente?.lugar ?? '');
  const [comuna, setComuna] = useState(existente?.comuna ?? '');
  const [cupos, setCupos] = useState(existente ? String(existente.cupos) : '10');
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? '');
  const [requisitos, setRequisitos] = useState(existente?.requisitos ?? '');
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  const sugeridas = [...new Set([usuario?.comuna, ...comunasDisponibles(actividades, ahora)].filter((c): c is string => !!c))];

  function guardar() {
    const datos: DatosActividad = {
      titulo, deporte, nivelMinimo: nivel, fecha: combinarFecha(dia, minutos), lugar, comuna,
      cupos: Number(cupos), descripcion, requisitos,
    };
    if (editando && existente) {
      const r = editarActividad(existente.id, datos);
      if (!r.ok) return Alert.alert('No se pudo guardar', r.motivo);
      router.back();
      return;
    }
    const r = crearActividad(datos);
    if (!r.ok) return Alert.alert('No se pudo publicar', r.motivo);
    router.replace({ pathname: '/(deportista)/activity/[id]', params: { id: r.id } });
  }

  const chip = (key: string, label: string, activo: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} style={[styles.chip, activo && styles.chipActivo]} onPress={onPress}>
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </TouchableOpacity>
  );

  if (id && !existente) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.vacio}>No encontramos esta actividad.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{editando ? 'Editar actividad' : 'Crear actividad'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Título</Text>
        <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Ej: Trote suave en el parque" placeholderTextColor={colors.textMuted} maxLength={60} />

        <Text style={styles.label}>Deporte</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
          {DEPORTES_ACTIVIDAD.map((d) => chip(`dep-${d}`, `${visualDeporte(d).icon} ${d}`, deporte === d, () => setDeporte(d)))}
        </ScrollView>

        <Text style={styles.label}>Nivel mínimo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
          {chip('niv-0', 'Sin requisito', nivel === null, () => setNivel(null))}
          {[1, 2, 3, 4, 5].map((n) => chip(`niv-${n}`, NOMBRES_NIVEL[n], nivel === n, () => setNivel(n)))}
        </ScrollView>

        <Text style={styles.label}>Día</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
          {dias.map((d) => chip(`dia-${d}`, formatearDia(d, ahora), dia === d, () => setDia(d)))}
        </ScrollView>

        <Text style={styles.label}>Hora</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
          {HORARIOS.map((m) => chip(`hora-${m}`, formatearHora(m), minutos === m, () => setMinutos(m)))}
        </ScrollView>

        <Text style={styles.label}>Lugar</Text>
        <TextInput style={styles.input} value={lugar} onChangeText={setLugar} placeholder="Ej: Parque Bicentenario" placeholderTextColor={colors.textMuted} maxLength={80} />

        <Text style={styles.label}>Comuna</Text>
        <TextInput style={styles.input} value={comuna} onChangeText={setComuna} placeholder="Ej: Vitacura" placeholderTextColor={colors.textMuted} maxLength={40} />
        {sugeridas.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsFila, { marginTop: 8 }]}>
            {sugeridas.map((c) => chip(`com-${c}`, c, comuna === c, () => setComuna(c)))}
          </ScrollView>
        ) : null}

        <Text style={styles.label}>Cupos</Text>
        <TextInput style={[styles.input, styles.inputCorto]} value={cupos} onChangeText={(t) => setCupos(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={2} placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput style={[styles.input, styles.inputLargo]} value={descripcion} onChangeText={setDescripcion} multiline maxLength={300} placeholder="Ritmo, qué llevar, cómo llegar..." placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Requisitos para postular (opcional)</Text>
        <TextInput style={styles.input} value={requisitos} onChangeText={setRequisitos} maxLength={120} placeholder="Ej: Casco obligatorio" placeholderTextColor={colors.textMuted} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.guardar} onPress={guardar}>
          <Text style={styles.guardarTexto}>{editando ? 'Guardar cambios' : 'Publicar actividad'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    vacio: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 60 },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
    backButton: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 17, fontWeight: '700' },
    content: { paddingHorizontal: 20, paddingBottom: 24 },
    label: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 16, marginBottom: 6 },
    input: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 11, color: c.text, fontSize: 13,
    },
    inputCorto: { width: 90 },
    inputLargo: { height: 90, textAlignVertical: 'top' },
    chipsFila: { gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7 },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipTexto: { color: c.textMuted, fontSize: 11.5, fontWeight: '600' },
    chipTextoActivo: { color: '#fff' },
    footer: { paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1, borderColor: c.border },
    guardar: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    guardarTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });