import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GEOAPIFY_API_KEY } from '../services/location';
import { useAppTheme } from '../theme/ThemeContext';

type Props = {
  latitud: number;
  longitud: number;
  titulo?: string;
  marcar?: boolean;
  onElegir?: (latitud: number, longitud: number) => void;
  onMoviendo?: (moviendo: boolean) => void;
};

// Versión web: react-native-maps no funciona en el navegador, así que se muestra el mapa estático de Geoapify
// (solo lectura: para marcar la ubicación del club hay que usar el teléfono).
export default function MapaUbicacion({ latitud, longitud, marcar = true }: Props) {
  const { colors } = useAppTheme();
  const [error, setError] = useState(false);
  const marcador = marcar ? `&marker=lonlat:${longitud},${latitud};color:%23ff0000;size:large` : '';
  const zoom = marcar ? 15 : 11;
  const uri = `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=400&height=220&center=lonlat:${longitud},${latitud}&zoom=${zoom}${marcador}&apiKey=${GEOAPIFY_API_KEY}`;

  if (error) {
    return <Text style={[styles.error, { color: colors.textMuted }]}>No se pudo cargar el mapa. Revisa tu conexión.</Text>;
  }
  return (
    <View style={[styles.wrap, { backgroundColor: colors.inputBg }]}>
      <Image source={{ uri }} style={styles.mapa} onError={() => setError(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 220 },
  mapa: { width: '100%', height: '100%' },
  error: { fontSize: 11.5, paddingHorizontal: 14, paddingBottom: 12 },
});