import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import BannerAviso from '../components/BannerAviso';
import DialogoHost from '../components/DialogoHost';
import { usarDialogosDeLaApp } from '../services/dialogo';
import { AppThemeProvider, useAppTheme } from '../theme/ThemeContext';

// Todos los Alert.alert de la app pasan a verse con la visual de la app.
usarDialogosDeLaApp();

function RootStack() {
  const { colors, isDark } = useAppTheme();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(deportista)" />
        <Stack.Screen name="(club)" />
        <Stack.Screen name="(admin)" />
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