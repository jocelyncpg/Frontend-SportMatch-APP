import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';
import Avatar from './Avatar';

type AthleteCardProps = {
  name: string;
  sport: string;
  level: string;
  distance?: string;
  compatibility: number;
  colorFrom: string;
  fotoUri?: string | null;
  onPress?: () => void;
};

export default function AthleteCard({
  name,
  sport,
  level,
  distance,
  compatibility,
  colorFrom,
  fotoUri,
  onPress,
}: AthleteCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <Avatar
        name={name}
        colorFrom={colorFrom}
        uri={fotoUri}
        style={styles.avatar}
        fontSize={30}
        overlayStyle={styles.avatarOverlay}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{compatibility}%</Text>
        </View>
      </Avatar>
      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{sport} · {level}</Text>
        {distance ? <Text style={styles.distance}>{distance}</Text> : null}
      </View>
    </TouchableOpacity>
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
    avatar: { height: 96 },
    avatarOverlay: { alignItems: 'flex-end', justifyContent: 'flex-start', padding: 6 },
    badge: { backgroundColor: c.badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    badgeText: { color: c.success, fontSize: 10, fontWeight: '700' },
    body: { padding: 9 },
    name: { color: c.text, fontSize: 12, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 9.5, marginTop: 2 },
    distance: { color: c.textMuted, fontSize: 9.5, marginTop: 1 },
  });