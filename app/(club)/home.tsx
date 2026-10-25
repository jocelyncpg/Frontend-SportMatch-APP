import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { Usuario, cambiarPassword, getSession, logout } from '../../services/auth';
import {
  DEPORTES_CLUB,
  cerrarConvocatoria as cerrarConvocatoriaEnAlmacen,
  fechaCorta,
  publicarConvocatoria,
  sembrarDemoClub,
  useConsultasPendientes,
  useConvocatoria,
} from '../../services/consultas';
import { usePerfilClub } from '../../services/perfilClub';
import { resolverPostulacion, sembrarDemoPostulaciones, usePostulacionesDelClub } from '../../services/postulaciones';
import { PASSWORD_MAX, passwordRules, validatePassword, validatePasswordMatch } from '../../services/validators';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

// DATOS DE EJEMPLO: el nombre del club sale de la cuenta con la que se inició sesión; este texto solo se usa
// si no hay sesión. La foto del club y el resto del perfil vendrán del backend (HU-30).
const NOMBRE_CLUB_DEMO = 'Club de Atletismo';
const CLUB_ID_DEMO = 'club-demo';

const FORM_VACIO = { titulo: '', descripcion: '', deporte: '', categoria: '', fecha: '', requisitos: '', cupos: '' };

export default function ClubHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fotoClub, setFotoClub] = useState<string | null>(null);
  const [tab, setTab] = useState<'postulantes' | 'preseleccionados' | 'confirmados'>('postulantes');

  // Cuenta con la que se inició sesión (representante del club).
  const [sesion, setSesion] = useState<Usuario | null>(null);
  useEffect(() => {
    getSession().then((s) => {
      setSesion(s);
      // DEMO: deja consultas y postulaciones de ejemplo en el panel de este club (HU-51 y HU-34).
      const id = s?.clubId ?? CLUB_ID_DEMO;
      const nombre = s?.clubNombre ?? NOMBRE_CLUB_DEMO;
      sembrarDemoClub(id, nombre);
      sembrarDemoPostulaciones(id, nombre);
    });
  }, []);
  const clubId = sesion?.clubId ?? CLUB_ID_DEMO;
  // El nombre que el club edita en "Mi club" manda sobre el del registro.
  const perfilClub = usePerfilClub(clubId);
  const nombreClub = perfilClub?.nombre ?? sesion?.clubNombre ?? NOMBRE_CLUB_DEMO;

  // La convocatoria vive en services/consultas.ts: así la ven los deportistas y pueden hacerle consultas (HU-51).
  const convocatoriaGuardada = useConvocatoria(clubId);
  const convocatoria = convocatoriaGuardada?.abierta ? convocatoriaGuardada : null;
  const consultasPendientes = useConsultasPendientes(clubId);

  // Las postulaciones viven en services/postulaciones.ts: llegan desde el perfil del club del deportista (HU-33).
  const postulaciones = usePostulacionesDelClub(clubId);
  const postulantes = useMemo(() => postulaciones.filter((p) => p.estado === 'pendiente'), [postulaciones]);
  const preseleccionados = useMemo(() => postulaciones.filter((p) => p.estado === 'preseleccionada'), [postulaciones]);
  const confirmados = useMemo(() => postulaciones.filter((p) => p.estado === 'aceptada'), [postulaciones]);

  // Cambio de contraseña
  const [passModal, setPassModal] = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passRepetir, setPassRepetir] = useState('');
  const [passMostrar, setPassMostrar] = useState(false);
  const [passError, setPassError] = useState('');
  const [passEnviando, setPassEnviando] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  // Formulario de la convocatoria (HU-32). Los campos de texto se guardan como texto; los cupos se validan al publicar.
  const [form, setForm] = useState(FORM_VACIO);
  const [formError, setFormError] = useState('');
  const cambiar = (campo: keyof typeof FORM_VACIO, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  // ---------- Foto del club ----------
  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para elegir la imagen del club.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!resultado.canceled) setFotoClub(resultado.assets[0].uri);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu cámara para tomar la foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!resultado.canceled) setFotoClub(resultado.assets[0].uri);
  }

  function cambiarFoto() {
    Alert.alert('Foto del club', '¿Cómo quieres agregar la imagen?', [
      { text: 'Tomar foto', onPress: tomarFoto },
      { text: 'Elegir de galería', onPress: elegirDeGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  // ---------- Sesión ----------
  function confirmarCerrarSesion() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  // ---------- Contraseña ----------
  function abrirCambioPassword() {
    setPassActual('');
    setPassNueva('');
    setPassRepetir('');
    setPassMostrar(false);
    setPassError('');
    setPassModal(true);
  }

  async function guardarPassword() {
    setPassError('');
    if (!sesion) return;
    if (!passActual) {
      setPassError('Ingresa tu contraseña actual.');
      return;
    }
    const problema = validatePassword(passNueva) ?? validatePasswordMatch(passNueva, passRepetir);
    if (problema) {
      setPassError(problema);
      return;
    }
    setPassEnviando(true);
    try {
      await cambiarPassword(sesion.email, passActual, passNueva);
      setPassModal(false);
      Alert.alert('Contraseña actualizada', 'Úsala la próxima vez que inicies sesión.');
    } catch (e: any) {
      setPassError(e.message);
    } finally {
      setPassEnviando(false);
    }
  }

  // ---------- Convocatoria ----------
  function abrirEditor() {
    const c = convocatoriaGuardada;
    setForm(
      c
        ? {
            titulo: c.titulo,
            descripcion: c.descripcion,
            deporte: c.deporte ?? '',
            categoria: c.categoria ?? '',
            fecha: c.fecha ?? '',
            requisitos: c.requisitos ?? '',
            cupos: c.cupos !== undefined ? String(c.cupos) : '',
          }
        : FORM_VACIO,
    );
    setFormError('');
    setModalVisible(true);
  }

  function guardarConvocatoria() {
    setFormError('');
    const r = publicarConvocatoria(clubId, nombreClub, {
      titulo: form.titulo,
      descripcion: form.descripcion,
      deporte: form.deporte,
      categoria: form.categoria,
      fecha: form.fecha,
      requisitos: form.requisitos,
      cupos: form.cupos.trim() === '' ? NaN : Number(form.cupos),
    });
    if (!r.ok) {
      setFormError(r.motivo);
      return;
    }
    setModalVisible(false);
  }

  function cerrarConvocatoria() {
    cerrarConvocatoriaEnAlmacen(clubId);
  }

  // ---------- Postulantes (HU-34) ----------
  function confirmar(id: string) {
    const r = resolverPostulacion(id, 'aceptada');
    if (!r.ok) Alert.alert('No se pudo aceptar', r.motivo);
  }

  function preseleccionar(id: string) {
    const r = resolverPostulacion(id, 'preseleccionada');
    if (!r.ok) Alert.alert('No se pudo preseleccionar', r.motivo);
  }

  function rechazar(id: string, nombre: string) {
    Alert.alert('Rechazar postulación', `¿Quieres rechazar la postulación de ${nombre}? No podrá volver a postular a esta convocatoria.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rechazar',
        style: 'destructive',
        onPress: () => {
          const r = resolverPostulacion(id, 'rechazada');
          if (!r.ok) Alert.alert('No se pudo rechazar', r.motivo);
        },
      },
    ]);
  }

  const lista = tab === 'postulantes' ? postulantes : tab === 'preseleccionados' ? preseleccionados : confirmados;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Encabezado del club */}
        <View style={styles.header}>
          <TouchableOpacity onPress={cambiarFoto} activeOpacity={0.85} accessibilityLabel="Cambiar foto del club">
            <Avatar name={nombreClub} colorFrom="#7C3AED" uri={fotoClub} style={styles.clubFoto} fontSize={22} />
            <View style={styles.camaraBadge}>
              <Ionicons name="camera" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerEtiqueta}>Panel del club</Text>
            <Text style={styles.headerNombre} numberOfLines={1}>{nombreClub}</Text>
            {sesion ? (
              <Text style={styles.headerRepresentante} numberOfLines={1}>
                {sesion.nombre} {sesion.apellidoPaterno} · {sesion.email}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Resumen */}
        <View style={styles.resumen}>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValor}>{postulantes.length + preseleccionados.length}</Text>
            <Text style={styles.resumenEtiqueta}>Por resolver</Text>
          </View>
          <View style={styles.resumenDivisor} />
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValor}>{confirmados.length}</Text>
            <Text style={styles.resumenEtiqueta}>Confirmados</Text>
          </View>
          <View style={styles.resumenDivisor} />
          <View style={styles.resumenItem}>
            <Text style={[styles.resumenValor, { color: convocatoria ? colors.success : colors.textMuted }]}>
              {convocatoria ? 'Abierta' : 'Cerrada'}
            </Text>
            <Text style={styles.resumenEtiqueta}>Convocatoria</Text>
          </View>
        </View>

        {/* HU-31: editar la información pública del club */}
        <TouchableOpacity
          style={styles.consultasCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(club)/mi-club' as never)}
          accessibilityLabel="Editar la información del club"
        >
          <View style={styles.planesIcon}>
            <Ionicons name="create-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.planesInfo}>
            <Text style={styles.planesTitle}>Mi club</Text>
            <Text style={styles.planesSub}>Descripción, deportes y datos de contacto</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* HU-51: bandeja de consultas de los postulantes, compartida por los representantes del club */}
        <TouchableOpacity
          style={styles.consultasCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(club)/consultas' as never)}
          accessibilityLabel="Abrir consultas de postulantes"
        >
          <View style={styles.planesIcon}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.planesInfo}>
            <Text style={styles.planesTitle}>Consultas de postulantes</Text>
            <Text style={styles.planesSub}>
              {consultasPendientes > 0
                ? `${consultasPendientes} ${consultasPendientes === 1 ? 'consulta sin responder' : 'consultas sin responder'}`
                : 'Todo al día'}
            </Text>
          </View>
          {consultasPendientes > 0 ? (
            <View style={styles.consultasBadge}>
              <Text style={styles.consultasBadgeTexto}>{consultasPendientes > 9 ? '9+' : consultasPendientes}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* HU-39: acceso al catálogo de planes (versión club) */}
        <TouchableOpacity
          style={styles.planesCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(club)/planes' as never)}
        >
          <View style={styles.planesIcon}>
            <Ionicons name="ribbon-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.planesInfo}>
            <Text style={styles.planesTitle}>Planes y beneficios</Text>
            <Text style={styles.planesSub}>Conoce lo que incluye el plan Club</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Mi convocatoria</Text>

        {convocatoria ? (
          <View style={styles.convocatoriaCard}>
            <View style={styles.convocatoriaHeader}>
              <Ionicons name="megaphone" size={16} color={colors.success} />
              <Text style={styles.convocatoriaBadge}>Abierta</Text>
            </View>
            <Text style={styles.convocatoriaTitulo}>{convocatoria.titulo}</Text>
            {convocatoria.descripcion ? <Text style={styles.convocatoriaDesc}>{convocatoria.descripcion}</Text> : null}
            <View style={styles.datosFila}>
              {convocatoria.deporte ? <Text style={styles.dato}>{convocatoria.deporte}</Text> : null}
              {convocatoria.categoria ? <Text style={styles.dato}>{convocatoria.categoria}</Text> : null}
              {convocatoria.fecha ? <Text style={styles.dato}>Prueba: {fechaCorta(convocatoria.fecha)}</Text> : null}
              {convocatoria.cupos !== undefined ? (
                <Text style={styles.dato}>Cupos: {confirmados.length} de {convocatoria.cupos}</Text>
              ) : null}
            </View>
            {convocatoria.requisitos ? (
              <Text style={styles.convocatoriaDesc}>Requisitos: {convocatoria.requisitos}</Text>
            ) : null}
            <View style={styles.convocatoriaActions}>
              <TouchableOpacity style={styles.editButton} onPress={abrirEditor}>
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={cerrarConvocatoria}>
                <Text style={styles.closeButtonText}>Cerrar convocatoria</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyConvocatoria} onPress={abrirEditor}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            <Text style={styles.emptyConvocatoriaText}>Crear una convocatoria</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Postulaciones</Text>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'postulantes' && styles.tabActive]} onPress={() => setTab('postulantes')}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, tab === 'postulantes' && styles.tabTextActive]}>
              Nuevos {postulantes.length > 0 ? `(${postulantes.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'preseleccionados' && styles.tabActive]} onPress={() => setTab('preseleccionados')}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, tab === 'preseleccionados' && styles.tabTextActive]}>
              Preseleccionados {preseleccionados.length > 0 ? `(${preseleccionados.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'confirmados' && styles.tabActive]} onPress={() => setTab('confirmados')}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tabText, tab === 'confirmados' && styles.tabTextActive]}>
              Confirmados {confirmados.length > 0 ? `(${confirmados.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {lista.map((p) => (
          <View key={p.id} style={styles.card}>
            <Avatar
              name={p.postulante.nombre}
              colorFrom={p.postulante.colorFrom}
              uri={p.postulante.fotoUri}
              style={styles.avatar}
              fontSize={16}
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{p.postulante.nombre}</Text>
              <Text style={styles.cardMeta}>{p.postulante.deporte} · {p.postulante.nivel}</Text>
            </View>
            {tab !== 'confirmados' && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.rejectButton} onPress={() => rechazar(p.id, p.postulante.nombre)} accessibilityLabel={`Rechazar a ${p.postulante.nombre}`}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {tab === 'postulantes' && (
                  <TouchableOpacity style={styles.shortlistButton} onPress={() => preseleccionar(p.id)} accessibilityLabel={`Preseleccionar a ${p.postulante.nombre}`}>
                    <Ionicons name="star-outline" size={16} color={colors.accent} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.acceptButton} onPress={() => confirmar(p.id)} accessibilityLabel={`Aceptar a ${p.postulante.nombre}`}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {tab === 'postulantes'
              ? 'No hay postulantes nuevos por ahora.'
              : tab === 'preseleccionados'
                ? 'Todavía no has preseleccionado a nadie.'
                : 'Todavía no hay confirmados.'}
          </Text>
        )}

        <TouchableOpacity style={styles.passwordButton} onPress={abrirCambioPassword} activeOpacity={0.8}>
          <Ionicons name="key-outline" size={18} color={colors.accent} />
          <Text style={styles.passwordText}>Cambiar contraseña</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={confirmarCerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalBox, { maxHeight: '92%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Convocatoria</Text>

              <Text style={styles.etiqueta}>Título</Text>
              <View style={styles.inputBox}>
                <TextInput
                  placeholder="Ej: Buscamos velocistas nivel intermedio"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={form.titulo}
                  onChangeText={(v) => cambiar('titulo', v)}
                />
              </View>

              <Text style={styles.etiqueta}>Deporte</Text>
              <View style={styles.chips}>
                {DEPORTES_CLUB.map((d) => {
                  const activo = form.deporte === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.chip, activo && styles.chipActivo]}
                      onPress={() => cambiar('deporte', d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activo }}
                    >
                      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.etiqueta}>Categoría / edad</Text>
              <View style={styles.inputBox}>
                <TextInput
                  placeholder="Ej: Sub-18, Adultos, Mixto"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={form.categoria}
                  onChangeText={(v) => cambiar('categoria', v)}
                />
              </View>

              <View style={styles.dosColumnas}>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.etiqueta}>Fecha de la prueba</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      value={form.fecha}
                      onChangeText={(v) => cambiar('fecha', v)}
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.etiqueta}>Cupos</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      placeholder="Ej: 12"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      value={form.cupos}
                      onChangeText={(v) => cambiar('cupos', v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.etiqueta}>Requisitos</Text>
              <View style={[styles.inputBox, { height: 80, alignItems: 'flex-start' }]}>
                <TextInput
                  placeholder="Ej: Zapatillas de clavos, certificado médico"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
                  value={form.requisitos}
                  onChangeText={(v) => cambiar('requisitos', v)}
                  multiline
                />
              </View>

              <Text style={styles.etiqueta}>Descripción (opcional)</Text>
              <View style={[styles.inputBox, { height: 80, alignItems: 'flex-start' }]}>
                <TextInput
                  placeholder="Cuéntales más sobre la convocatoria"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
                  value={form.descripcion}
                  onChangeText={(v) => cambiar('descripcion', v)}
                  multiline
                />
              </View>

              {formError ? <Text accessibilityRole="alert" style={styles.modalError}>{formError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={guardarConvocatoria}>
                  <Text style={styles.modalSaveText}>Publicar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={passModal} transparent animationType="fade" onRequestClose={() => setPassModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <Text style={styles.modalAyuda}>Cambia solo la contraseña de tu cuenta ({sesion?.email}).</Text>

            {passError ? <Text style={styles.modalError}>{passError}</Text> : null}

            <View style={styles.inputBox}>
              <TextInput
                placeholder="Contraseña actual"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={passActual}
                onChangeText={setPassActual}
                secureTextEntry={!passMostrar}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={PASSWORD_MAX}
              />
              <TouchableOpacity onPress={() => setPassMostrar(!passMostrar)}>
                <Ionicons name={passMostrar ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputBox}>
              <TextInput
                placeholder="Nueva contraseña"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={passNueva}
                onChangeText={setPassNueva}
                secureTextEntry={!passMostrar}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={PASSWORD_MAX}
              />
            </View>
            {passNueva.length > 0 && passwordRules(passNueva).some((r) => !r.ok) ? (
              <View style={styles.reglasBox}>
                {passwordRules(passNueva).map((r) => (
                  <View key={r.id} style={styles.reglaFila}>
                    <Ionicons
                      name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={r.ok ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.reglaTexto, r.ok && { color: colors.success }]}>{r.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.inputBox}>
              <TextInput
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={passRepetir}
                onChangeText={setPassRepetir}
                secureTextEntry={!passMostrar}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={PASSWORD_MAX}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPassModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, passEnviando && { opacity: 0.6 }]}
                onPress={guardarPassword}
                disabled={passEnviando}
              >
                <Text style={styles.modalSaveText}>{passEnviando ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
    clubFoto: { width: 60, height: 60, borderRadius: 16 },
    camaraBadge: {
      position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: { flex: 1 },
    headerEtiqueta: { color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
    headerNombre: { color: c.text, fontSize: 19, fontWeight: '800', marginTop: 2 },
    headerRepresentante: { color: c.textMuted, fontSize: 11, marginTop: 2 },

    resumen: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, paddingVertical: 14, marginBottom: 14,
    },
    resumenItem: { flex: 1, alignItems: 'center' },
    resumenValor: { color: c.text, fontSize: 17, fontWeight: '800' },
    resumenEtiqueta: { color: c.textMuted, fontSize: 10.5, marginTop: 3 },
    resumenDivisor: { width: 1, height: 28, backgroundColor: c.border },

    consultasCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 10 },
    consultasBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    consultasBadgeTexto: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
    planesCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 22 },
    planesIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    planesInfo: { flex: 1 },
    planesTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    planesSub: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },

    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
    convocatoriaCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 24 },
    convocatoriaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    convocatoriaBadge: { color: c.success, fontSize: 10.5, fontWeight: '700' },
    convocatoriaTitulo: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    convocatoriaDesc: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 },
    convocatoriaActions: { flexDirection: 'row', gap: 10 },
    editButton: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    editButtonText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    closeButton: { flex: 1, backgroundColor: c.dangerBg, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    closeButtonText: { color: c.danger, fontSize: 12, fontWeight: '700' },
    emptyConvocatoria: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', borderRadius: 16, padding: 18, marginBottom: 24, justifyContent: 'center' },
    emptyConvocatoriaText: { color: c.accent, fontSize: 13, fontWeight: '700' },

    tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 10 },
    avatar: { width: 48, height: 48, borderRadius: 12 },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8 },
    rejectButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.subtle, alignItems: 'center', justifyContent: 'center' },
    shortlistButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    acceptButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 20 },

    passwordButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingVertical: 13, marginTop: 28,
    },
    passwordText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    logoutButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.dangerBg, borderRadius: 13, paddingVertical: 13, marginTop: 12,
    },
    logoutText: { color: c.danger, fontSize: 13, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
    modalAyuda: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: -8, marginBottom: 14 },
    modalError: { color: c.danger, fontSize: 12, marginBottom: 12 },
    reglasBox: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, marginTop: -4, marginBottom: 12, gap: 6 },
    reglaFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reglaTexto: { flex: 1, color: c.textMuted, fontSize: 12 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
    input: { color: c.text, fontSize: 13, flex: 1 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    modalSave: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    datosFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    dato: { color: c.accent, backgroundColor: c.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
    etiqueta: { color: c.textMuted, fontSize: 11.5, fontWeight: '600', marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipTexto: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    chipTextoActivo: { color: '#fff' },
    dosColumnas: { flexDirection: 'row', gap: 10 },
  });