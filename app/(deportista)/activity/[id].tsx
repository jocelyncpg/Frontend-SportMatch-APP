import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReportarModal from '../../../components/ReportarModal';
import {
  NOMBRES_NIVEL,
  YO,
  cancelarActividad,
  cargarActividad,
  cuposTomados,
  estadoActividad,
  formatearCuando,
  postulantes,
  postular,
  puedePostular,
  relacionConActividad,
  responderPostulacion,
  retirarse,
  useActividades,
  visualDeporte,
} from '../../../services/actividades';
import { Usuario, getSession } from '../../../services/auth';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ActividadDetalleScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const actividades = useActividades();
  const a = actividades.find((x) => x.id === id);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [modalPostular, setModalPostular] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cumplo, setCumplo] = useState(false);
  const [modalReporte, setModalReporte] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  // Al abrir (o volver a) la pantalla se piden los datos frescos: cupos y postulaciones cambian.
  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    cargarActividad(id).then((r) => {
      if (!activo) return;
      setErrorCarga(r.ok ? null : r.motivo);
      setCargando(false);
    });
    return () => { activo = false; };
  }, [id]));

  const atras = (
    <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { top: insets.top + 12 }]}>
      <Ionicons name="arrow-back" size={18} color={colors.text} />
    </TouchableOpacity>
  );

  if (!a) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        {atras}
        <View style={styles.noEncontrada}>
          {cargando ? <ActivityIndicator color={colors.accent} /> : (
            <Text style={styles.noEncontradaTexto}>{errorCarga ?? 'No encontramos esta actividad.'}</Text>
          )}
        </View>
      </View>
    );
  }

  const ahora = Date.now();
  const estado = estadoActividad(a, ahora);
  const relacion = relacionConActividad(a);
  const verificacion = puedePostular(a, usuario?.deportes, ahora);
  const visual = visualDeporte(a.deporte);
  const tomados = cuposTomados(a);
  const activa = estado === 'abierta' || estado === 'llena';
  const miMensaje = a.mensajes[YO];
  const lista = postulantes(a);

  function abrirPostular() {
    setMensaje('');
    setCumplo(false);
    setModalPostular(true);
  }

  async function enviar() {
    if (!a || !cumplo || enviando) return;
    setEnviando(true);
    const r = await postular(a.id, mensaje, usuario?.deportes);
    setEnviando(false);
    setModalPostular(false);
    if (!r.ok) {
      Alert.alert('No se pudo postular', r.motivo);
      return;
    }
    Alert.alert('Postulación enviada', 'Quien organiza revisará tu postulación y te avisará su decisión.');
  }

  function confirmarRetiro() {
    if (!a) return;
    const aprobada = relacion === 'aprobada';
    Alert.alert(
      aprobada ? 'Retirarme de la actividad' : 'Cancelar postulación',
      aprobada ? 'Tu cupo quedará libre para otras personas. ¿Quieres retirarte?' : '¿Quieres cancelar tu postulación?',
      [
        { text: 'No', style: 'cancel' },
        { text: aprobada ? 'Sí, retirarme' : 'Sí, cancelar', style: 'destructive', onPress: () => {
          const r = retirarse(a.id);
          if (!r.ok) Alert.alert('No se pudo completar', r.motivo);
        } },
      ]
    );
  }

  async function responder(personaId: string, decision: 'aprobada' | 'rechazada') {
    if (!a || enviando) return;
    setEnviando(true);
    const r = await responderPostulacion(a.id, personaId, decision);
    setEnviando(false);
    if (!r.ok) Alert.alert('No se pudo responder', r.motivo);
  }

  function confirmarCancelacion() {
    if (!a) return;
    Alert.alert('Cancelar actividad', 'Las personas postuladas verán que la actividad fue cancelada. ¿Quieres cancelarla?', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: async () => {
        setEnviando(true);
        const r = await cancelarActividad(a.id);
        setEnviando(false);
        if (!r.ok) Alert.alert('No se pudo cancelar', r.motivo);
      } },
    ]);
  }

  const fila = (icono: keyof typeof Ionicons.glyphMap, titulo: string, valor: string) => (
    <View style={styles.infoFila}>
      <View style={styles.infoIcono}>
        <Ionicons name={icono} size={16} color={colors.accent} />
      </View>
      <View style={styles.infoTextos}>
        <Text style={styles.infoTitulo}>{titulo}</Text>
        <Text style={styles.infoValor}>{valor}</Text>
      </View>
    </View>
  );

  /** Zona de acciones, según tu relación con la actividad. */
  const acciones = () => {
    if (relacion === 'organizador') {
      return activa ? (
        <>
          <TouchableOpacity
            style={styles.pill}
            onPress={() => router.push({ pathname: '/(deportista)/activity/nueva', params: { id: a.id } })}
          >
            <Ionicons name="create-outline" size={16} color={colors.accent} />
            <Text style={styles.pillTexto}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillCancelar} onPress={confirmarCancelacion} disabled={enviando}>
            <Text style={styles.pillCancelarTexto}>Cancelar actividad</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.nota}>{estado === 'cancelada' ? 'Cancelaste esta actividad.' : 'Organizaste esta actividad.'}</Text>
      );
    }
    if (relacion === 'aprobada') {
      return activa ? (
        <>
          <View style={styles.pill}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.pillTexto}>Tu postulación fue aprobada</Text>
          </View>
          <TouchableOpacity style={styles.pillCancelar} onPress={confirmarRetiro}>
            <Text style={styles.pillCancelarTexto}>Retirarme</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.nota}>Participaste en esta actividad.</Text>
      );
    }
    if (relacion === 'pendiente') {
      return activa ? (
        <>
          <View style={styles.pill}>
            <Ionicons name="time-outline" size={16} color={colors.accent} />
            <Text style={styles.pillTexto}>Postulación enviada</Text>
          </View>
          <TouchableOpacity style={styles.pillCancelar} onPress={confirmarRetiro}>
            <Text style={styles.pillCancelarTexto}>Cancelar postulación</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.nota}>Tu postulación quedó sin respuesta.</Text>
      );
    }
    if (relacion === 'rechazada') return <Text style={styles.nota}>Tu postulación no fue aprobada.</Text>;
    if (verificacion.ok) {
      return (
        <TouchableOpacity style={styles.pillPrimario} onPress={abrirPostular}>
          <Ionicons name="paper-plane" size={16} color="#fff" />
          <Text style={styles.pillPrimarioTexto}>Postular</Text>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.bloqueado}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
        <Text style={styles.bloqueadoTexto}>{verificacion.motivo}</Text>
      </View>
    );
  };

  const bannerEstado =
    estado === 'llena' ? 'Esta actividad está completa' : estado === 'vencida' ? 'Esta actividad ya finalizó' : estado === 'cancelada' ? 'Esta actividad fue cancelada' : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {atras}
      {a.organizadorId !== YO ? (
        <TouchableOpacity
          onPress={() => setModalReporte(true)}
          style={[styles.reportButton, { top: insets.top + 12 }]}
          accessibilityLabel="Reportar actividad"
        >
          <Ionicons name="flag-outline" size={17} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroIcono, { backgroundColor: visual.colorBg }]}>
            <Text style={styles.heroEmoji}>{visual.icon}</Text>
          </View>
          <Text style={styles.titulo}>{a.titulo}</Text>
          <Text style={styles.organiza}>Organiza {a.organizadorId === YO ? 'tú' : a.organizadorNombre}</Text>
        </View>

        {bannerEstado ? (
          <View style={styles.banner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.textMuted} />
            <Text style={styles.bannerTexto}>{bannerEstado}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          {fila('calendar-outline', 'Fecha y hora', formatearCuando(a.fecha, ahora))}
          <View style={styles.separador} />
          {fila('location-outline', 'Lugar', a.comuna ? `${a.lugar} · ${a.comuna}` : a.lugar)}
          <View style={styles.separador} />
          {fila('speedometer-outline', 'Nivel', a.nivelMinimo === null ? 'Sin requisito de nivel' : `${NOMBRES_NIVEL[a.nivelMinimo]} o más en ${a.deporte}`)}
          <View style={styles.separador} />
          {fila('people-outline', 'Cupos', a.cupos === null ? 'Sin límite de cupos' : `${tomados} de ${a.cupos} ocupados`)}
          {a.cupos !== null ? (
            <View style={styles.barra}>
              <View style={[styles.barraRelleno, { width: `${Math.min(100, (tomados / a.cupos) * 100)}%` }]} />
            </View>
          ) : null}
        </View>

        {a.descripcion ? (
          <>
            <Text style={styles.seccion}>Descripción</Text>
            <Text style={styles.texto}>{a.descripcion}</Text>
          </>
        ) : null}

        {a.requisitos ? (
          <>
            <Text style={styles.seccion}>Requisitos para postular</Text>
            <Text style={styles.texto}>{a.requisitos}</Text>
          </>
        ) : null}

        {relacion === 'organizador' ? (
          <>
            <Text style={styles.seccion}>Postulantes ({lista.length})</Text>
            {lista.length === 0 ? <Text style={styles.texto}>Aún nadie ha postulado.</Text> : null}
            {lista.map((p) => (
              <View key={p.id} style={styles.postulante}>
                <View style={styles.postulanteInfo}>
                  <Text style={styles.postulanteNombre}>{p.nombre}</Text>
                  {p.mensaje ? <Text style={styles.postulanteMensaje}>{p.mensaje}</Text> : null}
                </View>
                {p.estado === 'pendiente' && activa ? (
                  <View style={styles.postulanteBotones}>
                    <TouchableOpacity style={styles.btnRechazar} disabled={enviando} onPress={() => responder(p.id, 'rechazada')} accessibilityLabel={`Rechazar a ${p.nombre}`}>
                      <Ionicons name="close" size={16} color={colors.danger} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnAprobar} disabled={enviando} onPress={() => responder(p.id, 'aprobada')} accessibilityLabel={`Aprobar a ${p.nombre}`}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.estadoPost, p.estado === 'aprobada' && { color: colors.success }]}>
                    {p.estado === 'aprobada' ? 'Aprobado' : p.estado === 'rechazada' ? 'Rechazado' : 'Pendiente'}
                  </Text>
                )}
              </View>
            ))}
          </>
        ) : null}

        {miMensaje ? (
          <>
            <Text style={styles.seccion}>Tu mensaje</Text>
            <Text style={styles.texto}>{miMensaje}</Text>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.acciones, { paddingBottom: insets.bottom + 16 }]}>{acciones()}</View>

      {/* Formulario de postulación */}
      <Modal visible={modalPostular} transparent animationType="fade" onRequestClose={() => setModalPostular(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Postular a {a.titulo}</Text>
            <Text style={styles.modalHint}>
              {a.requisitos ? `Requisitos: ${a.requisitos}` : 'Esta actividad no pide requisitos adicionales.'}
              {a.nivelMinimo !== null ? `\nNivel mínimo: ${NOMBRES_NIVEL[a.nivelMinimo]} en ${a.deporte}.` : ''}
            </Text>

            <TextInput
              style={styles.mensajeInput}
              placeholder="Mensaje para quien organiza (opcional)"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={140}
              value={mensaje}
              onChangeText={setMensaje}
            />
            <Text style={styles.charCount}>{mensaje.length}/140</Text>

            <TouchableOpacity style={styles.checkFila} onPress={() => setCumplo((v) => !v)} accessibilityLabel="Confirmo que cumplo los requisitos">
              <Ionicons name={cumplo ? 'checkbox' : 'square-outline'} size={20} color={cumplo ? colors.accent : colors.textMuted} />
              <Text style={styles.checkTexto}>Confirmo que cumplo los requisitos de la actividad</Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalPostular(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, (!cumplo || enviando) && styles.modalSaveOff]} onPress={enviar} disabled={!cumplo || enviando}>
                <Text style={styles.modalSaveText}>{enviando ? 'Enviando…' : 'Enviar postulación'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reportar actividad (HU-42) */}
      <ReportarModal
        visible={modalReporte}
        onClose={() => setModalReporte(false)}
        tipo="actividad"
        objetivoId={a.id}
        objetivoNombre={a.titulo}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backButton: {
      position: 'absolute', left: 20, zIndex: 2, width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    reportButton: {
      position: 'absolute', right: 20, zIndex: 2, width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    noEncontrada: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    noEncontradaTexto: { color: c.textMuted, fontSize: 13 },

    content: { padding: 20, paddingTop: 52, paddingBottom: 30 },
    hero: { alignItems: 'center', marginBottom: 18 },
    heroIcono: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    heroEmoji: { fontSize: 34 },
    titulo: { color: c.text, fontSize: 19, fontWeight: '700', textAlign: 'center' },
    organiza: { color: c.textMuted, fontSize: 12, marginTop: 4 },

    banner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.chip, borderRadius: 12, paddingVertical: 10, marginBottom: 14,
    },
    bannerTexto: { color: c.textMuted, fontSize: 12, fontWeight: '600' },

    infoCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 18 },
    infoFila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    infoIcono: { width: 30, height: 30, borderRadius: 9, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    infoTextos: { flex: 1 },
    infoTitulo: { color: c.textMuted, fontSize: 10.5, fontWeight: '600' },
    infoValor: { color: c.text, fontSize: 12.5, fontWeight: '600', marginTop: 1 },
    separador: { height: 1, backgroundColor: c.border, marginVertical: 2 },
    barra: { height: 6, borderRadius: 3, backgroundColor: c.chip, marginTop: 6, overflow: 'hidden' },
    barraRelleno: { height: 6, borderRadius: 3, backgroundColor: c.accent },

    seccion: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    texto: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: 16 },

    acciones: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12,
      paddingTop: 14, paddingHorizontal: 20, borderTopWidth: 1, borderColor: c.border,
    },
    nota: { color: c.textMuted, fontSize: 12.5, textAlign: 'center', paddingVertical: 8 },
    pillPrimario: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14,
    },
    pillPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
    pill: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14,
    },
    pillTexto: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    pillCancelar: {
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.danger,
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    },
    pillCancelarTexto: { color: c.danger, fontSize: 12.5, fontWeight: '700' },
    bloqueado: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12,
    },
    bloqueadoTexto: { color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 17 },

    postulante: {
      flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, marginBottom: 8,
    },
    postulanteInfo: { flex: 1 },
    postulanteNombre: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    postulanteMensaje: { color: c.textMuted, fontSize: 11, marginTop: 3, lineHeight: 15 },
    postulanteBotones: { flexDirection: 'row', gap: 8 },
    btnRechazar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.danger, alignItems: 'center', justifyContent: 'center' },
    btnAprobar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    estadoPost: { color: c.textMuted, fontSize: 11, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    modalHint: { color: c.textMuted, fontSize: 11.5, marginBottom: 14, lineHeight: 16 },
    mensajeInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, height: 80, textAlignVertical: 'top',
    },
    charCount: { color: c.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4, marginBottom: 12 },
    checkFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    checkTexto: { color: c.text, fontSize: 12, flex: 1 },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    modalSave: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalSaveOff: { opacity: 0.4 },
    modalSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });