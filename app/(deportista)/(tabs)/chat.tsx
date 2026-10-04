import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { Persona, cargarMatching, useMatches } from '../../../services/matchStore';
import { useMatchingRefresh } from '../../../hooks/useMatchingRefresh';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  useMatchingRefresh();
  const { confirmados: chats, matchingError, cargandoMatches, sesionExpirada } = useMatches();

  function abrirChat(persona: Persona) {
    if (!persona.matchId) return;
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.matchId },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Chats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {matchingError && (
          <TouchableOpacity onPress={() => sesionExpirada ? router.replace('/(auth)/login') : void cargarMatching()}>
            <Text style={styles.emptyText}>{matchingError} · {sesionExpirada ? 'Iniciar sesión' : 'Reintentar'}</Text>
          </TouchableOpacity>
        )}
        {!matchingError && chats.map((persona) => {
          const ultimo = persona.ultimoMensaje ? { texto: persona.ultimoMensaje,
            hora: persona.ultimoMensajeFecha ? new Date(persona.ultimoMensajeFecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' } : null;
          return (
            <TouchableOpacity key={persona.id} style={styles.card} onPress={() => abrirChat(persona)}>
              <Avatar
                name={persona.name}
                colorFrom={persona.colorFrom}
                uri={persona.fotoUri}
                style={styles.avatar}
                fontSize={16}
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{persona.name}</Text>
                <Text style={ultimo ? styles.cardMessage : styles.cardMessageNuevo} numberOfLines={1}>
                  {ultimo ? ultimo.texto : `¡Nuevo match! Saluda a ${persona.name.split(' ')[0]} 👋`}
                </Text>
              </View>
              {ultimo ? (
                <Text style={styles.cardHora}>{ultimo.hora}</Text>
              ) : (
                <View style={styles.nuevoBadge}>
                  <Text style={styles.nuevoText}>Nuevo</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {!matchingError && chats.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{cargandoMatches ? 'Cargando conversaciones...' : 'Aún no tienes conversaciones'}</Text>
            <Text style={styles.emptyText}>Cuando hagas match con alguien, podrás escribirle desde aquí.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { paddingHorizontal: 20, marginBottom: 16 },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    list: { paddingHorizontal: 20, paddingBottom: 30 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, padding: 12, marginBottom: 10,
    },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardMessage: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    cardMessageNuevo: { color: c.accent, fontSize: 11.5, marginTop: 2, fontWeight: '600' },
    cardHora: { color: c.textMuted, fontSize: 10 },
    nuevoBadge: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    nuevoText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingHorizontal: 30, marginTop: 60, gap: 8 },
    emptyTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
