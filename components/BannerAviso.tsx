import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { abrirNotificacion, estiloNotificacion } from '../services/notificacionUi';
import { useNotificaciones, type Notificacion } from '../services/notificaciones';
import { Colors, espacio, radio, tipo, useAppTheme } from '../theme/ThemeContext';

/** Milisegundos que se ve el banner antes de esconderse solo. */
const VISIBLE_MS = 4500;
/** Al abrir la app los datos de ejemplo terminan de cargar; en ese rato no se muestra nada. */
const GRACIA_ARRANQUE_MS = 3000;

// Una solicitud nueva llega ya como "leída" en la bandeja, así que también se mira aparte.
const cuenta = (n: Notificacion) => !n.leida || n.tipo === 'solicitud';
// Si cambia el texto (por ejemplo, un segundo mensaje del mismo chat), cuenta como aviso nuevo.
const clave = (n: Notificacion) => `${n.id}|${n.titulo}|${n.detalle}`;

/**
 * Banner que baja desde arriba cuando llega un aviso nuevo (solicitud, match, mensaje, calificación,
 * actividad o club), además de la campanita. Se esconde solo; al tocarlo abre lo que corresponde.
 * Se monta una sola vez, en el layout raíz, y solo se ve dentro de la zona del deportista.
 */
export default function BannerAviso() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const enApp = useSegments()[0] === '(deportista)';
  const { lista } = useNotificaciones();

  const [actual, setActual] = useState<Notificacion | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const vistos = useRef<Set<string> | null>(null);
  const inicio = useRef(0);

  // Detecta avisos nuevos: lo que ya estaba al entrar a la app no cuenta.
  useEffect(() => {
    if (!enApp) {
      vistos.current = null;
      return;
    }
    const candidatas = lista.filter(cuenta);
    if (vistos.current === null) {
      vistos.current = new Set(candidatas.map(clave));
      inicio.current = Date.now();
      return;
    }
    const conocidos = vistos.current;
    const nuevas = candidatas.filter((n) => !conocidos.has(clave(n)));
    nuevas.forEach((n) => conocidos.add(clave(n)));
    if (nuevas.length === 0 || Date.now() - inicio.current < GRACIA_ARRANQUE_MS) return;
    // La lista viene ordenada con lo más reciente primero.
    setActual(nuevas[0]);
  }, [lista, enApp]);

  function cerrar() {
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setActual(null);
      }
    );
  }

  // Entra deslizando; un aviso nuevo reinicia la cuenta.
  useEffect(() => {
    if (!actual) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const t = setTimeout(cerrar, VISIBLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual]);

  if (!enApp || !actual) return null;

  const { icono, color } = estiloNotificacion(actual, colors);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });

  function abrir() {
    if (!actual) return;
    const n = actual;
    setActual(null);
    abrirNotificacion(n);
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.contenedor, { top: insets.top + espacio.s, opacity: anim, transform: [{ translateY }] }]}
    >
      <TouchableOpacity
        style={styles.banner}
        onPress={abrir}
        activeOpacity={0.85}
        accessibilityRole="alert"
        accessibilityLabel={`${actual.titulo}. ${actual.detalle}`}
        accessibilityHint="Toca para abrir"
      >
        <View style={[styles.icono, { backgroundColor: colors.chip }]}>
          <Ionicons name={icono} size={18} color={color} />
        </View>
        <View style={styles.textos}>
          <Text style={styles.titulo} numberOfLines={2}>{actual.titulo}</Text>
          <Text style={styles.detalle} numberOfLines={1}>{actual.detalle}</Text>
        </View>
        <TouchableOpacity onPress={cerrar} style={styles.cerrar} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar aviso">
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    contenedor: { position: 'absolute', left: espacio.l, right: espacio.l, zIndex: 100, elevation: 10 },
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.accent,
      borderRadius: radio.tarjeta, paddingVertical: espacio.m, paddingLeft: espacio.m, paddingRight: espacio.xs,
      shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 10,
    },
    icono: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    textos: { flex: 1 },
    titulo: { color: c.text, ...tipo.cuerpoFuerte },
    detalle: { color: c.textMuted, ...tipo.dato, marginTop: 2 },
    cerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  });