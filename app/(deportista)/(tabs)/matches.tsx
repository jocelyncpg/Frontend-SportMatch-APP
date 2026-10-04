import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import BrandLogo from '../../../components/BrandLogo';
import MatchModal from '../../../components/MatchModal';
import { Usuario, getSession } from '../../../services/auth';
import { Persona, aceptarSolicitud, rechazarSolicitud, cancelarSolicitud, cargarMatching, useMatches } from '../../../services/matchStore';
import { useMatchingRefresh } from '../../../hooks/useMatchingRefresh';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function MatchesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  useMatchingRefresh();
  const { solicitudes, solicitudesEnviadas, confirmados, ocupados, cargandoMatches, matchingError, sesionExpirada } = useMatches();
  const [tab, setTab] = useState<'solicitudes' | 'enviadas' | 'confirmados'>('solicitudes');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  async function aceptar(id: string) {
    try {
      setNuevoMatch(await aceptarSolicitud(id));
    } catch (e) {
      Alert.alert('No se pudo aceptar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  async function rechazar(id: string) {
    try {
      await rechazarSolicitud(id);
    } catch (e) {
      Alert.alert('No se pudo rechazar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  async function cancelar(id: string) {
    try {
      await cancelarSolicitud(id);
    } catch (e) {
      Alert.alert('No se pudo cancelar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  function abrirPerfil(persona: Persona) {
    if (!persona.matchId) return;
    router.push({ pathname: '/(deportista)/athlete/[id]', params: { id: persona.matchId } });
  }

  function abrirChat(persona: Persona) {
    if (!persona.matchId) return;
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.matchId },
    });
  }

  function enviarMensajeDesdeMatch() {
    const persona = nuevoMatch;
    setNuevoMatch(null);
    if (persona) abrirChat(persona);
  }

  const lista = tab === 'solicitudes' ? solicitudes : tab === 'enviadas' ? solicitudesEnviadas : confirmados;
  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';
  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>

      {/* HEADER */}
      <View style={styles.topbar}>
        <BrandLogo width={200} />

        <TouchableOpacity
          onPress={() => router.push('/(deportista)/(tabs)/profile')}
          style={styles.miniAvatar}
        >
          {usuario?.fotoPerfil ? (
            <Image
              source={{ uri: usuario.fotoPerfil }}
              style={styles.miniAvatarImage}
            />
          ) : (
            <Text style={styles.miniAvatarText}>{iniciales}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {([
          ['solicitudes', 'Recibidas', solicitudes.length],
          ['enviadas', 'Enviadas', solicitudesEnviadas.length],
          ['confirmados', 'Matches', confirmados.length],
        ] as const).map(([key, label, count]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}{count > 0 ? ` (${count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTA */}
      <ScrollView contentContainerStyle={styles.list}>
        {matchingError && (
          <TouchableOpacity onPress={() => sesionExpirada ? router.replace('/(auth)/login') : void cargarMatching()}>
            <Text style={styles.emptyText}>{matchingError} · {sesionExpirada ? 'Iniciar sesión' : 'Reintentar'}</Text>
          </TouchableOpacity>
        )}
        {!matchingError && lista.map((persona) => (
          <View key={persona.id} style={styles.card}>

            <Avatar
              name={persona.name}
              colorFrom={persona.colorFrom}
              uri={persona.fotoUri}
              style={styles.avatar}
              fontSize={18}
              overlayStyle={styles.avatarOverlay}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {persona.compatibility}%
                </Text>
              </View>
            </Avatar>

            <TouchableOpacity style={styles.cardInfo} disabled={tab !== 'confirmados'}
              onPress={() => abrirPerfil(persona)} accessibilityLabel={`Ver perfil de ${persona.name}`}>

              <Text style={styles.cardName}>
                {persona.name}
              </Text>

              <Text style={styles.cardMeta}>
                {persona.sport} · {persona.level}
              </Text>
              {tab === 'confirmados' && <Text style={styles.profileLink}>Ver perfil</Text>}
              {tab === 'enviadas' && <Text style={styles.cardMeta}>Pendiente de respuesta</Text>}
            </TouchableOpacity>

            {tab === 'solicitudes' ? (
              <View style={styles.actions}>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => rechazar(persona.id)}
                  disabled={ocupados.includes(persona.id)}
                  accessibilityLabel={`Rechazar solicitud de ${persona.name}`}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => aceptar(persona.id)}
                  disabled={ocupados.includes(persona.id)}
                  accessibilityLabel={`Aceptar solicitud de ${persona.name}`}
                >
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>

              </View>
            ) : tab === 'enviadas' ? (
              <TouchableOpacity style={styles.cancelButton} onPress={() => cancelar(persona.id)}
                disabled={ocupados.includes(persona.id)} accessibilityLabel={`Cancelar solicitud a ${persona.name}`}>
                <Text style={styles.cancelText}>{ocupados.includes(persona.id) ? 'Cancelando...' : 'Cancelar'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.chatButton} onPress={() => abrirChat(persona)} accessibilityLabel={`Abrir chat con ${persona.name}`}>
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={colors.accent}
                />
              </TouchableOpacity>
            )}

          </View>
        ))}

        {!matchingError && lista.length === 0 && (
          <Text style={styles.emptyText}>
            {cargandoMatches ? 'Cargando matches...' : tab === 'solicitudes'
              ? 'No tienes solicitudes pendientes.'
              : tab === 'enviadas' ? 'No tienes solicitudes enviadas pendientes.'
              : 'Todavía no tienes matches confirmados.'}
          </Text>
        )}
      </ScrollView>

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
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 16,
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

    tabs: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 8,
      marginBottom: 16,
    },

    tab: {
      flex: 1,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },

    tabActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },

    tabText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },

    tabTextActive: {
      color: '#fff',
    },

    list: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 10,
      marginBottom: 10,
    },

    avatar: {
      width: 56,
      height: 56,
      borderRadius: 12,
    },

    avatarOverlay: {
      alignItems: 'flex-end',
      padding: 4,
    },

    badge: {
      backgroundColor: c.badgeBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },

    badgeText: {
      color: c.success,
      fontSize: 9,
      fontWeight: '700',
    },

    cardInfo: {
      flex: 1,
    },

    cardName: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
    },

    cardMeta: {
      color: c.textMuted,
      fontSize: 10.5,
      marginTop: 2,
    },

    profileLink: { color: c.accent, fontSize: 12, fontWeight: '600', marginTop: 6 },
    cancelButton: { backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10 },
    cancelText: { color: c.text, fontSize: 12, fontWeight: '600' },

    actions: {
      flexDirection: 'row',
      gap: 8,
    },

    rejectButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },

    acceptButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#16A34A',
      alignItems: 'center',
      justifyContent: 'center',
    },

    chatButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyText: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 30,
    },
  });
