import { ReactNode, useEffect, useState } from 'react';
import { Image, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Avatar from './Avatar';

type Props = {
  nombre: string;
  colorFrom: string;
  // Fotos en orden. Si no hay ninguna se muestran las iniciales, como en el resto de la app.
  fotos: string[];
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
  // Lo que va encima de la foto (nombre, datos). Debe llevar pointerEvents="none" si no necesita recibir toques.
  children?: ReactNode;
};

/**
 * Foto grande con varias imágenes, como en Tinder: tocar la mitad derecha pasa a la siguiente,
 * la izquierda vuelve a la anterior, y arriba unas barritas muestran en cuál va.
 */
export default function GaleriaFotos({ nombre, colorFrom, fotos, style, fontSize = 72, children }: Props) {
  const [indice, setIndice] = useState(0);
  const total = fotos.length;

  // Si se quitan fotos y el índice queda fuera de rango, vuelve a la última que exista.
  useEffect(() => {
    if (indice > 0 && indice >= total) setIndice(Math.max(0, total - 1));
  }, [indice, total]);

  // Se cargan todas de antemano para que el cambio de foto sea instantáneo.
  useEffect(() => {
    fotos.forEach((u) => {
      Image.prefetch(u).catch(() => {});
    });
  }, [fotos]);

  const ir = (delta: number) => setIndice((i) => Math.min(total - 1, Math.max(0, i + delta)));

  return (
    <View style={[styles.contenedor, style]}>
      <Avatar name={nombre} colorFrom={colorFrom} uri={fotos[indice] ?? null} style={StyleSheet.absoluteFill} fontSize={fontSize} />

      {total > 1 ? (
        <View style={styles.zonas}>
          <Pressable style={styles.zona} onPress={() => ir(-1)} accessibilityRole="button" accessibilityLabel="Foto anterior" />
          <Pressable style={styles.zona} onPress={() => ir(1)} accessibilityRole="button" accessibilityLabel="Foto siguiente" />
        </View>
      ) : null}

      {children}

      {total > 1 ? (
        <View style={styles.barras} pointerEvents="none" accessibilityLabel={`Foto ${indice + 1} de ${total}`}>
          {fotos.map((_, i) => (
            <View key={i} style={[styles.barra, i === indice && styles.barraActiva]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { overflow: 'hidden' },
  zonas: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  zona: { flex: 1 },
  barras: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 4 },
  barra: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  barraActiva: { backgroundColor: '#FFFFFF' },
});