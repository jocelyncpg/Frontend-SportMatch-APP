import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aviso, Boton, EncabezadoPantalla, Tarjeta } from '../../components/ui';
import { useTecladoVisible } from '../../hooks/use-teclado';
import { Usuario, cambiarPassword, getSession, logout, updateDatosPersonales } from '../../services/auth';
import { cargarBloqueados, desbloquear, useBloqueados } from '../../services/reportes';
import { dialogo } from '../../services/dialogo';
import { useMatches } from '../../services/matchStore';
import { PASSWORD_MAX, passwordRules, validateNombre, validatePassword, validatePasswordMatch } from '../../services/validators';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../theme/ThemeContext';

type Seccion = 'datos' | 'password' | null;

/** Configuración de la cuenta: datos personales, contraseña, personas bloqueadas y cierre de sesión. */
export default function ConfiguracionScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tecladoAbierto = useTecladoVisible();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [abierta, setAbierta] = useState<Seccion>(null);

  useFocusEffect(
    useCallback(() => {
      getSession().then(setUsuario);
      void cargarBloqueados().catch(() => {});
    }, [])
  );

  // ---------- Datos personales ----------
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [intentoDatos, setIntentoDatos] = useState(false);

  const errNombre = validateNombre(nombre, 'Nombre');
  const errPaterno = validateNombre(apellidoPaterno, 'Apellido paterno');
  const errMaterno = validateNombre(apellidoMaterno, 'Apellido materno', false);

  function abrirSeccion(s: Exclude<Seccion, null>) {
    if (abierta === s) {
      setAbierta(null);
      return;
    }
    if (s === 'datos' && usuario) {
      setNombre(usuario.nombre);
      setApellidoPaterno(usuario.apellidoPaterno);
      setApellidoMaterno(usuario.apellidoMaterno ?? '');
      setIntentoDatos(false);
    }
    if (s === 'password') {
      setActual('');
      setNueva('');
      setRepetir('');
      setIntentoPass(false);
    }
    setAbierta(s);
  }

  async function guardarDatos() {
    if (!usuario) return;
    setIntentoDatos(true);
    if (errNombre || errPaterno || errMaterno) return;
    setGuardandoDatos(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno.trim() || undefined,
      };
      await updateDatosPersonales(usuario.id, datos);
      setUsuario({ ...usuario, ...datos });
      setAbierta(null);
      dialogo('Datos actualizados', 'Tu nombre ya se ve con los cambios en tu perfil.');
    } catch (e) {
      dialogo('No se pudo guardar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setGuardandoDatos(false);
    }
  }

  // ---------- Contraseña ----------
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [intentoPass, setIntentoPass] = useState(false);

  const errActual = actual ? null : 'Ingresa tu contraseña actual.';
  const errNueva = validatePassword(nueva);
  const errRepetir = validatePasswordMatch(nueva, repetir);
  const reglas = passwordRules(nueva);

  async function guardarPassword() {
    if (!usuario) return;
    setIntentoPass(true);
    if (errActual || errNueva || errRepetir) return;
    setGuardandoPass(true);
    try {
      await cambiarPassword(usuario.email, actual, nueva);
      setAbierta(null);
      setActual('');
      setNueva('');
      setRepetir('');
      dialogo('Contraseña actualizada', 'Úsala la próxima vez que inicies sesión.');
    } catch (e) {
      dialogo('No se pudo cambiar', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setGuardandoPass(false);
    }
  }

  // ---------- Personas bloqueadas ----------
  const idsBloqueados = useBloqueados();
  const { catalogo, confirmados, solicitudes } = useMatches();
  const bloqueados = useMemo(() => {
    const personas = [...catalogo, ...confirmados, ...solicitudes];
    return idsBloqueados.map((id) => ({ id, persona: personas.find((p) => p.id === id) }));
  }, [idsBloqueados, catalogo, confirmados, solicitudes]);

  function confirmarDesbloqueo(id: string, nombrePersona: string) {
    dialogo(`¿Desbloquear a ${nombrePersona}?`, 'Podrán volver a escribirse en el chat.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: async () => {
          const resultado = await desbloquear(id);
          if (!resultado.ok) { dialogo('No se pudo desbloquear', resultado.motivo); return; }
          dialogo('Desbloqueado', `${nombrePersona} ya puede escribirte de nuevo.`);
        },
      },
    ]);
  }

  // ---------- Sesión ----------
  function confirmarCerrarSesion() {
    dialogo('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
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

  const campo = (
    etiqueta: string,
    valor: string,
    onChange: (t: string) => void,
    error: string | null,
    mostrarError: boolean,
    extra: { secure?: boolean; maxLength?: number; capitalizar?: boolean } = {}
  ) => (
    <View style={styles.campo}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <View style={[styles.inputBox, error && mostrarError && styles.inputBoxError]}>
        <TextInput
          style={styles.input}
          value={valor}
          onChangeText={onChange}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={extra.secure && !verPassword}
          autoCapitalize={extra.capitalizar ? 'words' : 'none'}
          autoCorrect={false}
          maxLength={extra.maxLength}
          accessibilityLabel={etiqueta}
        />
      </View>
      {error && mostrarError ? <Text style={styles.campoError}>{error}</Text> : null}
    </View>
  );

  const filaSeccion = (
    clave: Exclude<Seccion, null>,
    icono: keyof typeof Ionicons.glyphMap,
    titulo: string,
    subtitulo: string
  ) => (
    <TouchableOpacity
      style={styles.fila}
      onPress={() => abrirSeccion(clave)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierta === clave }}
      accessibilityLabel={titulo}
    >
      <View style={styles.filaIcono}>
        <Ionicons name={icono} size={18} color={colors.accent} />
      </View>
      <View style={styles.filaTextos}>
        <Text style={styles.filaTitulo}>{titulo}</Text>
        <Text style={styles.filaSub} numberOfLines={1}>{subtitulo}</Text>
      </View>
      <Ionicons name={abierta === clave ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + espacio.m, paddingBottom: tecladoAbierto ? 120 : insets.bottom + espacio.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <EncabezadoPantalla titulo="Configuración" subtitulo="Administra tu cuenta y tu privacidad." />
        <Boton texto="Mis pagos" icono="receipt-outline" variante="secundario" onPress={() => router.push('/(deportista)/mis-pagos')} />

        {/* Cuenta */}
        <Text style={styles.seccion}>Cuenta</Text>
        <Tarjeta style={styles.tarjeta}>
          {filaSeccion('datos', 'person-outline', 'Mis datos', usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Nombre y apellidos')}
          {abierta === 'datos' ? (
            <View style={styles.form}>
              {campo('Nombre', nombre, setNombre, errNombre, intentoDatos, { maxLength: 40, capitalizar: true })}
              {campo('Apellido paterno', apellidoPaterno, setApellidoPaterno, errPaterno, intentoDatos, { maxLength: 40, capitalizar: true })}
              {campo('Apellido materno (opcional)', apellidoMaterno, setApellidoMaterno, errMaterno, intentoDatos, { maxLength: 40, capitalizar: true })}
              <Aviso texto="El correo y el RUT no se pueden cambiar desde la app." />
              <Boton
                texto={guardandoDatos ? 'Guardando...' : 'Guardar cambios'}
                onPress={guardarDatos}
                deshabilitado={guardandoDatos}
                style={styles.botonForm}
              />
            </View>
          ) : null}

          <View style={styles.separador} />
          <View style={styles.fila}>
            <View style={styles.filaIcono}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            </View>
            <View style={styles.filaTextos}>
              <Text style={styles.filaTitulo}>Correo</Text>
              <Text style={styles.filaSub} numberOfLines={1}>{usuario?.email ?? ''}</Text>
            </View>
          </View>
        </Tarjeta>

        {/* Seguridad */}
        <Text style={styles.seccion}>Seguridad</Text>
        <Tarjeta style={styles.tarjeta}>
          {filaSeccion('password', 'lock-closed-outline', 'Cambiar contraseña', 'Usa una que no uses en otros sitios')}
          {abierta === 'password' ? (
            <View style={styles.form}>
              {campo('Contraseña actual', actual, setActual, errActual, intentoPass, { secure: true, maxLength: PASSWORD_MAX })}
              {campo('Contraseña nueva', nueva, setNueva, errNueva, intentoPass, { secure: true, maxLength: PASSWORD_MAX })}
              {nueva.length > 0 || intentoPass ? (
                <View style={styles.reglas}>
                  {reglas.map((r) => (
                    <View key={r.id} style={styles.regla}>
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
              {campo('Repite la contraseña nueva', repetir, setRepetir, errRepetir, intentoPass, { secure: true, maxLength: PASSWORD_MAX })}
              <TouchableOpacity style={styles.verPass} onPress={() => setVerPassword((v) => !v)} accessibilityRole="button">
                <Ionicons name={verPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.accent} />
                <Text style={styles.verPassTexto}>{verPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text>
              </TouchableOpacity>
              <Boton
                texto={guardandoPass ? 'Guardando...' : 'Cambiar contraseña'}
                onPress={guardarPassword}
                deshabilitado={guardandoPass}
                style={styles.botonForm}
              />
            </View>
          ) : null}
        </Tarjeta>

        {/* Bloqueados */}
        <Text style={styles.seccion}>Personas bloqueadas</Text>
        <Tarjeta style={styles.tarjeta}>
          {bloqueados.length === 0 ? (
            <View style={styles.vacio}>
              <Ionicons name="shield-checkmark-outline" size={26} color={colors.textMuted} />
              <Text style={styles.vacioTitulo}>No tienes personas bloqueadas</Text>
              <Text style={styles.vacioTexto}>Puedes bloquear a alguien desde el menú de su chat.</Text>
            </View>
          ) : (
            bloqueados.map(({ id, persona }, i) => {
              const nombrePersona = persona?.name ?? 'Usuario';
              return (
                <View key={id}>
                  {i > 0 ? <View style={styles.separador} /> : null}
                  <View style={styles.fila}>
                    {persona?.fotoUri ? (
                      <Image source={{ uri: persona.fotoUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarIniciales]}>
                        <Text style={styles.avatarTexto}>{nombrePersona.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.filaTextos}>
                      <Text style={styles.filaTitulo} numberOfLines={1}>{nombrePersona}</Text>
                      {persona ? <Text style={styles.filaSub} numberOfLines={1}>{persona.sport}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={styles.desbloquear}
                      onPress={() => confirmarDesbloqueo(id, nombrePersona)}
                      accessibilityRole="button"
                      accessibilityLabel={`Desbloquear a ${nombrePersona}`}
                    >
                      <Text style={styles.desbloquearTexto}>Desbloquear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </Tarjeta>

        {/* Sesión */}
        <Boton texto="Cerrar sesión" variante="peligro" icono="log-out-outline" onPress={confirmarCerrarSesion} style={styles.cerrarSesion} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: espacio.xl },

    seccion: { color: c.textMuted, ...tipo.etiqueta, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: espacio.s, marginTop: espacio.s },
    tarjeta: { padding: 0, marginBottom: espacio.l, overflow: 'hidden' },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: espacio.l },

    fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, padding: espacio.l, minHeight: 60 },
    filaIcono: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    filaTextos: { flex: 1 },
    filaTitulo: { color: c.text, ...tipo.cuerpoFuerte },
    filaSub: { color: c.textMuted, ...tipo.dato, marginTop: 2 },

    form: { paddingHorizontal: espacio.l, paddingBottom: espacio.l },
    campo: { marginBottom: espacio.m },
    campoEtiqueta: { color: c.textMuted, ...tipo.etiqueta, marginBottom: espacio.xs },
    inputBox: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
      paddingHorizontal: espacio.m + 2, minHeight: 48, justifyContent: 'center',
    },
    inputBoxError: { borderColor: c.danger },
    input: { color: c.text, fontSize: 14, fontWeight: '400', paddingVertical: espacio.m },
    campoError: { color: c.danger, ...tipo.dato, marginTop: espacio.xs, marginLeft: 2 },
    botonForm: { marginTop: espacio.m },

    reglas: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
      padding: espacio.m, gap: espacio.s, marginBottom: espacio.m,
    },
    regla: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
    reglaTexto: { flex: 1, color: c.textMuted, ...tipo.dato },
    verPass: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, minHeight: 44 },
    verPassTexto: { color: c.accent, ...tipo.cuerpoFuerte },

    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarIniciales: { backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    avatarTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    desbloquear: {
      minHeight: 44, paddingHorizontal: espacio.m, justifyContent: 'center',
      borderWidth: 1, borderColor: c.border, borderRadius: radio.control,
    },
    desbloquearTexto: { color: c.text, ...tipo.etiqueta },

    vacio: { alignItems: 'center', padding: espacio.xl, gap: espacio.s },
    vacioTitulo: { color: c.text, ...tipo.cuerpoFuerte },
    vacioTexto: { color: c.textMuted, ...tipo.dato, textAlign: 'center' },

    cerrarSesion: { marginTop: espacio.s },
  });
