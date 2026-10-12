import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BrandLogo from '../../components/BrandLogo';
import { EmailNotVerifiedError, login } from '../../services/auth';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Rol = 'deportista' | 'club';

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [rol, setRol] = useState<Rol>('deportista');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    setEnviando(true);
    try {
      await login(email.trim(), password);
      // El rol se elige en esta pantalla (aún no viene del backend).
      if (rol === 'club') {
        router.replace('/(club)/home' as never);
      } else {
        router.replace('/(deportista)/(tabs)');
      }
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <BrandLogo width={222} style={styles.logo} />

        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>
          {rol === 'club' ? 'Inicia sesión para gestionar tu club' : 'Inicia sesión para seguir entrenando'}
        </Text>

        <View style={styles.rolSelector}>
          <TouchableOpacity
            style={[styles.rolOpcion, rol === 'deportista' && styles.rolOpcionActiva]}
            onPress={() => setRol('deportista')}
            accessibilityRole="button"
            accessibilityState={{ selected: rol === 'deportista' }}
          >
            <Ionicons name="person-outline" size={15} color={rol === 'deportista' ? '#fff' : colors.textMuted} />
            <Text style={[styles.rolTexto, rol === 'deportista' && styles.rolTextoActivo]}>Deportista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rolOpcion, rol === 'club' && styles.rolOpcionActiva]}
            onPress={() => setRol('club')}
            accessibilityRole="button"
            accessibilityState={{ selected: rol === 'club' }}
          >
            <Ionicons name="shield-outline" size={15} color={rol === 'club' ? '#fff' : colors.textMuted} />
            <Text style={[styles.rolTexto, rol === 'club' && styles.rolTextoActivo]}>Club</Text>
          </TouchableOpacity>
        </View>

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
          style={[styles.loginButton, enviando && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={enviando}
        >
          <Text style={styles.loginButtonText}>{enviando ? 'Entrando...' : 'Iniciar sesión'}</Text>
        </TouchableOpacity>

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
    title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
    subtitle: { color: c.textMuted, fontSize: 13, marginBottom: 20 },
    rolSelector: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      padding: 4,
      marginBottom: 18,
    },
    rolOpcion: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    rolOpcionActiva: { backgroundColor: c.primary },
    rolTexto: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    rolTextoActivo: { color: '#fff' },
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
    registerLink: { color: c.textMuted, fontSize: 12.5, textAlign: 'center' },
    registerLinkAccent: { color: c.accent, fontWeight: '700' },
  });