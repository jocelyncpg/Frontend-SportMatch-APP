import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

const CHATS = [
  { id: '3', name: 'Camila R.', sport: 'Running', colorFrom: '#3648A6', ultimoMensaje: '¡Dale, nos vemos a las 19:30!', hora: '18:42' },
  { id: '4', name: 'Diego A.', sport: 'Fútbol', colorFrom: '#1F2A5C', ultimoMensaje: 'Perfecto, cualquier cosa avísame', hora: 'Ayer' },
];

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Chats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {CHATS.map((chat) => (
          <TouchableOpacity
            key={chat.id}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/(deportista)/chat/[id]',
                params: { id: chat.id, name: chat.name, sport: chat.sport, colorFrom: chat.colorFrom },
              })
            }
          >
            <View style={[styles.avatar, { backgroundColor: chat.colorFrom }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{chat.name}</Text>
              <Text style={styles.cardMessage} numberOfLines={1}>{chat.ultimoMensaje}</Text>
            </View>
            <Text style={styles.cardHora}>{chat.hora}</Text>
          </TouchableOpacity>
        ))}

        {CHATS.length === 0 && (
          <Text style={styles.emptyText}>Todavía no tienes conversaciones activas.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60 },
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
    cardHora: { color: c.textMuted, fontSize: 10 },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 30 },
  });