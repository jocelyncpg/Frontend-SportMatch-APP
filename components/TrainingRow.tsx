import { StyleSheet, Text, View } from 'react-native';

type TrainingRowProps = {
  icon: string;
  title: string;
  time: string;
  distance: string;
  colorBg: string;
};

export default function TrainingRow({ icon, title, time, distance, colorBg }: TrainingRowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: colorBg }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{time} · {distance}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    borderRadius: 13,
    padding: 12,
    marginBottom: 9,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  meta: { color: '#8A93A6', fontSize: 10.5, marginTop: 2 },
});