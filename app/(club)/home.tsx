import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConvocatoriasClub } from '../../components/ConvocatoriasClub';
import { getSession, guardarClubEnSesion, logout, type Usuario } from '../../services/auth';
import { ApiError } from '../../services/api';
import { cargarHilosClub, useConsultasPendientes } from '../../services/consultas';
import {
  asignarCorreo, crearClub, listarAdministradores, listarAsignaciones,
  miClubActual, quitarAdministrador, revocarAsignacion,
  type AdministradorClub, type AsignacionRead, type ClubGestionado,
} from '../../services/clubes';
import { alCambiar, crearSondeo } from '../../services/sondeo';
import { validateNombreClub, validateRutClub } from '../../services/validators';
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
  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={[styles.contenido, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}
    >
      <Text style={styles.titulo}>{club?.nombre ?? 'Club'}</Text>
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
          <Text style={styles.info}>RUT {club.rut} · Tu rol: {miRol ?? club.mi_rol}</Text>
          <TouchableOpacity style={styles.tarjeta} onPress={() => router.push('/(club)/consultas' as never)}>
            <Text style={styles.subtitulo}>Consultas de deportistas</Text>
            <Text style={styles.info}>{pendientes} sin responder · Abrir bandeja</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tarjeta} onPress={() => router.push('/(club)/postulaciones' as never)}>
            <Text style={styles.subtitulo}>Postulaciones</Text>
            <Text style={styles.info}>Revisar candidatos y contactar postulantes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tarjeta} onPress={() => router.push('/(club)/canales' as never)}>
            <Text style={styles.subtitulo}>Canales del club</Text>
            <Text style={styles.info}>Gestionar anuncios y miembros</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tarjeta} onPress={() => router.push('/(club)/planes' as never)}>
            <Text style={styles.subtitulo}>Planes y beneficios</Text>
          </TouchableOpacity>
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
      <TouchableOpacity onPress={cerrarSesion}><Text style={styles.accion}>Cerrar sesión</Text></TouchableOpacity>
    </ScrollView>
  );
}
const makeStyles = (c: Colors) => StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: c.bg },
  contenido: { paddingHorizontal: 20, gap: 16 },
  titulo: { color: c.text, fontSize: 24, fontWeight: '700' },
  subtitulo: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  nombre: { color: c.text, fontSize: 14, fontWeight: '600' },
  info: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
  error: { color: c.danger, fontSize: 13 },
  seccion: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  tarjeta: { backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 16 },
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
  codigo: { backgroundColor: c.chip, padding: 12, borderRadius: 10, gap: 5 },
});
