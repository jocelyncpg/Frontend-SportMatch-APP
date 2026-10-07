import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '../../../components/Avatar';
import BrandLogo from '../../../components/BrandLogo';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import { Usuario, getSession } from '../../../services/auth';
import {
  Persona,
  aceptarSolicitud,
  calificacionDe,
  calificar,
  rechazarSolicitud,
  useMatches,
} from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function MatchesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const estado = useMatches();
  const { solicitudes, confirmados } = estado;
  const [tab, setTab] = useState<'solicitudes' | 'confirmados'>('solicitudes');
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [calificando, setCalificando] = useState<Persona | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  function aceptar(id: string) {
    const persona = aceptarSolicitud(id);
    if (persona) setNuevoMatch(persona);
  }

  function rechazar(id: string) {
    rechazarSolicitud(id);
  }

  function abrirChat(persona: Persona) {
    router.push({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    });
  }

  function verPerfil(persona: Persona) {
    router.push({
      pathname: '/(deportista)/perfil/[id]',
      params: {
        id: persona.id,
        name: persona.name,
        sport: persona.sport,
        level: persona.level,
        age: persona.age?.toString() ?? '',
        compatibility: persona.compatibility.toString(),
        distance: persona.distance ?? '',
        bio: persona.bio ?? '',
        colorFrom: persona.colorFrom,
        fotoUri: persona.fotoUri ?? '',
      },
    });
  }

  function enviarMensajeDesdeMatch() {
    const persona = nuevoMatch;
    setNuevoMatch(null);
    if (persona) abrirChat(persona);
  }

  function handleEnviarCalificacion(estrellas: number, comentario: string) {
    if (!calificando) return;
    calificar(calificando.id, estrellas, comentario);
    setCalificando(null);
  }

  const lista = tab === 'solicitudes' ? solicitudes : confirmados;
  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';
  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.topbar}>
        <BrandLogo width={200} />

        <TouchableOpacity
          onPress={() => router.push('/(deportista)/(tabs)/profile')}
          style={styles.miniAvatar}
        >
          {usuario?.fotoPerfil ? (
            <Image source={{ uri: usuario.fotoPerfil }} style={styles.miniAvatarImage} />
          ) : (
            <Text style={styles.miniAvatarText}>{iniciales}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'solicitudes' && styles.tabActive]}
          onPress={() => setTab('solicitudes')}
        >
          <Text style={[styles.tabText, tab === 'solicitudes' && styles.tabTextActive]}>
            Solicitudes {solicitudes.length > 0 ? `(${solicitudes.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'confirmados' && styles.tabActive]}
          onPress={() => setTab('confirmados')}
        >
          <Text style={[styles.tabText, tab === 'confirmados' && styles.tabTextActive]}>
            Confirmados {confirmados.length > 0 ? `(${confirmados.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView contentContainerStyle={styles.list}>
        {lista.map((persona) => {
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
                </View>
              </TouchableOpacity>

              {tab === 'solicitudes' ? (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.rejectButton} onPress={() => rechazar(persona.id)}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptButton} onPress={() => aceptar(persona.id)}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
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

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {tab === 'solicitudes'
              ? 'No tienes solicitudes pendientes.'
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
    container: { flex: 1, backgroundColor: c.bg, paddingTop: 60 },
    topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
    miniAvatar: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    miniAvatarImage: { width: '100%', height: '100%' },
    miniAvatarText: { color: c.text, fontSize: 12, fontWeight: '700' },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    tab: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    list: { paddingHorizontal: 20, paddingBottom: 30 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, padding: 10, marginBottom: 10,
    },
    cardTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 56, height: 56, borderRadius: 12 },
    avatarOverlay: { alignItems: 'flex-end', padding: 4 },
    badge: { backgroundColor: c.badgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: c.success, fontSize: 9, fontWeight: '700' },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8 },
    rejectButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.subtle, alignItems: 'center', justifyContent: 'center' },
    acceptButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
    chatButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    ratingButton: {
      flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, height: 34, borderRadius: 17,
      backgroundColor: c.chip, justifyContent: 'center',
    },
    ratingButtonHecho: { backgroundColor: c.badgeBg, borderWidth: 1, borderColor: '#FACC15' },
    ratingButtonTexto: { color: '#FACC15', fontSize: 11, fontWeight: '800' },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 30 },
  });