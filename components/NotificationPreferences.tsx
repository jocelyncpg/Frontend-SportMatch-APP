import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { activarPush, desactivarPush, soportePush, usePush } from '../services/push';
import { useAppTheme } from '../theme/ThemeContext';

export function NotificationPreferences() {
  const { colors } = useAppTheme();
  const { enabled, busy, denied, error } = usePush();
  const unsupported = soportePush();
  return <View style={{ padding: 16, marginBottom: 20, gap: 10, borderRadius: 14, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>Alertas en este celular</Text>
    <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
      {unsupported ?? (enabled ? 'Recibirás solicitudes, matches, mensajes y cambios de actividades, incluso con la app cerrada.'
        : 'Actívalas para enterarte de tus solicitudes, matches, mensajes y actividades. Tú decides si das permiso.')}
    </Text>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    {denied ? <>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>El permiso está desactivado. Puedes cambiarlo en los ajustes del celular y luego activar las alertas aquí.</Text>
      <TouchableOpacity onPress={() => { void Linking.openSettings(); }}><Text style={{ color: colors.accent }}>Abrir ajustes</Text></TouchableOpacity>
    </> : null}
    {!unsupported ? <TouchableOpacity accessibilityRole="button" disabled={busy}
      onPress={() => { if (enabled) void desactivarPush().catch(() => {}); else void activarPush(); }}
      style={{ paddingVertical: 10, opacity: busy ? 0.5 : 1 }}>
      <Text style={{ color: colors.accent, fontWeight: '700' }}>{busy ? 'Guardando…' : enabled ? 'Desactivar alertas' : 'Activar notificaciones'}</Text>
    </TouchableOpacity> : null}
  </View>;
}
