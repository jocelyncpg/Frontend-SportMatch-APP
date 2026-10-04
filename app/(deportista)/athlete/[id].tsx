import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { ApiError } from '../../../services/api';
import { getChat } from '../../../services/chat';
import { Persona } from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

/** The route carries the match ID; the server supplies the public athlete profile. */
export default function AthleteProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    let active = true;
    function load() {
      setPersona(null); setError(null); setExpired(false); setLoading(true);
      getChat(id).then(({ persona: athlete }) => {
        if (active) setPersona(athlete);
      }).catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el perfil.');
        setExpired(e instanceof ApiError && e.status === 401);
      }).finally(() => { if (active) setLoading(false); });
    }
    reload.current = load;
    load();
    return () => { active = false; reload.current = () => {}; };
  }, [id]));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Volver a matches" style={styles.back}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(deportista)/(tabs)/matches')}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Perfil del deportista</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Cargando perfil" />}
        {error && <View style={styles.section}>
          <Text style={styles.body}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => expired ? router.replace('/(auth)/login') : reload.current()}>
            <Text style={styles.buttonText}>{expired ? 'Iniciar sesión' : 'Reintentar'}</Text>
          </TouchableOpacity>
        </View>}
        {persona && <>
          <Avatar name={persona.name} colorFrom={persona.colorFrom} uri={persona.fotoUri} style={styles.photo} fontSize={52} />
          <Text style={styles.name}>{persona.name}{persona.age != null ? `, ${persona.age}` : ''}</Text>
          <Text style={styles.matched}>♥ Tienen un match</Text>
          <View style={styles.section}>
            <Text style={styles.title}>Sobre mí</Text>
            <Text style={styles.body}>{persona.bio?.trim() || 'Este deportista aún no ha agregado una biografía.'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.title}>Deportes</Text>
            {persona.deportes?.length ? persona.deportes.map((sport, index) => (
              <View key={`${sport.nombre}-${index}`} style={styles.sport}>
                <Text style={styles.body}>{sport.nombre}</Text>
                <Text style={styles.secondary}>{sport.nivel}</Text>
              </View>
            )) : <Text style={styles.body}>Aún no ha agregado deportes.</Text>}
          </View>
          <TouchableOpacity style={styles.button}
            onPress={() => router.navigate({ pathname: '/(deportista)/chat/[id]', params: { id } })}>
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Enviar mensaje</Text>
          </TouchableOpacity>
        </>}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  back: { padding: 10 },
  content: { paddingHorizontal: 24, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: c.text, fontSize: 17, fontWeight: '700' },
  photo: { width: '100%', height: 260, borderRadius: 20, overflow: 'hidden' },
  name: { color: c.text, fontSize: 26, fontWeight: '700' },
  matched: { color: c.success, fontSize: 14, fontWeight: '600' },
  section: { padding: 18, gap: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border },
  body: { color: c.text, fontSize: 15, lineHeight: 23 },
  secondary: { color: c.textMuted, fontSize: 13 },
  sport: { gap: 4 },
  button: { backgroundColor: c.primary, padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
