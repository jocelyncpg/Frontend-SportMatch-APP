import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { cerrarDialogo, useDialogo, type BotonDialogo, type TonoDialogo } from '../services/dialogo';
import { Colors, espacio, radio, tipo, useAppTheme } from '../theme/ThemeContext';
import { Boton } from './ui';

const ICONOS: Record<TonoDialogo, keyof typeof Ionicons.glyphMap> = {
  exito: 'checkmark-circle',
  error: 'alert-circle',
  aviso: 'warning',
  info: 'information-circle',
};

/** Muestra los diálogos de services/dialogo.ts con la visual de la app. Va una sola vez, en el layout raíz. */
export default function DialogoHost() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const d = useDialogo();
  if (!d) return null;

  const color = d.tono === 'exito' ? colors.success : d.tono === 'error' ? colors.danger : colors.accent;
  const fondo = d.tono === 'exito' ? colors.successBg : d.tono === 'error' ? colors.dangerBg : colors.chip;

  // Si hay un botón "cancel" no cuenta como acción principal; con un solo botón se muestra a ancho completo.
  const cancelar = d.botones.find((b) => b.style === 'cancel');
  const acciones = d.botones.filter((b) => b !== cancelar);
  // Con 2 o más opciones es un menú (adjuntar, ubicación, opciones del chat): ninguna se destaca sobre las otras.
  const esMenu = acciones.length >= 2;

  function pulsar(b: BotonDialogo) {
    cerrarDialogo();
    b.onPress?.();
  }

  // Android: el botón atrás cierra el diálogo y ejecuta "cancel" si existe.
  function alVolver() {
    cerrarDialogo();
    cancelar?.onPress?.();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={alVolver} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.caja} accessibilityViewIsModal>
          <View style={[styles.icono, { backgroundColor: fondo }]}>
            <Ionicons name={ICONOS[d.tono]} size={28} color={color} />
          </View>
          <Text accessibilityRole="header" style={styles.titulo}>{d.titulo}</Text>
          {d.mensaje ? <Text style={styles.mensaje}>{d.mensaje}</Text> : null}
          <View style={styles.acciones}>
            {acciones.map((b) => (
              <Boton
                key={b.text}
                texto={b.text}
                variante={b.style === 'destructive' ? 'peligro' : esMenu ? 'secundario' : 'principal'}
                onPress={() => pulsar(b)}
              />
            ))}
            {cancelar && esMenu ? (
              <TouchableOpacity style={styles.cancelarMenu} onPress={() => pulsar(cancelar)} accessibilityRole="button">
                <Text style={styles.cancelarMenuTexto}>{cancelar.text}</Text>
              </TouchableOpacity>
            ) : cancelar ? (
              <Boton texto={cancelar.text} variante="secundario" onPress={() => pulsar(cancelar)} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: espacio.xxl },
    caja: {
      backgroundColor: c.card, borderRadius: radio.tarjeta + 2, borderWidth: 1, borderColor: c.border,
      padding: espacio.xl, alignItems: 'center',
    },
    icono: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: espacio.m },
    titulo: { color: c.text, ...tipo.titulo, textAlign: 'center' },
    mensaje: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, textAlign: 'center', marginTop: espacio.s },
    cancelarMenu: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    cancelarMenuTexto: { color: c.textMuted, ...tipo.cuerpoFuerte },
    acciones: { alignSelf: 'stretch', gap: espacio.s, marginTop: espacio.xl },
  });