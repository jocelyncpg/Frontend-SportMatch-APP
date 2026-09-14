import { Image, StyleSheet } from 'react-native';

type LogoProps = {
  width?: number;
};

const ASPECT_RATIO = 2172 / 724; // ancho / alto real de tu imagen

export default function Logo({ width = 220 }: LogoProps) {
  return (
    <Image
      source={require('../assets/images/logo-full.png')}
      style={[styles.logo, { width, height: width / ASPECT_RATIO }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});