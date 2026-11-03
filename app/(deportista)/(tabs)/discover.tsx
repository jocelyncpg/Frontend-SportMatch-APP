import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import { AvatarMini, Boton, EncabezadoMarca } from '../../../components/ui';
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
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;
// Texto e íconos que van sobre la foto: siempre claros, porque el degradado de abajo es oscuro en ambos temas.
const SOBRE_FOTO = '#FFFFFF';
const SOBRE_FOTO_SUAVE = 'rgba(255,255,255,0.85)';
// Alto máximo de la tarjeta. El alto real se mide con el espacio que queda entre los filtros y los botones
// (así la tarjeta nunca se monta sobre "2 km, 5 km…"); mientras no se mide, se usa este valor de partida.
const CARD_HEIGHT_MAX = 540;
const CARD_HEIGHT_INICIAL = Math.min(CARD_HEIGHT_MAX, Math.round(SCREEN_HEIGHT * 0.5));

// Degradado oscuro bajo el texto, hecho con franjas (no necesita librerías extra).
const FRANJAS = 14;
const SOMBRA = Array.from({ length: FRANJAS }, (_, i) => Math.pow((i + 1) / FRANJAS, 1.7) * 0.92);

const RADIOS: { label: string; km: number | null }[] = [
  { label: 'Todas', km: null },
  { label: '2 km', km: 2 },
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
];

export default function DiscoverScreen() {
  const { colors } = useAppTheme();
  const [deckAlto, setDeckAlto] = useState(0);
  const cardAlto = deckAlto > 0 ? Math.min(CARD_HEIGHT_MAX, Math.round(deckAlto - espacio.xl * 2)) : CARD_HEIGHT_INICIAL;
  const styles = useMemo(() => makeStyles(colors, cardAlto), [colors, cardAlto]);

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
    <View style={styles.container}>

      {/* HEADER */}
      <EncabezadoMarca
        subtitulo={usuario?.comuna ? `Cerca de ${usuario.comuna}` : 'Desliza para conectar'}
        derecha={
          <AvatarMini
            uri={usuario?.fotoPerfil}
            iniciales={iniciales}
            onPress={() => router.push('/(deportista)/(tabs)/profile')}
          />
        }
      />

      {/* FILTRO DE RADIO */}
      <View style={styles.radioRow}>
        {RADIOS.map((r) => {
          const activo = estado.radioKm === r.km;
          return (
            <TouchableOpacity
              key={r.label}
              style={[styles.radioChip, activo && styles.radioChipActivo]}
              onPress={() => setRadio(r.km)}
              accessibilityRole="button"
              accessibilityLabel={r.km === null ? 'Distancia: todas' : `Distancia: ${r.km} kilómetros`}
              accessibilityState={{ selected: activo }}
            >
              <Text style={[styles.radioChipTexto, activo && styles.radioChipTextoActivo]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DECK */}
      <View style={styles.deck} onLayout={(e) => setDeckAlto(e.nativeEvent.layout.height)}>

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
              <Boton
                variante="secundario"
                icono={estado.sesionExpirada ? 'log-in-outline' : 'refresh'}
                texto={
                  estado.sesionExpirada
                    ? 'Iniciar sesión'
                    : estado.error
                      ? 'Reintentar'
                      : 'Volver a ver deportistas'
                }
                onPress={() =>
                  estado.sesionExpirada ? router.replace('/(auth)/login') : reiniciarDemo()
                }
                style={styles.resetButton}
              />
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

              {/* Degradado para que el texto se lea sobre cualquier foto */}
              <View style={styles.sombra} pointerEvents="none">
                {SOMBRA.map((a, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: `rgba(8,10,20,${a.toFixed(3)})` }} />
                ))}
              </View>

              <View style={styles.info} pointerEvents="none">
                <Text style={styles.name} numberOfLines={1}>
                  {personaActual.name}
                  {personaActual.age ? `  ${personaActual.age}` : ''}
                </Text>

                <Text style={styles.sportLine}>
                  {personaActual.sport} · {personaActual.level}
                </Text>

                {personaActual.distance ? (
                  <View style={styles.distRow}>
                    <Ionicons name="location-outline" size={13} color={SOBRE_FOTO_SUAVE} />
                    <Text style={styles.distance}>{personaActual.distance}</Text>
                  </View>
                ) : null}

                {personaActual.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>
                    {personaActual.bio}
                  </Text>
                ) : null}

                <View style={styles.compatRow}>
                  <View style={styles.ring}>
                    <Text style={styles.ringText}>{personaActual.compatibility}%</Text>
                  </View>
                  <Text style={styles.compatLabel}>Compatibilidad</Text>
                </View>
              </View>

            </Avatar>
          </Animated.View>
        )}

      </View>

      {/* ACTIONS */}
      {personaActual && (
        <View style={styles.actions}>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => forceSwipe('left')}
            accessibilityRole="button"
            accessibilityLabel="Pasar"
          >
            <Ionicons
              name="close"
              size={26}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.perfilButton}
            onPress={() => verPerfil(personaActual)}
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil de ${personaActual.name}`}
          >
            <Ionicons name="person-outline" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => forceSwipe('right')}
            accessibilityRole="button"
            accessibilityLabel="Me gusta"
          >
            <Ionicons
              name="heart"
              size={28}
              color={SOBRE_FOTO}
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

const makeStyles = (c: Colors, cardAlto: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    radioRow: {
      flexDirection: 'row',
      gap: espacio.s,
      paddingHorizontal: espacio.xl,
      marginBottom: espacio.l,
    },

    radioChip: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radio.control,
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
      ...tipo.cuerpoFuerte,
    },

    radioChipTextoActivo: {
      color: SOBRE_FOTO,
    },

    deck: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      // Lo que se salga del espacio del mazo se recorta, para que la foto no tape los filtros de distancia.
      overflow: 'hidden',
    },

    emptyState: {
      alignItems: 'center',
      paddingHorizontal: espacio.xxl + espacio.l,
      gap: espacio.m,
    },

    emptyText: {
      color: c.textMuted,
      ...tipo.cuerpo,
      lineHeight: 19,
      textAlign: 'center',
    },

    resetButton: {
      marginTop: espacio.xs,
      alignSelf: 'stretch',
    },

    card: {
      position: 'absolute',
      width: SCREEN_WIDTH - espacio.xl * 2,
      height: cardAlto,
      backgroundColor: c.card,
      borderRadius: radio.tarjeta + 8,
      overflow: 'hidden',
    },

    cardBehind: {
      top: espacio.m,
      transform: [{ scale: 0.96 }],
      opacity: 0.6,
    },

    photo: {
      height: cardAlto,
    },

    sombra: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: cardAlto * 0.62,
    },

    info: {
      position: 'absolute',
      left: espacio.l + 2,
      right: espacio.l + 2,
      bottom: espacio.l + 2,
    },

    // Nombre grande de la tarjeta: es el dato principal, por eso queda fuera de la escala de texto.
    name: {
      color: SOBRE_FOTO,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.3,
    },

    sportLine: {
      color: SOBRE_FOTO,
      ...tipo.seccion,
      marginTop: espacio.xs,
    },

    distRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.xs,
      marginTop: espacio.xs,
    },

    distance: {
      color: SOBRE_FOTO_SUAVE,
      ...tipo.dato,
    },

    bio: {
      color: SOBRE_FOTO_SUAVE,
      ...tipo.cuerpo,
      lineHeight: 18,
      marginTop: espacio.m,
    },

    compatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.m,
      marginTop: espacio.l,
    },

    ring: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 3,
      borderColor: c.success,
      backgroundColor: 'rgba(8,10,20,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    ringText: {
      color: SOBRE_FOTO,
      ...tipo.etiqueta,
      fontWeight: '800',
    },

    compatLabel: {
      color: SOBRE_FOTO,
      ...tipo.cuerpoFuerte,
    },

    stamp: {
      position: 'absolute',
      top: espacio.xxl,
      borderWidth: 3,
      borderRadius: radio.control,
      paddingHorizontal: espacio.m,
      paddingVertical: espacio.xs,
    },

    likeStamp: {
      left: espacio.xl,
      borderColor: c.success,
      transform: [{ rotate: '-15deg' }],
    },

    likeStampText: {
      color: c.success,
      fontWeight: '900',
      fontSize: 20,
      letterSpacing: 1,
    },

    nopeStamp: {
      right: espacio.xl,
      borderColor: c.danger,
      transform: [{ rotate: '15deg' }],
    },

    nopeStampText: {
      color: c.danger,
      fontWeight: '900',
      fontSize: 20,
      letterSpacing: 1,
    },

    actions: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: espacio.xl,
      paddingVertical: espacio.xxl,
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

    perfilButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    acceptButton: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: c.primary,
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
      gap: espacio.s,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.tarjeta + 4,
      paddingHorizontal: espacio.l,
      paddingVertical: espacio.m,
    },

    toastText: {
      color: c.text,
      ...tipo.cuerpoFuerte,
    },
  });