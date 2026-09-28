import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../../components/Avatar';
import { Colors, useAppTheme } from '../../../theme/ThemeContext';

type Mensaje = { id: string; texto: string; propio: boolean };

// Conversaciones de prueba para los matches que ya tenían mensajes.
// Un match nuevo empieza con el chat vacío. Se reemplaza por la API de chat.
const CONVERSACIONES_PREVIAS: Record<string, Mensaje[]> = {
  camila: [
    { id: 'c1', texto: '¡Hola! Vi que también corres los fines de semana 🏃‍♀️', propio: false },
    { id: 'c2', texto: '¡Sí! Estoy entrenando para una media maratón. ¿Salimos mañana?', propio: true },
    { id: 'c3', texto: '¡Dale, nos vemos a las 19:30!', propio: false },
  ],
  diego: [
    { id: 'd1', texto: '¡Buenas! ¿Juegas fútbol los fines de semana?', propio: false },
    { id: 'd2', texto: 'Sí, los sábados en la mañana. ¿Te sumas?', propio: true },
    { id: 'd3', texto: 'Perfecto, cualquier cosa avísame', propio: false },
  ],
};

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const { id, name, sport, colorFrom } = useLocalSearchParams<{ id: string; name: string; sport: string; colorFrom: string }>();
  const nombre = name ?? 'Deportista';
  const primerNombre = nombre.split(' ')[0];

  const [mensajes, setMensajes] = useState<Mensaje[]>(CONVERSACIONES_PREVIAS[id ?? ''] ?? []);
  const [texto, setTexto] = useState('');
  const listaRef = useRef<FlatList<Mensaje>>(null);

  const sugerencias = [
    '¡Hola! 👋',
    `¿Entrenamos ${sport ? sport.toLowerCase() : 'juntos'}?`,
    '¿Qué días te acomodan?',
  ];

  function enviar(contenido?: string) {
    const t = (contenido ?? texto).trim();
    if (!t) return;
    setMensajes((prev) => [...prev, { id: Date.now().toString(), texto: t, propio: true }]);
    setTexto('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Avatar name={nombre} colorFrom={colorFrom ?? '#7C3AED'} style={styles.avatar} fontSize={13} />
        <View>
          <Text style={styles.name}>{nombre}</Text>
          <Text style={styles.sport}>{sport ?? ''}</Text>
        </View>
      </View>

      <FlatList
        ref={listaRef}
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, mensajes.length === 0 && styles.listVacia]}
        onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.intro}>
            <View style={styles.introIcono}>
              <Ionicons name="heart" size={22} color="#fff" />
            </View>
            <Text style={styles.introTitulo}>Hiciste match con {primerNombre}</Text>
            <Text style={styles.introTexto}>Rompe el hielo y coordinen su primer entrenamiento.</Text>
            <View style={styles.sugerencias}>
              {sugerencias.map((s) => (
                <TouchableOpacity key={s} style={styles.sugerencia} onPress={() => enviar(s)}>
                  <Text style={styles.sugerenciaTexto}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.propio ? styles.bubbleOwn : styles.bubbleOther]}>
            <Text style={item.propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{item.texto}</Text>
          </View>
        )}
      />

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          placeholder="Escribe un mensaje..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => enviar()}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendButton} onPress={() => enviar()}>
          <Ionicons name="send" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: c.border },
    backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    name: { color: c.text, fontSize: 14, fontWeight: '700' },
    sport: { color: c.textMuted, fontSize: 11 },
    list: { padding: 20, gap: 10 },
    listVacia: { flexGrow: 1, justifyContent: 'center' },
    bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
    bubbleTextOther: { color: c.text, fontSize: 13 },
    bubbleTextOwn: { color: '#fff', fontSize: 13 },
    intro: { alignItems: 'center', paddingHorizontal: 12 },
    introIcono: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EC4899', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    introTitulo: { color: c.text, fontSize: 16, fontWeight: '700' },
    introTexto: { color: c.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },
    sugerencias: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 18 },
    sugerencia: { backgroundColor: c.chip, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
    sugerenciaTexto: { color: c.accent, fontSize: 12, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, borderColor: c.border },
    input: { flex: 1, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.text, fontSize: 13 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  });