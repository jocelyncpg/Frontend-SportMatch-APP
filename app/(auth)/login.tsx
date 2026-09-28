import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Logo from '../../components/Logo';
import { login } from '../../services/auth';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    try {
      await login(email, password);
      router.replace('/(deportista)/(tabs)');
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={[styles.logoWrap, { transform: [{ translateY: -45 }] }]}>
          <Logo width={300} />
        </View>

        <Text style={styles.title}>Bienvenido </Text>
        <Text style={styles.subtitle}>Inicia sesión para seguir entrenando</Text>

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
          />
          <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
            <Ionicons name={mostrarPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotWrap}>
          <Text style={styles.registerLinkAccent}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Iniciar sesión</Text>
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
    logoWrap: { marginLeft: -38, marginTop: -25 },
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
    registerLink: { color: c.textMuted, fontSize: 12.5, textAlign: 'center' },
    registerLinkAccent: { color: c.accent, fontWeight: '700' },
  });