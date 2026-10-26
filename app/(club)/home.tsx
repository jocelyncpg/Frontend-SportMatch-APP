import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { ConvocatoriasClub } from '../../components/ConvocatoriasClub';
import { cambiarPassword, getSession, guardarClubEnSesion, logout, type Usuario } from '../../services/auth';
import { ApiError } from '../../services/api';
import { cargarHilosClub, useConsultasPendientes } from '../../services/consultas';
import {
  asignarCorreo, crearClub, listarAdministradores, listarAsignaciones,
  miClubActual, quitarAdministrador, revocarAsignacion,
  type AdministradorClub, type AsignacionRead, type ClubGestionado,
} from '../../services/clubes';
import { alCambiar, crearSondeo } from '../../services/sondeo';
import { PASSWORD_MAX, passwordRules, validateNombreClub, validatePassword, validatePasswordMatch, validateRutClub } from '../../services/validators';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function ClubHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<Usuario | null>(null);
  const [club, setClub] = useState<ClubGestionado | null>(null);
  const [admins, setAdmins] = useState<AdministradorClub[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionRead[]>([]);
  const [correo, setCorreo] = useState('');
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const pendientes = useConsultasPendientes(club?.id ?? '');

  // Cambio de contraseña
  const [passModal, setPassModal] = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passRepetir, setPassRepetir] = useState('');
  const [passMostrar, setPassMostrar] = useState(false);
  const [passError, setPassError] = useState('');
  const [passEnviando, setPassEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [s, actual] = await Promise.all([getSession(), miClubActual()]);
      setSesion(s);
      setClub(actual);
      if (actual) {
        await guardarClubEnSesion(actual.id, actual.nombre);
        setSesion(await getSession());
        const [personas, pendientesCorreo] = await Promise.all([
          listarAdministradores(actual.id),
          listarAsignaciones(actual.id),
        ]);
        setAdmins(personas);
        setAsignaciones(pendientesCorreo);
      } else {
        await guardarClubEnSesion(undefined, undefined);
        setSesion(await getSession());
        setAdmins([]);
        setAsignaciones([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el club.');
    }
    finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => {
    if (!club) return;
    const sondeo = crearSondeo('listas:club:' + club.id, () => cargarHilosClub(club.id, club.nombre)
      .catch(() => false), { minMs: 10000, maxMs: 60000, factor: 1.5 });
    const quitarAviso = alCambiar(({ tipo }) => {
      if (tipo === 'consulta_club') sondeo.ahora();
    });
    sondeo.iniciar();
    return () => {
      sondeo.detener();
      quitarAviso();
    };
  }, [club]));
  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError('');
    try {
      await accion();
      await cargar();
    }
    catch (e) {
      setError(e instanceof ApiError ? e.detail || e.message
        : e instanceof Error ? e.message : 'No se pudo completar la acción.');
    }
    finally {
      setOcupado(false);
    }
  }
  function crear() {
    const problema = validateNombreClub(nombre) ?? validateRutClub(rut.toUpperCase());
    if (problema) {
      setError(problema);
      return;
    }
    ejecutar(() => crearClub(nombre.trim(), rut.trim().toUpperCase()));
  }
  function agregarCorreo() {
    ejecutar(async () => {
      await asignarCorreo(club!.id, correo);
      setCorreo('');
    });
  }
  function revocar(id: string, email: string) {
    Alert.alert('Revocar asignación', '¿Revocar el correo ' + email + '?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revocar', style: 'destructive', onPress: () => ejecutar(() => revocarAsignacion(club!.id, id)) },
    ]);
  }
  function quitar(usuarioId: string, nombreAdmin: string) {
    Alert.alert('Quitar administrador', '¿Quitar a ' + nombreAdmin + ' del club?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar permisos',
        style: 'destructive',
        onPress: () => ejecutar(() => quitarAdministrador(club!.id, usuarioId))
      },
    ]);
  }
  function salir() {
    Alert.alert('Salir del club', 'Perderás acceso a este panel y a sus consultas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => ejecutar(async () => {
          await quitarAdministrador(club!.id, sesion!.id);
          await guardarClubEnSesion(undefined, undefined);
        })
      },
    ]);
  }
  async function cerrarSesion() {
    await logout();
    router.replace('/(auth)/login');
  }
  function confirmarCerrarSesion() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => { void cerrarSesion(); } },
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

  const miRol = admins.find((a) => a.usuario_id === sesion?.id)?.rol;
  const boton = (texto: string, accion: () => void, deshabilitado = false) => (
    <TouchableOpacity
      style={[styles.boton, deshabilitado && styles.deshabilitado]}
      onPress={accion}
      disabled={deshabilitado}
    >
      <Text style={styles.botonTexto}>{texto}</Text>
    </TouchableOpacity>
  );
  const tarjetaNav = (icono: keyof typeof Ionicons.glyphMap, titulo: string, sub: string, ruta: string, badge = 0) => (
    <TouchableOpacity style={styles.consultasCard} activeOpacity={0.8} onPress={() => router.push(ruta as never)} accessibilityLabel={titulo}>
      <View style={styles.planesIcon}>
        <Ionicons name={icono} size={18} color={colors.accent} />
      </View>
      <View style={styles.planesInfo}>
        <Text style={styles.planesTitle}>{titulo}</Text>
        <Text style={styles.planesSub}>{sub}</Text>
      </View>
      {badge > 0 ? (
        <View style={styles.consultasBadge}>
          <Text style={styles.consultasBadgeTexto}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
        {/* Encabezado del club */}
        <View style={styles.header}>
          <Avatar name={club?.nombre ?? 'Club'} colorFrom="#7C3AED" uri={null} style={styles.clubFoto} fontSize={22} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerEtiqueta}>Panel del club</Text>
            <Text style={styles.headerNombre} numberOfLines={1}>{club?.nombre ?? 'Club'}</Text>
            {sesion ? (
              <Text style={styles.headerRepresentante} numberOfLines={1}>
                {sesion.nombre} {sesion.apellidoPaterno} · {sesion.email}
              </Text>
            ) : null}
          </View>
        </View>

        {cargando ? <Text style={styles.info}>Cargando club...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {error ? boton('Reintentar', () => {
          cargar();
        }, cargando) : null}

        {!cargando && !club && !error ? (
          <View style={styles.seccion}>
            <Text style={styles.subtitulo}>Tu cuenta aún no administra un club</Text>
            <Text style={styles.subtitulo}>Crear mi club</Text>
            <TextInput
              style={styles.campo}
              placeholder="Nombre del club"
              placeholderTextColor={colors.textMuted}
              value={nombre}
              onChangeText={setNombre}
              maxLength={60}
            />
            <TextInput
              style={styles.campo}
              placeholder="RUT del club (sin puntos)"
              placeholderTextColor={colors.textMuted}
              value={rut}
              onChangeText={setRut}
              autoCapitalize="characters"
              maxLength={12}
            />
            {boton('Crear mi club', crear, ocupado)}
            <Text style={styles.subtitulo}>Me asignaron un club</Text>
            <Text style={styles.info}>
              Pide al administrador principal que agregue tu correo {sesion?.email}; luego toca Actualizar.
            </Text>
            {boton('Actualizar', () => { void cargar(); }, cargando)}
          </View>
        ) : null}

        {club ? (
          <>
            <View style={styles.resumen}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>{pendientes}</Text>
                <Text style={styles.resumenEtiqueta}>Consultas sin responder</Text>
              </View>
              <View style={styles.resumenDivisor} />
              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>{admins.length}</Text>
                <Text style={styles.resumenEtiqueta}>Administradores</Text>
              </View>
              <View style={styles.resumenDivisor} />
              <View style={styles.resumenItem}>
                <Text style={styles.resumenValor}>{asignaciones.length}</Text>
                <Text style={styles.resumenEtiqueta}>Correos pendientes</Text>
              </View>
            </View>

            <Text style={styles.info}>RUT {club.rut} · Tu rol: {miRol ?? club.mi_rol}</Text>

            {tarjetaNav('create-outline', 'Mi club', 'Descripción, deportes y datos de contacto', '/(club)/mi-club')}
            {tarjetaNav('megaphone-outline', 'Avisos', 'Envía comunicados a tus postulantes', '/(club)/avisos')}
            {tarjetaNav('chatbubbles-outline', 'Consultas de deportistas',
              pendientes > 0 ? `${pendientes} ${pendientes === 1 ? 'consulta sin responder' : 'consultas sin responder'}` : 'Todo al día',
              '/(club)/consultas', pendientes)}
            {tarjetaNav('people-outline', 'Postulaciones', 'Revisar candidatos y contactar postulantes', '/(club)/postulaciones')}
            {tarjetaNav('layers-outline', 'Canales del club', 'Gestionar anuncios y miembros', '/(club)/canales')}
            {tarjetaNav('ribbon-outline', 'Planes y beneficios', 'Conoce lo que incluye el plan Club', '/(club)/planes')}

            <Text style={styles.sectionTitle}>Mi convocatoria</Text>
            <ConvocatoriasClub club={club} />

            <View style={styles.seccion}>
              <Text style={styles.subtitulo}>Administradores</Text>
              {admins.map((a) => (
                <View key={a.usuario_id} style={styles.fila}>
                  <View style={styles.expandir}>
                    <Text style={styles.nombre}>{a.nombre}</Text>
                    <Text style={styles.info}>{a.rol} · Desde {new Date(a.fecha_alta).toLocaleDateString('es-CL')}</Text>
                  </View>
                  {miRol === 'PRINCIPAL' && a.rol === 'ADMIN' ? (
                    <TouchableOpacity onPress={() => quitar(a.usuario_id, a.nombre)}>
                      <Text style={styles.accion}>Quitar permisos</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              <Text style={styles.subtitulo}>Correos pendientes</Text>
              {asignaciones.length === 0 ? <Text style={styles.info}>No hay correos pendientes.</Text> : null}
              {asignaciones.map((i) => (
                <View key={i.id} style={styles.fila}>
                  <Text style={[styles.info, styles.expandir]}>
                    {i.email}{'\n'}Pendiente: se activa cuando esa persona entre con una cuenta de club con este correo
                  </Text>
                  {miRol === 'PRINCIPAL' ? (
                    <TouchableOpacity onPress={() => revocar(i.id, i.email)}>
                      <Text style={styles.accion}>Revocar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {miRol === 'PRINCIPAL' ? (
                <>
                  <Text style={styles.subtitulo}>Agregar correo de administrador</Text>
                  <TextInput style={styles.campo} placeholder="Correo electrónico" value={correo}
                    onChangeText={setCorreo} autoCapitalize="none" keyboardType="email-address" />
                  {boton('Agregar correo de administrador', agregarCorreo, ocupado)}
                </>
              ) : null}
              {miRol === 'ADMIN' ? (
                <TouchableOpacity onPress={salir}>
                  <Text style={styles.accion}>Salir del club</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <TouchableOpacity style={styles.passwordButton} onPress={abrirCambioPassword} activeOpacity={0.8}>
          <Ionicons name="key-outline" size={18} color={colors.accent} />
          <Text style={styles.passwordText}>Cambiar contraseña</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={confirmarCerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={passModal} transparent animationType="fade" onRequestClose={() => setPassModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPassModal(false)} disabled={passEnviando}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={() => { void guardarPassword(); }} disabled={passEnviando}>
                <Text style={styles.modalSaveText}>{passEnviando ? 'Guardando…' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, gap: 16 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 2 },
    clubFoto: { width: 60, height: 60, borderRadius: 16 },
    headerInfo: { flex: 1 },
    headerEtiqueta: { color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
    headerNombre: { color: c.text, fontSize: 19, fontWeight: '800', marginTop: 2 },
    headerRepresentante: { color: c.textMuted, fontSize: 11, marginTop: 2 },

    resumen: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, paddingVertical: 14,
    },
    resumenItem: { flex: 1, alignItems: 'center' },
    resumenValor: { color: c.text, fontSize: 17, fontWeight: '800' },
    resumenEtiqueta: { color: c.textMuted, fontSize: 10.5, marginTop: 3, textAlign: 'center' },
    resumenDivisor: { width: 1, height: 28, backgroundColor: c.border },

    consultasCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12 },
    consultasBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    consultasBadgeTexto: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
    planesIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    planesInfo: { flex: 1 },
    planesTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    planesSub: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },

    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700' },

    passwordButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingVertical: 13, marginTop: 8,
    },
    passwordText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    logoutButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.dangerBg, borderRadius: 13, paddingVertical: 13,
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

    titulo: { color: c.text, fontSize: 24, fontWeight: '700' },
    subtitulo: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    nombre: { color: c.text, fontSize: 14, fontWeight: '600' },
    info: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    error: { color: c.danger, fontSize: 13 },
    seccion: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
    campo: {
      color: c.text,
      backgroundColor: c.inputBg,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12
    },
    boton: { backgroundColor: c.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
    botonTexto: { color: '#fff', fontWeight: '700' },
    deshabilitado: { opacity: 0.5 },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderBottomColor: c.border,
      borderBottomWidth: 1,
      paddingVertical: 8
    },
    expandir: { flex: 1 },
    accion: { color: c.accent, fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  });
