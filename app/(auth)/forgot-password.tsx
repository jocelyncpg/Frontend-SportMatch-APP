import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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
import BrandLogo from '../../components/BrandLogo';
import { restablecerPassword, solicitarCodigoRecuperacion } from '../../services/recuperacion';
import { passwordRules, validateEmail, validatePassword, validatePasswordMatch } from '../../services/validators';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Paso = 'correo' | 'codigo' | 'listo';

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [paso, setPaso] = useState<Paso>('correo');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verNueva, setVerNueva] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reglas = passwordRules(nueva);
  const errorCodigo = /^\d{6}$/.test(codigo) ? null : 'El código tiene 6 dígitos.';
  const errorNueva = validatePassword(nueva);
  const errorConfirmar = validatePasswordMatch(nueva, confirmar);

  async function handleEnviar() {
    const problema = validateEmail(email);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await solicitarCodigoRecuperacion(email.trim());
      setPaso('codigo');
    } finally {
      setEnviando(false);
    }
  }

  async function handleReenviar() {
    await solicitarCodigoRecuperacion(email.trim());
    setReenviado(true);
  }

  async function handleRestablecer() {
    setIntento(true);
    setError(null);
    if (errorCodigo || errorNueva || errorConfirmar) return;
    setEnviando(true);
    try {
      await restablecerPassword(email.trim(), codigo, nueva);
      setPaso('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos restablecer tu contraseña.');
    } finally {
      setEnviando(false);
    }
  }

  function volverAlCorreo() {
    setPaso('correo');
    setCodigo('');
    setNueva('');
    setConfirmar('');
    setIntento(false);
    setReenviado(false);
    setError(null);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity
        onPress={() => (paso === 'codigo' ? volverAlCorreo() : router.back())}
        style={[styles.backButton, { top: insets.top + 12 }]}
      >
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandLogo width={222} style={styles.logo} />

        <Text style={styles.title}>Recuperar contraseña</Text>

        {paso === 'correo' ? (
          <>
            <Text style={styles.subtitle}>
              Ingresa tu correo y te enviaremos un código para restablecer tu contraseña.
            </Text>

            <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
              <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Correo electrónico"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
            {error ? <Text style={styles.fieldError}>{error}</Text> : null}

            <TouchableOpacity style={[styles.sendButton, enviando && styles.sendButtonOff]} onPress={handleEnviar} disabled={enviando}>
              <Text style={styles.sendButtonText}>Enviar código</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {paso === 'codigo' ? (
          <>
            <Text style={styles.subtitle}>
              Si{' '}
              <Text style={styles.subtitleBold}>{email.trim()}</Text>{' '}
              está registrado, te enviamos un código de 6 dígitos. Ingrésalo y elige tu nueva contraseña.
            </Text>

            {/* DEMO: quitar cuando el código llegue al correo desde el backend */}
            <View style={styles.demoBox}>
              <Ionicons name="flask-outline" size={14} color={colors.textMuted} />
              <Text style={styles.demoTexto}>Modo simulado: sirve cualquier código de 6 dígitos.</Text>
            </View>

            <View style={[styles.inputBox, intento && errorCodigo ? styles.inputBoxError : null]}>
              <Ionicons name="keypad-outline" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Código de 6 dígitos"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={codigo}
                onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            {intento && errorCodigo ? <Text style={styles.fieldError}>{errorCodigo}</Text> : null}

            <View style={[styles.inputBox, intento && errorNueva ? styles.inputBoxError : null]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Nueva contraseña"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={nueva}
                onChangeText={setNueva}
                secureTextEntry={!verNueva}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={64}
              />
              <TouchableOpacity onPress={() => setVerNueva(!verNueva)}>
                <Ionicons name={verNueva ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {nueva.length > 0 || intento ? (
              <View style={styles.rulesBox}>
                {reglas.map((r) => (
                  <View key={r.id} style={styles.ruleRow}>
                    <Ionicons
                      name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={r.ok ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.ruleText, r.ok && { color: colors.success }]}>{r.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={[styles.inputBox, intento && errorConfirmar ? styles.inputBoxError : null]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Repite la nueva contraseña"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={confirmar}
                onChangeText={setConfirmar}
                secureTextEntry={!verConfirmar}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={64}
              />
              <TouchableOpacity onPress={() => setVerConfirmar(!verConfirmar)}>
                <Ionicons name={verConfirmar ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {intento && errorConfirmar ? <Text style={styles.fieldError}>{errorConfirmar}</Text> : null}

            {error ? <Text style={styles.fieldError}>{error}</Text> : null}

            <TouchableOpacity style={[styles.sendButton, enviando && styles.sendButtonOff]} onPress={handleRestablecer} disabled={enviando}>
              <Text style={styles.sendButtonText}>Cambiar contraseña</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleReenviar} style={styles.linkWrap}>
              <Text style={styles.link}>{reenviado ? 'Código reenviado' : '¿No te llegó? Reenviar código'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {paso === 'listo' ? (
          <>
            <Ionicons name="checkmark-circle-outline" size={44} color={colors.success} style={{ marginBottom: 16 }} />
            <Text style={styles.subtitle}>
              Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con la nueva.
            </Text>
            <TouchableOpacity style={styles.sendButton} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.sendButtonText}>Volver a Iniciar sesión</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },

    backButton: {
      position: 'absolute',
      left: 24,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    logo: { marginBottom: 32 },
    title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 10 },
    subtitle: { color: c.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 19 },
    subtitleBold: { color: c.text, fontWeight: '700' },

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
    inputBoxError: { borderColor: c.danger, marginBottom: 6 },
    fieldError: { color: c.danger, fontSize: 11, marginBottom: 12, marginLeft: 4 },
    input: { color: c.text, fontSize: 13, flex: 1 },

    rulesBox: { marginBottom: 14, marginLeft: 4, gap: 5 },
    ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    ruleText: { color: c.textMuted, fontSize: 11.5 },

    demoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
    demoTexto: { color: c.textMuted, fontSize: 11 },

    sendButton: { backgroundColor: c.primary, borderRadius: 13, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
    sendButtonOff: { opacity: 0.6 },
    sendButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    linkWrap: { marginTop: 18, alignItems: 'center' },
    link: { color: c.accent, fontSize: 12.5, fontWeight: '600' },
  });