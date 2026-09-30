import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BrandLogo from '../../components/BrandLogo';
import { resendVerificationCode, verifyEmail } from '../../services/auth';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

// El backend no reenvía un código antes de 60 s.
const ESPERA_REENVIO = 60;

export default function VerifyEmailScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { email = '', nuevo } = useLocalSearchParams<{ email: string; nuevo?: string }>();

  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Recién registrado: el código acaba de salir, así que se espera antes de reenviar.
  const [espera, setEspera] = useState(nuevo === '1' ? ESPERA_REENVIO : 0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function handleVerificar() {
    setError('');
    setAviso('');
    if (!/^\d{6}$/.test(codigo)) {
      setError('Ingresa los 6 dígitos del código.');
      return;
    }
    setEnviando(true);
    try {
      await verifyEmail(email, codigo);
      router.replace('/(deportista)/(tabs)');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    setError('');
    setAviso('');
    try {
      await resendVerificationCode(email);
      setCodigo('');
      setEspera(ESPERA_REENVIO);
      setAviso('Te enviamos un código nuevo. Revisa también la carpeta de spam.');
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
        <BrandLogo width={222} style={styles.logo} />

        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>
          Te enviamos un código de 6 dígitos a <Text style={styles.email}>{email}</Text>.
          Ingrésalo para activar tu cuenta. Vence en 30 minutos.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {aviso ? <Text style={styles.okText}>{aviso}</Text> : null}

        <View style={styles.inputBox}>
          <Ionicons name="key-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Código de 6 dígitos"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.codeInput]}
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, enviando && { opacity: 0.6 }]}
          onPress={handleVerificar}
          disabled={enviando}
        >
          <Text style={styles.primaryButtonText}>{enviando ? 'Verificando...' : 'Verificar y entrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleReenviar} disabled={espera > 0}>
          <Text style={styles.link}>
            ¿No te llegó?{' '}
            <Text style={espera > 0 ? styles.linkDisabled : styles.linkAccent}>
              {espera > 0 ? `Reenviar código en ${espera} s` : 'Reenviar código'}
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.backWrap}>
          <Text style={styles.link}>Volver a iniciar sesión</Text>
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
    subtitle: { color: c.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 19 },
    email: { color: c.text, fontWeight: '700' },
    errorText: { color: c.danger, fontSize: 12, marginBottom: 12 },
    okText: { color: c.success, fontSize: 12, marginBottom: 12 },
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
    codeInput: { fontSize: 18, letterSpacing: 6, fontWeight: '700' },
    primaryButton: {
      backgroundColor: c.primary,
      borderRadius: 13,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    link: { color: c.textMuted, fontSize: 12.5, textAlign: 'center' },
    linkAccent: { color: c.accent, fontWeight: '700' },
    linkDisabled: { color: c.textMuted, fontWeight: '700' },
    backWrap: { marginTop: 16 },
  });
