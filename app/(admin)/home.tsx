import { StyleSheet, Text, View } from 'react-native';

export default function AdminHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Panel de Administración (próximamente)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 16 },
});