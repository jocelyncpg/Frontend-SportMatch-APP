import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from './Avatar';

type MatchModalProps = {
  visible: boolean;
  miNombre: string;
  miFoto?: string | null;
  nombre: string;
  colorFrom: string;
  fotoUri?: string | null;
  onEnviarMensaje: () => void;
  onCerrar: () => void;
};

export default function MatchModal({
  visible,
  miNombre,
  miFoto,
  nombre,
  colorFrom,
  fotoUri,
  onEnviarMensaje,
  onCerrar,
}: MatchModalProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const izquierda = useRef(new Animated.Value(-70)).current;
  const derecha = useRef(new Animated.Value(70)).current;
  const corazon = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    fade.setValue(0);
    izquierda.setValue(-70);
    derecha.setValue(70);
    corazon.setValue(0);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // en dispositivos sin vibración no pasa nada
    }

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(izquierda, { toValue: 0, friction: 6, useNativeDriver: true }),
      Animated.spring(derecha, { toValue: 0, friction: 6, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(250),
        Animated.spring(corazon, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  const primerNombre = nombre.split(' ')[0];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onCerrar}>
      <Animated.View style={[styles.overlay, { opacity: fade }]}>
        <Text style={styles.titulo}>
          ¡Es un <Text style={styles.tituloAcento}>match!</Text>
        </Text>
        <Text style={styles.subtitulo}>Tú y {primerNombre} quieren entrenar juntos</Text>

        <View style={styles.fila}>
          <Animated.View style={{ transform: [{ translateX: izquierda }] }}>
            <Avatar name={miNombre} colorFrom="#7C3AED" uri={miFoto} style={styles.avatar} fontSize={34} />
          </Animated.View>
          <Animated.View style={{ transform: [{ translateX: derecha }] }}>
            <Avatar
              name={nombre}
              colorFrom={colorFrom}
              uri={fotoUri}
              style={[styles.avatar, styles.avatarDerecha]}
              fontSize={34}
            />
          </Animated.View>
          <Animated.View style={[styles.corazon, { transform: [{ scale: corazon }] }]}>
            <Ionicons name="heart" size={22} color="#fff" />
          </Animated.View>
        </View>

        <TouchableOpacity style={styles.botonPrimario} onPress={onEnviarMensaje}>
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          <Text style={styles.botonPrimarioTexto}>Enviar mensaje</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.botonSecundario} onPress={onCerrar}>
          <Text style={styles.botonSecundarioTexto}>Seguir descubriendo</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,8,19,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  titulo: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', textAlign: 'center' },
  tituloAcento: { color: '#EC4899' },
  subtitulo: { color: '#C9CEDA', fontSize: 14, marginTop: 8, textAlign: 'center' },
  fila: { flexDirection: 'row', alignItems: 'center', marginVertical: 38 },
  avatar: { width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: '#FFFFFF' },
  avatarDerecha: { marginLeft: -20 },
  corazon: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EC4899',
    borderWidth: 3,
    borderColor: '#050813',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonPrimario: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 15,
  },
  botonPrimarioTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  botonSecundario: {
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  botonSecundarioTexto: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});