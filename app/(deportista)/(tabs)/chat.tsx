import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { Persona, useMatches } from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

// Conversaciones de prueba que ya tenían mensajes. Se reemplaza por la API de chat.
const ULTIMOS_MENSAJES: Record<string, { texto: string; hora: string }> = {
  camila: { texto: '¡Dale, nos vemos a las 19:30!', hora: '18:42' },
  diego: { texto: 'Perfecto, cualquier cosa avísame', hora: 'Ayer' },
};

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { confirmados } = useMatches();

  // Los matches nuevos (sin mensajes todavía) van arriba, el más reciente primero.
  const chats = useMemo(() => {
    const conMensajes = confirmados.filter((p) => ULTIMOS_MENSAJES[p.id]);
    const nuevos = confirmados.filter((p) => !ULTIMOS_MENSAJES[p.id]).reverse();
    return [...nuevos, ...conMensajes];
  }, [confirmados]);

  function abrirChat(persona: Persona) {
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Chats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {chats.map((persona) => {
          const ultimo = ULTIMOS_MENSAJES[persona.id];
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

        {chats.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Aún no tienes conversaciones</Text>
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