import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type RatingModalProps = {
  visible: boolean;
  nombre: string;
  calificacionActual?: { estrellas: number; comentario?: string };
  onEnviar: (estrellas: number, comentario: string) => void;
  onCerrar: () => void;
};

export default function RatingModal({ visible, nombre, calificacionActual, onEnviar, onCerrar }: RatingModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [estrellas, setEstrellas] = useState(calificacionActual?.estrellas ?? 0);
  const [comentario, setComentario] = useState(calificacionActual?.comentario ?? '');

  // Cada vez que se abre, parte desde la calificación que ya existía (o en blanco).
  useEffect(() => {
    if (visible) {
      setEstrellas(calificacionActual?.estrellas ?? 0);
      setComentario(calificacionActual?.comentario ?? '');
    }
  }, [visible, calificacionActual?.estrellas, calificacionActual?.comentario]);

  function handleEnviar() {
    if (estrellas === 0) return;
    onEnviar(estrellas, comentario.trim());
  }

  const primerNombre = nombre.split(' ')[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>
            {calificacionActual ? `Tu calificación a ${primerNombre}` : `Calificar a ${primerNombre}`}
          </Text>
          <Text style={styles.subtitle}>¿Cómo fue entrenar con {primerNombre}?</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setEstrellas(n)}>
                <Ionicons
                  name={n <= estrellas ? 'star' : 'star-outline'}
                  size={34}
                  color={n <= estrellas ? '#FACC15' : colors.textMuted}
                  style={{ marginHorizontal: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Comentario (opcional)"
            placeholderTextColor={colors.textMuted}
            value={comentario}
            onChangeText={setComentario}
            maxLength={140}
            multiline
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCerrar}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, estrellas === 0 && { opacity: 0.5 }]}
              onPress={handleEnviar}
              disabled={estrellas === 0}
            >
              <Text style={styles.sendText}>{calificacionActual ? 'Actualizar' : 'Enviar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    box: { backgroundColor: c.card, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    title: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
    subtitle: { color: c.textMuted, fontSize: 12.5, marginBottom: 18, textAlign: 'center' },
    starsRow: { flexDirection: 'row', marginBottom: 18 },
    input: {
      width: '100%', backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, minHeight: 60, textAlignVertical: 'top', marginBottom: 16,
    },
    actions: { flexDirection: 'row', gap: 10, width: '100%' },
    cancelButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    cancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    sendButton: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    sendText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });