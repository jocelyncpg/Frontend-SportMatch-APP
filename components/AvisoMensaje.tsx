import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { descartarAviso, useAvisoEntrante } from '../services/chat';
import { Colors, useAppTheme } from '../theme/ThemeContext';

/** Segundos que se ve el aviso antes de esconderse solo. */
const SEGUNDOS_VISIBLE = 5;

/**
 * HU-60: aviso dentro de la app cuando te escriben y no estás en ese chat.
 * Se ve sobre cualquier pestaña; al tocarlo abre la conversación.
 */
export default function AvisoMensaje() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const aviso = useAvisoEntrante();

  // Se esconde solo; un mensaje nuevo reinicia la cuenta.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(descartarAviso, SEGUNDOS_VISIBLE * 1000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;

  const nombre = aviso.nombre || 'Nuevo mensaje';
  const { matchId, personaId } = aviso;

  function abrir() {
    descartarAviso();
    router.push({ pathname: '/(deportista)/chat/[id]', params: { id: matchId, personaId } });
  }

  return (
    <View style={[styles.contenedor, { top: insets.top + 8 }]} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.aviso}
        onPress={abrir}
        activeOpacity={0.85}
        accessibilityRole="alert"
        accessibilityLabel={`${nombre} te escribió: ${aviso.texto}`}
      >
        <View style={styles.icono}>
          <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
        </View>
        <View style={styles.textos}>
          <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
          <Text style={styles.mensaje} numberOfLines={1}>{aviso.texto}</Text>
        </View>
        <TouchableOpacity onPress={descartarAviso} hitSlop={10} accessibilityLabel="Cerrar aviso">
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    contenedor: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
    aviso: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.accent,
      borderRadius: 14, padding: 12,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
    },
    icono: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    textos: { flex: 1 },
    nombre: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    mensaje: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
  });