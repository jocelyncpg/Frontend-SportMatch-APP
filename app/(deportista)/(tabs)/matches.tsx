import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Logo from '../../../components/Logo';
import { Usuario, getSession } from '../../../services/auth';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

const SOLICITUDES_INICIALES = [
  { id: '1', name: 'Ignacio R.', sport: 'Ciclismo', level: 'Avanzado', compatibility: 85, colorFrom: '#7C3AED' },
  { id: '2', name: 'Daniela S.', sport: 'Yoga', level: 'Intermedio', compatibility: 90, colorFrom: '#22C55E' },
];

const CONFIRMADOS_INICIALES = [
  { id: '3', name: 'Camila R.', sport: 'Running', level: 'Intermedio', compatibility: 95, colorFrom: '#3648A6' },
  { id: '4', name: 'Diego A.', sport: 'Fútbol', level: 'Intermedio', compatibility: 89, colorFrom: '#1F2A5C' },
];

export default function MatchesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<'solicitudes' | 'confirmados'>('solicitudes');
  const [solicitudes, setSolicitudes] = useState(SOLICITUDES_INICIALES);
  const [confirmados, setConfirmados] = useState(CONFIRMADOS_INICIALES);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  function aceptar(id: string) {
    const persona = solicitudes.find((s) => s.id === id);
    if (!persona) return;
    setConfirmados((prev) => [...prev, persona]);
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
  }

  function rechazar(id: string) {
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
  }

  function abrirChat(persona: { id: string; name: string; sport: string; colorFrom: string }) {
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    });
  }

  const lista = tab === 'solicitudes' ? solicitudes : confirmados;
  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.topbar}>

        <View style={styles.logoWrap}>
          <Logo width={270} />
        </View>

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

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === 'solicitudes' && styles.tabActive,
          ]}
          onPress={() => setTab('solicitudes')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'solicitudes' && styles.tabTextActive,
            ]}
          >
            Solicitudes {solicitudes.length > 0 ? `(${solicitudes.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            tab === 'confirmados' && styles.tabActive,
          ]}
          onPress={() => setTab('confirmados')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'confirmados' && styles.tabTextActive,
            ]}
          >
            Confirmados {confirmados.length > 0 ? `(${confirmados.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView contentContainerStyle={styles.list}>
        {lista.map((persona) => (
          <View key={persona.id} style={styles.card}>

            <View
              style={[
                styles.avatar,
                { backgroundColor: persona.colorFrom },
              ]}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {persona.compatibility}%
                </Text>
              </View>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>
                {persona.name}
              </Text>

              <Text style={styles.cardMeta}>
                {persona.sport} · {persona.level}
              </Text>
            </View>

            {tab === 'solicitudes' ? (
              <View style={styles.actions}>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => rechazar(persona.id)}
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
                >
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>

              </View>
            ) : (
              <TouchableOpacity style={styles.chatButton} onPress={() => abrirChat(persona)}>
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={colors.accent}
                />
              </TouchableOpacity>
            )}

          </View>
        ))}

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {tab === 'solicitudes'
              ? 'No tienes solicitudes pendientes.'
              : 'Todavía no tienes matches confirmados.'}
          </Text>
        )}
      </ScrollView>

    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      paddingTop: 60,
    },

    topbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      marginBottom: 16,
      height: 55,
    },

    logoWrap: {
      marginLeft: -38,
      marginTop: -25,
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