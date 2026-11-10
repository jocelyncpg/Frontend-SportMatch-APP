import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * true mientras el teclado está abierto.
 * Las pantallas con barra de escritura lo usan para quitar el margen inferior del borde del teléfono
 * (la barra de gestos queda tapada por el teclado, así que ese margen solo dejaría un hueco).
 */
export function useTecladoVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const mostrar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const ocultar = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return visible;
}