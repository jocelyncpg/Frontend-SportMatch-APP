import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      width: 148,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      overflow: 'hidden',
      marginRight: 10,
    },
    avatar: { height: 96, justifyContent: 'flex-start', alignItems: 'flex-end', padding: 6 },
    badge: { backgroundColor: c.badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    badgeText: { color: c.success, fontSize: 10, fontWeight: '700' },
    body: { padding: 9 },
    name: { color: c.text, fontSize: 12, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 9.5, marginTop: 2 },
    distance: { color: c.textMuted, fontSize: 9.5, marginTop: 1 },
  });