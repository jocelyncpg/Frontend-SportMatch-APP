import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import RatingModal from '../../../components/RatingModal';
import ReportarModal from '../../../components/ReportarModal';
import { Boton } from '../../../components/ui';
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
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Colores que se usan sobre la foto o sobre un botón de color fuerte: no cambian con el tema.
const SOBRE_COLOR = '#FFFFFF';
const FONDO_SOBRE_FOTO = 'rgba(11,15,25,0.6)';
const VERDE_SOBRE_FOTO = '#4ADE80';
const VERDE_ACEPTAR = '#16A34A';

/** La distancia siempre con su unidad: "3.4" → "3.4 km"; "800 m" y "1.8 km" quedan como están. */
function textoDistancia(d?: string): string | null {
  const t = d?.trim();
  if (!t) return null;
  return /\b(km|m)\b/i.test(t) ? t : `${t} km`;
}

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
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

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
  const tieneFoto = !!persona.fotoUri;
  const distancia = textoDistancia(persona.distance);

  // La foto se muestra con su proporción real (sin recortarla), dentro de un rango razonable.
  const [proporcion, setProporcion] = useState<number | null>(null);
  useEffect(() => {
    setProporcion(null);
    const uri = persona.fotoUri;
    if (!uri) return;
    let activo = true;
    Image.getSize(
      uri,
      (w, hh) => { if (activo && w > 0 && hh > 0) setProporcion(w / hh); },
      () => undefined,
    );
    return () => { activo = false; };
  }, [persona.fotoUri]);
  const proporcionFoto = tieneFoto ? Math.min(1.3, Math.max(0.7, proporcion ?? 0.8)) : 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + espacio.s }]}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Ionicons name="arrow-back" size={20} color={SOBRE_COLOR} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setReportando(true)}
        style={[styles.reportButton, { top: insets.top + espacio.s }]}
        accessibilityRole="button"
        accessibilityLabel={`Reportar a ${persona.name}`}
      >
        <Ionicons name="flag-outline" size={19} color={SOBRE_COLOR} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Tocar la foto la abre completa, sin recortar */}
        <TouchableOpacity
          activeOpacity={tieneFoto ? 0.9 : 1}
          onPress={() => tieneFoto && setFotoAmpliada(true)}
          accessibilityRole={tieneFoto ? 'button' : undefined}
          accessibilityLabel={tieneFoto ? `Ampliar foto de ${persona.name}` : undefined}
        >
          <Avatar
            name={persona.name}
            colorFrom={persona.colorFrom}
            uri={persona.fotoUri}
            style={[styles.foto, { aspectRatio: proporcionFoto }]}
            fontSize={56}
          >
            {tieneFoto ? (
              <View style={styles.ampliarBadge} pointerEvents="none">
                <Ionicons name="expand-outline" size={16} color={SOBRE_COLOR} />
              </View>
            ) : null}
            <View style={styles.compatBadge}>
              <Text style={styles.compatText}>{persona.compatibility}% compatible</Text>
            </View>
          </Avatar>
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.name}>
            {persona.name}{persona.age ? `, ${persona.age}` : ''}
          </Text>

          {distancia ? (
            <View style={styles.distanciaFila}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.distance}>A {distancia} de ti</Text>
            </View>
          ) : null}

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
      <View style={[styles.actions, { paddingBottom: insets.bottom + espacio.l }]}>
        {esMatch ? (
          <>
            <Boton
              variante="secundario"
              icono={miCalificacion ? 'star' : 'star-outline'}
              texto={miCalificacion ? `Tu calificación: ${miCalificacion.estrellas}★` : 'Calificar'}
              onPress={() => setCalificando(true)}
              style={styles.accionFlex}
            />
            <Boton
              icono="chatbubble-ellipses"
              texto="Enviar mensaje"
              onPress={() => irAlChat(false)}
              style={styles.accionFlex}
            />
          </>
        ) : esSolicitud ? (
          <>
            <TouchableOpacity style={styles.rejectButton} onPress={handleRechazar} accessibilityRole="button" accessibilityLabel="Rechazar solicitud">
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.aceptarButton} onPress={handleAceptar} accessibilityRole="button" accessibilityLabel="Aceptar solicitud">
              <Ionicons name="checkmark" size={26} color={SOBRE_COLOR} />
            </TouchableOpacity>
          </>
        ) : esEnviada ? (
          <>
            <View style={styles.enviada}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.accent} />
              <Text style={styles.enviadaTexto}>Solicitud enviada</Text>
            </View>
            <Boton variante="peligro" texto="Cancelar solicitud" onPress={handleCancelarSolicitud} style={styles.accionFlex} />
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.rejectButton} onPress={handlePasar} accessibilityRole="button" accessibilityLabel="Pasar">
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={handleMeGusta} accessibilityRole="button" accessibilityLabel="Me gusta">
              <Ionicons name="heart" size={24} color={SOBRE_COLOR} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* FOTO AMPLIADA: se ve completa (contain), se cierra tocando en cualquier parte o con la X */}
      <Modal
        visible={fotoAmpliada}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFotoAmpliada(false)}
      >
        <Pressable style={styles.visorFondo} onPress={() => setFotoAmpliada(false)}>
          {persona.fotoUri ? (
            <Image source={{ uri: persona.fotoUri }} style={styles.visorImagen} resizeMode="contain" />
          ) : null}

          <TouchableOpacity
            onPress={() => setFotoAmpliada(false)}
            style={[styles.visorCerrar, { top: insets.top + espacio.m }]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar foto"
          >
            <Ionicons name="close" size={22} color={SOBRE_COLOR} />
          </TouchableOpacity>

          <View style={[styles.visorPie, { paddingBottom: insets.bottom + 20 }]} pointerEvents="none">
            <Text style={styles.visorNombre}>
              {persona.name}{persona.age ? `, ${persona.age}` : ''}
            </Text>
          </View>
        </Pressable>
      </Modal>

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
      position: 'absolute', left: espacio.l, zIndex: 2,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: FONDO_SOBRE_FOTO,
      alignItems: 'center', justifyContent: 'center',
    },
    reportButton: {
      position: 'absolute', right: espacio.l, zIndex: 2,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: FONDO_SOBRE_FOTO,
      alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingBottom: espacio.xxl + espacio.s },
    foto: { width: '100%' },
    compatBadge: {
      position: 'absolute', bottom: espacio.l, right: espacio.l,
      backgroundColor: FONDO_SOBRE_FOTO, paddingHorizontal: espacio.m, paddingVertical: espacio.s - 2, borderRadius: radio.tarjeta + 4,
    },
    compatText: { color: VERDE_SOBRE_FOTO, ...tipo.cuerpoFuerte, fontWeight: '800' },
    ampliarBadge: {
      position: 'absolute', bottom: espacio.l, left: espacio.l,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: FONDO_SOBRE_FOTO, alignItems: 'center', justifyContent: 'center',
    },
    info: { padding: espacio.xl },
    // Nombre del perfil: es el dato principal, por eso queda fuera de la escala de texto.
    name: { color: c.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
    distanciaFila: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2, marginTop: espacio.xs + 2 },
    distance: { color: c.textMuted, ...tipo.cuerpo, flexShrink: 1 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginTop: espacio.l, marginBottom: espacio.xl },
    tag: { backgroundColor: c.chip, borderRadius: radio.control, paddingHorizontal: espacio.m, paddingVertical: espacio.s - 1 },
    tagText: { color: c.accent, ...tipo.cuerpoFuerte },
    sectionTitle: { color: c.text, ...tipo.seccion, marginBottom: espacio.s },
    bio: { color: c.textMuted, ...tipo.cuerpo, fontSize: 14, lineHeight: 21 },
    actions: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: espacio.l,
      paddingTop: espacio.l, paddingHorizontal: espacio.xl, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.bg,
    },
    accionFlex: { flex: 1 },
    rejectButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    acceptButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    aceptarButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: VERDE_ACEPTAR,
      alignItems: 'center', justifyContent: 'center',
    },
    enviada: {
      flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacio.s,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
    },
    enviadaTexto: { color: c.text, ...tipo.cuerpoFuerte },

    // Visor de foto (siempre oscuro, como un visor de imágenes)
    visorFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
    visorImagen: { width: '100%', height: '100%' },
    visorCerrar: {
      position: 'absolute', right: espacio.xl,
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
    },
    visorPie: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingTop: espacio.m },
    visorNombre: { color: SOBRE_COLOR, ...tipo.seccion },
  });