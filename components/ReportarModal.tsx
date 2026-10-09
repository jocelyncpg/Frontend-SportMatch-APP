import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MAX_DETALLE, MOTIVOS, TITULO_TIPO, reportar, type TipoReporte } from '../services/reportes';
import { Colors, useAppTheme } from '../theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  tipo: TipoReporte;
  /** Id de lo que se reporta (persona, actividad o mensaje). */
  objetivoId: string;
  /** Nombre que se muestra en el formulario. */
  objetivoNombre: string;
};

export default function ReportarModal({ visible, onClose, tipo, objetivoId, objetivoNombre }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  // Cada vez que se abre, el formulario parte limpio.
  useEffect(() => {
    if (visible) {
      setMotivo(null);
      setDetalle('');
      setError(null);
      setEnviado(false);
    }
  }, [visible]);

  function enviar() {
    if (!motivo) {
      setError('Elige un motivo para el reporte.');
      return;
    }
    const r = reportar(tipo, objetivoId, objetivoNombre, motivo, detalle);
    if (!r.ok) {
      setError(r.motivo);
      return;
    }
    setError(null);
    setEnviado(true);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          {enviado ? (
            <>
              <Ionicons name="shield-checkmark-outline" size={38} color={colors.success} style={styles.okIcono} />
              <Text style={styles.titulo}>Gracias por avisar</Text>
              <Text style={styles.hint}>
                Recibimos tu reporte sobre {objetivoNombre}. Nuestro equipo lo revisará y tomará las medidas que correspondan.
              </Text>
              <TouchableOpacity style={styles.btnPrimario} onPress={onClose}>
                <Text style={styles.btnPrimarioTexto}>Cerrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.titulo}>{TITULO_TIPO[tipo]}</Text>
              <Text style={styles.hint} numberOfLines={2}>{objetivoNombre}</Text>

              <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>¿Qué pasó?</Text>
                {MOTIVOS[tipo].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.motivo, motivo === m && styles.motivoOn]}
                    onPress={() => {
                      setMotivo(m);
                      setError(null);
                    }}
                    accessibilityLabel={`Motivo: ${m}`}
                  >
                    <Ionicons
                      name={motivo === m ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={motivo === m ? colors.accent : colors.textMuted}
                    />
                    <Text style={styles.motivoTexto}>{m}</Text>
                  </TouchableOpacity>
                ))}

                <Text style={[styles.label, { marginTop: 14 }]}>Cuéntanos más (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Describe lo que ocurrió"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={MAX_DETALLE}
                  value={detalle}
                  onChangeText={(t) => {
                    setDetalle(t);
                    if (error) setError(null);
                  }}
                />
                <Text style={styles.contador}>{detalle.length}/{MAX_DETALLE}</Text>
              </ScrollView>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnCancelar} onPress={onClose}>
                  <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimario, styles.btnFlex, !motivo && styles.btnOff]} onPress={enviar}>
                  <Text style={styles.btnPrimarioTexto}>Enviar reporte</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    box: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border, maxHeight: '88%' },
    titulo: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
    hint: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 },
    okIcono: { alignSelf: 'center', marginBottom: 10 },
    scroll: { flexGrow: 0 },
    label: { color: c.text, fontSize: 12, fontWeight: '700', marginBottom: 8 },
    motivo: {
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, marginBottom: 8, backgroundColor: c.bg,
    },
    motivoOn: { borderColor: c.accent },
    motivoTexto: { color: c.text, fontSize: 12.5, flex: 1 },
    input: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, height: 84, textAlignVertical: 'top',
    },
    contador: { color: c.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4, marginBottom: 6 },
    error: { color: c.danger, fontSize: 11.5, marginTop: 6, marginBottom: 4 },
    acciones: { flexDirection: 'row', gap: 10, marginTop: 10 },
    btnCancelar: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    btnCancelarTexto: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    btnPrimario: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    btnFlex: { flex: 1 },
    btnOff: { opacity: 0.5 },
    btnPrimarioTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });