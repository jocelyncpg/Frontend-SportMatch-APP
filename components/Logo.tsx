import { Image } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

const ASPECT_RATIO = 2172 / 724;

type LogoProps = { width?: number; forceDark?: boolean };

export default function Logo({ width = 220, forceDark = false }: LogoProps) {
  const { isDark } = useAppTheme();
  const source =
    isDark || forceDark
      ? require('../assets/images/logo-full.png')
      : require('../assets/images/logo-full-light.png');

  return <Image source={source} style={{ width, height: width / ASPECT_RATIO }} resizeMode="contain" />;
}