import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function ClubProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { name, sport, comuna, colorFrom } = useLocalSearchParams<{ name: string; sport: string; comuna: string; colorFrom: string }>();
  const [postulado, setPostulado] = useState(false);

  function postular() {
    setPostulado(true);
    Alert.alert('Postulación enviada', 'El club revisará tu perfil y te avisaremos con el resultado.');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>

      <View style={[styles.avatar, { backgroundColor: colorFrom ?? '#7C3AED' }]}>
        <Ionicons name="shield" size={36} color="#fff" />
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{sport} · {comuna}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sobre el club</Text>
        <Text style={styles.sectionText}>
          Club deportivo con entrenamientos regulares y espacio para nuevos integrantes que quieran competir y mejorar su nivel.
        </Text>
      </View>

      <View style={styles.convocatoria}>
        <View style={styles.convocatoriaHeader}>
          <Ionicons name="megaphone-outline" size={16} color={colors.success} />
          <Text style={styles.convocatoriaTitle}>Convocatoria abierta</Text>
        </View>
        <Text style={styles.convocatoriaText}>Buscamos deportistas nivel intermedio-avanzado para completar el equipo de esta temporada.</Text>

        {postulado ? (
          <View style={styles.postuladoBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.postuladoText}>Postulación enviada</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.postularButton} onPress={postular}>
            <Text style={styles.postularButtonText}>Postular a esta convocatoria</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 60, alignItems: 'center' },
    backButton: { position: 'absolute', top: 60, left: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    avatar: { width: 84, height: 84, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    name: { color: c.text, fontSize: 19, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 20 },
    section: { width: '100%', marginBottom: 20 },
    sectionTitle: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    sectionText: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    convocatoria: { width: '100%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16 },
    convocatoriaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    convocatoriaTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    convocatoriaText: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
    postularButton: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    postularButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    postuladoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.successBg, borderRadius: 12, paddingVertical: 12, justifyContent: 'center' },
    postuladoText: { color: c.success, fontSize: 13, fontWeight: '700' },
  });