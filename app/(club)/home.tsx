import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConvocatoriasClub } from '../../components/ConvocatoriasClub';
import { getSession, guardarClubEnSesion, logout, type Usuario } from '../../services/auth';
import { cargarHilosClub, useConsultasPendientes } from '../../services/consultas';
import {
  aceptarInvitacion, crearClub, generarInvitacion, listarAdministradores, listarInvitaciones,
  miClubActual, quitarAdministrador, revocarInvitacion,
  type AdministradorClub, type ClubGestionado, type InvitacionClub, type InvitacionCreada,
} from '../../services/clubes';
import { validateNombreClub, validateRutClub } from '../../services/validators';
import { Colors, useAppTheme } from '../../theme/ThemeContext';
export default function ClubHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [sesion, setSesion] = useState<Usuario | null>(null);
  const [club, setClub] = useState<ClubGestionado | null>(null);
  const [admins, setAdmins] = useState<AdministradorClub[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionClub[]>([]);
  const [codigoNuevo, setCodigoNuevo] = useState<InvitacionCreada | null>(null);
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [codigo, setCodigo] = useState('');
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
        const [personas, vigentes] = await Promise.all([
          listarAdministradores(actual.id),
          listarInvitaciones(actual.id),
        ]);
        setAdmins(personas);
        setInvitaciones(vigentes);
        cargarHilosClub(actual.id, actual.nombre).catch(() => { });
      } else {
        await guardarClubEnSesion(undefined, undefined);
        setSesion(await getSession());
        setAdmins([]);
        setInvitaciones([]);
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
  useEffect(() => {
    if (!club) return;
    const timer = setInterval(() => cargarHilosClub(club.id, club.nombre).catch(() => { }), 6000);
    return () => clearInterval(timer);
  }, [club]);
  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true);
    setError('');
    try {
      await accion();
      await cargar();
    }
    catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
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
  function unir() {
    if (!codigo.trim()) {
      setError('Ingresa el código de invitación.');
      return;
    }
    ejecutar(() => aceptarInvitacion(codigo.trim()));
  }
  async function invitar() {
    setOcupado(true);
    setError('');
    try {
      const nueva = await generarInvitacion(club!.id);
      setCodigoNuevo(nueva);
      const lista = await listarInvitaciones(club!.id);
      setInvitaciones(lista);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la invitación.');
    }
    finally {
      setOcupado(false);
    }
  }
  function quitar(usuarioId: string, nombreAdmin: string) {
    Alert.alert('Quitar administrador', '¿Quitar a ' + nombreAdmin + ' del club?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
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
          <Text style={styles.info}>Crea un club o únete con una invitación.</Text>
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
          {boton('Crear club', crear, ocupado)}
          <Text style={styles.subtitulo}>Unirse a un club</Text>
          <TextInput
            style={styles.campo}
            placeholder="Código de invitación"
            placeholderTextColor={colors.textMuted}
            value={codigo}
            onChangeText={setCodigo}
            autoCapitalize="characters"
          />
          {boton('Aceptar invitación', unir, ocupado)}
        </View>
      ) : null}
      {club ? (
        <>
          <Text style={styles.info}>RUT {club.rut} · Tu rol: {club.mi_rol}</Text>
          <TouchableOpacity style={styles.tarjeta} onPress={() => router.push('/(club)/consultas' as never)}>
            <Text style={styles.subtitulo}>Consultas de deportistas</Text>
            <Text style={styles.info}>{pendientes} sin responder · Abrir bandeja</Text>
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
                {club.mi_rol === 'PRINCIPAL' && a.usuario_id !== sesion?.id ? (
                  <TouchableOpacity onPress={() => quitar(a.usuario_id, a.nombre)}>
                    <Text style={styles.accion}>Quitar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {boton('Generar invitación', invitar, ocupado)}
            {codigoNuevo ? (
              <View style={styles.codigo}>
                <Text style={styles.nombre}>Código: {codigoNuevo.codigo}</Text>
                <Text style={styles.info}>Vence: {new Date(codigoNuevo.expira_en).toLocaleString('es-CL')}</Text>
                <TouchableOpacity onPress={() => Clipboard.setStringAsync(codigoNuevo.codigo)}>
                  <Text style={styles.accion}>Copiar código</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCodigoNuevo(null)}>
                  <Text style={styles.accion}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={styles.subtitulo}>Invitaciones vigentes</Text>
            {invitaciones.length === 0 ? <Text style={styles.info}>No hay invitaciones vigentes.</Text> : null}
            {invitaciones.map((i) => (
              <View key={i.id} style={styles.fila}>
                <Text style={[styles.info, styles.expandir]}>
                  Vence {new Date(i.expira_en).toLocaleString('es-CL')}
                </Text>
                <TouchableOpacity onPress={() => ejecutar(() => revocarInvitacion(club.id, i.id))}>
                  <Text style={styles.accion}>Revocar</Text>
                </TouchableOpacity>
              </View>
            ))}
            {club.mi_rol === 'ADMIN' ? (
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
