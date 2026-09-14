import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Logo from '../../../components/Logo';
import { Usuario, getSession } from '../../../services/auth';

const SOLICITUDES = [
  { id: '1', name: 'Ignacio R.', sport: 'Ciclismo', level: 'Avanzado', compatibility: 85, colorFrom: '#7C3AED' },
  { id: '2', name: 'Daniela S.', sport: 'Yoga', level: 'Intermedio', compatibility: 90, colorFrom: '#22C55E' },
];

const CONFIRMADOS = [
  { id: '3', name: 'Camila R.', sport: 'Running', level: 'Intermedio', compatibility: 95, colorFrom: '#3648A6' },
  { id: '4', name: 'Diego A.', sport: 'Fútbol', level: 'Intermedio', compatibility: 89, colorFrom: '#1F2A5C' },
];

export default function MatchesScreen() {
  const [tab, setTab] = useState<'solicitudes' | 'confirmados'>('solicitudes');
  const [solicitudes, setSolicitudes] = useState(SOLICITUDES);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  function aceptar(id: string) {
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
  }

  function rechazar(id: string) {
    setSolicitudes((prev) => prev.filter((s) => s.id !== id));
  }

  const lista = tab === 'solicitudes' ? solicitudes : CONFIRMADOS;
  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.topbar}>

        <View style={styles.logoWrap}>
          <Logo width={270} />
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(deportista)/(tabs)/profile')}
          style={styles.miniAvatar}
        >
          {usuario?.fotoPerfil ? (
            <Image
              source={{ uri: usuario.fotoPerfil }}
              style={styles.miniAvatarImage}
            />
          ) : (
            <Text style={styles.miniAvatarText}>{iniciales}</Text>
          )}
        </TouchableOpacity>

      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            tab === 'solicitudes' && styles.tabActive,
          ]}
          onPress={() => setTab('solicitudes')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'solicitudes' && styles.tabTextActive,
            ]}
          >
            Solicitudes {solicitudes.length > 0 ? `(${solicitudes.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            tab === 'confirmados' && styles.tabActive,
          ]}
          onPress={() => setTab('confirmados')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'confirmados' && styles.tabTextActive,
            ]}
          >
            Confirmados
          </Text>
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <ScrollView contentContainerStyle={styles.list}>
        {lista.map((persona) => (
          <View key={persona.id} style={styles.card}>

            <View
              style={[
                styles.avatar,
                { backgroundColor: persona.colorFrom },
              ]}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {persona.compatibility}%
                </Text>
              </View>
            </View>

            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>
                {persona.name}
              </Text>

              <Text style={styles.cardMeta}>
                {persona.sport} · {persona.level}
              </Text>
            </View>

            {tab === 'solicitudes' ? (
              <View style={styles.actions}>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => rechazar(persona.id)}
                >
                  <Ionicons
                    name="close"
                    size={16}
                    color="#8A93A6"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => aceptar(persona.id)}
                >
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color="#fff"
                  />
                </TouchableOpacity>

              </View>
            ) : (
              <TouchableOpacity style={styles.chatButton}>
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color="#9061F9"
                />
              </TouchableOpacity>
            )}

          </View>
        ))}

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {tab === 'solicitudes'
              ? 'No tienes solicitudes pendientes.'
              : 'Todavía no tienes matches confirmados.'}
          </Text>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    paddingTop: 60,
  },

  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
    height: 55,
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

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },

  tab: {
    flex: 1,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },

  tabActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },

  tabText: {
    color: '#AEB6C2',
    fontSize: 12,
    fontWeight: '600',
  },

  tabTextActive: {
    color: '#fff',
  },

  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161C2A',
    borderWidth: 1,
    borderColor: '#262E40',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'flex-end',
    padding: 4,
  },

  badge: {
    backgroundColor: '#0B0F19',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },

  badgeText: {
    color: '#4ADE80',
    fontSize: 9,
    fontWeight: '700',
  },

  cardInfo: {
    flex: 1,
  },

  cardName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  cardMeta: {
    color: '#8A93A6',
    fontSize: 10.5,
    marginTop: 2,
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
  },

  rejectButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1D2333',
    alignItems: 'center',
    justifyContent: 'center',
  },

  acceptButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2536',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    color: '#8A93A6',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
});