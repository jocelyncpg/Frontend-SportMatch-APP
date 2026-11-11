import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Foto a mostrar; null = cerrado. */
  uri: string | null;
  onClose: () => void;
};

const ESCALA_MAXIMA = 5;
const ESCALA_DOBLE_TOQUE = 2.5;

/** Foto a pantalla completa: se agranda con dos dedos o con doble toque, y se mueve arrastrando. */
export default function VisorFoto({ uri, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const escala = useSharedValue(1);
  const escalaBase = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xBase = useSharedValue(0);
  const yBase = useSharedValue(0);

  // Cada foto parte sin zoom.
  useEffect(() => {
    escala.value = 1;
    escalaBase.value = 1;
    x.value = 0;
    y.value = 0;
    xBase.value = 0;
    yBase.value = 0;
  }, [uri, escala, escalaBase, x, y, xBase, yBase]);

  const pellizco = Gesture.Pinch()
    .onUpdate((e) => {
      escala.value = Math.min(ESCALA_MAXIMA, Math.max(1, escalaBase.value * e.scale));
    })
    .onEnd(() => {
      escalaBase.value = escala.value;
      if (escala.value <= 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
        xBase.value = 0;
        yBase.value = 0;
      }
    });

  const arrastre = Gesture.Pan()
    .onUpdate((e) => {
      if (escala.value > 1) {
        x.value = xBase.value + e.translationX;
        y.value = yBase.value + e.translationY;
      }
    })
    .onEnd(() => {
      xBase.value = x.value;
      yBase.value = y.value;
    });

  const dobleToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (escala.value > 1) {
        escala.value = withTiming(1);
        escalaBase.value = 1;
        x.value = withTiming(0);
        y.value = withTiming(0);
        xBase.value = 0;
        yBase.value = 0;
      } else {
        escala.value = withTiming(ESCALA_DOBLE_TOQUE);
        escalaBase.value = ESCALA_DOBLE_TOQUE;
      }
    });

  const gesto = Gesture.Exclusive(dobleToque, Gesture.Simultaneous(pellizco, arrastre));

  const estiloFoto = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: escala.value }],
  }));

  return (
    <Modal visible={uri !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.fondo}>
        {uri ? (
          <GestureDetector gesture={gesto}>
            <Animated.Image source={{ uri }} style={[{ width, height }, estiloFoto]} resizeMode="contain" accessibilityLabel="Foto ampliada" />
          </GestureDetector>
        ) : null}
        <TouchableOpacity
          style={[styles.cerrar, { top: insets.top + 12 }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar foto"
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  cerrar: {
    position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
});