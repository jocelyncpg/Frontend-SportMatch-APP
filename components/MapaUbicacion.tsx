import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { GEOAPIFY_API_KEY } from '../services/location';
import { useAppTheme } from '../theme/ThemeContext';

// Teselas de Geoapify (mismo proveedor y misma API key de la ubicación del perfil).
const TESELAS_URL = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

type Props = {
  latitud: number;
  longitud: number;
  // Texto del marcador.
  titulo?: string;
  // false = solo se ve el mapa centrado ahí, sin marcador (el club aún no marca su punto).
  marcar?: boolean;
  // Si se entrega, tocar el mapa elige ese punto (lo usa el club en "Mi club").
  onElegir?: (latitud: number, longitud: number) => void;
  // Avisa cuando el dedo mueve el mapa, para que la pantalla no haga scroll al mismo tiempo.
  onMoviendo?: (moviendo: boolean) => void;
};

// Versión para teléfono. En web se usa MapaUbicacion.web.tsx, porque react-native-maps no funciona en el navegador.
export default function MapaUbicacion({ latitud, longitud, titulo = 'Ubicación', marcar = true, onElegir, onMoviendo }: Props) {
  const { colors } = useAppTheme();
  const mapa = useRef<MapView>(null);

  // Si cambia el punto (por ejemplo al elegir otro), el mapa se centra ahí sin perder el zoom.
  useEffect(() => {
    mapa.current?.animateCamera({ center: { latitude: latitud, longitude: longitud } }, { duration: 250 });
  }, [latitud, longitud]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.inputBg }]}>
      <MapView
        ref={mapa}
        style={styles.mapa}
        initialRegion={{ latitude: latitud, longitude: longitud, latitudeDelta: marcar ? 0.012 : 0.12, longitudeDelta: marcar ? 0.012 : 0.12 }}
        // Android: se oculta el mapa base de Google para mostrar solo las teselas de Geoapify.
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onPress={onElegir ? (e) => onElegir(Number(e.nativeEvent.coordinate.latitude.toFixed(6)), Number(e.nativeEvent.coordinate.longitude.toFixed(6))) : undefined}
        onPanDrag={() => onMoviendo?.(true)}
        onRegionChangeComplete={() => onMoviendo?.(false)}
      >
        <UrlTile urlTemplate={TESELAS_URL} maximumZ={19} shouldReplaceMapContent />
        {marcar ? <Marker coordinate={{ latitude: latitud, longitude: longitud }} title={titulo} /> : null}
      </MapView>
      <Text style={styles.credito}>© Geoapify © OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 220 },
  mapa: { width: '100%', height: '100%' },
  credito: {
    position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#374151',
    backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 4, borderRadius: 3,
  },
});