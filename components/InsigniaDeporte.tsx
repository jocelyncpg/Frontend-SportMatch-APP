import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { visualDeporte } from '../services/actividades';
import { useAppTheme } from '../theme/ThemeContext';

type Props = {
  deporte: string;
  /** Lado del cuadro en píxeles. */
  tamano?: number;
};

/** Cuadro suave con el ícono de línea del deporte; usa los colores del tema, así funciona en claro y oscuro. */
export default function InsigniaDeporte({ deporte, tamano = 40 }: Props) {
  const { colors } = useAppTheme();
  const { icon } = visualDeporte(deporte);
  const caja = useMemo(
    () => [styles.caja, { width: tamano, height: tamano, borderRadius: Math.round(tamano * 0.28), backgroundColor: colors.chip }],
    [tamano, colors.chip],
  );
  return (
    <View style={caja}>
      <MaterialCommunityIcons name={icon} size={Math.round(tamano * 0.52)} color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { alignItems: 'center', justifyContent: 'center' },
});