import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { horaCorta, useChats, useSilenciados } from '../../../services/chat';
import { Persona, cargarMatching, useMatches } from '../../../services/matchStore';
import { useBloqueados } from '../../../services/reportes';
import { useMatchingRefresh } from '../../../hooks/useMatchingRefresh';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  useMatchingRefresh();
  const { confirmados, matchingError, cargandoMatches, sesionExpirada } = useMatches();
  const resumenes = useChats();
  const silenciados = useSilenciados();
  const bloqueados = useBloqueados();

  /** Último mensaje: el de /chats (con no leídos) o, si aún no carga, el que trae el match. */
  function ultimoDe(p: Persona) {
    const r = p.matchId ? resumenes[p.matchId] : undefined;
    if (r) return r.ultimo;
    return p.ultimoMensaje
      ? { texto: p.ultimoMensaje, propio: false, enviadoEn: p.ultimoMensajeFecha ? Date.parse(p.ultimoMensajeFecha) : 0 }
      : null;
  }

  // Los matches nuevos (sin mensajes todavía) van arriba, el más reciente primero.
  // Después, las conversaciones, con la de mensaje más reciente primero.
  const chats = useMemo(() => {
    const conMensajes = confirmados
      .filter((p) => ultimoDe(p))
      .sort((a, b) => (ultimoDe(b)?.enviadoEn ?? 0) - (ultimoDe(a)?.enviadoEn ?? 0));
    const nuevos = confirmados.filter((p) => !ultimoDe(p)).reverse();
    return [...nuevos, ...conMensajes];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmados, resumenes]);

  function abrirChat(persona: Persona) {
    if (!persona.matchId) return;
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.matchId, personaId: persona.id },
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
          const ultimo = ultimoDe(persona);
          const noLeidos = (persona.matchId && resumenes[persona.matchId]?.noLeidos) || 0;
          const silenciado = silenciados.includes(persona.id);
          const bloqueado = bloqueados.includes(persona.id);
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
                {bloqueado ? (
                  <Text style={styles.cardBloqueado} numberOfLines={1}>Bloqueado</Text>
                ) : (
                  <Text
                    style={ultimo ? [styles.cardMessage, noLeidos > 0 && styles.cardMessageSinLeer] : styles.cardMessageNuevo}
                    numberOfLines={1}
                  >
                    {ultimo
                      ? `${ultimo.propio ? 'Tú: ' : ''}${ultimo.texto}`
                      : `¡Nuevo match! Saluda a ${persona.name.split(' ')[0]} 👋`}
                  </Text>
                )}
              </View>
              {ultimo ? (
                <View style={styles.cardDerecha}>
                  <View style={styles.horaFila}>
                    {silenciado && !bloqueado ? (
                      <Ionicons name="notifications-off-outline" size={12} color={colors.textMuted} accessibilityLabel="Silenciado" />
                    ) : null}
                    {bloqueado ? (
                      <Ionicons name="ban-outline" size={12} color={colors.danger} accessibilityLabel="Bloqueado" />
                    ) : null}
                    <Text style={[styles.cardHora, noLeidos > 0 && !silenciado && styles.cardHoraSinLeer]}>
                      {ultimo.enviadoEn ? horaCorta(ultimo.enviadoEn) : ''}
                    </Text>
                  </View>
                  {noLeidos > 0 && !bloqueado && (
                    <View style={[styles.contador, silenciado && styles.contadorSilenciado]} accessibilityLabel={`${noLeidos} mensajes sin leer`}>
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
    cardMessageSinLeer: { color: c.text, fontWeight: '700' },
    cardMessageNuevo: { color: c.accent, fontSize: 11.5, marginTop: 2, fontWeight: '600' },
    cardBloqueado: { color: c.danger, fontSize: 11.5, marginTop: 2, fontWeight: '600' },
    cardDerecha: { alignItems: 'flex-end', gap: 5 },
    horaFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardHora: { color: c.textMuted, fontSize: 10 },
    cardHoraSinLeer: { color: c.primary, fontWeight: '700' },
    contador: {
      minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    contadorSilenciado: { backgroundColor: c.textMuted },
    contadorTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
    nuevoBadge: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    nuevoText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingHorizontal: 30, marginTop: 60, gap: 8 },
    emptyTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
