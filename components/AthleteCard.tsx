import { StyleSheet, Text, View } from 'react-native';

type AthleteCardProps = {
  name: string;
  sport: string;
  level: string;
  distance: string;
  compatibility: number;
  colorFrom: string;
  colorTo: string;
};

export default function AthleteCard({ name, sport, level, distance, compatibility, colorFrom, colorTo }: AthleteCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: colorFrom }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{compatibility}%</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{sport} · {level}</Text>
        <Text style={styles.distance}>{distance}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
  },
  avatar: { height: 96, justifyContent: 'flex-start', alignItems: 'flex-end', padding: 6 },
  badge: { backgroundColor: '#0B0F19', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { color: '#4ADE80', fontSize: 10, fontWeight: '700' },
  body: { padding: 9 },
  name: { color: '#fff', fontSize: 12, fontWeight: '700' },
  meta: { color: '#8A93A6', fontSize: 9.5, marginTop: 2 },
  distance: { color: '#8A93A6', fontSize: 9.5, marginTop: 1 },
});