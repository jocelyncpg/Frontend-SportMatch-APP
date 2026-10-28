import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapaUbicacion from '../../../components/MapaUbicacion';
import { NOMBRES_NIVEL, YO } from '../../../services/actividades';
import { Usuario, getSession } from '../../../services/auth';
import { idHilo, useConvocatoria, useHilo } from '../../../services/consultas';
import { usePerfilClub } from '../../../services/perfilClub';
import { PerfilPostulante, idPostulacion, postular, retirarPostulacion, usePostulacion } from '../../../services/postulaciones';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

type Contacto = { icono: React.ComponentProps<typeof Ionicons>['name']; etiqueta: string; valor: string; url: string };

// El sitio web puede venir sin esquema: se abre siempre como https.
const conEsquema = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-11-10" → "Mar 10 nov 2026", el mismo estilo de fechas que usa Actividades. */
function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

function abrirEnlace(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir', 'No se pudo abrir el enlace en este dispositivo.'));
}

export default function ClubProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { id, name, sport, comuna, colorFrom } = useLocalSearchParams<{ id: string; name: string; sport: string; comuna: string; colorFrom: string }>();
  const clubId = id ?? '';
  // Lo que el club editó en "Mi club"; si aún no lo edita, se muestra lo que llegó al abrir la pantalla.
  const perfil = usePerfilClub(clubId);
  // Mientras el dedo mueve el mapa, la pantalla no debe hacer scroll.
  const [scrollActivo, setScrollActivo] = useState(true);

  // Cuenta con la que se inició sesión: de ahí sale el nombre y el nivel con que el club ve tu postulación.
  const [sesion, setSesion] = useState<Usuario | null>(null);
  useEffect(() => {
    getSession().then(setSesion);
  }, []);

  // La convocatoria la publica el club desde su panel (HU-51); aquí se ve la versión actual.
  const convocatoria = useConvocatoria(clubId);
  const abierta = convocatoria?.abierta === true;
  const hilo = useHilo(idHilo(clubId, YO));
  const noLeidos = hilo?.noLeidosPostulante ?? 0;

  // Postulación (HU-33): una retirada se trata como si no hubiera postulado.
  const postulacion = usePostulacion(clubId, YO);
  const estado = postulacion && postulacion.estado !== 'retirada' ? postulacion.estado : null;

  function miPerfil(): PerfilPostulante {
    const deportes = sesion?.deportes ?? [];
    const delClub = deportes.find((d) => d.nombre === sport) ?? deportes[0];
    return {
      id: YO,
      nombre: sesion ? `${sesion.nombre} ${sesion.apellidoPaterno}`.trim() : 'Postulante',
      deporte: sport || delClub?.nombre || 'Sin deporte',
      nivel: delClub ? NOMBRES_NIVEL[delClub.nivel] ?? 'Sin nivel' : 'Sin nivel',
      colorFrom: colorFrom ?? '#7C3AED',
      fotoUri: sesion?.fotoPerfil ?? null,
    };
  }

  function enviarPostulacion() {
    const r = postular(clubId, miPerfil());
    if (!r.ok) {
      Alert.alert('No se pudo postular', r.motivo);
      return;
    }
    const prueba = convocatoria?.fecha ? ` La prueba es el ${fechaCorta(convocatoria.fecha)}.` : '';
    Alert.alert('Postulación enviada', `El club revisará tu perfil y te avisaremos con el resultado.${prueba}`);
  }

  function confirmarRetiro() {
    Alert.alert('Retirar postulación', '¿Quieres retirar tu postulación a esta convocatoria?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Retirar',
        style: 'destructive',
        onPress: () => {
          const r = retirarPostulacion(idPostulacion(clubId, YO));
          if (!r.ok) Alert.alert('No se pudo retirar', r.motivo);
        },
      },
    ]);
  }

  function abrirConsultas() {
    router.push({ pathname: '/(deportista)/chat-club/[id]', params: { id: clubId } } as never);
  }

  const lugar = [perfil?.direccion, perfil?.zona].filter(Boolean).join(' · ');
  const tieneMapa = perfil?.latitud != null && perfil?.longitud != null;
  const contactos: Contacto[] = [];
  if (perfil?.telefono) contactos.push({ icono: 'call-outline', etiqueta: 'Teléfono', valor: perfil.telefono, url: `tel:${perfil.telefono.replace(/[^\d+]/g, '')}` });
  if (perfil?.email) contactos.push({ icono: 'mail-outline', etiqueta: 'Correo', valor: perfil.email, url: `mailto:${perfil.email}` });
  if (perfil?.web && !/\s/.test(perfil.web)) contactos.push({ icono: 'globe-outline', etiqueta: 'Sitio web', valor: perfil.web, url: conEsquema(perfil.web) });
  if (perfil?.instagram && !/\s/.test(perfil.instagram)) {
    const usuario = perfil.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/+$/, '');
    if (usuario) contactos.push({ icono: 'logo-instagram', etiqueta: 'Instagram', valor: `@${usuario}`, url: `https://instagram.com/${usuario}` });
  }

  // Detalle completo de la convocatoria: lo que necesitas saber antes y después de postular.
  const filas: { etiqueta: string; valor: string }[] = convocatoria
    ? [
        { etiqueta: 'Deporte', valor: convocatoria.deporte ?? '' },
        { etiqueta: 'Categoría / edad', valor: convocatoria.categoria ?? '' },
        { etiqueta: 'Fecha de la prueba', valor: convocatoria.fecha ? fechaCorta(convocatoria.fecha) : '' },
        { etiqueta: 'Cupos', valor: convocatoria.cupos !== undefined ? String(convocatoria.cupos) : '' },
        { etiqueta: 'Requisitos', valor: convocatoria.requisitos ?? '' },
      ].filter((f) => f.valor !== '')
    : [];
  const detalle =
    filas.length > 0 ? (
      <View style={styles.detalle}>
        {filas.map((f) => (
          <View key={f.etiqueta} style={styles.detalleFila}>
            <Text style={styles.detalleEtiqueta}>{f.etiqueta}</Text>
            <Text style={styles.detalleValor}>{f.valor}</Text>
          </View>
        ))}
      </View>
    ) : null;

  // Resultado de tu postulación (se ve aunque la convocatoria ya esté cerrada).
  const bloqueEstado =
    estado === 'pendiente' ? (
      <>
        <View style={styles.pendienteBadge}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.pendienteText}>Postulación enviada · en revisión</Text>
        </View>
        <TouchableOpacity onPress={confirmarRetiro} style={styles.retirarButton} accessibilityLabel="Retirar postulación">
          <Text style={styles.retirarText}>Retirar postulación</Text>
        </TouchableOpacity>
      </>
    ) : estado === 'preseleccionada' ? (
      <>
        <View style={styles.preseleccionBadge}>
          <Ionicons name="star" size={16} color={colors.accent} />
          <Text style={styles.preseleccionText}>El club te preseleccionó · falta su respuesta final</Text>
        </View>
        <TouchableOpacity onPress={confirmarRetiro} style={styles.retirarButton} accessibilityLabel="Retirar postulación">
          <Text style={styles.retirarText}>Retirar postulación</Text>
        </TouchableOpacity>
      </>
    ) : estado === 'aceptada' ? (
      <View style={styles.postuladoBadge}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={styles.postuladoText}>¡El club aceptó tu postulación!</Text>
      </View>
    ) : estado === 'rechazada' ? (
      <View style={styles.rechazadoBadge}>
        <Ionicons name="close-circle" size={16} color={colors.danger} />
        <Text style={styles.rechazadoText}>El club no aceptó tu postulación</Text>
      </View>
    ) : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 60 }]}
      scrollEnabled={scrollActivo}
    >
      <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { top: insets.top + 12 }]} accessibilityLabel="Volver">
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.avatar}>
        <Ionicons name="shield-outline" size={38} color={colors.accent} />
      </View>
      <Text style={styles.name}>{perfil?.nombre || name}</Text>
      <Text style={styles.meta}>{[sport, perfil?.zona || comuna].map((x) => x?.trim()).filter(Boolean).join(' · ')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre el club</Text>
        <Text style={styles.sectionText}>
          {perfil?.descripcion ||
            'Club deportivo con entrenamientos regulares y espacio para nuevos integrantes que quieran competir y mejorar su nivel.'}
        </Text>
      </View>

      {abierta && convocatoria ? (
        <View style={styles.convocatoria}>
          <View style={styles.convocatoriaHeader}>
            <Ionicons name="megaphone-outline" size={16} color={colors.success} />
            <Text style={styles.convocatoriaTitle}>Convocatoria abierta</Text>
          </View>
          <Text style={styles.convocatoriaNombre}>{convocatoria.titulo}</Text>
          {convocatoria.descripcion ? <Text style={styles.convocatoriaText}>{convocatoria.descripcion}</Text> : null}
          {detalle}

          {bloqueEstado ?? (
            <TouchableOpacity style={styles.postularButton} onPress={enviarPostulacion}>
              <Text style={styles.postularButtonText}>Postular a esta convocatoria</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <View style={styles.convocatoria}>
            <View style={styles.convocatoriaHeader}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <Text style={styles.convocatoriaTitle}>Sin convocatoria abierta</Text>
            </View>
            {convocatoria && bloqueEstado ? (
              <>
                <Text style={styles.convocatoriaNombre}>{convocatoria.titulo}</Text>
                <Text style={styles.convocatoriaText}>La convocatoria ya está cerrada. Este es el detalle de tu postulación:</Text>
                {detalle}
              </>
            ) : (
              <Text style={[styles.convocatoriaText, !bloqueEstado && styles.sinMargen]}>
                Este club no tiene una convocatoria abierta por ahora.
              </Text>
            )}
            {bloqueEstado}
          </View>
        </>
      )}

      {lugar || tieneMapa ? (
        <View style={styles.tarjeta}>
          <View style={styles.convocatoriaHeader}>
            <Ionicons name="location-outline" size={16} color={colors.accent} />
            <Text style={styles.convocatoriaTitle}>Ubicación</Text>
          </View>
          {lugar ? <Text style={styles.lugarTexto}>{lugar}</Text> : null}
          {perfil && tieneMapa ? (
            <View style={styles.mapaWrap}>
              <MapaUbicacion
                latitud={perfil.latitud as number}
                longitud={perfil.longitud as number}
                titulo={perfil.nombre || name}
                onMoviendo={(moviendo) => setScrollActivo(!moviendo)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {contactos.length > 0 ? (
        <View style={styles.tarjeta}>
          <View style={styles.convocatoriaHeader}>
            <Ionicons name="call-outline" size={16} color={colors.accent} />
            <Text style={styles.convocatoriaTitle}>Contacto</Text>
          </View>
          {contactos.map((c) => (
            <TouchableOpacity key={c.etiqueta} style={styles.contactoFila} onPress={() => abrirEnlace(c.url)} accessibilityLabel={`${c.etiqueta}: ${c.valor}`}>
              <Ionicons name={c.icono} size={18} color={colors.textMuted} />
              <View style={styles.consultaTextos}>
                <Text style={styles.detalleEtiqueta}>{c.etiqueta}</Text>
                <Text style={styles.detalleValor}>{c.valor}</Text>
              </View>
              <Ionicons name="open-outline" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* HU-51: canal de consultas con el club */}
      {abierta || hilo ? (
        <TouchableOpacity style={styles.consultaButton} onPress={abrirConsultas} activeOpacity={0.8} accessibilityLabel="Abrir consultas con el club">
          <View style={styles.consultaIcono}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.consultaTextos}>
            <Text style={styles.consultaTitulo}>{hilo ? 'Mis consultas al club' : 'Hacer una consulta'}</Text>
            <Text style={styles.consultaSub}>
              {hilo ? (abierta ? 'Revisa las respuestas o escribe de nuevo' : 'La convocatoria está cerrada') : 'Resuelve tus dudas sobre pruebas y convocatoria'}
            </Text>
          </View>
          {noLeidos > 0 ? (
            <View style={styles.consultaBadge}>
              <Text style={styles.consultaBadgeTexto}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: espacio.xl, paddingBottom: 40, alignItems: 'center' },
    backButton: {
      position: 'absolute', left: espacio.xl, width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', zIndex: 1,
    },
    avatar: {
      width: 84, height: 84, borderRadius: 22, backgroundColor: c.chip,
      alignItems: 'center', justifyContent: 'center', marginBottom: espacio.m + 2,
    },
    name: { color: c.text, ...tipo.titulo },
    meta: { color: c.textMuted, ...tipo.dato, marginTop: 2, marginBottom: espacio.xl },

    section: { width: '100%', marginBottom: espacio.xl },
    sectionTitle: { color: c.text, ...tipo.cuerpoFuerte, marginBottom: espacio.s - 2 },
    sectionText: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19 },

    convocatoria: {
      width: '100%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.tarjeta, padding: espacio.l, marginBottom: espacio.m + 2,
    },
    convocatoriaHeader: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.s },
    convocatoriaTitle: { color: c.text, ...tipo.cuerpoFuerte },
    convocatoriaNombre: { color: c.text, ...tipo.seccion, marginBottom: espacio.xs },
    convocatoriaText: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, marginBottom: espacio.m + 2 },
    sinMargen: { marginBottom: 0 },

    detalle: { marginBottom: espacio.m + 2 },
    detalleFila: { paddingVertical: espacio.m - 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    detalleEtiqueta: { color: c.textMuted, ...tipo.etiqueta, textTransform: 'uppercase', letterSpacing: 0.3 },
    detalleValor: { color: c.text, ...tipo.cuerpo, lineHeight: 19, marginTop: 2 },

    postularButton: { backgroundColor: c.primary, borderRadius: radio.control, paddingVertical: 13, alignItems: 'center' },
    postularButtonText: { color: '#fff', ...tipo.cuerpoFuerte },

    postuladoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.successBg, borderRadius: radio.control, paddingVertical: espacio.m, justifyContent: 'center' },
    postuladoText: { color: c.success, ...tipo.cuerpoFuerte },
    preseleccionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.chip, borderRadius: radio.control, paddingVertical: espacio.m, paddingHorizontal: espacio.m - 2, justifyContent: 'center' },
    preseleccionText: { color: c.accent, ...tipo.cuerpoFuerte, flexShrink: 1, textAlign: 'center' },
    pendienteBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.chip, borderRadius: radio.control, paddingVertical: espacio.m, justifyContent: 'center' },
    pendienteText: { color: c.textMuted, ...tipo.cuerpoFuerte },
    rechazadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.dangerBg, borderRadius: radio.control, paddingVertical: espacio.m, justifyContent: 'center' },
    rechazadoText: { color: c.danger, ...tipo.cuerpoFuerte },
    retirarButton: { alignItems: 'center', paddingTop: espacio.m },
    retirarText: { color: c.danger, fontSize: 12, fontWeight: '700' },

    tarjeta: {
      width: '100%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: radio.tarjeta, padding: espacio.l, marginBottom: espacio.m + 2,
    },
    lugarTexto: { color: c.text, ...tipo.cuerpo, lineHeight: 19 },
    mapaWrap: { borderRadius: radio.control, overflow: 'hidden', marginTop: espacio.m - 2 },
    contactoFila: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m - 2, paddingVertical: espacio.m - 2,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },

    consultaButton: {
      width: '100%', flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radio.tarjeta, padding: espacio.m,
    },
    consultaIcono: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    consultaTextos: { flex: 1 },
    consultaTitulo: { color: c.text, ...tipo.cuerpoFuerte },
    consultaSub: { color: c.textMuted, fontSize: 11, fontWeight: '400', marginTop: 2 },
    consultaBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    consultaBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  });