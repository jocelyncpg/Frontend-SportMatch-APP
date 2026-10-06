import { router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Activity, activityTime } from '../services/activities';
import { nombreDeporte } from '../services/deportes';
import TrainingRow from './TrainingRow';

const ICONS: Record<string, string> = { running: '🏃', futbol: '⚽', ciclismo: '🚴', yoga: '🧘', natacion: '🏊', tennis: '🎾', trekking: '🥾' };
export default function ActivityCard({ activity }: { activity: Activity }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver actividad: ${activity.title}`}
    onPress={() => router.push({ pathname: '/(deportista)/activity/[id]', params: { id: activity.id } })}>
    <TrainingRow icon={ICONS[activity.sport_code] ?? '🏅'} title={activity.title}
      time={`${nombreDeporte(activity.sport_code)} · ${activityTime(activity.starts_at)}`}
      distance={activity.location} colorBg="#1B3324" />
  </TouchableOpacity>;
}
