import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ApiError } from '../../../services/api';
import { Usuario, getSession, refrescarPreferencias, logout, updateFotoPerfil, updatePerfilExtra, updateUbicacion } from '../../../services/auth';
import { codigoDeporte } from '../../../services/deportes';
import { GEOAPIFY_API_KEY, solicitarUbicacion } from '../../../services/location';
import { Colors, Mode, useAppTheme } from '../../../theme/ThemeContext';

const DEPORTES_DISPONIBLES = ['Running', 'Fútbol', 'Ciclismo', 'Yoga', 'Tenis', 'Natación', 'Trekking'];

/** Los cambios del perfil ahora se guardan en el servidor, así que pueden fallar. */
function avisarError(titulo: string, e: unknown) {
  const mensaje =
    e instanceof ApiError && e.status === 422
      ? 'Revisa los datos: la comuna solo puede tener letras, espacios, guiones o apóstrofos, y cada deporte debe tener nombre.'
      : e instanceof Error
        ? e.message
        : 'Inténtalo de nuevo.';
  Alert.alert(titulo, mensaje);
}

const OPCIONES_TEMA: { key: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'Automático', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Claro', icon: 'sunny-outline' },
  { key: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [comunaManual, setComunaManual] = useState('');
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const [mapaError, setMapaError] = useState(false);

  const [modalBioVisible, setModalBioVisible] = useState(false);
  const [bioTemp, setBioTemp] = useState('');
  const [modalDeportesVisible, setModalDeportesVisible] = useState(false);
  const [deportesTemp, setDeportesTemp] = useState<string[]>([]);
  const [nivelesTemp, setNivelesTemp] = useState<Record<string, number>>({});
  const [guardandoDeportes, setGuardandoDeportes] = useState(false);
  const [otroDeporteTexto, setOtroDeporteTexto] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    getSession().then((session) => { if (active) setUsuario(session); });
    refrescarPreferencias().then((session) => { if (active) setUsuario(session); })
      .catch((e) => { if (active) avisarError('No se pudo actualizar el perfil', e); });
    return () => { active = false; };
  }, []));

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
    try {
      const resultado = await solicitarUbicacion();
      if (resultado.ok && resultado.ubicacion) {
        const { latitud, longitud, comuna } = resultado.ubicacion;
        const comunaFinal = comuna ?? 'Ubicación detectada';
        await updateUbicacion(usuario.id, { comuna: comunaFinal, latitud, longitud });
        setUsuario({ ...usuario, comuna: comunaFinal, latitud, longitud });
        setPermisoNegado(false);
      } else {
        setPermisoNegado(true);
      }
    } catch (e) {
      avisarError('No se pudo obtener o guardar tu ubicación', e);
    } finally { setPidiendoUbicacion(false); }
  }

  async function handleGuardarComunaManual() {
    if (!usuario || !comunaManual.trim()) return;
    try {
      await updateUbicacion(usuario.id, { comuna: comunaManual.trim() });
    } catch (e) {
      avisarError('No se pudo guardar la comuna', e);
      return;
    }
    setUsuario({ ...usuario, comuna: comunaManual.trim(), latitud: undefined, longitud: undefined });
  }

  function abrirEditorBio() {
    setBioTemp(usuario?.biografia ?? '');
    setModalBioVisible(true);
  }

  async function guardarBio() {
    if (!usuario) return;
    try {
      await updatePerfilExtra(usuario.id, { biografia: bioTemp.trim() });
    } catch (e) {
      avisarError('No se pudo guardar tu biografía', e);
      return;
    }
    setUsuario({ ...usuario, biografia: bioTemp.trim() });
    setModalBioVisible(false);
  }

  function abrirEditorDeportes() {
    const actuales = usuario?.deportes ?? [];
    const enLista = actuales.filter((d) => DEPORTES_DISPONIBLES.includes(d));
    const personalizados = actuales.filter((d) => !DEPORTES_DISPONIBLES.includes(d));
    setDeportesTemp(enLista);
    setNivelesTemp(usuario?.nivelesDeportes ?? {});
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
    setGuardandoDeportes(true);
    try {
      await updatePerfilExtra(usuario.id, { deportes: deportesFinales, nivelesDeportes: nivelesTemp });
    } catch (e) {
      avisarError('No se pudieron guardar tus deportes', e);
      return;
    } finally { setGuardandoDeportes(false); }
    setUsuario(await getSession());
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
              <Ionicons name="location" size={14} color={colors.success} />
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
              <Ionicons name="navigate-outline" size={15} color={colors.accent} />
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
                    placeholderTextColor={colors.textMuted}
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
                <Text style={styles.deporteChipText}>{d} · Nivel {usuario.nivelesDeportes?.[codigoDeporte(d)] ?? 3}/5</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sectionText}>Todavía no has agregado deportes a tu perfil.</Text>
        )}
      </View>

      {/* Apariencia */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Apariencia</Text>
        <View style={styles.themeRow}>
          {OPCIONES_TEMA.map((op) => {
            const activo = mode === op.key;
            return (
              <TouchableOpacity
                key={op.key}
                style={[styles.themeOption, activo && styles.themeOptionActive]}
                onPress={() => setMode(op.key)}
              >
                <Ionicons name={op.icon} size={18} color={activo ? '#fff' : colors.textMuted} />
                <Text style={[styles.themeOptionText, activo && styles.themeOptionTextActive]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
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
              placeholderTextColor={colors.textMuted}
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
      <Modal visible={modalDeportesVisible} transparent animationType="fade" onRequestClose={() => setModalDeportesVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>Mis deportes</Text>
            <ScrollView>
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
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={otroDeporteTexto}
                onChangeText={setOtroDeporteTexto}
              />
            </View>

            <Text style={styles.otroLabel}>Tu nivel por deporte: 1–2 principiante · 3 intermedio · 4–5 avanzado</Text>
            {[...new Set([...deportesTemp, ...otroDeporteTexto.split(',').map((d) => d.trim()).filter(Boolean)])].map((sport) => {
              const code = codigoDeporte(sport);
              const level = nivelesTemp[code] ?? 3;
              return <View key={code}>
                <Text style={styles.sectionText}>{sport}</Text>
                <View style={styles.chipsWrap}>{[1, 2, 3, 4, 5].map((value) => (
                  <TouchableOpacity key={value} style={[styles.selectChip, value === level && styles.selectChipActive]}
                    accessibilityLabel={`${sport}: nivel ${value}`} accessibilityState={{ selected: level === value }}
                    onPress={() => setNivelesTemp({ ...nivelesTemp, [code]: value })}>
                    <Text style={[styles.selectChipText, value === level && styles.selectChipTextActive]}>{value}</Text>
                  </TouchableOpacity>
                ))}</View>
              </View>;
            })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalDeportesVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} disabled={guardandoDeportes} onPress={guardarDeportes}>
                <Text style={styles.loginButtonText}>{guardandoDeportes ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 60, alignItems: 'center' },
    header: { alignItems: 'center', marginBottom: 24 },
    avatarWrapper: { width: 100, height: 100, marginBottom: 12 },
    avatarInner: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: c.card, borderWidth: 2, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { color: c.text, fontSize: 30, fontWeight: '700' },
    editBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: c.primary, borderWidth: 3, borderColor: c.bg,
      alignItems: 'center', justifyContent: 'center',
    },
    name: { color: c.text, fontSize: 18, fontWeight: '700' },
    email: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    statsRow: {
      flexDirection: 'row', width: '100%', backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 14, marginBottom: 20,
    },
    statBox: { flex: 1, alignItems: 'center' },
    statNumber: { color: c.text, fontSize: 17, fontWeight: '700' },
    statLabel: { color: c.textMuted, fontSize: 9.5, marginTop: 2 },
    section: { width: '100%', marginBottom: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    sectionTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    sectionText: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locationText: { color: c.text, fontSize: 12.5, fontWeight: '600' },
    updateLink: { color: c.accent, fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },
    mapImage: { width: '100%', height: 140, borderRadius: 12, marginTop: 10, backgroundColor: c.card },
    locationButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start',
    },
    locationButtonText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    manualLocation: { marginTop: 12, width: '100%' },
    inputBoxSmall: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, marginBottom: 10,
    },
    input: { color: c.text, fontSize: 13 },
    saveComunaButton: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    loginButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    logoutButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderColor: c.danger, borderRadius: 13,
      paddingVertical: 12, paddingHorizontal: 24, marginTop: 12,
    },
    logoutText: { color: c.danger, fontSize: 13, fontWeight: '700' },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    deporteChip: { backgroundColor: c.chip, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    deporteChipText: { color: c.accent, fontSize: 11.5, fontWeight: '700' },

    themeRow: { flexDirection: 'row', gap: 8 },
    themeOption: {
      flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12,
    },
    themeOptionActive: { backgroundColor: c.primary, borderColor: c.primary },
    themeOptionText: { color: c.textMuted, fontSize: 11.5, fontWeight: '600' },
    themeOptionTextActive: { color: '#fff' },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
    bioInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, height: 90, textAlignVertical: 'top',
    },
    charCount: { color: c.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4, marginBottom: 10 },
    selectChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 },
    selectChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    selectChipText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    selectChipTextActive: { color: '#fff' },
    otroLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 6 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    modalSave: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  });
