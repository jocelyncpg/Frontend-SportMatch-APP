import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GEOAPIFY_API_KEY } from '../services/location';
import { useAppTheme } from '../theme/ThemeContext';

type Props = {
  latitud: number;
  longitud: number;
  // Alto del mapa en px.
  alto?: number;
};

// Mapa de solo lectura: una imagen estática de Geoapify con el punto marcado.
// No usa Google Maps (react-native-maps), así que funciona en el APK sin ninguna key de Google.
export default function MapaEstatico({ latitud, longitud, alto = 220 }: Props) {
  const { colors } = useAppTheme();
  const [error, setError] = useState(false);
  const uri =
    `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=640&height=400&zoom=15` +
    `&center=lonlat:${longitud},${latitud}&marker=lonlat:${longitud},${latitud};color:%23ef4444;size:large&apiKey=${GEOAPIFY_API_KEY}`;

  if (error) {
    return <Text style={[styles.error, { color: colors.textMuted }]}>No se pudo cargar el mapa. Revisa tu conexión.</Text>;
  }
  return (
    <View style={[styles.wrap, { height: alto, backgroundColor: colors.inputBg }]}>
      <Image source={{ uri }} style={styles.mapa} resizeMode="cover" onError={() => setError(true)} accessibilityLabel="Mapa con la ubicación" />
      <Text style={styles.credito}>© Geoapify © OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  mapa: { width: '100%', height: '100%' },
  error: { fontSize: 11.5, paddingHorizontal: 14, paddingBottom: 12 },
  credito: {
    position: 'absolute', bottom: 4, right: 6, fontSize: 9, fontWeight: '400', color: '#374151',
    backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 4, borderRadius: 3,
  },
});