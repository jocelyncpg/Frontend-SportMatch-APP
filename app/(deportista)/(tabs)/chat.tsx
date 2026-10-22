import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { visualDeporte } from '../../../services/actividades';
import { getConversacion, horaCorta, ultimoMensaje, useConversaciones } from '../../../services/chat';
import { ChatGrupal, ultimoMensajeGrupal, useChatsGrupales } from '../../../services/chatGrupal';
import { Persona, useMatches } from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

type Item =
  | { tipo: 'persona'; persona: Persona; orden: number; nuevo: boolean }
  | { tipo: 'grupo'; grupo: ChatGrupal; orden: number; nuevo: false };

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { confirmados } = useMatches();
  const conversaciones = useConversaciones();
  const grupos = useChatsGrupales();

  // Los matches nuevos (sin mensajes todavía) van arriba, el más reciente primero.
  // Después, chats 1 a 1 y grupos de actividad juntos, con el mensaje más reciente primero.
  const items = useMemo<Item[]>(() => {
    const de = (p: Persona) => conversaciones[p.id] ?? getConversacion(p.id);
    const nuevos: Item[] = confirmados
      .filter((p) => !ultimoMensaje(de(p)))
      .reverse()
      .map((persona) => ({ tipo: 'persona', persona, orden: 0, nuevo: true }));
    const conMensajes: Item[] = confirmados
      .filter((p) => ultimoMensaje(de(p)))
      .map((persona) => ({ tipo: 'persona', persona, orden: ultimoMensaje(de(persona))?.enviadoEn ?? 0, nuevo: false }));
    const deGrupos: Item[] = grupos.map((grupo) => ({
      tipo: 'grupo',
      grupo,
      orden: grupo.sala.mensajes[grupo.sala.mensajes.length - 1]?.enviadoEn ?? 0,
      nuevo: false,
    }));
    return [...nuevos, ...[...conMensajes, ...deGrupos].sort((a, b) => b.orden - a.orden)];
  }, [confirmados, conversaciones, grupos]);

  function abrirChat(persona: Persona) {
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    });
  }

  function abrirGrupo(g: ChatGrupal) {
    router.push({ pathname: '/(deportista)/chat-grupo/[id]', params: { id: g.actividad.id } });
  }

  function tarjetaPersona(persona: Persona) {
    const conv = conversaciones[persona.id] ?? getConversacion(persona.id);
    const ultimo = ultimoMensaje(conv);
    const noLeidos = conv.noLeidos;
    const { silenciado, bloqueado } = conv;
    return (
      <TouchableOpacity key={`p-${persona.id}`} style={styles.card} onPress={() => abrirChat(persona)}>
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
              <Text style={[styles.cardHora, noLeidos > 0 && !silenciado && styles.cardHoraSinLeer]}>{horaCorta(ultimo.enviadoEn)}</Text>
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
  }

  function tarjetaGrupo(g: ChatGrupal) {
    const { actividad, sala, acceso, participantes } = g;
    const visual = visualDeporte(actividad.deporte);
    const ultimo = ultimoMensajeGrupal(sala);
    const ultimoCualquiera = sala.mensajes[sala.mensajes.length - 1];
    const { noLeidos, silenciado } = sala;
    const vista = ultimo
      ? `${ultimo.propio ? 'Tú' : ultimo.autorNombre.split(' ')[0]}: ${ultimo.texto}`
      : 'Aún no hay mensajes. ¡Saluda al grupo! 👋';
    return (
      <TouchableOpacity key={`g-${actividad.id}`} style={styles.card} onPress={() => abrirGrupo(g)}>
        <View style={[styles.grupoIcono, { backgroundColor: visual.colorBg }]}>
          <Text style={styles.grupoEmoji}>{visual.icon}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nombreFila}>
            <Text style={[styles.cardName, styles.cardNameGrupo]} numberOfLines={1}>{actividad.titulo}</Text>
            <View style={styles.grupoTag}>
              <Ionicons name="people" size={10} color={colors.accent} />
              <Text style={styles.grupoTagTexto}>{participantes}</Text>
            </View>
          </View>
          <Text style={[styles.cardMessage, noLeidos > 0 && styles.cardMessageSinLeer]} numberOfLines={1}>
            {acceso === 'leer' ? `Finalizada · ${vista}` : vista}
          </Text>
        </View>
        <View style={styles.cardDerecha}>
          <View style={styles.horaFila}>
            {silenciado ? (
              <Ionicons name="notifications-off-outline" size={12} color={colors.textMuted} accessibilityLabel="Silenciado" />
            ) : null}
            {ultimoCualquiera ? (
              <Text style={[styles.cardHora, noLeidos > 0 && !silenciado && styles.cardHoraSinLeer]}>{horaCorta(ultimoCualquiera.enviadoEn)}</Text>
            ) : null}
          </View>
          {noLeidos > 0 && (
            <View style={[styles.contador, silenciado && styles.contadorSilenciado]} accessibilityLabel={`${noLeidos} mensajes sin leer`}>
              <Text style={styles.contadorTexto}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Chats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.map((it) => (it.tipo === 'grupo' ? tarjetaGrupo(it.grupo) : tarjetaPersona(it.persona)))}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Aún no tienes conversaciones</Text>
            <Text style={styles.emptyText}>
              Cuando hagas match con alguien o te aprueben en una actividad, podrás escribir desde aquí.
            </Text>
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
    grupoIcono: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    grupoEmoji: { fontSize: 21 },
    cardInfo: { flex: 1 },
    nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardNameGrupo: { flexShrink: 1 },
    grupoTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.chip, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 2 },
    grupoTagTexto: { color: c.accent, fontSize: 10, fontWeight: '700' },
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