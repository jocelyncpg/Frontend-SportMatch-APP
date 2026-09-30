import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AthleteCard from '../../../components/AthleteCard';
import BrandLogo from '../../../components/BrandLogo';
import TrainingRow from '../../../components/TrainingRow';
import { Usuario, getSession } from '../../../services/auth';
import { cargarSugerencias, sugerencias, useMatches } from '../../../services/matchStore';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const estado = useMatches();
  const recomendados = useMemo(() => sugerencias(estado).slice(0, 5), [estado]);

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // Cada vez que se vuelve a esta pestaña se traen los deportistas actualizados.
  useFocusEffect(
    useCallback(() => {
      getSession().then(setUsuario);
      void cargarSugerencias();
    }, [])
  );

  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      {/* Encabezado */}
      <View style={styles.header}>
        <BrandLogo width={200} />

        <TouchableOpacity
          onPress={() =>
            router.push('/(deportista)/(tabs)/profile')
          }
          style={styles.miniAvatar}
        >
          {usuario?.fotoPerfil ? (
            <Image
              source={{ uri: usuario.fotoPerfil }}
              style={styles.miniAvatarImage}
            />
          ) : (
            <Text style={styles.miniAvatarText}>
              {iniciales}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>
        ¡Hola, {usuario?.nombre ?? '...'}! 👋
      </Text>

      <Text style={styles.subtitle}>
        ¿Qué deporte quieres practicar hoy?
      </Text>

      {/* Buscador */}
      <View style={styles.searchBox}>
        <Ionicons
          name="search"
          size={16}
          color={colors.textMuted}
        />

        <TextInput
          placeholder="Buscar deporte, personas o clubes..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {/* Acceso al directorio de clubes */}
      <TouchableOpacity
        style={styles.clubBanner}
        onPress={() => router.push('/(deportista)/clubs')}
      >
        <Ionicons name="shield-outline" size={18} color={colors.accent} />
        <Text style={styles.clubBannerText}>Explorar clubes cerca de ti</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Sección: Deportistas recomendados */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          Deportistas recomendados
        </Text>

        <TouchableOpacity onPress={() => router.push('/(deportista)/(tabs)/discover')}>
          <Text style={styles.sectionLink}>
            Ver todos
          </Text>
        </TouchableOpacity>
      </View>

      {recomendados.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {recomendados.map((persona) => (
            <AthleteCard
              key={persona.id}
              name={persona.name}
              sport={persona.sport}
              level={persona.level}
              distance={persona.distance}
              compatibility={persona.compatibility}
              colorFrom={persona.colorFrom}
              fotoUri={persona.fotoUri}
              onPress={() => router.push('/(deportista)/(tabs)/discover')}
            />
          ))}
        </ScrollView>
      ) : estado.cargando ? (
        <Text style={styles.emptyText}>Cargando deportistas...</Text>
      ) : estado.error ? (
        <TouchableOpacity
          onPress={() =>
            estado.sesionExpirada ? router.replace('/(auth)/login') : void cargarSugerencias()
          }
        >
          <Text style={styles.emptyText}>{estado.error}</Text>
          <Text style={styles.sectionLink}>
            {estado.sesionExpirada ? 'Iniciar sesión' : 'Reintentar'}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.emptyText}>
          {estado.catalogo.length === 0
            ? 'Aún no hay otros deportistas registrados.'
            : 'Ya viste a todos los deportistas cerca de ti por ahora.'}
        </Text>
      )}

      {/* Sección: Entrenamientos cerca de ti */}
      <View style={[styles.sectionRow, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>
          Entrenamientos cerca de ti
        </Text>

        <TouchableOpacity onPress={() => router.push('/(deportista)/activities')}>
          <Text style={styles.sectionLink}>
            Ver todos
          </Text>
        </TouchableOpacity>
      </View>

      <TrainingRow
        icon="🏃"
        title="Running en Parque Bicentenario"
        time="Hoy, 19:30"
        distance="1.2 km"
        colorBg="#1B3324"
      />

      <TrainingRow
        icon="⚽"
        title="Fútbol 7 — Maipú"
        time="Mañana, 20:00"
        distance="2.8 km"
        colorBg="#1B2144"
      />

      <TrainingRow
        icon="🧘"
        title="Yoga al aire libre"
        time="Sábado, 09:00"
        distance="3.4 km"
        colorBg="#2B1B44"
      />
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    content: {
      paddingHorizontal: 20,
      paddingBottom: 30,
    },

    header: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },

    miniAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },

    miniAvatarImage: {
      width: '100%',
      height: '100%',
    },

    miniAvatarText: {
      color: c.text,
      fontSize: 12,
      fontWeight: '700',
    },

    greeting: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },

    subtitle: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: 16,
    },

    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 14,
    },

    searchInput: {
      color: c.text,
      fontSize: 13,
      flex: 1,
    },

    clubBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 22,
    },

    clubBannerText: {
      color: c.text,
      fontSize: 12.5,
      fontWeight: '600',
      flex: 1,
    },

    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12,
    },

    sectionTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },

    sectionLink: {
      color: c.accent,
      fontSize: 11,
      fontWeight: '600',
    },

    emptyText: {
      color: c.textMuted,
      fontSize: 12,
    },
  });