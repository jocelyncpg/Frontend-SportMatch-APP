import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import MatchModal from '../../../components/MatchModal';
import { Usuario, getSession } from '../../../services/auth';
import { Persona, darLike, descartar } from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function PerfilDeportistaScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    id: string; name: string; sport: string; level: string; age: string;
    compatibility: string; distance: string; bio: string; colorFrom: string; fotoUri: string;
  }>();

  const persona: Persona = {
    id: params.id,
    name: params.name,
    sport: params.sport,
    level: params.level,
    age: params.age ? Number(params.age) : undefined,
    compatibility: Number(params.compatibility) || 0,
    distance: params.distance || undefined,
    bio: params.bio || undefined,
    colorFrom: params.colorFrom || '#7C3AED',
    fotoUri: params.fotoUri || null,
  };

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  function handlePasar() {
    descartar(persona.id);
    router.back();
  }

  function handleMeGusta() {
    const resultado = darLike(persona);
    if (resultado === 'match') {
      setNuevoMatch(persona);
    } else {
      router.back();
    }
  }

  function enviarMensajeDesdeMatch() {
    setNuevoMatch(null);
    router.replace({
      pathname: '/(deportista)/chat/[id]',
      params: { id: persona.id, name: persona.name, sport: persona.sport, colorFrom: persona.colorFrom },
    });
  }

  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Avatar
          name={persona.name}
          colorFrom={persona.colorFrom}
          uri={persona.fotoUri}
          style={styles.foto}
          fontSize={56}
        >
          <View style={styles.compatBadge}>
            <Text style={styles.compatText}>{persona.compatibility}% compatible</Text>
          </View>
        </Avatar>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {persona.name}{persona.age ? `, ${persona.age}` : ''}
            </Text>
            {persona.distance ? <Text style={styles.distance}>{persona.distance}</Text> : null}
          </View>

          <View style={styles.tagsRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{persona.sport}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{persona.level}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Sobre {persona.name.split(' ')[0]}</Text>
          <Text style={styles.bio}>
            {persona.bio || 'Todavía no agregó una biografía.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.rejectButton} onPress={handlePasar}>
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.acceptButton} onPress={handleMeGusta}>
          <Ionicons name="heart" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <MatchModal
        visible={nuevoMatch !== null}
        miNombre={miNombre}
        miFoto={usuario?.fotoPerfil}
        nombre={nuevoMatch?.name ?? ''}
        colorFrom={nuevoMatch?.colorFrom ?? '#7C3AED'}
        fotoUri={nuevoMatch?.fotoUri}
        onEnviarMensaje={enviarMensajeDesdeMatch}
        onCerrar={() => { setNuevoMatch(null); router.back(); }}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    backButton: {
      position: 'absolute', left: 20, zIndex: 2, top: 60,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingBottom: 30 },
    foto: { width: '100%', height: 320 },
    compatBadge: {
      position: 'absolute', bottom: 16, right: 16,
      backgroundColor: 'rgba(11,15,25,0.75)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    compatText: { color: '#4ADE80', fontSize: 12, fontWeight: '800' },
    info: { padding: 20 },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
    name: { color: c.text, fontSize: 22, fontWeight: '700' },
    distance: { color: c.textMuted, fontSize: 12 },
    tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    tag: { backgroundColor: c.chip, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
    tagText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    bio: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
    actions: {
      flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 20,
      borderTopWidth: 1, borderColor: c.border,
    },
    rejectButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    acceptButton: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: '#DB2777',
      alignItems: 'center', justifyContent: 'center',
    },
  });