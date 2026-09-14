import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Logo from '../../components/Logo';

export default function OnboardingScreen() {
  return (
    <ImageBackground
      source={require('../../assets/images/onboarding-bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(11,15,25,0)', 'rgba(11,15,25,0.35)', 'rgba(11,15,25,0.95)', '#0B0F19']}
        locations={[0, 0.45, 0.78, 1]}
        style={styles.gradient}
      >
        <View style={[styles.logoOverlay, { transform: [{ translateY: -40 }] }]}>
          <Logo width={310} />
        </View>

        <View style={styles.bottom}>
          <Text style={styles.heading}>Conecta, entrena{'\n'}y comparte</Text>
          <Text style={styles.subtitle}>Encuentra compañeros de entrenamiento cerca de ti</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.secondaryButtonText}>Registrarse</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 40 },

  logoOverlay: { paddingTop: 50 },
  bottom: {},
  heading: { color: '#fff', fontSize: 28, fontWeight: '800', lineHeight: 34, marginBottom: 10 },
  subtitle: { color: '#C9CEDA', fontSize: 13, marginBottom: 24 },

  primaryButton: { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryButton: { borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});