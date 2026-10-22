import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';

export type TipoCuenta = 'deportista' | 'club';

type Props = {
  /** Tipo de cuenta que se está registrando en esta pantalla. */
  activo: TipoCuenta;
  /** Se llama al tocar una opción distinta de la activa. */
  onElegir: (tipo: TipoCuenta) => void;
};

/** Selector "Soy deportista / Soy club" de las pantallas de registro. */
export default function SelectorTipoCuenta({ activo, onElegir }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const opciones: { tipo: TipoCuenta; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { tipo: 'deportista', label: 'Soy deportista', icon: 'person-outline' },
    { tipo: 'club', label: 'Soy club', icon: 'shield-outline' },
  ];

  return (
    <View style={styles.selector}>
      {opciones.map((op) => {
        const esActiva = activo === op.tipo;
        return (
          <TouchableOpacity
            key={op.tipo}
            style={[styles.opcion, esActiva && styles.opcionActiva]}
            onPress={() => {
              if (!esActiva) onElegir(op.tipo);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: esActiva }}
          >
            <Ionicons name={op.icon} size={15} color={esActiva ? '#fff' : colors.textMuted} />
            <Text style={[styles.texto, esActiva && styles.textoActivo]}>{op.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    selector: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      padding: 4,
      marginBottom: 18,
    },
    opcion: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    opcionActiva: { backgroundColor: c.primary },
    texto: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    textoActivo: { color: '#fff' },
  });