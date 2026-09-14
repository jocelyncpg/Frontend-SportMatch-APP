import * as Location from 'expo-location';

export const GEOAPIFY_API_KEY = '9bd562e32cf44b9090f3613e81d6690f';

export type Ubicacion = {
  latitud: number;
  longitud: number;
  comuna?: string;
};

export async function solicitarUbicacion(): Promise<{ ok: boolean; ubicacion?: Ubicacion; motivo?: string }> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    return { ok: false, motivo: 'permiso_denegado' };
  }

  const posicion = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  let comuna: string | undefined;

  try {
    const direcciones = await Location.reverseGeocodeAsync({
      latitude: posicion.coords.latitude,
      longitude: posicion.coords.longitude,
    });
    comuna = direcciones[0]?.city ?? direcciones[0]?.district ?? direcciones[0]?.subregion ?? undefined;
  } catch {
    // Si falla la geocodificación inversa, igual devolvemos las coordenadas.
  }

  return {
    ok: true,
    ubicacion: {
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
      comuna,
    },
  };
}