import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';
import InsigniaDeporte from './InsigniaDeporte';

type TrainingRowProps = {
  deporte: string;
  title: string;
  time: string;
  distance: string;
};

export default function TrainingRow({ deporte, title, time, distance }: TrainingRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <InsigniaDeporte deporte={deporte} tamano={40} />
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
    info: { flex: 1 },
    title: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
  });