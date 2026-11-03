import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import { AvatarMini, EncabezadoMarca } from '../../../components/ui';
import { Usuario, getSession } from '../../../services/auth';
import {
  Persona,
  aceptarSolicitud,
  calificacionDe,
  calificar,
  rechazarSolicitud,
  useMatches,
} from '../../../services/matchStore';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Colores fijos: texto sobre botones de color fuerte, estrella de calificación y botón de aceptar.
const SOBRE_COLOR = '#FFFFFF';
const ESTRELLA = '#FACC15';
const VERDE_ACEPTAR = '#16A34A';

// Cuántas personas se ven en cada pestaña antes de tocar "Ver más".
const VISIBLES = 5;

export default function MatchesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const estado = useMatches();
  const { solicitudes, confirmados } = estado;
  const [tab, setTab] = useState<'solicitudes' | 'confirmados'>('solicitudes');
  const [verTodas, setVerTodas] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [calificando, setCalificando] = useState<Persona | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  function cambiarTab(t: 'solicitudes' | 'confirmados') {
    setTab(t);
    setVerTodas(false);
  }

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
  const visibles = verTodas ? lista : lista.slice(0, VISIBLES);
  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';
  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <EncabezadoMarca
        derecha={
          <AvatarMini
            uri={usuario?.fotoPerfil}
            iniciales={iniciales}
            onPress={() => router.push('/(deportista)/(tabs)/profile')}
          />
        }
      />

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'solicitudes' && styles.tabActive]}
          onPress={() => cambiarTab('solicitudes')}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'solicitudes' }}
        >
          <Text style={[styles.tabText, tab === 'solicitudes' && styles.tabTextActive]}>
            Solicitudes {solicitudes.length > 0 ? `(${solicitudes.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === 'confirmados' && styles.tabActive]}
          onPress={() => cambiarTab('confirmados')}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'confirmados' }}
        >
          <Text style={[styles.tabText, tab === 'confirmados' && styles.tabTextActive]}>
            Confirmados {confirmados.length > 0 ? `(${confirmados.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView contentContainerStyle={styles.list}>
        {visibles.map((persona) => {
          const miCalificacion = calificacionDe(estado, persona.id);
          return (
            <View key={persona.id} style={styles.card}>

              {/* Zona tocable: abre el perfil completo */}
              <TouchableOpacity
                style={styles.cardTap}
                onPress={() => verPerfil(persona)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Ver perfil de ${persona.name}`}
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
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => rechazar(persona.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rechazar a ${persona.name}`}
                  >
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => aceptar(persona.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Aceptar a ${persona.name}`}
                  >
                    <Ionicons name="checkmark" size={20} color={SOBRE_COLOR} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.ratingButton, miCalificacion && styles.ratingButtonHecho]}
                    onPress={() => setCalificando(persona)}
                    accessibilityRole="button"
                    accessibilityLabel={miCalificacion ? `Tu calificación a ${persona.name}: ${miCalificacion.estrellas}` : `Calificar a ${persona.name}`}
                  >
                    <Ionicons
                      name={miCalificacion ? 'star' : 'star-outline'}
                      size={18}
                      color={miCalificacion ? ESTRELLA : colors.textMuted}
                    />
                    {miCalificacion ? (
                      <Text style={styles.ratingButtonTexto}>{miCalificacion.estrellas}</Text>
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => abrirChat(persona)}
                    accessibilityRole="button"
                    accessibilityLabel={`Escribir a ${persona.name}`}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              )}

            </View>
          );
        })}

        {lista.length > VISIBLES ? (
          <TouchableOpacity
            style={styles.verMasBtn}
            onPress={() => setVerTodas((v) => !v)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={verTodas ? 'Ver menos personas' : 'Ver más personas'}
          >
            <Text style={styles.verMasTexto}>
              {verTodas ? 'Ver menos' : `Ver más (${lista.length - VISIBLES})`}
            </Text>
            <Ionicons name={verTodas ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
          </TouchableOpacity>
        ) : null}

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
    container: { flex: 1, backgroundColor: c.bg },
    tabs: { flexDirection: 'row', paddingHorizontal: espacio.xl, gap: espacio.s, marginBottom: espacio.l },
    tab: {
      flex: 1, minHeight: 44, backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.control, alignItems: 'center', justifyContent: 'center',
    },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textMuted, ...tipo.cuerpoFuerte },
    tabTextActive: { color: SOBRE_COLOR },
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
    acceptButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: VERDE_ACEPTAR, alignItems: 'center', justifyContent: 'center' },
    chatButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    ratingButton: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.xs, paddingHorizontal: espacio.m, height: 44, minWidth: 44, borderRadius: 22,
      backgroundColor: c.chip, justifyContent: 'center',
    },
    ratingButtonHecho: { backgroundColor: c.badgeBg, borderWidth: 1, borderColor: ESTRELLA },
    ratingButtonTexto: { color: ESTRELLA, ...tipo.cuerpoFuerte, fontWeight: '800' },
    verMasBtn: {
      minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s - 2,
      borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
    },
    verMasTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    emptyText: { color: c.textMuted, ...tipo.cuerpo, textAlign: 'center', marginTop: espacio.xxl + espacio.s },
  });