import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

type Mensaje = { id: string; texto: string; propio: boolean };

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { name, sport, colorFrom } = useLocalSearchParams<{ id: string; name: string; sport: string; colorFrom: string }>();
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { id: '1', texto: `¡Hola! Vi que hacemos match en ${sport ?? 'deporte'} 💪`, propio: false },
    { id: '2', texto: '¡Hola! Sí, dale, ¿cuándo te acomoda entrenar?', propio: true },
  ]);
  const [texto, setTexto] = useState('');

  function enviar() {
    if (!texto.trim()) return;
    setMensajes((prev) => [...prev, { id: Date.now().toString(), texto: texto.trim(), propio: true }]);
    setTexto('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: colorFrom ?? '#7C3AED' }]} />
        <View>
          <Text style={styles.name}>{name ?? 'Deportista'}</Text>
          <Text style={styles.sport}>{sport ?? ''}</Text>
        </View>
      </View>

      <FlatList
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.propio ? styles.bubbleOwn : styles.bubbleOther]}>
            <Text style={item.propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{item.texto}</Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
        />
        <TouchableOpacity style={styles.sendButton} onPress={enviar}>
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: c.border },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    name: { color: c.text, fontSize: 14, fontWeight: '700' },
    sport: { color: c.textMuted, fontSize: 11 },
    list: { padding: 20, gap: 10 },
    bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleTextOther: { color: c.text, fontSize: 13 },
    bubbleTextOwn: { color: '#fff', fontSize: 13 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 24, borderTopWidth: 1, borderColor: c.border },
    input: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.text, fontSize: 13 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  });