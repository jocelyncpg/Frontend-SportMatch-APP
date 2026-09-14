import { Redirect } from 'expo-router';

export default function Index() {
  // Sin login todavía: por ahora entra directo como deportista.
  // Cuando exista sesión real, esto se reemplaza por la lógica de rol.
  return <Redirect href="/(auth)/onboarding" />;
}