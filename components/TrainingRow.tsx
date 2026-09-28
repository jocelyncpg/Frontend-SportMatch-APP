import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type TrainingRowProps = {
  icon: string;
  title: string;
  time: string;
  distance: string;
  colorBg: string;
};

export default function TrainingRow({ icon, title, time, distance, colorBg }: TrainingRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
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
    title: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
  });