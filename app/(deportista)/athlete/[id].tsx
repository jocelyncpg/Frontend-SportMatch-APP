import { Redirect, useLocalSearchParams } from 'expo-router';

/** Keep previously shared match-profile links while using the team's profile view. */
export default function MatchedAthleteProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/(deportista)/perfil/[id]', params: { id, matchId: id } }} />;
}
