import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { logout } from '../../services/auth';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Postulante = { id: string; name: string; sport: string; level: string; colorFrom: string; fotoUri?: string | null };

// DATOS DE EJEMPLO: el nombre y la foto del club vendrán del backend cuando exista el perfil de club.
const NOMBRE_CLUB_DEMO = 'Club de Atletismo';

const POSTULANTES_INICIALES: Postulante[] = [
  { id: '1', name: 'Matías P.', sport: 'Atletismo', level: 'Avanzado', colorFrom: '#7C3AED' },
  { id: '2', name: 'Valentina S.', sport: 'Atletismo', level: 'Intermedio', colorFrom: '#22C55E' },
];

export default function ClubHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fotoClub, setFotoClub] = useState<string | null>(null);
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

  // ---------- Foto del club ----------
  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para elegir la imagen del club.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!resultado.canceled) setFotoClub(resultado.assets[0].uri);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu cámara para tomar la foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!resultado.canceled) setFotoClub(resultado.assets[0].uri);
  }

  function cambiarFoto() {
    Alert.alert('Foto del club', '¿Cómo quieres agregar la imagen?', [
      { text: 'Tomar foto', onPress: tomarFoto },
      { text: 'Elegir de galería', onPress: elegirDeGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  // ---------- Sesión ----------
  function confirmarCerrarSesion() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  // ---------- Convocatoria ----------
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

  // ---------- Postulantes ----------
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
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Encabezado del club */}
        <View style={styles.header}>
          <TouchableOpacity onPress={cambiarFoto} activeOpacity={0.85} accessibilityLabel="Cambiar foto del club">
            <Avatar name={NOMBRE_CLUB_DEMO} colorFrom="#7C3AED" uri={fotoClub} style={styles.clubFoto} fontSize={22} />
            <View style={styles.camaraBadge}>
              <Ionicons name="camera" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerEtiqueta}>Panel del club</Text>
            <Text style={styles.headerNombre} numberOfLines={1}>{NOMBRE_CLUB_DEMO}</Text>
          </View>
        </View>

        {/* Resumen */}
        <View style={styles.resumen}>
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValor}>{postulantes.length}</Text>
            <Text style={styles.resumenEtiqueta}>Postulantes</Text>
          </View>
          <View style={styles.resumenDivisor} />
          <View style={styles.resumenItem}>
            <Text style={styles.resumenValor}>{confirmados.length}</Text>
            <Text style={styles.resumenEtiqueta}>Confirmados</Text>
          </View>
          <View style={styles.resumenDivisor} />
          <View style={styles.resumenItem}>
            <Text style={[styles.resumenValor, { color: convocatoria ? colors.success : colors.textMuted }]}>
              {convocatoria ? 'Abierta' : 'Cerrada'}
            </Text>
            <Text style={styles.resumenEtiqueta}>Convocatoria</Text>
          </View>
        </View>

        {/* HU-39: acceso al catálogo de planes (versión club) */}
        <TouchableOpacity
          style={styles.planesCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(club)/planes' as never)}
        >
          <View style={styles.planesIcon}>
            <Ionicons name="ribbon-outline" size={18} color={colors.accent} />
          </View>
          <View style={styles.planesInfo}>
            <Text style={styles.planesTitle}>Planes y beneficios</Text>
            <Text style={styles.planesSub}>Conoce lo que incluye el plan Club</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

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

        <Text style={styles.sectionTitle}>Postulaciones</Text>

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
            <Avatar
              name={persona.name}
              colorFrom={persona.colorFrom}
              uri={persona.fotoUri}
              style={styles.avatar}
              fontSize={16}
            />
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

        <TouchableOpacity style={styles.logoutButton} onPress={confirmarCerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
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
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
    clubFoto: { width: 60, height: 60, borderRadius: 16 },
    camaraBadge: {
      position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11,
      backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center',
    },
    headerInfo: { flex: 1 },
    headerEtiqueta: { color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
    headerNombre: { color: c.text, fontSize: 19, fontWeight: '800', marginTop: 2 },

    resumen: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, paddingVertical: 14, marginBottom: 14,
    },
    resumenItem: { flex: 1, alignItems: 'center' },
    resumenValor: { color: c.text, fontSize: 17, fontWeight: '800' },
    resumenEtiqueta: { color: c.textMuted, fontSize: 10.5, marginTop: 3 },
    resumenDivisor: { width: 1, height: 28, backgroundColor: c.border },

    planesCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12, marginBottom: 22 },
    planesIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    planesInfo: { flex: 1 },
    planesTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    planesSub: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },

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

    logoutButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: c.dangerBg, borderRadius: 13, paddingVertical: 13, marginTop: 28,
    },
    logoutText: { color: c.danger, fontSize: 13, fontWeight: '700' },

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