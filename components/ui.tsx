import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, ReactNode, useMemo } from 'react';
import { Image, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, espacio, radio, tipo, useAppTheme } from '../theme/ThemeContext';
import BrandLogo from './BrandLogo';

/**
 * Piezas base de la interfaz. Usan solo la escala del tema (tipo, espacio, radio)
 * y los colores de useAppTheme(), así todas las pantallas se ven iguales y
 * cambian solas entre modo claro y oscuro.
 */

// Texto sobre fondos de color fuerte (botón principal, etiquetas). Es el único color fijo.
const SOBRE_COLOR = '#FFFFFF';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- Tarjeta
type TarjetaProps = {
  children: ReactNode;
  /** Borde de color para destacar una tarjeta (por ejemplo, el plan recomendado). */
  resaltada?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Tarjeta({ children, resaltada = false, style }: TarjetaProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  return <View style={[s.tarjeta, resaltada && s.tarjetaResaltada, style]}>{children}</View>;
}

// ---------------------------------------------------------------- Boton
type BotonProps = {
  texto: string;
  onPress: () => void;
  variante?: 'principal' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  icono?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Boton({ texto, onPress, variante = 'principal', deshabilitado = false, icono, style }: BotonProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  const colorTexto =
    variante === 'principal' ? SOBRE_COLOR : variante === 'peligro' ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.boton, s[`boton_${variante}`], deshabilitado && s.botonDeshabilitado, style]}
    >
      {icono ? <Ionicons name={icono} size={18} color={colorTexto} /> : null}
      <Text style={[s.botonTexto, { color: colorTexto }]}>{texto}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------- Chip
type ChipProps = {
  texto: string;
  tono?: 'neutro' | 'acento' | 'exito';
  icono?: IconName;
};

export function Chip({ texto, tono = 'neutro', icono }: ChipProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  const color = tono === 'acento' ? colors.accent : tono === 'exito' ? colors.success : colors.textMuted;
  return (
    <View style={[s.chip, s[`chip_${tono}`]]}>
      {icono ? <Ionicons name={icono} size={12} color={color} /> : null}
      <Text style={[s.chipTexto, { color }]}>{texto}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Aviso
type AvisoProps = {
  texto: string;
  icono?: IconName;
};

export function Aviso({ texto, icono = 'information-circle-outline' }: AvisoProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  return (
    <View style={s.aviso}>
      <Ionicons name={icono} size={18} color={colors.accent} />
      <Text style={s.avisoTexto}>{texto}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- EncabezadoPantalla
type EncabezadoProps = {
  titulo: string;
  subtitulo?: string;
  /** Por defecto vuelve a la pantalla anterior. Pásalo en false en pantallas de primer nivel. */
  conVolver?: boolean;
  onVolver?: () => void;
};

export function EncabezadoPantalla({ titulo, subtitulo, conVolver = true, onVolver }: EncabezadoProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  return (
    <View style={s.encabezado}>
      {conVolver ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={s.volver}
          onPress={onVolver ?? (() => router.back())}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <Text accessibilityRole="header" style={s.encabezadoTitulo}>{titulo}</Text>
      {subtitulo ? <Text style={s.encabezadoSubtitulo}>{subtitulo}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------- EncabezadoMarca
type EncabezadoMarcaProps = {
  /** Lo que va a la derecha del logo: el avatar, la campanita, etc. */
  derecha?: ReactNode;
  /** Línea chica bajo el logo. */
  subtitulo?: string;
  /** Margen a los lados. Pásalo en 0 si la pantalla ya lo pone (por ejemplo, dentro de un ScrollView con padding). */
  margenHorizontal?: number;
};

/**
 * Encabezado de las pestañas principales (Inicio, Descubrir, Matches, Chat, Perfil): el logo siempre en el
 * mismo lugar. Ya suma el borde superior del teléfono, así que la pantalla no debe agregar su propio margen arriba.
 */
export function EncabezadoMarca({ derecha, subtitulo, margenHorizontal = espacio.xl }: EncabezadoMarcaProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.marca, { paddingTop: insets.top + espacio.m, paddingHorizontal: margenHorizontal }]}>
      <View>
        <BrandLogo width={200} />
        {subtitulo ? <Text style={s.marcaSubtitulo}>{subtitulo}</Text> : null}
      </View>
      {derecha ? <View style={s.marcaDerecha}>{derecha}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- AvatarMini
type AvatarMiniProps = {
  /** Foto de perfil; si falta se muestran las iniciales. */
  uri?: string | null;
  iniciales: string;
  onPress: () => void;
};

/** Botón redondo con la foto (o las iniciales) de la persona; lleva a su perfil. */
export function AvatarMini({ uri, iniciales, onPress }: AvatarMiniProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => estilos(colors), [colors]);
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ir a mi perfil" onPress={onPress} style={s.avatarMini}>
      {uri ? <Image source={{ uri }} style={s.avatarMiniImagen} /> : <Text style={s.avatarMiniTexto}>{iniciales}</Text>}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------- estilos
const estilos = (c: Colors) =>
  StyleSheet.create({
    tarjeta: {
      backgroundColor: c.card,
      borderRadius: radio.tarjeta,
      borderWidth: 1,
      borderColor: c.border,
      padding: espacio.l,
    },
    tarjetaResaltada: { borderColor: c.primary, borderWidth: 2 },

    boton: {
      minHeight: 48,
      borderRadius: radio.control,
      paddingHorizontal: espacio.l,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espacio.s,
    },
    boton_principal: { backgroundColor: c.primary },
    boton_secundario: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
    boton_peligro: { backgroundColor: c.dangerBg, borderWidth: 1, borderColor: c.danger },
    botonDeshabilitado: { opacity: 0.45 },
    botonTexto: { ...tipo.cuerpoFuerte, fontSize: 14 },

    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.xs,
      alignSelf: 'flex-start',
      borderRadius: radio.control,
      paddingHorizontal: espacio.s,
      paddingVertical: espacio.xs,
    },
    chip_neutro: { backgroundColor: c.chip },
    chip_acento: { backgroundColor: c.chip },
    chip_exito: { backgroundColor: c.successBg },
    chipTexto: { ...tipo.etiqueta },

    aviso: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: espacio.m,
      backgroundColor: c.chip,
      borderRadius: radio.control,
      padding: espacio.m,
    },
    avisoTexto: { flex: 1, color: c.textMuted, ...tipo.dato, lineHeight: 17 },

    marca: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: espacio.l,
    },
    marcaSubtitulo: { color: c.textMuted, ...tipo.dato, marginTop: espacio.xs, marginLeft: 2 },
    // Alto del logo (≈49 px) para que lo de la derecha quede centrado con él.
    marcaDerecha: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: espacio.s },
    avatarMini: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarMiniImagen: { width: '100%', height: '100%' },
    avatarMiniTexto: { color: c.text, ...tipo.cuerpoFuerte },

    encabezado: { marginBottom: espacio.xl },
    volver: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espacio.l,
    },
    encabezadoTitulo: { color: c.text, ...tipo.titulo },
    encabezadoSubtitulo: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, marginTop: espacio.xs },
  });