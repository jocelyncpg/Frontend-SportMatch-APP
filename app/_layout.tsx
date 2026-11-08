import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import BannerAviso from '../components/BannerAviso';
import DialogoHost from '../components/DialogoHost';
import { usarDialogosDeLaApp } from '../services/dialogo';
import { AppThemeProvider, useAppTheme } from '../theme/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { alSuspenderse } from '../services/api';
import { getToken, logout } from '../services/auth';
import { crearManejadorSuspension } from '../services/suspension';

// Todos los Alert.alert de la app pasan a verse con la visual de la app.
usarDialogosDeLaApp();

function RootStack() {
  useNotifications();
  // HU-45: si el backend responde que la cuenta fue suspendida, se avisa con el tipo, el motivo y la fecha de fin
  // (vienen en el mensaje) y se cierra la sesión.
  useEffect(() => {
    const manejar = crearManejadorSuspension({
      haySesion: async () => (await getToken()) !== null,
      avisar: (texto) => Alert.alert('Cuenta suspendida', texto),
      cerrarSesion: logout,
      irAlLogin: () => router.replace('/(auth)/login'),
    });
    return alSuspenderse((error) => { void manejar(error); });
  }, []);
  const { colors, isDark } = useAppTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <BannerAviso />
      <DialogoHost />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootStack />
    </AppThemeProvider>
  );
}
