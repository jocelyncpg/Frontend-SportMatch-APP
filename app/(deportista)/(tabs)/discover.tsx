import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Avatar from '../../../components/Avatar';
import BrandLogo from '../../../components/BrandLogo';
import MatchModal from '../../../components/MatchModal';
import { Usuario, getSession } from '../../../services/auth';
import {
  Persona,
  cargarSugerencias,
  darLike,
  descartar,
  reiniciarDemo,
  setRadio,
  sugerencias,
  useMatches,
} from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
const CARD_HEIGHT = 420;

const RADIOS: { label: string; km: number | null }[] = [
  { label: 'Todas', km: null },
  { label: '2 km', km: 2 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
];

export default function DiscoverScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const estado = useMatches();
  const deck = useMemo(() => sugerencias(estado), [estado]);
  const personaActual = deck[0];
  const siguientePersona = deck[1];

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const animando = useRef(false);
  // El PanResponder se crea una sola vez, así que lee la persona actual desde una ref.
  const actualRef = useRef<Persona | undefined>(undefined);
  actualRef.current = personaActual;

  // Cada vez que se abre la pestaña se traen los deportistas actualizados.
  useFocusEffect(
    useCallback(() => {
      getSession().then(setUsuario);
      void cargarSugerencias();
    }, [])
  );

  // El aviso "Solicitud enviada" desaparece solo.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 1800);
    return () => clearTimeout(t);
  }, [aviso]);

  // Cuando cambia la tarjeta, se centra la nueva antes de pintar (evita el parpadeo).
  useLayoutEffect(() => {
    pan.setValue({ x: 0, y: 0 });
  }, [personaActual?.id]);

  const panResponder = useRef(
    PanResponder.create({
      // Clave para que un botón dentro de la tarjeta reciba el toque: el responder
      // solo se reclama cuando hay un arrastre de verdad (>5px), no con un simple tap.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !animando.current && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5),

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
    const persona = actualRef.current;
    if (!persona || animando.current) return;
    animando.current = true;

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
      animando.current = false;

      if (direction === 'right') {
        const resultado = darLike(persona);
        if (resultado === 'match') {
          setNuevoMatch(persona);
        } else {
          setAviso(`Solicitud enviada a ${persona.name.split(' ')[0]}`);
        }
      } else {
        descartar(persona.id);
      }
    });
  }

  function resetPosition() {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  }

  function enviarMensajeDesdeMatch() {
    const persona = nuevoMatch;
    setNuevoMatch(null);
    if (persona) {
      router.push({
        pathname: '/(deportista)/chat/[id]',
        params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
      });
    }
  }

  function verPerfil(persona: Persona) {
    router.push({
      pathname: '/(deportista)/perfil/[id]',
      params: {
        id: persona.id,
        name: persona.name,
        sport: persona.sport,
        level: persona.level,
        age: persona.age?.toString() ?? '',
        compatibility: persona.compatibility.toString(),
        distance: persona.distance ?? '',
        bio: persona.bio ?? '',
        colorFrom: persona.colorFrom,
        fotoUri: persona.fotoUri ?? '',
      },
    });
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
  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>

      {/* HEADER */}
      <View style={styles.topbar}>
        <View>
          <BrandLogo width={200} />

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

      {/* FILTRO DE RADIO */}
      <View style={styles.radioRow}>
        {RADIOS.map((r) => {
          const activo = estado.radioKm === r.km;
          return (
            <TouchableOpacity
              key={r.label}
              style={[styles.radioChip, activo && styles.radioChipActivo]}
              onPress={() => setRadio(r.km)}
            >
              <Text style={[styles.radioChipTexto, activo && styles.radioChipTextoActivo]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DECK */}
      <View style={styles.deck}>

        {!personaActual && (
          <View style={styles.emptyState}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={48}
              color={colors.textMuted}
            />

            <Text style={styles.emptyText}>
              {estado.cargando
                ? 'Cargando deportistas...'
                : estado.error
                  ? estado.error
                  : estado.catalogo.length === 0
                    ? 'Aún no hay otros deportistas registrados.'
                    : estado.radioKm !== null
                      ? `No hay deportistas dentro de ${estado.radioKm} km por ahora.`
                      : 'Ya viste a todos los deportistas cerca de ti por ahora.'}
            </Text>

            {!estado.cargando && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() =>
                  estado.sesionExpirada ? router.replace('/(auth)/login') : reiniciarDemo()
                }
              >
                <Ionicons
                  name={estado.sesionExpirada ? 'log-in-outline' : 'refresh'}
                  size={14}
                  color={colors.accent}
                />
                <Text style={styles.resetButtonText}>
                  {estado.sesionExpirada
                    ? 'Iniciar sesión'
                    : estado.error
                      ? 'Reintentar'
                      : 'Volver a ver deportistas'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {siguientePersona && (
          <View
            style={[
              styles.card,
              styles.cardBehind,
            ]}
          >
            <Avatar
              name={siguientePersona.name}
              colorFrom={siguientePersona.colorFrom}
              uri={siguientePersona.fotoUri}
              style={styles.photo}
              fontSize={72}
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
            <Avatar
              name={personaActual.name}
              colorFrom={personaActual.colorFrom}
              uri={personaActual.fotoUri}
              style={styles.photo}
              fontSize={72}
            >

              <Animated.View
                style={[
                  styles.stamp,
                  styles.likeStamp,
                  { opacity: likeOpacity },
                ]}
              >
                <Text style={styles.likeStampText}>
                  ME GUSTA
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

              <TouchableOpacity
                style={styles.infoButton}
                onPress={() => verPerfil(personaActual)}
              >
                <Ionicons name="information-circle-outline" size={20} color="#fff" />
              </TouchableOpacity>

            </Avatar>

            <View style={styles.cardBody}>

              <View style={styles.nameRow}>
                <Text style={styles.name}>
                  {personaActual.name}
                  {personaActual.age ? `, ${personaActual.age}` : ''}
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
              color={colors.textMuted}
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

      {/* AVISO: SOLICITUD ENVIADA */}
      {aviso && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Ionicons name="paper-plane" size={14} color={colors.accent} />
            <Text style={styles.toastText}>{aviso}</Text>
          </View>
        </View>
      )}

      {/* ¡ES UN MATCH! */}
      <MatchModal
        visible={nuevoMatch !== null}
        miNombre={miNombre}
        miFoto={usuario?.fotoPerfil}
        nombre={nuevoMatch?.name ?? ''}
        colorFrom={nuevoMatch?.colorFrom ?? '#7C3AED'}
        fotoUri={nuevoMatch?.fotoUri}
        onEnviarMensaje={enviarMensajeDesdeMatch}
        onCerrar={() => setNuevoMatch(null)}
      />

    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    topbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      marginBottom: 14,
    },

    subtitle: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 4,
      marginLeft: 2,
    },

    miniAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginTop: 7,
    },

    miniAvatarImage: {
      width: '100%',
      height: '100%',
    },

    miniAvatarText: {
      color: c.text,
      fontSize: 12,
      fontWeight: '700',
    },

    radioRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 16,
    },

    radioChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },

    radioChipActivo: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },

    radioChipTexto: {
      color: c.textMuted,
      fontSize: 11.5,
      fontWeight: '700',
    },

    radioChipTextoActivo: {
      color: '#fff',
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
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },

    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 4,
    },

    resetButtonText: {
      color: c.accent,
      fontSize: 12,
      fontWeight: '700',
    },

    card: {
      position: 'absolute',
      width: SCREEN_WIDTH - 40,
      height: CARD_HEIGHT,
      backgroundColor: c.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },

    cardBehind: {
      top: 12,
      transform: [{ scale: 0.96 }],
      opacity: 0.6,
    },

    photo: {
      height: CARD_HEIGHT * 0.62,
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

    infoButton: {
      position: 'absolute',
      top: 14,
      left: 14,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(11,15,25,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
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
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },

    distance: {
      color: c.textMuted,
      fontSize: 11,
    },

    tagsRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 10,
    },

    tag: {
      color: c.accent,
      backgroundColor: c.chip,
      fontSize: 10.5,
      fontWeight: '700',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      overflow: 'hidden',
    },

    bio: {
      color: c.textMuted,
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
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
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

    toastWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 118,
      alignItems: 'center',
    },

    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },

    toastText: {
      color: c.text,
      fontSize: 12,
      fontWeight: '600',
    },
  });