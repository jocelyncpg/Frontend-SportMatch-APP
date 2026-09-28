import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
          <Ionicons name="arrow-back" size={18} color={colors.text} />
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
              color={colors.success}
              style={{ marginBottom: 16 }}
            />

            <Text style={styles.subtitle}>
              Si el correo{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
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
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    logoWrap: {
      marginLeft: -38,
      marginTop: -100,
    },

    title: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 10,
    },

    subtitle: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: 24,
      lineHeight: 19,
    },

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
      marginBottom: 20,
    },

    input: {
      color: c.text,
      fontSize: 13,
      flex: 1,
    },

    sendButton: {
      backgroundColor: c.primary,
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