import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

type AvatarProps = {
  name: string;
  colorFrom: string;
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
  overlayStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const segunda = partes.length > 1 ? partes[1][0] : '';
  return (partes[0][0] + segunda).toUpperCase();
}

function oscurecer(hex: string, factor = 0.55): string {
  const limpio = hex.replace('#', '');
  const completo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio;
  const n = parseInt(completo, 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Muestra la foto si existe; si no, un degradado con las iniciales.
 * El tamaño y la forma se controlan desde `style` (width, height, borderRadius).
 */
export default function Avatar({ name, colorFrom, uri, style, fontSize = 16, overlayStyle, children }: AvatarProps) {
  return (
    <View style={[styles.base, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <LinearGradient
            colors={[colorFrom, oscurecer(colorFrom)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.iniciales, { fontSize }]}>{iniciales(name)}</Text>
        </>
      )}
      {children ? (
        <View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  iniciales: { color: 'rgba(255,255,255,0.92)', fontWeight: '800', letterSpacing: 1 },
});