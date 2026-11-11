import { Redirect } from 'expo-router';

export default function Index() {
  // La bienvenida y el login restauran la sesión y el destino según el rol.
  return <Redirect href="/(auth)/onboarding" />;
}
