import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { buscarComunas } from '../services/comunas';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type ComunaPickerProps = {
  visible: boolean;
  seleccionada?: string;
  onElegir: (comuna: string) => void;
  onCerrar: () => void;
};

export default function ComunaPicker({ visible, seleccionada, onElegir, onCerrar }: ComunaPickerProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [texto, setTexto] = useState('');

  // Cada vez que se abre, parte con el buscador vacío.
  useEffect(() => {
    if (visible) setTexto('');
  }, [visible]);

  const resultados = useMemo(() => buscarComunas(texto), [texto]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Elige tu comuna</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar comuna..."
              placeholderTextColor={colors.textMuted}
              value={texto}
              onChangeText={setTexto}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={resultados}
            keyExtractor={(c) => c}
            style={styles.lista}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.vacio}>No encontramos esa comuna en la Región Metropolitana.</Text>
            }
            renderItem={({ item }) => {
              const activa = item === seleccionada;
              return (
                <TouchableOpacity
                  style={[styles.fila, activa && styles.filaActiva]}
                  onPress={() => onElegir(item)}
                >
                  <Text style={[styles.filaTexto, activa && styles.filaTextoActiva]}>{item}</Text>
                  {activa ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    box: {
      height: '75%', backgroundColor: c.card, borderRadius: 18, padding: 18,
      borderWidth: 1, borderColor: c.border,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { color: c.text, fontSize: 16, fontWeight: '700' },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.inputBg,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, padding: 0 },
    lista: { flex: 1 },
    fila: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10,
    },
    filaActiva: { backgroundColor: c.chip },
    filaTexto: { color: c.text, fontSize: 13.5 },
    filaTextoActiva: { color: c.accent, fontWeight: '700' },
    vacio: { color: c.textMuted, fontSize: 12.5, textAlign: 'center', marginTop: 24, paddingHorizontal: 20, lineHeight: 18 },
  });