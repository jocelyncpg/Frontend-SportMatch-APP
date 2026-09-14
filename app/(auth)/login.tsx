import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Logo from '../../components/Logo';
import { login } from '../../services/auth';

export default function LoginScreen() {
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
          <Ionicons name="mail-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="Contraseña"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!mostrarPassword}
          />
          <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
            <Ionicons name={mostrarPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8A93A6" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap: {  marginLeft: -38,marginTop: -25 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#8A93A6', fontSize: 13, marginBottom: 20 },
  errorText: { color: '#F87171', fontSize: 12, marginBottom: 12 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 14,
  },
  input: { color: '#fff', fontSize: 13, flex: 1 },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -4 },
  loginButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  loginButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  registerLink: { color: '#8A93A6', fontSize: 12.5, textAlign: 'center' },
  registerLinkAccent: { color: '#9061F9', fontWeight: '700' },
});