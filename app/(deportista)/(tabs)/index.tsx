import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AthleteCard from '../../../components/AthleteCard';
import Logo from '../../../components/Logo';
import TrainingRow from '../../../components/TrainingRow';
import { Usuario, getSession } from '../../../services/auth';

export default function HomeScreen() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Encabezado */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Logo width={270} />
        </View>

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
          color="#8A93A6"
        />

        <TextInput
          placeholder="Buscar deporte, personas o clubes..."
          placeholderTextColor="#8A93A6"
          style={styles.searchInput}
        />
      </View>

      {/* Sección: Deportistas recomendados */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          Deportistas recomendados
        </Text>

        <Text style={styles.sectionLink}>
          Ver todos
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <AthleteCard
          name="Camila R."
          sport="Running"
          level="Intermedio"
          distance="1.8 km"
          compatibility={95}
          colorFrom="#3648A6"
          colorTo="#22C55E"
        />

        <AthleteCard
          name="Diego A."
          sport="Fútbol"
          level="Intermedio"
          distance="2.3 km"
          compatibility={89}
          colorFrom="#1F2A5C"
          colorTo="#6366F1"
        />

        <AthleteCard
          name="Valentina S."
          sport="Ciclismo"
          level="Intermedio"
          distance="2.7 km"
          compatibility={87}
          colorFrom="#22C55E"
          colorTo="#BBF7D0"
        />
      </ScrollView>

      {/* Sección: Entrenamientos cerca de ti */}
      <View style={[styles.sectionRow, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>
          Entrenamientos cerca de ti
        </Text>

        <Text style={styles.sectionLink}>
          Ver todos
        </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },

  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  logoWrap: {
    marginLeft: -38,
    marginTop: -25,
  },

  miniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  miniAvatarImage: {
    width: '100%',
    height: '100%',
  },

  miniAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  greeting: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },

  subtitle: {
    color: '#8A93A6',
    fontSize: 13,
    marginBottom: 16,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },

  searchInput: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  sectionLink: {
    color: '#9061F9',
    fontSize: 11,
    fontWeight: '600',
  },
});