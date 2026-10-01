import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import { register } from '../../services/auth';
import {
  formatRut,
  passwordRules,
  validateEmail,
  validateNombre,
  validatePassword,
  validatePasswordMatch,
  validateRut,
} from '../../services/validators';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Campo = 'rut' | 'nombre' | 'apellidoPaterno' | 'apellidoMaterno' | 'email' | 'password' | 'confirmar';

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Campo, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors: Record<Campo, string | null> = {
    rut: validateRut(rut),
    nombre: validateNombre(nombre, 'Nombre'),
    apellidoPaterno: validateNombre(apellidoPaterno, 'Apellido paterno'),
    apellidoMaterno: validateNombre(apellidoMaterno, 'Apellido materno', false),
    email: validateEmail(email),
    password: validatePassword(password),
    confirmar: validatePasswordMatch(password, confirmar),
  };

  const touch = (c: Campo) => setTouched((prev) => ({ ...prev, [c]: true }));
  const err = (c: Campo) => (touched[c] || submitted ? errors[c] : null);
  const reglas = passwordRules(password);

  async function handleRegister() {
    setError('');
    setSubmitted(true);

    if (Object.values(errors).some((e) => e)) {
      setError('Revisa los campos marcados en rojo.');
      return;
    }

    setEnviando(true);
    try {
      await register({
        rut,
        nombre: nombre.trim(),
        apellidoPaterno: apellidoPaterno.trim(),
        apellidoMaterno: apellidoMaterno.trim() || undefined,
        email: email.trim(),
        password,
      });
      // La cuenta queda creada pero inactiva hasta confirmar el código del correo.
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: email.trim(), nuevo: '1' },
      });
    } catch (e: any) {
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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BrandLogo width={222} style={styles.logo} />

        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Únete y encuentra tu compañero ideal</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* RUT */}
        <View style={[styles.inputBox, err('rut') && styles.inputBoxError]}>
          <Ionicons name="card-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="RUT (12345678-9) *"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={rut}
            onChangeText={(t) => setRut(formatRut(t))}
            onBlur={() => touch('rut')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
          />
        </View>
        {err('rut') ? <Text style={styles.fieldError}>{err('rut')}</Text> : null}

        {/* Nombre */}
        <View style={[styles.inputBox, err('nombre') && styles.inputBoxError]}>
          <Ionicons name="person-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Nombre *"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            onBlur={() => touch('nombre')}
            autoCapitalize="words"
            maxLength={40}
          />
        </View>
        {err('nombre') ? <Text style={styles.fieldError}>{err('nombre')}</Text> : null}

        {/* Apellido paterno */}
        <View style={[styles.inputBox, err('apellidoPaterno') && styles.inputBoxError]}>
          <Ionicons name="person-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Apellido paterno *"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={apellidoPaterno}
            onChangeText={setApellidoPaterno}
            onBlur={() => touch('apellidoPaterno')}
            autoCapitalize="words"
            maxLength={40}
          />
        </View>
        {err('apellidoPaterno') ? <Text style={styles.fieldError}>{err('apellidoPaterno')}</Text> : null}

        {/* Apellido materno */}
        <View style={[styles.inputBox, err('apellidoMaterno') && styles.inputBoxError]}>
          <Ionicons name="person-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Apellido materno (opcional)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={apellidoMaterno}
            onChangeText={setApellidoMaterno}
            onBlur={() => touch('apellidoMaterno')}
            autoCapitalize="words"
            maxLength={40}
          />
        </View>
        {err('apellidoMaterno') ? <Text style={styles.fieldError}>{err('apellidoMaterno')}</Text> : null}

        {/* Correo */}
        <View style={[styles.inputBox, err('email') && styles.inputBoxError]}>
          <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Correo electrónico *"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            onBlur={() => touch('email')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            maxLength={100}
          />
        </View>
        {err('email') ? <Text style={styles.fieldError}>{err('email')}</Text> : null}

        {/* Contraseña */}
        <View style={[styles.inputBox, err('password') && styles.inputBoxError]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Contraseña *"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            onBlur={() => touch('password')}
            secureTextEntry={!mostrarPassword}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={64}
          />
          <TouchableOpacity onPress={() => setMostrarPassword(!mostrarPassword)}>
            <Ionicons name={mostrarPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {(password.length > 0 || touched.password || submitted) && (
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
        )}

        {/* Confirmar contraseña */}
        <View style={[styles.inputBox, err('confirmar') && styles.inputBoxError]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Repite tu contraseña *"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={confirmar}
            onChangeText={setConfirmar}
            onBlur={() => touch('confirmar')}
            secureTextEntry={!mostrarConfirmar}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={64}
          />
          <TouchableOpacity onPress={() => setMostrarConfirmar(!mostrarConfirmar)}>
            <Ionicons name={mostrarConfirmar ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        {err('confirmar') ? <Text style={styles.fieldError}>{err('confirmar')}</Text> : null}

        <TouchableOpacity
          style={[styles.loginButton, enviando && { opacity: 0.6 }]}
          onPress={handleRegister}
          disabled={enviando}
        >
          <Text style={styles.loginButtonText}>{enviando ? 'Creando cuenta...' : 'Registrarse'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.registerLink}>
            ¿Ya tienes cuenta? <Text style={styles.registerLinkAccent}>Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    logo: { marginBottom: 28 },
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
      marginBottom: 12,
    },
    inputBoxError: { borderColor: c.danger },
    input: { color: c.text, fontSize: 13, flex: 1 },
    fieldError: { color: c.danger, fontSize: 11, marginTop: -8, marginBottom: 12, marginLeft: 4 },
    rulesBox: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      marginTop: -4,
      marginBottom: 12,
      gap: 6,
    },
    ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ruleText: { color: c.textMuted, fontSize: 11.5 },
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