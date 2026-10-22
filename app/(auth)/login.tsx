import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import { EmailNotVerifiedError, inicioSegunRol, login, loginConHuella, type Usuario } from '../../services/auth';
import {
  activarBiometria,
  autenticar,
  biometriaDisponible,
  emailActivado,
  marcarRechazo,
  nombreBiometria,
  yaRechazo,
} from '../../services/biometria';
import { Colors, Mode, useAppTheme } from '../../theme/ThemeContext';

const OPCIONES_TEMA: { key: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Claro', icon: 'sunny-outline' },
  { key: 'dark', label: 'Oscuro', icon: 'moon-outline' },
  { key: 'system', label: 'Automático', icon: 'phone-portrait-outline' },
];

export default function LoginScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Huella
  const [bioDisponible, setBioDisponible] = useState(false);
  const [bioEmail, setBioEmail] = useState<string | null>(null);
  const [bioNombre, setBioNombre] = useState('huella');

  useEffect(() => {
    (async () => {
      const ok = await biometriaDisponible();
      setBioDisponible(ok);
      if (ok) {
        setBioNombre(await nombreBiometria());
        setBioEmail(await emailActivado());
      }
    })();
  }, []);

  // Ingreso único: el rol de la cuenta (admin, club_admin o deportista) decide a qué vista se va.
  function entrar(usuario: Usuario) {
    router.replace(inicioSegunRol(usuario) as never);
  }

  /** Después de un login con contraseña, ofrece activar la huella (una sola vez por cuenta). */
  function ofrecerActivarHuella(emailLogin: string, passwordLogin: string): Promise<void> {
    return new Promise((resolve) => {
      Alert.alert(
        `¿Entrar con ${bioNombre}?`,
        `Activa el acceso con ${bioNombre} para entrar más rápido la próxima vez. Tus datos de acceso quedan cifrados en el llavero de este celular y solo se usan tras verificar tu ${bioNombre}.`,
        [
          {
            text: 'Ahora no',
            style: 'cancel',
            onPress: async () => {
              await marcarRechazo(emailLogin);
              resolve();
            },
          },
          {
            text: 'Activar',
            onPress: async () => {
              const ok = await autenticar(`Confirma tu ${bioNombre} para activarlo`);
              if (ok) {
                await activarBiometria(emailLogin, passwordLogin);
                setBioEmail(emailLogin.trim().toLowerCase());
              }
              resolve();
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    setEnviando(true);
    try {
      const usuario = await login(email.trim(), password);

      const yaActivado = bioEmail === email.trim().toLowerCase();
      if (bioDisponible && !yaActivado && !(await yaRechazo(email))) {
        await ofrecerActivarHuella(email.trim(), password);
      }
      entrar(usuario);
    } catch (e: any) {
      if (e instanceof EmailNotVerifiedError) {
        router.push({ pathname: '/(auth)/verify-email', params: { email: e.email } });
        return;
      }
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleHuella() {
    if (!bioEmail) return;
    setError('');
    const ok = await autenticar(`Entra con tu ${bioNombre}`);
    if (!ok) return; // canceló o no coincidió: el sistema ya muestra su mensaje
    setEnviando(true);
    try {
      entrar(await loginConHuella());
    } catch (e: any) {
      setError(e.message);
      // Si la huella se desactivó (contraseña cambiada), se esconde el botón.
      setBioEmail(await emailActivado());
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Apariencia: claro / oscuro / automático */}
      <View style={[styles.temaBarra, { top: insets.top + 10 }]}>
        {OPCIONES_TEMA.map((op) => {
          const activa = mode === op.key;
          return (
            <TouchableOpacity
              key={op.key}
              style={[styles.temaOpcion, activa && styles.temaOpcionActiva]}
              onPress={() => setMode(op.key)}
              accessibilityRole="button"
              accessibilityLabel={`Tema ${op.label}`}
              accessibilityState={{ selected: activa }}
            >
              <Ionicons name={op.icon} size={16} color={activa ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.content}>
        <BrandLogo width={222} style={styles.logo} />

        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Inicia sesión con tu correo para continuar</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Contraseña"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!mostrarPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
            <Ionicons name={mostrarPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotWrap}>
          <Text style={styles.registerLinkAccent}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, enviando && { opacity: 0.6 }, bioDisponible && bioEmail ? { marginBottom: 12 } : null]}
          onPress={handleLogin}
          disabled={enviando}
        >
          <Text style={styles.loginButtonText}>{enviando ? 'Entrando...' : 'Iniciar sesión'}</Text>
        </TouchableOpacity>

        {bioDisponible && bioEmail ? (
          <TouchableOpacity
            style={[styles.huellaButton, enviando && { opacity: 0.6 }]}
            onPress={handleHuella}
            disabled={enviando}
            accessibilityLabel={`Entrar con ${bioNombre}`}
          >
            <Ionicons name="finger-print" size={20} color={colors.accent} />
            <Text style={styles.huellaTexto}>Entrar con {bioNombre}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.registerLink}>
            ¿No tienes cuenta? <Text style={styles.registerLinkAccent}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    logo: { marginBottom: 36 },

    temaBarra: {
      position: 'absolute',
      right: 20,
      zIndex: 10,
      flexDirection: 'row',
      gap: 2,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 3,
    },
    temaOpcion: { width: 32, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    temaOpcionActiva: { backgroundColor: c.primary },

    title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
    subtitle: { color: c.textMuted, fontSize: 13, marginBottom: 20 },
    errorText: { color: c.danger, fontSize: 12, marginBottom: 12 },
    inputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 14,
    },
    input: { color: c.text, fontSize: 13, flex: 1 },
    forgotWrap: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -4 },
    loginButton: {
      backgroundColor: c.primary,
      borderRadius: 13,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    loginButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    huellaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      borderRadius: 13,
      paddingVertical: 13,
      marginBottom: 20,
    },
    huellaTexto: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
    registerLink: { color: c.textMuted, fontSize: 12.5, textAlign: 'center' },
    registerLinkAccent: { color: c.accent, fontWeight: '700' },
  });