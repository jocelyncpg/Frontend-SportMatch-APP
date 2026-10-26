import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapaUbicacion from '../../components/MapaUbicacion';
import { Usuario, getSession } from '../../services/auth';
import { DEPORTES_CLUB } from '../../services/consultas';
import { solicitarUbicacion } from '../../services/location';
import {
  MAX_DESCRIPCION_CLUB,
  MAX_DIRECCION_CLUB,
  MAX_NOMBRE_CLUB,
  guardarPerfilClub,
  perfilInicial,
  usePerfilClub,
  type PerfilClub,
} from '../../services/perfilClub';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

// DATOS DE EJEMPLO: igual que el panel del club, el id y el nombre salen de la cuenta; si no hay sesión se usa este.
const NOMBRE_CLUB_DEMO = 'Club de Atletismo';
const CLUB_ID_DEMO = 'club-demo';
// Hacia dónde mira el mapa mientras el club no marca su punto: Santiago centro.
const CENTRO_SANTIAGO = { latitud: -33.4489, longitud: -70.6693 };

/** HU-31: el club edita la información pública de su entidad. */
export default function MiClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sesion, setSesion] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    getSession().then((s) => {
      setSesion(s);
      setListo(true);
    });
  }, []);

  const clubId = sesion?.clubId ?? CLUB_ID_DEMO;
  const guardado = usePerfilClub(clubId);
  const base = guardado ?? perfilInicial(sesion?.clubNombre ?? NOMBRE_CLUB_DEMO, sesion?.email ?? '');

  // Hasta saber con qué cuenta se entró, no se muestra el formulario: así no arranca con el club de ejemplo.
  if (!listo) return <View style={styles.container} />;
  return <Formulario key={clubId} clubId={clubId} inicial={base} />;
}

function Formulario({ clubId, inicial }: { clubId: string; inicial: PerfilClub }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [f, setF] = useState<PerfilClub>(inicial);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);
  // Mientras el dedo mueve el mapa, la pantalla no debe hacer scroll.
  const [scrollActivo, setScrollActivo] = useState(true);
  const [buscandoGps, setBuscandoGps] = useState(false);

  const tienePunto = f.latitud != null && f.longitud != null;

  const set = <K extends keyof PerfilClub>(campo: K, valor: PerfilClub[K]) => {
    setF((p) => ({ ...p, [campo]: valor }));
    setGuardado(false);
    setError('');
  };

  function alternarDeporte(d: string) {
    set('deportes', f.deportes.includes(d) ? f.deportes.filter((x) => x !== d) : [...f.deportes, d]);
  }

  function marcar(latitud: number, longitud: number) {
    setF((p) => ({ ...p, latitud, longitud }));
    setGuardado(false);
    setError('');
  }

  function quitarMarca() {
    setF((p) => ({ ...p, latitud: null, longitud: null }));
    setGuardado(false);
  }

  // Útil si el club está físicamente donde se encuentra: usa el GPS del teléfono.
  async function usarMiUbicacion() {
    setBuscandoGps(true);
    setError('');
    try {
      const r = await solicitarUbicacion();
      if (r.ok && r.ubicacion) marcar(Number(r.ubicacion.latitud.toFixed(6)), Number(r.ubicacion.longitud.toFixed(6)));
      else setError('No se pudo usar el GPS. Permite el acceso a la ubicación o toca el mapa para marcarla.');
    } catch {
      setError('No se pudo obtener tu ubicación. Toca el mapa para marcarla.');
    } finally {
      setBuscandoGps(false);
    }
  }

  function guardar() {
    const r = guardarPerfilClub(clubId, f);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={scrollActivo}>
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
            {DEPORTES_CLUB.map((d) => {
              const activo = f.deportes.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, activo && styles.chipActivo]}
                  onPress={() => alternarDeporte(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {f.deportes.length === 0 ? <Text style={styles.aviso}>Selecciona al menos un deporte.</Text> : null}
        </View>

        <View style={styles.tarjeta}>
          <Text style={styles.tituloTarjeta}>Ubicación</Text>
          <Text style={styles.ayuda}>Así te encuentran los deportistas. Toca el mapa para marcar dónde está tu club.</Text>
          {campo('Dirección', f.direccion, (v) => set('direccion', v), { placeholder: 'Calle y número', maxLength: MAX_DIRECCION_CLUB })}
          <View style={styles.mapaWrap}>
            <MapaUbicacion
              latitud={f.latitud ?? CENTRO_SANTIAGO.latitud}
              longitud={f.longitud ?? CENTRO_SANTIAGO.longitud}
              marcar={tienePunto}
              titulo={f.nombre || 'Mi club'}
              onElegir={marcar}
              onMoviendo={(moviendo) => setScrollActivo(!moviendo)}
            />
          </View>
          <View style={styles.accionesMapa}>
            <TouchableOpacity style={styles.accionBoton} onPress={usarMiUbicacion} disabled={buscandoGps} accessibilityRole="button">
              <Ionicons name="locate-outline" size={16} color={colors.accent} />
              <Text style={styles.accionTexto}>{buscandoGps ? 'Buscando…' : 'Usar mi ubicación actual'}</Text>
            </TouchableOpacity>
            {tienePunto ? (
              <TouchableOpacity onPress={quitarMarca} accessibilityRole="button">
                <Text style={styles.quitar}>Quitar marca</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.coord}>
            {tienePunto ? `Marcado: ${(f.latitud as number).toFixed(5)}, ${(f.longitud as number).toFixed(5)}` : 'Aún no marcas la ubicación del club.'}
          </Text>
        </View>

        <View style={styles.tarjeta}>
          {campo('Correo de contacto', f.email, (v) => set('email', v), { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
          {campo('Teléfono', f.telefono, (v) => set('telefono', v), { keyboardType: 'phone-pad', maxLength: 20 })}
          {campo('Instagram', f.instagram, (v) => set('instagram', v), { autoCapitalize: 'none', autoCorrect: false, placeholder: '@tuclub' })}
          {campo('Sitio web', f.web, (v) => set('web', v), { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'url' })}
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {guardado ? <Text accessibilityLiveRegion="polite" style={styles.exito}>Cambios guardados</Text> : null}

        <TouchableOpacity style={styles.guardar} onPress={guardar} accessibilityRole="button">
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
    tituloTarjeta: { color: c.text, fontSize: 13, fontWeight: '700' },
    ayuda: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: 4, marginBottom: 12 },
    mapaWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
    accionesMapa: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    accionBoton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    accionTexto: { color: c.accent, fontSize: 12.5, fontWeight: '700' },
    quitar: { color: c.danger, fontSize: 12, fontWeight: '700' },
    coord: { color: c.textMuted, fontSize: 11, marginTop: 8 },
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