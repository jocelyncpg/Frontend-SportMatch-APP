import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { horaCorta, ultimoMensaje, useConversaciones } from '../../../services/chat';
import { Persona, useMatches } from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { confirmados } = useMatches();
  const conversaciones = useConversaciones();

  // Los matches nuevos (sin mensajes todavía) van arriba, el más reciente primero.
  // Después, las conversaciones, con la de mensaje más reciente primero.
  const chats = useMemo(() => {
    const conMensajes = confirmados
      .filter((p) => ultimoMensaje(conversaciones[p.id] ?? { personaId: p.id, mensajes: [], noLeidos: 0 }))
      .sort((a, b) => {
        const ta = ultimoMensaje(conversaciones[a.id])?.enviadoEn ?? 0;
        const tb = ultimoMensaje(conversaciones[b.id])?.enviadoEn ?? 0;
        return tb - ta;
      });
    const nuevos = confirmados
      .filter((p) => !ultimoMensaje(conversaciones[p.id] ?? { personaId: p.id, mensajes: [], noLeidos: 0 }))
      .reverse();
    return [...nuevos, ...conMensajes];
  }, [confirmados, conversaciones]);

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
          const conv = conversaciones[persona.id];
          const ultimo = conv ? ultimoMensaje(conv) : null;
          const noLeidos = conv?.noLeidos ?? 0;
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
                <Text
                  style={ultimo ? [styles.cardMessage, noLeidos > 0 && styles.cardMessageSinLeer] : styles.cardMessageNuevo}
                  numberOfLines={1}
                >
                  {ultimo
                    ? `${ultimo.propio ? 'Tú: ' : ''}${ultimo.texto}`
                    : `¡Nuevo match! Saluda a ${persona.name.split(' ')[0]} 👋`}
                </Text>
              </View>
              {ultimo ? (
                <View style={styles.cardDerecha}>
                  <Text style={[styles.cardHora, noLeidos > 0 && styles.cardHoraSinLeer]}>{horaCorta(ultimo.enviadoEn)}</Text>
                  {noLeidos > 0 && (
                    <View style={styles.contador} accessibilityLabel={`${noLeidos} mensajes sin leer`}>
                      <Text style={styles.contadorTexto}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
                    </View>
                  )}
                </View>
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
    cardMessageSinLeer: { color: c.text, fontWeight: '700' },
    cardMessageNuevo: { color: c.accent, fontSize: 11.5, marginTop: 2, fontWeight: '600' },
    cardDerecha: { alignItems: 'flex-end', gap: 5 },
    cardHora: { color: c.textMuted, fontSize: 10 },
    cardHoraSinLeer: { color: c.primary, fontWeight: '700' },
    contador: {
      minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    contadorTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
    nuevoBadge: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    nuevoText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingHorizontal: 30, marginTop: 60, gap: 8 },
    emptyTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });