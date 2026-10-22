import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    KeyboardTypeOptions,
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
import SelectorTipoCuenta from '../../components/SelectorTipoCuenta';
import { registerClub } from '../../services/auth';
import {
    MAX_REPRESENTANTES,
    PASSWORD_MAX,
    formatRut,
    passwordRules,
    validateEmail,
    validateEmailRepetido,
    validateNombre,
    validateNombreClub,
    validatePassword,
    validatePasswordMatch,
    validateRutClub,
} from '../../services/validators';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Representante = {
  nombre: string;
  apellidoPaterno: string;
  email: string;
  password: string;
  confirmar: string;
  mostrarPassword: boolean;
};

const repVacio = (): Representante => ({
  nombre: '',
  apellidoPaterno: '',
  email: '',
  password: '',
  confirmar: '',
  mostrarPassword: false,
});

const OPCIONES_CANTIDAD = Array.from({ length: MAX_REPRESENTANTES }, (_, i) => i + 1);

export default function RegisterClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [clubNombre, setClubNombre] = useState('');
  const [clubRut, setClubRut] = useState('');
  const [cantidad, setCantidad] = useState(1);
  // Siempre hay MAX_REPRESENTANTES bloques guardados; solo se muestran y validan los primeros `cantidad`.
  const [reps, setReps] = useState<Representante[]>(() => OPCIONES_CANTIDAD.map(repVacio));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const activos = reps.slice(0, cantidad);

  // Errores por campo. Claves: "clubNombre", "clubRut" y "r<n>_<campo>" por representante.
  const errors: Record<string, string | null> = {
    clubNombre: validateNombreClub(clubNombre),
    clubRut: validateRutClub(clubRut),
  };
  activos.forEach((r, i) => {
    const otrosCorreos = activos.filter((_, j) => j !== i).map((o) => o.email);
    errors[`r${i}_nombre`] = validateNombre(r.nombre, 'Nombre');
    errors[`r${i}_apellido`] = validateNombre(r.apellidoPaterno, 'Apellido paterno');
    errors[`r${i}_email`] = validateEmail(r.email) ?? validateEmailRepetido(r.email, otrosCorreos);
    errors[`r${i}_password`] = validatePassword(r.password);
    errors[`r${i}_confirmar`] = validatePasswordMatch(r.password, r.confirmar);
  });

  const touch = (k: string) => setTouched((prev) => ({ ...prev, [k]: true }));
  const err = (k: string) => (touched[k] || submitted ? errors[k] : null);
  const cambiarRep = (i: number, datos: Partial<Representante>) =>
    setReps((prev) => prev.map((r, j) => (j === i ? { ...r, ...datos } : r)));

  async function handleRegister() {
    setError('');
    setSubmitted(true);

    if (Object.values(errors).some((e) => e)) {
      setError('Revisa los campos marcados en rojo.');
      return;
    }

    setEnviando(true);
    try {
      await registerClub({
        clubNombre: clubNombre.trim(),
        clubRut,
        representantes: activos.map((r) => ({
          nombre: r.nombre.trim(),
          apellidoPaterno: r.apellidoPaterno.trim(),
          email: r.email.trim(),
          password: r.password,
        })),
      });
      // Verifica primero el representante principal; los demás lo hacen al iniciar sesión por primera vez.
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: activos[0].email.trim(), nuevo: '1' },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  /** Caja de texto con su mensaje de error debajo. */
  function campo(
    key: string,
    icono: keyof typeof Ionicons.glyphMap,
    placeholder: string,
    valor: string,
    onChange: (t: string) => void,
    opciones: {
      maxLength?: number;
      autoCapitalize?: 'none' | 'words' | 'characters';
      keyboardType?: KeyboardTypeOptions;
    } = {}
  ) {
    return (
      <>
        <View style={[styles.inputBox, err(key) && styles.inputBoxError]}>
          <Ionicons name={icono} size={16} color={colors.textMuted} />
          <TextInput
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={valor}
            onChangeText={onChange}
            onBlur={() => touch(key)}
            autoCapitalize={opciones.autoCapitalize ?? 'sentences'}
            autoCorrect={false}
            keyboardType={opciones.keyboardType}
            maxLength={opciones.maxLength}
          />
        </View>
        {err(key) ? <Text style={styles.fieldError}>{err(key)}</Text> : null}
      </>
    );
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

        <Text style={styles.title}>Registra tu club</Text>
        <Text style={styles.subtitle}>Administra tu club y encuentra nuevos deportistas</Text>

        <SelectorTipoCuenta
          activo="club"
          onElegir={(tipo) => {
            if (tipo === 'deportista') router.replace('/(auth)/register');
          }}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Datos del club */}
        <Text style={styles.seccion}>Datos del club</Text>
        {campo('clubNombre', 'shield-outline', 'Nombre del club *', clubNombre, setClubNombre, {
          maxLength: 60,
          autoCapitalize: 'words',
        })}
        {campo('clubRut', 'card-outline', 'RUT del club (76123456-0) *', clubRut, (t) => setClubRut(formatRut(t)), {
          maxLength: 10,
          autoCapitalize: 'characters',
        })}
        <Text style={styles.ayuda}>Se revisa que el RUT esté bien escrito. La validación con el SII la hará el sistema.</Text>

        {/* Cantidad de representantes */}
        <Text style={styles.seccion}>Representantes del club</Text>
        <Text style={styles.ayuda}>
          ¿Cuántas personas administrarán el club? Cada una entra con su propio correo y contraseña.
        </Text>
        <View style={styles.cantidadFila}>
          {OPCIONES_CANTIDAD.map((n) => {
            const activa = cantidad === n;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.cantidadOpcion, activa && styles.cantidadOpcionActiva]}
                onPress={() => setCantidad(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${n === 1 ? 'representante' : 'representantes'}`}
                accessibilityState={{ selected: activa }}
              >
                <Text style={[styles.cantidadTexto, activa && styles.cantidadTextoActivo]}>{n}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Un bloque por representante */}
        {activos.map((r, i) => {
          const reglas = passwordRules(r.password);
          const reglasPendientes = r.password.length > 0 && reglas.some((x) => !x.ok);
          return (
            <View key={i} style={styles.repCard}>
              <Text style={styles.repTitulo}>
                {i === 0 ? 'Representante principal' : `Representante ${i + 1}`}
              </Text>

              {campo(`r${i}_nombre`, 'person-outline', 'Nombre *', r.nombre, (t) => cambiarRep(i, { nombre: t }), {
                maxLength: 40,
                autoCapitalize: 'words',
              })}
              {campo(
                `r${i}_apellido`,
                'person-outline',
                'Apellido paterno *',
                r.apellidoPaterno,
                (t) => cambiarRep(i, { apellidoPaterno: t }),
                { maxLength: 40, autoCapitalize: 'words' }
              )}
              {campo(`r${i}_email`, 'mail-outline', 'Correo electrónico *', r.email, (t) => cambiarRep(i, { email: t }), {
                maxLength: 100,
                autoCapitalize: 'none',
                keyboardType: 'email-address',
              })}

              {/* Contraseña */}
              <View style={[styles.inputBox, err(`r${i}_password`) && styles.inputBoxError]}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                <TextInput
                  placeholder="Contraseña *"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={r.password}
                  onChangeText={(t) => cambiarRep(i, { password: t })}
                  onBlur={() => touch(`r${i}_password`)}
                  secureTextEntry={!r.mostrarPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={PASSWORD_MAX}
                />
                <TouchableOpacity onPress={() => cambiarRep(i, { mostrarPassword: !r.mostrarPassword })}>
                  <Ionicons
                    name={r.mostrarPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Las reglas se muestran mientras falte alguna; al cumplirlas todas, se esconden. */}
              {reglasPendientes || ((touched[`r${i}_password`] || submitted) && err(`r${i}_password`)) ? (
                <View style={styles.rulesBox}>
                  {reglas.map((x) => (
                    <View key={x.id} style={styles.ruleRow}>
                      <Ionicons
                        name={x.ok ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={x.ok ? colors.success : colors.textMuted}
                        style={styles.ruleIcon}
                      />
                      <Text style={[styles.ruleText, x.ok && { color: colors.success }]}>{x.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Confirmar contraseña */}
              <View style={[styles.inputBox, err(`r${i}_confirmar`) && styles.inputBoxError]}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                <TextInput
                  placeholder="Repite la contraseña *"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={r.confirmar}
                  onChangeText={(t) => cambiarRep(i, { confirmar: t })}
                  onBlur={() => touch(`r${i}_confirmar`)}
                  secureTextEntry={!r.mostrarPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={PASSWORD_MAX}
                />
              </View>
              {err(`r${i}_confirmar`) ? <Text style={styles.fieldError}>{err(`r${i}_confirmar`)}</Text> : null}
            </View>
          );
        })}

        <Text style={styles.ayuda}>
          Cada representante podrá cambiar su contraseña después, desde el inicio del club.
          {cantidad > 1 ? ' Los demás confirman su correo la primera vez que inicien sesión.' : ''}
        </Text>

        <TouchableOpacity
          style={[styles.loginButton, enviando && { opacity: 0.6 }]}
          onPress={handleRegister}
          disabled={enviando}
        >
          <Text style={styles.loginButtonText}>{enviando ? 'Registrando club...' : 'Registrar club'}</Text>
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
    seccion: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 6, marginBottom: 10 },
    ayuda: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginBottom: 14, marginLeft: 2 },
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
    fieldError: { color: c.danger, fontSize: 11, lineHeight: 15, marginTop: -8, marginBottom: 12, marginLeft: 4 },

    cantidadFila: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    cantidadOpcion: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    cantidadOpcionActiva: { backgroundColor: c.primary, borderColor: c.primary },
    cantidadTexto: { color: c.textMuted, fontSize: 15, fontWeight: '700' },
    cantidadTextoActivo: { color: '#fff' },

    repCard: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    repTitulo: { color: c.accent, fontSize: 13, fontWeight: '700', marginBottom: 12 },

    rulesBox: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      marginTop: -4,
      marginBottom: 12,
      gap: 8,
    },
    ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    ruleIcon: { marginTop: 1 },
    ruleText: { flex: 1, flexShrink: 1, color: c.textMuted, fontSize: 12, lineHeight: 16 },
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