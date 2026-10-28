import { MaterialCommunityIcons } from '@expo/vector-icons';
import { visualDeporte } from '../services/actividades';

type Props = {
  deporte: string;
  size?: number;
};

/** Ícono de línea del deporte, con el color propio del deporte (se usa sobre un fondo oscuro). */
export default function IconoDeporte({ deporte, size = 20 }: Props) {
  const { icon, color } = visualDeporte(deporte);
  return <MaterialCommunityIcons name={icon} size={size} color={color} />;
}