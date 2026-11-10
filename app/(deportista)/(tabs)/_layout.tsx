import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import AvisoMensaje from '../../../components/AvisoMensaje';
import { useChatsRefresh } from '../../../hooks/useChatsRefresh';
import { YO } from '../../../services/actividades';
import { useNoLeidosTotal } from '../../../services/chat';
import { useNoLeidosGrupales } from '../../../services/chatGrupal';
import { useNoLeidosConsultas } from '../../../services/consultas';
import { useAppTheme } from '../../../theme/ThemeContext';
import { useVibrarAlLlegarAvisos } from '../../../services/notificacionUi';

export default function TabLayout() {
  const { colors } = useAppTheme();
  useChatsRefresh();

  // Globo de la pestaña Chat: sin leer en chats 1 a 1, grupos de actividad y respuestas de clubes.
  const noLeidos = useNoLeidosTotal() + useNoLeidosGrupales() + useNoLeidosConsultas(YO);
  useVibrarAlLlegarAvisos(noLeidos);

  // Vibra cuando llega algo nuevo: un mensaje (chat, grupo o club) o un aviso (solicitud, actividad o club).

  return (
    <>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Descubrir',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarBadge: noLeidos > 0 ? (noLeidos > 9 ? '9+' : noLeidos) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#fff', fontSize: 10 },
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
    {/* HU-60: aviso de mensaje nuevo sobre cualquier pestaña */}
    <AvisoMensaje />
    </>
  );
}
