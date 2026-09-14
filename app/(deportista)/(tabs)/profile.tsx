import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Usuario, getSession, logout, updateFotoPerfil, updatePerfilExtra, updateUbicacion } from '../../../services/auth';
import { GEOAPIFY_API_KEY, solicitarUbicacion } from '../../../services/location';

const DEPORTES_DISPONIBLES = ['Running', 'Fútbol', 'Ciclismo', 'Yoga', 'Tenis', 'Natación', 'Trekking'];

export default function ProfileScreen() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [comunaManual, setComunaManual] = useState('');
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const [mapaError, setMapaError] = useState(false);

  const [modalBioVisible, setModalBioVisible] = useState(false);
  const [bioTemp, setBioTemp] = useState('');
  const [modalDeportesVisible, setModalDeportesVisible] = useState(false);
  const [deportesTemp, setDeportesTemp] = useState<string[]>([]);
  const [otroDeporteTexto, setOtroDeporteTexto] = useState('');

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para elegir tu avatar.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    guardarFotoSiExiste(resultado);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu cámara para tomar la foto.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    guardarFotoSiExiste(resultado);
  }

  async function guardarFotoSiExiste(resultado: ImagePicker.ImagePickerResult) {
    if (!resultado.canceled && usuario) {
      const uri = resultado.assets[0].uri;
      await updateFotoPerfil(usuario.id, uri);
      setUsuario({ ...usuario, fotoPerfil: uri });
    }
  }

  function handleChangePhoto() {
    Alert.alert('Foto de perfil', '¿Cómo quieres agregar tu foto?', [
      { text: 'Tomar foto', onPress: tomarFoto },
      { text: 'Elegir de galería', onPress: elegirDeGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleActivarUbicacion() {
    if (!usuario) return;
    setPidiendoUbicacion(true);
    setMapaError(false);
    const resultado = await solicitarUbicacion();
    setPidiendoUbicacion(false);

    if (resultado.ok && resultado.ubicacion) {
      const { latitud, longitud, comuna } = resultado.ubicacion;
      const comunaFinal = comuna ?? 'Ubicación detectada';
      await updateUbicacion(usuario.id, { comuna: comunaFinal, latitud, longitud });
      setUsuario({ ...usuario, comuna: comunaFinal, latitud, longitud });
      setPermisoNegado(false);
    } else {
      setPermisoNegado(true);
    }
  }

  async function handleGuardarComunaManual() {
    if (!usuario || !comunaManual.trim()) return;
    await updateUbicacion(usuario.id, { comuna: comunaManual.trim() });
    setUsuario({ ...usuario, comuna: comunaManual.trim() });
  }

  function abrirEditorBio() {
    setBioTemp(usuario?.biografia ?? '');
    setModalBioVisible(true);
  }

  async function guardarBio() {
    if (!usuario) return;
    await updatePerfilExtra(usuario.id, { biografia: bioTemp.trim() });
    setUsuario({ ...usuario, biografia: bioTemp.trim() });
    setModalBioVisible(false);
  }

  function abrirEditorDeportes() {
    const actuales = usuario?.deportes ?? [];
    const enLista = actuales.filter((d) => DEPORTES_DISPONIBLES.includes(d));
    const personalizados = actuales.filter((d) => !DEPORTES_DISPONIBLES.includes(d));
    setDeportesTemp(enLista);
    setOtroDeporteTexto(personalizados.join(', '));
    setModalDeportesVisible(true);
  }

  function toggleDeporte(deporte: string) {
    setDeportesTemp((prev) =>
      prev.includes(deporte) ? prev.filter((d) => d !== deporte) : [...prev, deporte]
    );
  }

  async function guardarDeportes() {
    if (!usuario) return;
    const extras = otroDeporteTexto
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
    const deportesFinales = [...deportesTemp, ...extras];
    await updatePerfilExtra(usuario.id, { deportes: deportesFinales });
    setUsuario({ ...usuario, deportes: deportesFinales });
    setModalDeportesVisible(false);
  }

  const nombreCompleto = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Cargando...';
  const iniciales = usuario ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}` : '..';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarWrapper}>
          <View style={styles.avatarInner}>
            {usuario?.fotoPerfil ? (
              <Image source={{ uri: usuario.fotoPerfil }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{iniciales}</Text>
            )}
          </View>
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={13} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{nombreCompleto}</Text>
        <Text style={styles.email}>{usuario?.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Entrenamientos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Conexiones</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>—</Text>
          <Text style={styles.statLabel}>Valoración</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        {usuario?.comuna ? (
          <View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color="#4ADE80" />
              <Text style={styles.locationText}>{usuario.comuna}</Text>
              <TouchableOpacity onPress={handleActivarUbicacion} disabled={pidiendoUbicacion}>
                <Text style={styles.updateLink}>{pidiendoUbicacion ? 'Actualizando...' : 'Actualizar'}</Text>
              </TouchableOpacity>
            </View>

            {usuario.latitud && usuario.longitud && !mapaError && (
              <Image
                source={{
                  uri: `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=400&height=180&center=lonlat:${usuario.longitud},${usuario.latitud}&zoom=15&marker=lonlat:${usuario.longitud},${usuario.latitud};color:%23ff0000;size:large&apiKey=${GEOAPIFY_API_KEY}`,
                }}
                style={styles.mapImage}
                onError={() => setMapaError(true)}
              />
            )}
            {mapaError && <Text style={styles.sectionText}>No se pudo cargar el mapa. Revisa tu conexión.</Text>}
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.locationButton} onPress={handleActivarUbicacion} disabled={pidiendoUbicacion}>
              <Ionicons name="navigate-outline" size={15} color="#9061F9" />
              <Text style={styles.locationButtonText}>
                {pidiendoUbicacion ? 'Detectando...' : 'Activar mi ubicación'}
              </Text>
            </TouchableOpacity>

            {permisoNegado && (
              <View style={styles.manualLocation}>
                <Text style={styles.sectionText}>No diste permiso de ubicación. Escribe tu comuna:</Text>
                <View style={styles.inputBoxSmall}>
                  <TextInput
                    placeholder="Ej: Providencia"
                    placeholderTextColor="#8A93A6"
                    style={styles.input}
                    value={comunaManual}
                    onChangeText={setComunaManual}
                  />
                </View>
                <TouchableOpacity style={styles.saveComunaButton} onPress={handleGuardarComunaManual}>
                  <Text style={styles.loginButtonText}>Guardar comuna</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Sobre mí</Text>
          <TouchableOpacity onPress={abrirEditorBio}>
            <Text style={styles.updateLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionText}>
          {usuario?.biografia ? usuario.biografia : 'Aún no has agregado una biografía.'}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Deportes</Text>
          <TouchableOpacity onPress={abrirEditorDeportes}>
            <Text style={styles.updateLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        {usuario?.deportes && usuario.deportes.length > 0 ? (
          <View style={styles.chipsWrap}>
            {usuario.deportes.map((d) => (
              <View key={d} style={styles.deporteChip}>
                <Text style={styles.deporteChipText}>{d}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sectionText}>Todavía no has agregado deportes a tu perfil.</Text>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#F87171" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      {/* Modal: editar biografía */}
      <Modal visible={modalBioVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Sobre mí</Text>
            <TextInput
              style={styles.bioInput}
              placeholder="Cuéntale a otros deportistas sobre ti..."
              placeholderTextColor="#8A93A6"
              multiline
              numberOfLines={4}
              maxLength={200}
              value={bioTemp}
              onChangeText={setBioTemp}
            />
            <Text style={styles.charCount}>{bioTemp.length}/200</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalBioVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={guardarBio}>
                <Text style={styles.loginButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: editar deportes */}
      <Modal visible={modalDeportesVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mis deportes</Text>
            <View style={styles.chipsWrap}>
              {DEPORTES_DISPONIBLES.map((d) => {
                const seleccionado = deportesTemp.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.selectChip, seleccionado && styles.selectChipActive]}
                    onPress={() => toggleDeporte(d)}
                  >
                    <Text style={[styles.selectChipText, seleccionado && styles.selectChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.otroLabel}>¿Practicas otro deporte?</Text>
            <View style={styles.inputBoxSmall}>
              <TextInput
                placeholder="Ej: Escalada, Box, Pádel..."
                placeholderTextColor="#8A93A6"
                style={styles.input}
                value={otroDeporteTexto}
                onChangeText={setOtroDeporteTexto}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalDeportesVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={guardarDeportes}>
                <Text style={styles.loginButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  content: { padding: 20, paddingTop: 60, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  avatarWrapper: { width: 100, height: 100, marginBottom: 12 },
  avatarInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#161C2A', borderWidth: 2, borderColor: '#262E40',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#7C3AED', borderWidth: 3, borderColor: '#0B0F19',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  email: { color: '#8A93A6', fontSize: 12, marginTop: 2 },
  statsRow: {
    flexDirection: 'row', width: '100%', backgroundColor: '#161C2A',
    borderWidth: 1, borderColor: '#262E40', borderRadius: 14, paddingVertical: 14, marginBottom: 20,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statLabel: { color: '#8A93A6', fontSize: 9.5, marginTop: 2 },
  section: { width: '100%', marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionText: { color: '#8A93A6', fontSize: 12, lineHeight: 17 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  updateLink: { color: '#9061F9', fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },
  mapImage: { width: '100%', height: 140, borderRadius: 12, marginTop: 10, backgroundColor: '#161C2A' },
  locationButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#161C2A', borderWidth: 1, borderColor: '#262E40',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  locationButtonText: { color: '#9061F9', fontSize: 12, fontWeight: '700' },
  manualLocation: { marginTop: 12, width: '100%' },
  inputBoxSmall: {
    backgroundColor: '#161C2A', borderWidth: 1, borderColor: '#262E40',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, marginBottom: 10,
  },
  input: { color: '#fff', fontSize: 13 },
  saveComunaButton: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  loginButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#F87171', borderRadius: 13,
    paddingVertical: 12, paddingHorizontal: 24, marginTop: 12,
  },
  logoutText: { color: '#F87171', fontSize: 13, fontWeight: '700' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deporteChip: { backgroundColor: '#1E2536', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  deporteChipText: { color: '#9061F9', fontSize: 11.5, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalBox: { backgroundColor: '#161C2A', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#262E40' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  bioInput: {
    backgroundColor: '#0B0F19', borderWidth: 1, borderColor: '#262E40', borderRadius: 12,
    padding: 12, color: '#fff', fontSize: 13, height: 90, textAlignVertical: 'top',
  },
  charCount: { color: '#8A93A6', fontSize: 10, textAlign: 'right', marginTop: 4, marginBottom: 10 },
  selectChip: { borderWidth: 1, borderColor: '#262E40', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 },
  selectChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  selectChipText: { color: '#AEB6C2', fontSize: 12, fontWeight: '600' },
  selectChipTextActive: { color: '#fff' },
  otroLabel: { color: '#8A93A6', fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 6 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#262E40', alignItems: 'center' },
  modalCancelText: { color: '#8A93A6', fontSize: 13, fontWeight: '700' },
  modalSave: { flex: 1, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});