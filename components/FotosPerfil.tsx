import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { MAX_FOTOS, Usuario, fotosDe, updateFotos } from '../services/auth';
import { Colors, useAppTheme } from '../theme/ThemeContext';
import GaleriaFotos from './GaleriaFotos';

type Props = {
  usuario: Usuario | null;
  // Texto bajo el nombre en la vista previa (por ejemplo "Fútbol · Intermedio").
  subtitulo?: string;
  // Se llama con la lista ya guardada, para que la pantalla actualice su estado.
  onCambio: (fotos: string[]) => void;
};

type Pestana = 'fotos' | 'vista';

const SOMBRA = ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'] as const;
const SOMBRA_ABAJO = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const;

/**
 * Fotos del perfil. Cerrado muestra un carrusel con una foto a la vez (se desliza hacia los lados).
 * "Editar" despliega, en la misma pantalla, las pestañas Fotos (agregar, quitar, elegir la principal)
 * y Vista previa (cómo ven la tarjeta los demás). La primera foto es siempre la principal.
 */
export default function FotosPerfil({ usuario, subtitulo, onCambio }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: anchoPantalla, height: altoPantalla } = useWindowDimensions();

  const fotos = fotosDe(usuario);
  const nombre = usuario?.nombre ?? '';
  const [editando, setEditando] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('fotos');
  const [guardando, setGuardando] = useState(false);
  const [indice, setIndice] = useState(0);
  // Ancho real del carrusel (se mide al dibujarlo); mientras tanto una estimación.
  const [ancho, setAncho] = useState(Math.max(200, anchoPantalla - 40));

  const indiceVisible = Math.min(indice, Math.max(0, fotos.length - 1));

  async function guardar(nuevas: string[]) {
    if (!usuario || guardando) return;
    setGuardando(true);
    try {
      const guardadas = await updateFotos(usuario.id, nuevas);
      onCambio(guardadas);
      // El carrusel se vuelve a dibujar desde la primera foto.
      setIndice(0);
    } catch {
      Alert.alert('No se pudieron guardar las fotos', 'Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a tus fotos para poder elegirlas.');
      return;
    }
    const restantes = MAX_FOTOS - fotos.length;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: restantes > 1,
      selectionLimit: restantes,
      allowsEditing: restantes === 1,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (res.canceled) return;
    await guardar([...fotos, ...res.assets.map((a) => a.uri)].slice(0, MAX_FOTOS));
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a la cámara para tomar una foto.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.8 });
    if (res.canceled) return;
    await guardar([...fotos, res.assets[0].uri].slice(0, MAX_FOTOS));
  }

  function agregar() {
    if (fotos.length >= MAX_FOTOS) return;
    Alert.alert('Agregar foto', undefined, [
      { text: 'Tomar foto', onPress: tomarFoto },
      { text: 'Elegir de la galería', onPress: elegirDeGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function opciones(i: number) {
    const botones = [
      ...(i > 0 ? [{ text: 'Hacer principal', onPress: () => guardar([fotos[i], ...fotos.filter((_, j) => j !== i)]) }] : []),
      { text: 'Quitar', style: 'destructive' as const, onPress: () => guardar(fotos.filter((_, j) => j !== i)) },
      { text: 'Cancelar', style: 'cancel' as const },
    ];
    Alert.alert(i === 0 ? 'Foto principal' : `Foto ${i + 1}`, undefined, botones);
  }

  function alDeslizar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndice(Math.round(e.nativeEvent.contentOffset.x / ancho));
  }

  function abrirEditor() {
    setPestana('fotos');
    setEditando(true);
  }

  const ranuras = Array.from({ length: MAX_FOTOS }, (_, i) => fotos[i] ?? null);
  const filas = [ranuras.slice(0, 3), ranuras.slice(3)];
  // La tarjeta de la vista previa no debe pasar de la pantalla.
  const anchoTarjeta = Math.min(360, anchoPantalla - 48);
  const altoTarjeta = Math.min(anchoTarjeta / 0.72, altoPantalla * 0.6);

  return (
    <View style={styles.seccion}>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Mis fotos · {fotos.length}/{MAX_FOTOS}</Text>
        <TouchableOpacity
          onPress={() => (editando ? setEditando(false) : abrirEditor())}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={editando ? 'Cerrar el editor de fotos' : 'Editar fotos'}
        >
          <Text style={styles.enlace}>{editando ? 'Listo' : 'Editar'}</Text>
        </TouchableOpacity>
      </View>

      {!editando ? (
        fotos.length === 0 ? (
          <TouchableOpacity style={styles.vacio} onPress={abrirEditor} accessibilityRole="button" accessibilityLabel="Agregar fotos">
            <Ionicons name="add" size={28} color={colors.accent} />
            <Text style={styles.vacioTexto}>Agrega tus fotos</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.carrusel} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
            <FlatList
              key={fotos.join('|')}
              data={fotos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `${i}-${uri}`}
              onMomentumScrollEnd={alDeslizar}
              getItemLayout={(_, i) => ({ length: ancho, offset: ancho * i, index: i })}
              renderItem={({ item }) => <Image source={{ uri: item }} style={{ width: ancho, height: ancho * 1.1 }} resizeMode="cover" />}
            />
            <LinearGradient colors={SOMBRA} style={styles.sombraArriba} pointerEvents="none" />
            {fotos.length > 1 ? (
              <View style={styles.barras} pointerEvents="none" accessibilityLabel={`Foto ${indiceVisible + 1} de ${fotos.length}`}>
                {fotos.map((_, i) => (
                  <View key={i} style={[styles.barra, i === indiceVisible && styles.barraActiva]} />
                ))}
              </View>
            ) : null}
            {indiceVisible === 0 ? (
              <View style={styles.etiquetaPrincipal} pointerEvents="none">
                <Text style={styles.etiquetaTexto}>Principal</Text>
              </View>
            ) : null}
          </View>
        )
      ) : (
        <View>
          <View style={styles.pestanas}>
            {([['fotos', 'Fotos'], ['vista', 'Cómo me ven']] as const).map(([clave, texto]) => (
              <TouchableOpacity
                key={clave}
                style={[styles.pestana, pestana === clave && styles.pestanaActiva]}
                onPress={() => setPestana(clave)}
                accessibilityRole="tab"
                accessibilityState={{ selected: pestana === clave }}
              >
                <Text style={[styles.pestanaTexto, pestana === clave && styles.pestanaTextoActivo]}>{texto}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {pestana === 'fotos' ? (
            <View>
              {filas.map((fila, f) => (
                <View key={f} style={styles.fila}>
                  {fila.map((uri, k) => {
                    const i = f * 3 + k;
                    return uri ? (
                      <TouchableOpacity
                        key={i}
                        style={styles.ranura}
                        onPress={() => opciones(i)}
                        disabled={guardando}
                        accessibilityRole="button"
                        accessibilityLabel={i === 0 ? 'Foto principal, ver opciones' : `Foto ${i + 1}, ver opciones`}
                      >
                        <Image source={{ uri }} style={styles.imagen} resizeMode="cover" />
                        {i === 0 ? (
                          <View style={styles.etiquetaPrincipal}>
                            <Text style={styles.etiquetaTexto}>Principal</Text>
                          </View>
                        ) : null}
                        <View style={styles.puntos}>
                          <Ionicons name="ellipsis-horizontal" size={14} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={i}
                        style={[styles.ranura, styles.ranuraVacia]}
                        onPress={agregar}
                        disabled={guardando}
                        accessibilityRole="button"
                        accessibilityLabel="Agregar foto"
                      >
                        <Ionicons name="add" size={26} color={colors.accent} />
                      </TouchableOpacity>
                    );
                  })}
                  {fila.length < 3 ? Array.from({ length: 3 - fila.length }, (_, n) => <View key={`v${n}`} style={styles.relleno} />) : null}
                </View>
              ))}
              <Text style={styles.ayuda}>Toca una foto para hacerla principal o quitarla. La principal es la que ven primero los demás.</Text>
            </View>
          ) : (
            <View style={styles.vistaCaja}>
              <GaleriaFotos
                nombre={nombre}
                colorFrom={colors.primary}
                fotos={fotos}
                style={{ width: anchoTarjeta, height: altoTarjeta, borderRadius: 18 }}
              >
                <LinearGradient colors={SOMBRA} style={styles.sombraArriba} pointerEvents="none" />
                <LinearGradient colors={SOMBRA_ABAJO} style={styles.sombraAbajo} pointerEvents="none" />
                <View style={styles.datos} pointerEvents="none">
                  <Text style={styles.datosNombre} numberOfLines={1}>{nombre}</Text>
                  {subtitulo ? <Text style={styles.datosSubtitulo} numberOfLines={1}>{subtitulo}</Text> : null}
                </View>
              </GaleriaFotos>
              <Text style={styles.ayuda}>Así ve tu tarjeta quien te encuentra en Descubrir. Toca a los lados para cambiar de foto.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    seccion: { width: '100%', marginBottom: 18 },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    titulo: { color: c.text, fontSize: 13, fontWeight: '700' },
    enlace: { color: c.accent, fontSize: 12, fontWeight: '700' },

    carrusel: { width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: c.card },
    vacio: {
      height: 150, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: c.card,
    },
    vacioTexto: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    sombraArriba: { position: 'absolute', top: 0, left: 0, right: 0, height: 70 },
    sombraAbajo: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
    barras: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 4 },
    barra: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
    barraActiva: { backgroundColor: '#FFFFFF' },

    pestanas: { flexDirection: 'row', backgroundColor: c.chip, borderRadius: 10, padding: 3, marginBottom: 12 },
    pestana: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    pestanaActiva: { backgroundColor: c.card },
    pestanaTexto: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    pestanaTextoActivo: { color: c.text, fontWeight: '700' },

    fila: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    ranura: { flex: 1, aspectRatio: 0.75, borderRadius: 12, overflow: 'hidden', backgroundColor: c.card },
    relleno: { flex: 1 },
    ranuraVacia: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    imagen: { ...StyleSheet.absoluteFillObject },
    puntos: {
      position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
    },
    etiquetaPrincipal: {
      position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    etiquetaTexto: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
    ayuda: { color: c.textMuted, fontSize: 11.5, fontWeight: '500', lineHeight: 16, marginTop: 4, textAlign: 'center' },

    vistaCaja: { alignItems: 'center', gap: 10 },
    datos: { position: 'absolute', left: 16, right: 16, bottom: 16 },
    datosNombre: { color: '#fff', fontSize: 22, fontWeight: '700' },
    datosSubtitulo: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  });