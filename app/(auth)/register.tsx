import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Logo from '../../components/Logo';
import { register } from '../../services/auth';

export default function RegisterScreen() {
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');
    if (!rut || !nombre || !apellidoPaterno || !email || !password) {
      setError('Completa los campos obligatorios (*)');
      return;
    }
    try {
      await register({ rut, nombre, apellidoPaterno, apellidoMaterno, email, password });
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
  <ScrollView contentContainerStyle={styles.content}>
    <View style={[styles.logoWrap, { transform: [{ translateY: -15 }] }]}>
      <Logo width={300} />
    </View>
    
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Únete y encuentra tu compañero ideal</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputBox}>
          <Ionicons name="card-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="RUT (12345678-9) *"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={rut}
            onChangeText={setRut}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="Nombre *"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
          />
        </View>

        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="Apellido paterno *"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={apellidoPaterno}
            onChangeText={setApellidoPaterno}
          />
        </View>

        <View style={styles.inputBox}>
          <Ionicons name="person-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="Apellido materno (opcional)"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={apellidoMaterno}
            onChangeText={setApellidoMaterno}
          />
        </View>

        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={16} color="#8A93A6" />
          <TextInput
            placeholder="Correo electrónico *"
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
            placeholder="Contraseña *"
            placeholderTextColor="#8A93A6"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleRegister}>
          <Text style={styles.loginButtonText}>Registrarse</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
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
    marginBottom: 12,
  },
  input: { color: '#fff', fontSize: 13, flex: 1 },
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

