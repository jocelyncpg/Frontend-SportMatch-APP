import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '../../../components/Avatar';
import { AvatarMini, EncabezadoMarca } from '../../../components/ui';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import { useMatchingRefresh } from '../../../hooks/useMatchingRefresh';
import { Usuario, getSession } from '../../../services/auth';
import {
  Persona,
  aceptarSolicitud,
  calificacionDe,
  calificar,
  cancelarSolicitud,
  cargarCalificaciones,
  cargarMatching,
  rechazarSolicitud,
  useMatches,
} from '../../../services/matchStore';
import { Colors, useAppTheme, espacio, radio, tipo } from '../../../theme/ThemeContext';

export default function MatchesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useMatchingRefresh();
  // Las estrellas que ya diste se muestran en cada match confirmado.
  useFocusEffect(useCallback(() => { cargarCalificaciones().catch(() => {}); }, []));
  const estado = useMatches();
  const { solicitudes, solicitudesEnviadas, confirmados, ocupados, matchingError, sesionExpirada } = estado;
  const [tab, setTab] = useState<'solicitudes' | 'enviadas' | 'confirmados'>('solicitudes');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [calificando, setCalificando] = useState<Persona | null>(null);

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

  // El chat y el perfil se abren por id: los datos los entrega el servidor, no la URL.
  function abrirChat(persona: Persona) {
    if (!persona.matchId) return;
    router.push({ pathname: '/(deportista)/chat/[id]', params: { id: persona.matchId } });
  }

  function verPerfil(persona: Persona) {
    router.push({
      pathname: '/(deportista)/perfil/[id]',
      params: persona.matchId ? { id: persona.id, matchId: persona.matchId } : { id: persona.id },
    });
  }

  function enviarMensajeDesdeMatch() {
    const persona = nuevoMatch;
    setNuevoMatch(null);
    if (persona) abrirChat(persona);
  }

  async function handleEnviarCalificacion(estrellas: number, comentario: string) {
    if (!calificando) return;
    try {
      await calificar(calificando.id, estrellas, comentario);
      setCalificando(null);
    } catch (e) {
      Alert.alert('No se pudo calificar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  const [verTodas, setVerTodas] = useState(false);
  const lista = tab === 'solicitudes' ? solicitudes : tab === 'enviadas' ? solicitudesEnviadas : confirmados;
  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';
  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <EncabezadoMarca derecha={<AvatarMini uri={usuario?.fotoPerfil} iniciales={iniciales} onPress={() => router.push('/(deportista)/(tabs)/profile')} />} />

      {/* TABS */}
      <View style={styles.tabs}>
        {([
          ['solicitudes', 'Solicitudes', solicitudes.length],
          ['enviadas', 'Enviadas', solicitudesEnviadas.length],
          ['confirmados', 'Confirmados', confirmados.length],
        ] as const).map(([key, label, count]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => { setTab(key); setVerTodas(false); }} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {label}{count > 0 ? ` (${count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTA */}
      <ScrollView contentContainerStyle={styles.list}>
        {matchingError ? (
          <TouchableOpacity onPress={() => sesionExpirada ? router.replace('/(auth)/login') : void cargarMatching()}>
            <Text style={styles.emptyText}>{matchingError} · {sesionExpirada ? 'Iniciar sesión' : 'Reintentar'}</Text>
          </TouchableOpacity>
        ) : null}
        {!matchingError && (verTodas ? lista : lista.slice(0, 5)).map((persona) => {
          const ocupado = ocupados.includes(persona.id);
          const miCalificacion = calificacionDe(estado, persona.id);
          return (
            <View key={persona.id} style={styles.card}>

              {/* Zona tocable: abre el perfil completo */}
              <TouchableOpacity
                style={styles.cardTap}
                onPress={() => verPerfil(persona)}
                activeOpacity={0.7}
              >
                <Avatar
                  name={persona.name}
                  colorFrom={persona.colorFrom}
                  uri={persona.fotoUri}
                  style={styles.avatar}
                  fontSize={18}
                  overlayStyle={styles.avatarOverlay}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{persona.compatibility}%</Text>
                  </View>
                </Avatar>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{persona.name}</Text>
                  <Text style={styles.cardMeta}>{persona.sport} · {persona.level}</Text>
                  {tab === 'enviadas' ? <Text style={styles.cardMeta}>Pendiente de respuesta</Text> : null}
                </View>
              </TouchableOpacity>

              {tab === 'solicitudes' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.rejectButton} onPress={() => rechazar(persona.id)} disabled={ocupado}
                    accessibilityLabel={`Rechazar solicitud de ${persona.name}`}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptButton} onPress={() => aceptar(persona.id)} disabled={ocupado}
                    accessibilityLabel={`Aceptar solicitud de ${persona.name}`}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : tab === 'enviadas' ? (
                <TouchableOpacity style={styles.cancelButton} onPress={() => cancelar(persona.id)} disabled={ocupado}
                  accessibilityLabel={`Cancelar solicitud a ${persona.name}`}>
                  <Text style={styles.cancelText}>{ocupado ? 'Cancelando...' : 'Cancelar'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.ratingButton, miCalificacion && styles.ratingButtonHecho]}
                    onPress={() => setCalificando(persona)}
                  >
                    <Ionicons
                      name={miCalificacion ? 'star' : 'star-outline'}
                      size={15}
                      color={miCalificacion ? '#FACC15' : colors.textMuted}
                    />
                    {miCalificacion ? (
                      <Text style={styles.ratingButtonTexto}>{miCalificacion.estrellas}</Text>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chatButton} onPress={() => abrirChat(persona)}>
                    <Ionicons name="chatbubble-outline" size={16} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              )}

            </View>
          );
        })}

        {!matchingError && lista.length === 0 && (
          <Text style={styles.emptyText}>
            {tab === 'solicitudes'
              ? 'No tienes solicitudes pendientes.'
              : tab === 'enviadas'
                ? 'No tienes solicitudes esperando respuesta.'
                : 'Todavía no tienes matches confirmados.'}
          </Text>
        )}
        {lista.length > 5 ? <TouchableOpacity onPress={() => setVerTodas((v) => !v)} style={{ padding: espacio.l }}><Text style={styles.emptyText}>{verTodas ? 'Ver menos' : `Ver más (${lista.length - 5})`}</Text></TouchableOpacity> : null}
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

      {/* CALIFICAR */}
      <RatingModal
        visible={calificando !== null}
        nombre={calificando?.name ?? ''}
        calificacionActual={calificando ? calificacionDe(estado, calificando.id) : undefined}
        onEnviar={handleEnviarCalificacion}
        onCerrar={() => setCalificando(null)}
      />

    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    cancelButton: { backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10 },
    cancelText: { color: c.text, fontSize: 12, fontWeight: '600' },
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
    miniAvatar: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    miniAvatarImage: { width: '100%', height: '100%' },
    miniAvatarText: { color: c.text, fontSize: 12, fontWeight: '700' },
    tabs: { flexDirection: 'row', paddingHorizontal: espacio.xl, gap: espacio.s, marginBottom: espacio.l },
    tab: {
      flex: 1, minHeight: 44, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.control, alignItems: 'center', justifyContent: 'center',
    },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textMuted, ...tipo.cuerpoFuerte },
    tabTextActive: { color: '#FFFFFF' },
    list: { paddingHorizontal: espacio.xl, paddingBottom: espacio.xxl + espacio.s },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.tarjeta, padding: espacio.m, marginBottom: espacio.m,
    },
    cardTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m },
    avatar: { width: 56, height: 56, borderRadius: radio.control },
    avatarOverlay: { alignItems: 'flex-end', padding: espacio.xs },
    badge: { backgroundColor: c.badgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radio.control },
    badgeText: { color: c.success, ...tipo.etiqueta, fontWeight: '700' },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, ...tipo.seccion },
    cardMeta: { color: c.textMuted, ...tipo.dato, marginTop: 2 },
    actions: { flexDirection: 'row', gap: espacio.s },
    rejectButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.subtle, alignItems: 'center', justifyContent: 'center' },
    acceptButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
    chatButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    ratingButton: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.xs, paddingHorizontal: espacio.m, height: 44, minWidth: 44, borderRadius: 22,
      backgroundColor: c.chip, justifyContent: 'center',
    },
    ratingButtonHecho: { backgroundColor: c.badgeBg, borderWidth: 1, borderColor: '#FACC15' },
    ratingButtonTexto: { color: '#FACC15', ...tipo.cuerpoFuerte, fontWeight: '800' },
    emptyText: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', marginTop: espacio.xxl + espacio.s },
  });