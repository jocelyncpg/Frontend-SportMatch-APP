import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Logo from '../../components/Logo';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Postulante = { id: string; name: string; sport: string; level: string; colorFrom: string };

const POSTULANTES_INICIALES: Postulante[] = [
  { id: '1', name: 'Matías P.', sport: 'Atletismo', level: 'Avanzado', colorFrom: '#7C3AED' },
  { id: '2', name: 'Valentina S.', sport: 'Atletismo', level: 'Intermedio', colorFrom: '#22C55E' },
];

export default function ClubHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<'postulantes' | 'confirmados'>('postulantes');
  const [postulantes, setPostulantes] = useState(POSTULANTES_INICIALES);
  const [confirmados, setConfirmados] = useState<Postulante[]>([]);

  const [convocatoria, setConvocatoria] = useState<{ titulo: string; descripcion: string } | null>({
    titulo: 'Buscamos velocistas nivel intermedio-avanzado',
    descripcion: 'Completar el equipo de pista para la temporada 2026.',
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [tituloTemp, setTituloTemp] = useState('');
  const [descTemp, setDescTemp] = useState('');

  function abrirEditor() {
    setTituloTemp(convocatoria?.titulo ?? '');
    setDescTemp(convocatoria?.descripcion ?? '');
    setModalVisible(true);
  }

  function guardarConvocatoria() {
    if (!tituloTemp.trim()) return;
    setConvocatoria({ titulo: tituloTemp.trim(), descripcion: descTemp.trim() });
    setModalVisible(false);
  }

  function cerrarConvocatoria() {
    setConvocatoria(null);
  }

  function confirmar(id: string) {
    const persona = postulantes.find((p) => p.id === id);
    if (!persona) return;
    setConfirmados((prev) => [...prev, persona]);
    setPostulantes((prev) => prev.filter((p) => p.id !== id));
  }

  function rechazar(id: string) {
    setPostulantes((prev) => prev.filter((p) => p.id !== id));
  }

  const lista = tab === 'postulantes' ? postulantes : confirmados;

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Logo width={120} />
        <View style={styles.clubBadge}>
          <Ionicons name="shield" size={16} color="#fff" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Mi convocatoria</Text>

        {convocatoria ? (
          <View style={styles.convocatoriaCard}>
            <View style={styles.convocatoriaHeader}>
              <Ionicons name="megaphone" size={16} color={colors.success} />
              <Text style={styles.convocatoriaBadge}>Abierta</Text>
            </View>
            <Text style={styles.convocatoriaTitulo}>{convocatoria.titulo}</Text>
            <Text style={styles.convocatoriaDesc}>{convocatoria.descripcion}</Text>
            <View style={styles.convocatoriaActions}>
              <TouchableOpacity style={styles.editButton} onPress={abrirEditor}>
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={cerrarConvocatoria}>
                <Text style={styles.closeButtonText}>Cerrar convocatoria</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.emptyConvocatoria} onPress={abrirEditor}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
            <Text style={styles.emptyConvocatoriaText}>Crear una convocatoria</Text>
          </TouchableOpacity>
        )}

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'postulantes' && styles.tabActive]} onPress={() => setTab('postulantes')}>
            <Text style={[styles.tabText, tab === 'postulantes' && styles.tabTextActive]}>
              Postulantes {postulantes.length > 0 ? `(${postulantes.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'confirmados' && styles.tabActive]} onPress={() => setTab('confirmados')}>
            <Text style={[styles.tabText, tab === 'confirmados' && styles.tabTextActive]}>
              Confirmados {confirmados.length > 0 ? `(${confirmados.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {lista.map((persona) => (
          <View key={persona.id} style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: persona.colorFrom }]} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{persona.name}</Text>
              <Text style={styles.cardMeta}>{persona.sport} · {persona.level}</Text>
            </View>
            {tab === 'postulantes' && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.rejectButton} onPress={() => rechazar(persona.id)}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptButton} onPress={() => confirmar(persona.id)}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {lista.length === 0 && (
          <Text style={styles.emptyText}>
            {tab === 'postulantes' ? 'No hay postulantes por ahora.' : 'Todavía no hay confirmados.'}
          </Text>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Convocatoria</Text>
            <View style={styles.inputBox}>
              <TextInput
                placeholder="Título (ej: Buscamos velocistas nivel intermedio)"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={tituloTemp}
                onChangeText={setTituloTemp}
              />
            </View>
            <View style={[styles.inputBox, { height: 90, alignItems: 'flex-start' }]}>
              <TextInput
                placeholder="Descripción y requisitos"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
                value={descTemp}
                onChangeText={setDescTemp}
                multiline
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={guardarConvocatoria}>
                <Text style={styles.modalSaveText}>Publicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
    clubBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20, paddingBottom: 30 },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
    convocatoriaCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 24 },
    convocatoriaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    convocatoriaBadge: { color: c.success, fontSize: 10.5, fontWeight: '700' },
    convocatoriaTitulo: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    convocatoriaDesc: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 },
    convocatoriaActions: { flexDirection: 'row', gap: 10 },
    editButton: { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    editButtonText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    closeButton: { flex: 1, backgroundColor: c.dangerBg, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    closeButtonText: { color: c.danger, fontSize: 12, fontWeight: '700' },
    emptyConvocatoria: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', borderRadius: 16, padding: 18, marginBottom: 24, justifyContent: 'center' },
    emptyConvocatoriaText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    tabActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 10 },
    avatar: { width: 48, height: 48, borderRadius: 12 },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8 },
    rejectButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.subtle, alignItems: 'center', justifyContent: 'center' },
    acceptButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 20 },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
    input: { color: c.text, fontSize: 13, flex: 1 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    modalSave: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  });