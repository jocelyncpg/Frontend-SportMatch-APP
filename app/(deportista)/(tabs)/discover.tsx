import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Logo from '../../../components/Logo';
import { Usuario, getSession } from '../../../services/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

const DEPORTISTAS = [
  {
    id: '1',
    name: 'Camila R.',
    age: 24,
    sport: 'Running',
    level: 'Intermedio',
    distance: '1.8 km',
    compatibility: 95,
    colorFrom: '#3648A6',
    colorTo: '#22C55E',
    bio: 'Entrenando para una media maratón. Busco compañera para trotes de fondo los fines de semana.',
  },
  {
    id: '2',
    name: 'Diego A.',
    age: 27,
    sport: 'Fútbol',
    level: 'Intermedio',
    distance: '2.3 km',
    compatibility: 89,
    colorFrom: '#1F2A5C',
    colorTo: '#6366F1',
    bio: 'Juego 2 veces por semana, busco gente para armar equipo fijo.',
  },
  {
    id: '3',
    name: 'Valentina S.',
    age: 22,
    sport: 'Ciclismo',
    level: 'Intermedio',
    distance: '2.7 km',
    compatibility: 87,
    colorFrom: '#22C55E',
    colorTo: '#BBF7D0',
    bio: 'Salidas los sábados en la mañana, ritmo tranquilo pero constante.',
  },
  {
    id: '4',
    name: 'Andrés M.',
    age: 25,
    sport: 'Running',
    level: 'Principiante',
    distance: '3.1 km',
    compatibility: 83,
    colorFrom: '#7C3AED',
    colorTo: '#C4B5FD',
    bio: 'Recién empezando a correr, busco compañía para agarrar el hábito.',
  },
  {
    id: '5',
    name: 'Matías P.',
    age: 29,
    sport: 'Fútbol',
    level: 'Avanzado',
    distance: '3.2 km',
    compatibility: 78,
    colorFrom: '#1F2A5C',
    colorTo: '#6366F1',
    bio: 'Nivel competitivo, juego en liga amateur los domingos.',
  },
];

export default function DiscoverScreen() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),

      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe('right');
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  function forceSwipe(direction: 'left' | 'right') {
    Animated.timing(pan, {
      toValue: {
        x:
          direction === 'right'
            ? SCREEN_WIDTH + 100
            : -SCREEN_WIDTH - 100,
        y: 0,
      },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      setIndex((prev) => prev + 1);
    });
  }

  function resetPosition() {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  }

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [20, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = pan.x.interpolate({
    inputRange: [-120, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';

  const personaActual = DEPORTISTAS[index];
  const siguientePersona = DEPORTISTAS[index + 1];

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.topbar}>


      <View>
        <View style={styles.logoWrap}>
          <Logo width={270} />
        </View>

        <Text style={styles.subtitle}>
          {usuario?.comuna
            ? `Cerca de ${usuario.comuna}`
            : 'Desliza para conectar'}
        </Text>
     </View>




        <TouchableOpacity
          onPress={() =>
            router.push('/(deportista)/(tabs)/profile')
          }
          style={styles.miniAvatar}
        >
          {usuario?.fotoPerfil ? (
            <Image
              source={{ uri: usuario.fotoPerfil }}
              style={styles.miniAvatarImage}
            />
          ) : (
            <Text style={styles.miniAvatarText}>
              {iniciales}
            </Text>
          )}
        </TouchableOpacity>

      </View>

      {/* DECK */}
      <View style={styles.deck}>

        {!personaActual && (
          <View style={styles.emptyState}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={48}
              color="#8A93A6"
            />

            <Text style={styles.emptyText}>
              Ya viste a todos los deportistas cerca de ti por ahora.
            </Text>
          </View>
        )}

        {siguientePersona && (
          <View
            style={[
              styles.card,
              styles.cardBehind,
            ]}
          >
            <View
              style={[
                styles.photo,
                {
                  backgroundColor:
                    siguientePersona.colorFrom,
                },
              ]}
            />
          </View>
        )}

        {personaActual && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                transform: [
                  ...pan.getTranslateTransform(),
                  { rotate },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.photo,
                {
                  backgroundColor:
                    personaActual.colorFrom,
                },
              ]}
            >

              <Animated.View
                style={[
                  styles.stamp,
                  styles.likeStamp,
                  { opacity: likeOpacity },
                ]}
              >
                <Text style={styles.likeStampText}>
                  MATCH
                </Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.stamp,
                  styles.nopeStamp,
                  { opacity: nopeOpacity },
                ]}
              >
                <Text style={styles.nopeStampText}>
                  PASO
                </Text>
              </Animated.View>

              <View style={styles.compatBadge}>
                <Text style={styles.compatText}>
                  {personaActual.compatibility}%
                </Text>
              </View>

            </View>

            <View style={styles.cardBody}>

              <View style={styles.nameRow}>
                <Text style={styles.name}>
                  {personaActual.name}, {personaActual.age}
                </Text>

                <Text style={styles.distance}>
                  {personaActual.distance}
                </Text>
              </View>

              <View style={styles.tagsRow}>
                <Text style={styles.tag}>
                  {personaActual.sport}
                </Text>

                <Text style={styles.tag}>
                  {personaActual.level}
                </Text>
              </View>

              <Text
                style={styles.bio}
                numberOfLines={2}
              >
                {personaActual.bio}
              </Text>

            </View>
          </Animated.View>
        )}

      </View>

      {/* ACTIONS */}
      {personaActual && (
        <View style={styles.actions}>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => forceSwipe('left')}
          >
            <Ionicons
              name="close"
              size={26}
              color="#8A93A6"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => forceSwipe('right')}
          >
            <Ionicons
              name="heart"
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

        </View>
      )}

    </View>
  );
}

const CARD_HEIGHT = 420;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    paddingTop: 60,
  },

  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  logoWrap: {
    marginLeft: -38,
    marginTop: -25,
  },

  subtitle: {
    color: '#8A93A6',
    fontSize: 11,
    marginTop: 2,
  },

  miniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  miniAvatarImage: {
    width: '100%',
    height: '100%',
  },

  miniAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  deck: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },

  emptyText: {
    color: '#8A93A6',
    fontSize: 13,
    textAlign: 'center',
  },

  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: CARD_HEIGHT,
    backgroundColor: '#161C2A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#262E40',
    overflow: 'hidden',
  },

  cardBehind: {
    top: 12,
    transform: [{ scale: 0.96 }],
    opacity: 0.6,
  },

  photo: {
    height: CARD_HEIGHT * 0.62,
    position: 'relative',
  },

  compatBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(11,15,25,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  compatText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '800',
  },

  stamp: {
    position: 'absolute',
    top: 24,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  likeStamp: {
    left: 20,
    borderColor: '#4ADE80',
    transform: [{ rotate: '-15deg' }],
  },

  likeStampText: {
    color: '#4ADE80',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 1,
  },

  nopeStamp: {
    right: 20,
    borderColor: '#F87171',
    transform: [{ rotate: '15deg' }],
  },

  nopeStampText: {
    color: '#F87171',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 1,
  },

  cardBody: {
    padding: 16,
  },

  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },

  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  distance: {
    color: '#8A93A6',
    fontSize: 11,
  },

  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },

  tag: {
    color: '#9061F9',
    backgroundColor: '#1E2536',
    fontSize: 10.5,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },

  bio: {
    color: '#8A93A6',
    fontSize: 11.5,
    lineHeight: 16,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 24,
  },

  rejectButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    alignItems: 'center',
    justifyContent: 'center',
  },

  acceptButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DB2777',
    alignItems: 'center',
    justifyContent: 'center',
  },
});