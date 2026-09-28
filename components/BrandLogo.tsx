import { Image, ImageStyle, StyleProp } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

// Proporción real del PNG recortado (1605 x 389)
const ASPECT_RATIO = 1605 / 389;

type BrandLogoProps = {
  width?: number;
  forceDark?: boolean;
  style?: StyleProp<ImageStyle>;
};

export default function BrandLogo({ width = 200, forceDark = false, style }: BrandLogoProps) {
  const { isDark } = useAppTheme();
  const source =
    isDark || forceDark
      ? require('../assets/images/logo-tight-dark.png')
      : require('../assets/images/logo-tight-light.png');

  return (
    <Image
      source={source}
      style={[{ width, height: width / ASPECT_RATIO }, style]}
      resizeMode="contain"
    />
  );
}