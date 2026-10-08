import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import ReportarModal from '../../../components/ReportarModal';
import { Usuario, getSession } from '../../../services/auth';
import {
  Persona,
  aceptarSolicitud,
  calificacionDe,
  calificar,
  cancelarSolicitud,
  darLike,
  descartar,
  rechazarSolicitud,
  useMatches,
} from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function PerfilDeportistaScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const estado = useMatches();

  const params = useLocalSearchParams<{
    id: string; name: string; sport: string; level: string; age: string;
    compatibility: string; distance: string; bio: string; colorFrom: string; fotoUri: string;
  }>();

  // Se prefiere la persona real del store (trae datos como `leGustas`); los parámetros de la
  // ruta quedan solo como respaldo por si no se encuentra.
  const delStore =
    estado.catalogo.find((p) => p.id === params.id) ??
    estado.confirmados.find((p) => p.id === params.id) ??
    estado.solicitudes.find((p) => p.id === params.id);

  const persona: Persona = delStore ?? {
    id: params.id,
    name: params.name,
    sport: params.sport,
    level: params.level,
    age: params.age ? Number(params.age) : undefined,
    compatibility: Number(params.compatibility) || 0,
    distance: params.distance || undefined,
    bio: params.bio || undefined,
    colorFrom: params.colorFrom || '#7C3AED',
    fotoUri: params.fotoUri || null,
  };

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);
  const [calificando, setCalificando] = useState(false);
  const [reportando, setReportando] = useState(false);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  const esMatch = estado.confirmados.some((p) => p.id === persona.id);
  const esSolicitud = estado.solicitudes.some((p) => p.id === persona.id);
  const esEnviada = estado.enviadas.includes(persona.id);
  const miCalificacion = calificacionDe(estado, persona.id);

  function irAlChat(reemplazar: boolean) {
    const destino = {
      pathname: '/(deportista)/chat/[id]' as const,
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    };
    if (reemplazar) router.replace(destino);
    else router.push(destino);
  }

  function handlePasar() {
    descartar(persona.id);
    router.back();
  }

  function handleMeGusta() {
    const resultado = darLike(persona);
    if (resultado === 'match') setNuevoMatch(persona);
    else router.back();
  }

  function handleAceptar() {
    const aceptada = aceptarSolicitud(persona.id);
    if (aceptada) setNuevoMatch(aceptada);
  }

  function handleRechazar() {
    rechazarSolicitud(persona.id);
    router.back();
  }

  function handleCancelarSolicitud() {
    const primerNombre = persona.name.split(' ')[0];
    Alert.alert('Cancelar solicitud', `¿Quieres cancelar tu solicitud a ${primerNombre}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => {
          cancelarSolicitud(persona.id);
          router.back();
        },
      },
    ]);
  }

  function handleEnviarCalificacion(estrellas: number, comentario: string) {
    calificar(persona.id, estrellas, comentario);
    setCalificando(false);
  }

  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { top: insets.top + 12 }]}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setReportando(true)}
        style={[styles.reportButton, { top: insets.top + 12 }]}
        accessibilityLabel={`Reportar a ${persona.name}`}
      >
        <Ionicons name="flag-outline" size={17} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Avatar
          name={persona.name}
          colorFrom={persona.colorFrom}
          uri={persona.fotoUri}
          style={styles.foto}
          fontSize={56}
        >
          <View style={styles.compatBadge}>
            <Text style={styles.compatText}>{persona.compatibility}% compatible</Text>
          </View>
        </Avatar>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {persona.name}{persona.age ? `, ${persona.age}` : ''}
            </Text>
            {persona.distance ? <Text style={styles.distance}>{persona.distance}</Text> : null}
          </View>

          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{persona.sport}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{persona.level}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Sobre {persona.name.split(' ')[0]}</Text>
          <Text style={styles.bio}>
            {persona.bio || 'Todavía no agregó una biografía.'}
          </Text>
        </View>
      </ScrollView>

      {/* ACCIONES según la relación con esta persona */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        {esMatch ? (
          <>
            <TouchableOpacity style={styles.pillSecundario} onPress={() => setCalificando(true)}>
              <Ionicons
                name={miCalificacion ? 'star' : 'star-outline'}
                size={16}
                color={miCalificacion ? '#FACC15' : colors.accent}
              />
              <Text style={styles.pillSecundarioTexto}>
                {miCalificacion ? `Tu calificación: ${miCalificacion.estrellas}★` : 'Calificar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pillPrimario} onPress={() => irAlChat(false)}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
              <Text style={styles.pillPrimarioTexto}>Enviar mensaje</Text>
            </TouchableOpacity>
          </>
        ) : esSolicitud ? (
          <>
            <TouchableOpacity style={styles.rejectButton} onPress={handleRechazar}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.aceptarButton} onPress={handleAceptar}>
              <Ionicons name="checkmark" size={26} color="#fff" />
            </TouchableOpacity>
          </>
        ) : esEnviada ? (
          <>
            <View style={styles.pillSecundario}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.accent} />
              <Text style={styles.pillSecundarioTexto}>Solicitud enviada</Text>
            </View>
            <TouchableOpacity style={styles.pillCancelar} onPress={handleCancelarSolicitud}>
              <Text style={styles.pillCancelarTexto}>Cancelar solicitud</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.rejectButton} onPress={handlePasar}>
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={handleMeGusta}>
              <Ionicons name="heart" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <MatchModal
        visible={nuevoMatch !== null}
        miNombre={miNombre}
        miFoto={usuario?.fotoPerfil}
        nombre={nuevoMatch?.name ?? ''}
        colorFrom={nuevoMatch?.colorFrom ?? '#7C3AED'}
        fotoUri={nuevoMatch?.fotoUri}
        onEnviarMensaje={() => {
          setNuevoMatch(null);
          irAlChat(true);
        }}
        onCerrar={() => {
          setNuevoMatch(null);
          router.back();
        }}
      />

      <RatingModal
        visible={calificando}
        nombre={persona.name}
        calificacionActual={miCalificacion}
        onEnviar={handleEnviarCalificacion}
        onCerrar={() => setCalificando(false)}
      />

      {/* Reportar usuario (HU-42) */}
      <ReportarModal
        visible={reportando}
        onClose={() => setReportando(false)}
        tipo="usuario"
        objetivoId={persona.id}
        objetivoNombre={persona.name}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backButton: {
      position: 'absolute', left: 20, zIndex: 2,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    reportButton: {
      position: 'absolute', right: 20, zIndex: 2,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingBottom: 30 },
    foto: { width: '100%', height: 320 },
    compatBadge: {
      position: 'absolute', bottom: 16, right: 16,
      backgroundColor: 'rgba(11,15,25,0.75)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    compatText: { color: '#4ADE80', fontSize: 12, fontWeight: '800' },
    info: { padding: 20 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
    name: { color: c.text, fontSize: 22, fontWeight: '700' },
    distance: { color: c.textMuted, fontSize: 12 },
    tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    tag: { backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
    tagText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    bio: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
    actions: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14,
      paddingTop: 16, paddingHorizontal: 20, borderTopWidth: 1, borderColor: c.border,
    },
    rejectButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    acceptButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: '#DB2777',
      alignItems: 'center', justifyContent: 'center',
    },
    aceptarButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: '#16A34A',
      alignItems: 'center', justifyContent: 'center',
    },
    pillPrimario: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14,
    },
    pillPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
    pillSecundario: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14,
    },
    pillSecundarioTexto: { color: c.text, fontSize: 13, fontWeight: '700' },
    pillCancelar: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: c.danger, borderRadius: 14, paddingVertical: 14,
    },
    pillCancelarTexto: { color: c.danger, fontSize: 13, fontWeight: '700' },
  });