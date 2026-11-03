import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '../../../components/Avatar';
import InsigniaDeporte from '../../../components/InsigniaDeporte';
import { AvatarMini, EncabezadoMarca, EncabezadoPantalla } from '../../../components/ui';
import { YO } from '../../../services/actividades';
import { Usuario, getSession } from '../../../services/auth';
import { getConversacion, horaCorta, ultimoMensaje, useConversaciones } from '../../../services/chat';
import { ChatGrupal, ultimoMensajeGrupal, useChatsGrupales } from '../../../services/chatGrupal';
import { Hilo, useHilosDePostulante } from '../../../services/consultas';
import { Persona, useMatches } from '../../../services/matchStore';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Texto sobre fondos de color fuerte (contador, etiqueta "Nuevo").
const SOBRE_COLOR = '#FFFFFF';

// Cuántas conversaciones se ven antes de tocar "Ver más".
const VISIBLES = 5;

type Item =
  | { tipo: 'persona'; persona: Persona; orden: number; nuevo: boolean }
  | { tipo: 'grupo'; grupo: ChatGrupal; orden: number; nuevo: false }
  | { tipo: 'club'; hilo: Hilo; orden: number; nuevo: false };

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  useEffect(() => {
    getSession().then(setUsuario);
  }, []);
  const iniciales = usuario ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}` : '..';
  const [verTodas, setVerTodas] = useState(false);

  const { confirmados } = useMatches();
  const conversaciones = useConversaciones();
  const grupos = useChatsGrupales();
  const consultas = useHilosDePostulante(YO);

  // Los matches nuevos (sin mensajes todavía) van arriba, el más reciente primero.
  // Después, chats 1 a 1, grupos de actividad y consultas a clubes juntos, con el mensaje más reciente primero.
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
    const deClubes: Item[] = consultas.map((hilo) => ({
      tipo: 'club',
      hilo,
      orden: hilo.mensajes[hilo.mensajes.length - 1]?.enviadoEn ?? 0,
      nuevo: false,
    }));
    return [...nuevos, ...[...conMensajes, ...deGrupos, ...deClubes].sort((a, b) => b.orden - a.orden)];
  }, [confirmados, conversaciones, grupos, consultas]);

  function abrirChat(persona: Persona) {
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    });
  }

  function abrirGrupo(g: ChatGrupal) {
    router.push({ pathname: '/(deportista)/chat-grupo/[id]', params: { id: g.actividad.id } });
  }

  function abrirClub(h: Hilo) {
    router.push({ pathname: '/(deportista)/chat-club/[id]', params: { id: h.clubId } } as never);
  }

  function tarjetaPersona(persona: Persona) {
    const conv = conversaciones[persona.id] ?? getConversacion(persona.id);
    const ultimo = ultimoMensaje(conv);
    const noLeidos = conv.noLeidos;
    const { silenciado, bloqueado } = conv;
    return (
      <TouchableOpacity
        key={`p-${persona.id}`}
        style={styles.card}
        onPress={() => abrirChat(persona)}
        accessibilityRole="button"
        accessibilityLabel={`Chat con ${persona.name}${noLeidos > 0 ? `, ${noLeidos} sin leer` : ''}`}
      >
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
                : `¡Nuevo match! Saluda a ${persona.name.split(' ')[0]}`}
            </Text>
          )}
        </View>
        {ultimo ? (
          <View style={styles.cardDerecha}>
            <View style={styles.horaFila}>
              {silenciado && !bloqueado ? (
                <Ionicons name="notifications-off-outline" size={14} color={colors.textMuted} accessibilityLabel="Silenciado" />
              ) : null}
              {bloqueado ? (
                <Ionicons name="ban-outline" size={14} color={colors.danger} accessibilityLabel="Bloqueado" />
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
    const ultimo = ultimoMensajeGrupal(sala);
    const ultimoCualquiera = sala.mensajes[sala.mensajes.length - 1];
    const { noLeidos, silenciado } = sala;
    const vista = ultimo
      ? `${ultimo.propio ? 'Tú' : ultimo.autorNombre.split(' ')[0]}: ${ultimo.texto}`
      : 'Aún no hay mensajes. ¡Saluda al grupo!';
    return (
      <TouchableOpacity
        key={`g-${actividad.id}`}
        style={styles.card}
        onPress={() => abrirGrupo(g)}
        accessibilityRole="button"
        accessibilityLabel={`Grupo ${actividad.titulo}${noLeidos > 0 ? `, ${noLeidos} sin leer` : ''}`}
      >
        <InsigniaDeporte deporte={actividad.deporte} tamano={46} />
        <View style={styles.cardInfo}>
          <View style={styles.nombreFila}>
            <Text style={[styles.cardName, styles.cardNameGrupo]} numberOfLines={1}>{actividad.titulo}</Text>
            <View style={styles.grupoTag}>
              <Ionicons name="people" size={12} color={colors.accent} />
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
              <Ionicons name="notifications-off-outline" size={14} color={colors.textMuted} accessibilityLabel="Silenciado" />
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

  // Consulta a un club por su convocatoria (HU-51).
  function tarjetaClub(h: Hilo) {
    const ultimo = h.mensajes[h.mensajes.length - 1];
    const noLeidos = h.noLeidosPostulante;
    return (
      <TouchableOpacity
        key={`c-${h.id}`}
        style={styles.card}
        onPress={() => abrirClub(h)}
        accessibilityRole="button"
        accessibilityLabel={`Consulta con ${h.clubNombre}${noLeidos > 0 ? `, ${noLeidos} sin leer` : ''}`}
      >
        <View style={styles.clubIcono}>
          <Ionicons name="shield-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nombreFila}>
            <Text style={[styles.cardName, styles.cardNameGrupo]} numberOfLines={1}>{h.clubNombre}</Text>
            <View style={styles.grupoTag}>
              <Text style={styles.grupoTagTexto}>Club</Text>
            </View>
          </View>
          <Text style={[styles.cardMessage, noLeidos > 0 && styles.cardMessageSinLeer]} numberOfLines={1}>
            {ultimo ? `${ultimo.de === 'postulante' ? 'Tú: ' : ''}${ultimo.texto}` : ''}
          </Text>
        </View>
        <View style={styles.cardDerecha}>
          {ultimo ? <Text style={[styles.cardHora, noLeidos > 0 && styles.cardHoraSinLeer]}>{horaCorta(ultimo.enviadoEn)}</Text> : null}
          {noLeidos > 0 && (
            <View style={styles.contador} accessibilityLabel={`${noLeidos} respuestas sin leer`}>
              <Text style={styles.contadorTexto}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <EncabezadoMarca
        derecha={
          <AvatarMini
            uri={usuario?.fotoPerfil}
            iniciales={iniciales}
            onPress={() => router.push('/(deportista)/(tabs)/profile')}
          />
        }
      />
      <View style={styles.topbar}>
        <EncabezadoPantalla titulo="Chats" conVolver={false} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {(verTodas ? items : items.slice(0, VISIBLES)).map((it) => (it.tipo === 'grupo' ? tarjetaGrupo(it.grupo) : it.tipo === 'club' ? tarjetaClub(it.hilo) : tarjetaPersona(it.persona)))}

        {items.length > VISIBLES ? (
          <TouchableOpacity
            style={styles.verMasBtn}
            onPress={() => setVerTodas((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={verTodas ? 'Ver menos conversaciones' : 'Ver más conversaciones'}
          >
            <Text style={styles.verMasTexto}>
              {verTodas ? 'Ver menos' : `Ver más (${items.length - VISIBLES})`}
            </Text>
            <Ionicons name={verTodas ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
          </TouchableOpacity>
        ) : null}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Aún no tienes conversaciones</Text>
            <Text style={styles.emptyText}>
              Cuando hagas match con alguien, te aprueben en una actividad o le escribas a un club, podrás seguir la conversación desde aquí.
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
    topbar: { paddingHorizontal: espacio.xl },
    list: { paddingHorizontal: espacio.xl, paddingBottom: espacio.xxl + espacio.s },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.tarjeta, padding: espacio.m + 2, marginBottom: espacio.m, minHeight: 72,
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    clubIcono: { width: 46, height: 46, borderRadius: radio.control, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    nombreFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
    cardName: { color: c.text, ...tipo.seccion },
    cardNameGrupo: { flexShrink: 1 },
    grupoTag: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs, backgroundColor: c.chip, borderRadius: radio.control, paddingHorizontal: espacio.s, paddingVertical: 2 },
    grupoTagTexto: { color: c.accent, ...tipo.etiqueta },
    cardMessage: { color: c.textMuted, ...tipo.cuerpo, marginTop: 2 },
    cardMessageSinLeer: { color: c.text, fontWeight: '700' },
    cardMessageNuevo: { color: c.accent, ...tipo.cuerpoFuerte, marginTop: 2 },
    cardBloqueado: { color: c.danger, ...tipo.cuerpoFuerte, marginTop: 2 },
    cardDerecha: { alignItems: 'flex-end', gap: espacio.xs + 1 },
    horaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
    cardHora: { color: c.textMuted, ...tipo.etiqueta, fontWeight: '400' },
    cardHoraSinLeer: { color: c.primary, fontWeight: '700' },
    contador: {
      minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: espacio.xs + 2,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    contadorSilenciado: { backgroundColor: c.textMuted },
    contadorTexto: { color: SOBRE_COLOR, ...tipo.etiqueta, fontWeight: '700' },
    nuevoBadge: { backgroundColor: c.primary, borderRadius: radio.control, paddingHorizontal: espacio.s + 2, paddingVertical: espacio.xs },
    nuevoText: { color: SOBRE_COLOR, ...tipo.etiqueta, fontWeight: '700' },
    verMasBtn: {
      minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s - 2,
      borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
    },
    verMasTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    emptyState: { alignItems: 'center', paddingHorizontal: espacio.xxl + espacio.s, marginTop: 60, gap: espacio.s },
    emptyTitle: { color: c.text, ...tipo.seccion, marginTop: espacio.s },
    emptyText: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', lineHeight: 19 },
  });