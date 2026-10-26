import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getSession } from '../../services/auth';
import { listarDeportesClub, type DeporteClub } from '../../services/clubes';
import {
    MAX_DESCRIPCION_CLUB,
    MAX_NOMBRE_CLUB,
    cargarPerfilClub,
    guardarPerfilClub,
    type PerfilClub,
} from '../../services/perfilClub';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

/** HU-31: el club edita la información pública de su entidad. */
export default function MiClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [clubId, setClubId] = useState<string | null>(null);
  const [inicial, setInicial] = useState<PerfilClub | null>(null);
  const [deportes, setDeportes] = useState<DeporteClub[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const sesion = await getSession();
        if (!sesion?.clubId) {
          if (vigente) setError('Tu cuenta todavía no administra un club.');
          return;
        }
        const [perfil, catalogo] = await Promise.all([cargarPerfilClub(sesion.clubId), listarDeportesClub()]);
        if (!vigente) return;
        setClubId(sesion.clubId);
        setInicial(perfil);
        setDeportes(catalogo);
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil del club.');
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // Hasta cargar el club real no se muestra el formulario.
  if (!clubId || !inicial) {
    return (
      <View style={styles.container}>
        {error ? <Text accessibilityRole="alert" style={[styles.error, { margin: 20, marginTop: 60 }]}>{error}</Text> : null}
      </View>
    );
  }
  return <Formulario key={clubId} clubId={clubId} inicial={inicial} deportes={deportes} />;
}

function Formulario({ clubId, inicial, deportes }: { clubId: string; inicial: PerfilClub; deportes: DeporteClub[] }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [f, setF] = useState<PerfilClub>(inicial);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const set = <K extends keyof PerfilClub>(campo: K, valor: PerfilClub[K]) => {
    setF((p) => ({ ...p, [campo]: valor }));
    setGuardado(false);
    setError('');
  };

  function alternarDeporte(d: string) {
    set('deportes', f.deportes.includes(d) ? f.deportes.filter((x) => x !== d) : [...f.deportes, d]);
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    const r = await guardarPerfilClub(clubId, f);
    setGuardando(false);
    if (!r.ok) {
      setError(r.motivo);
      setGuardado(false);
      return;
    }
    setError('');
    setGuardado(true);
  }

  const campo = (etiqueta: string, valor: string, onCambio: (v: string) => void, extra?: Partial<React.ComponentProps<typeof TextInput>>) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          value={valor}
          onChangeText={onCambio}
          {...extra}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.volver} onPress={() => router.back()} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.titulo}>Mi club</Text>
        <Text style={styles.subtitulo}>Actualiza la información pública de tu entidad.</Text>

        <View style={styles.tarjeta}>
          {campo('Nombre del club', f.nombre, (v) => set('nombre', v), { maxLength: MAX_NOMBRE_CLUB })}
          <Text style={styles.etiqueta}>Descripción</Text>
          <View style={[styles.inputBox, { height: 110, alignItems: 'flex-start' }]}>
            <TextInput
              style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
              placeholder="Cuéntales a los deportistas quiénes son y qué ofrecen"
              placeholderTextColor={colors.textMuted}
              value={f.descripcion}
              onChangeText={(v) => set('descripcion', v)}
              multiline
              maxLength={MAX_DESCRIPCION_CLUB}
            />
          </View>
          <Text style={styles.contador}>{f.descripcion.length}/{MAX_DESCRIPCION_CLUB}</Text>
          {campo('Zona o comuna', f.zona, (v) => set('zona', v), { placeholder: 'Ej: Ñuñoa' })}
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.etiqueta}>Deportes ofrecidos</Text>
          <View style={styles.chips}>
            {deportes.map((d) => {
              const activo = f.deportes.includes(d.nombre);
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.chip, activo && styles.chipActivo]}
                  onPress={() => alternarDeporte(d.nombre)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{d.nombre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {f.deportes.length === 0 ? <Text style={styles.aviso}>Selecciona al menos un deporte.</Text> : null}
        </View>

        <View style={styles.tarjeta}>
          {campo('Correo de contacto', f.email, (v) => set('email', v), { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
          {campo('Teléfono', f.telefono, (v) => set('telefono', v), { keyboardType: 'phone-pad', maxLength: 20 })}
          {campo('Instagram', f.instagram, (v) => set('instagram', v), { autoCapitalize: 'none', autoCorrect: false, placeholder: '@tuclub' })}
          {campo('Sitio web', f.web, (v) => set('web', v), { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'url' })}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {guardado ? <Text accessibilityLiveRegion="polite" style={styles.exito}>Cambios guardados</Text> : null}

        <TouchableOpacity style={[styles.guardar, guardando && { opacity: 0.6 }]} onPress={guardar} disabled={guardando} accessibilityRole="button">
          <Text style={styles.guardarTexto}>Guardar cambios</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    volver: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    titulo: { color: c.text, fontSize: 20, fontWeight: '800' },
    subtitulo: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 18 },
    tarjeta: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 14 },
    etiqueta: { color: c.textMuted, fontSize: 11.5, fontWeight: '600', marginBottom: 6 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
    input: { color: c.text, fontSize: 13, flex: 1 },
    contador: { color: c.textMuted, fontSize: 10.5, textAlign: 'right', marginTop: 4, marginBottom: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipTexto: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    chipTextoActivo: { color: '#fff' },
    aviso: { color: c.danger, fontSize: 12, marginTop: 10 },
    error: { color: c.danger, fontSize: 12.5, fontWeight: '600', marginBottom: 10 },
    exito: { color: c.success, fontSize: 13, fontWeight: '700', marginBottom: 10 },
    guardar: { backgroundColor: c.primary, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
    guardarTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });