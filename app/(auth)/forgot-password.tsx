import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Logo from '../../components/Logo';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);

  function handleEnviar() {
    if (!email.trim()) return;
    // Simulado por ahora: aquí se conecta al endpoint real de recuperación cuando exista.
    setEnviado(true);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Logo width={300} />
        </View>

        <Text style={styles.title}>Recuperar contraseña</Text>

        {!enviado ? (
          <>
            <Text style={styles.subtitle}>
              Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.
            </Text>

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

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleEnviar}
            >
              <Text style={styles.sendButtonText}>
                Enviar instrucciones
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Ionicons
              name="mail-open-outline"
              size={40}
              color="#4ADE80"
              style={{ marginBottom: 16 }}
            />

            <Text style={styles.subtitle}>
              Si el correo{' '}
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {email}
              </Text>{' '}
              está registrado, te llegarán instrucciones para recuperar tu cuenta.
            </Text>

            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.sendButtonText}>
                Volver a Iniciar sesión
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoWrap: {
    marginLeft: -38,
    marginTop: -100,
  },

  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },

  subtitle: {
    color: '#8A93A6',
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 19,
  },

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
    marginBottom: 20,
  },

  input: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },

  sendButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});