import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { GEOAPIFY_API_KEY } from '../services/location';
import { useAppTheme } from '../theme/ThemeContext';

// Teselas de Geoapify (mismo proveedor y misma API key de antes, ahora en un mapa que se mueve y hace zoom).
const TESELAS_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

type Props = {
  latitud: number;
  longitud: number;
  // Avisa cuando el dedo mueve el mapa, para que la pantalla no haga scroll al mismo tiempo.
  onMoviendo?: (moviendo: boolean) => void;
};

// Versión para teléfono. En web se usa MapaUbicacion.web.tsx, porque react-native-maps no funciona en el navegador.
export default function MapaUbicacion({ latitud, longitud, onMoviendo }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.inputBg }]}>
      <MapView
        // Cambia de key al detectar otra ubicación para que el mapa se vuelva a centrar.
        key={`${latitud},${longitud}`}
        style={styles.mapa}
        initialRegion={{ latitude: latitud, longitude: longitud, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        // Android: se oculta el mapa base de Google para mostrar solo las teselas de Geoapify.
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onPanDrag={() => onMoviendo?.(true)}
        onRegionChangeComplete={() => onMoviendo?.(false)}
      >
        <UrlTile urlTemplate={TESELAS_URL} maximumZ={19} shouldReplaceMapContent />
        <Marker coordinate={{ latitude: latitud, longitude: longitud }} title="Tu ubicación" />
      </MapView>
      <Text style={styles.credito}>© Geoapify © OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 200 },
  mapa: { width: '100%', height: '100%' },
  credito: {
    position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#374151',
    backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 4, borderRadius: 3,
  },
});
