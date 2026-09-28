import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

export default function AdminHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Panel de Administración (próximamente)</Text>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
    text: { color: c.text, fontSize: 16 },
  });