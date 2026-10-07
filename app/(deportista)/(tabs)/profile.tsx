import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ComunaPicker from '../../../components/ComunaPicker';
import { ApiError } from '../../../services/api';
import { DeporteConNivel, Usuario, getSession, logout, updateFotoPerfil, updatePerfilExtra, updateUbicacion } from '../../../services/auth';
import {
  DIAS,
  Disponibilidad,
  FRANJAS,
  OBJETIVOS_DISPONIBLES,
  resumenDisponibilidad,
  tieneFranja,
  toggleFranja,
} from '../../../services/disponibilidad';
import { GEOAPIFY_API_KEY, solicitarUbicacion } from '../../../services/location';
import { useMatches } from '../../../services/matchStore';
import { formatearPromedio, promedioEstrellas } from '../../../services/reputacion';
import { Colors, Mode, useAppTheme } from '../../../theme/ThemeContext';

const DEPORTES_DISPONIBLES = ['Running', 'Fútbol', 'Ciclismo', 'Yoga', 'Tenis', 'Natación', 'Trekking'];
const NIVELES = [1, 2, 3, 4, 5];
const NOMBRES_NIVEL: Record<number, string> = { 1: 'Principiante', 2: 'Básico', 3: 'Intermedio', 4: 'Avanzado', 5: 'Experto' };

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
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);
  const [mapaError, setMapaError] = useState(false);

  const [modalBioVisible, setModalBioVisible] = useState(false);
  const [bioTemp, setBioTemp] = useState('');
  const [modalDeportesVisible, setModalDeportesVisible] = useState(false);
  const [deportesTemp, setDeportesTemp] = useState<DeporteConNivel[]>([]);
  const [nuevoDeporteTexto, setNuevoDeporteTexto] = useState('');
  const [modalDispVisible, setModalDispVisible] = useState(false);
  const [dispTemp, setDispTemp] = useState<Disponibilidad>({});
  const [modalObjVisible, setModalObjVisible] = useState(false);
  const [objTemp, setObjTemp] = useState<string[]>([]);

  // Reputación: Conexiones = tus matches confirmados; Valoración = promedio de lo que recibes.
  const { confirmados, calificacionesRecibidas } = useMatches();
  const conexiones = confirmados.length;
  const promedio = promedioEstrellas(calificacionesRecibidas);
  const valoracion = formatearPromedio(promedio);
  const hayEjemplos = calificacionesRecibidas.some((c) => c.simulada);

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
      try {
        await updateUbicacion(usuario.id, { comuna: comunaFinal, latitud, longitud });
      } catch (e) {
        avisarError('No se pudo guardar tu ubicación', e);
        return;
      }
      setUsuario({ ...usuario, comuna: comunaFinal, latitud, longitud });
      setPermisoNegado(false);
    } else {
      setPermisoNegado(true);
    }
  }

  /** La comuna elegida de la lista pasa a ser la ubicación base; se descarta el punto GPS anterior. */
  async function handleElegirComuna(comuna: string) {
    if (!usuario) return;
    try {
      await updateUbicacion(usuario.id, { comuna, latitud: undefined, longitud: undefined });
    } catch (e) {
      avisarError('No se pudo guardar la comuna', e);
      return;
    }
    setUsuario({ ...usuario, comuna, latitud: undefined, longitud: undefined });
    setPermisoNegado(false);
    setMapaError(false);
    setPickerVisible(false);
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
    setDeportesTemp(usuario?.deportes ?? []);
    setNuevoDeporteTexto('');
    setModalDeportesVisible(true);
  }

  function toggleDeporte(deporte: string) {
    setDeportesTemp((prev) => {
      const yaEsta = prev.find((d) => d.nombre === deporte);
      if (yaEsta) return prev.filter((d) => d.nombre !== deporte);
      return [...prev, { nombre: deporte, nivel: 3 }];
    });
  }

  function agregarDeportePersonalizado() {
    const nombre = nuevoDeporteTexto.trim();
    if (!nombre) return;
    const yaExiste = deportesTemp.some((d) => d.nombre.toLowerCase() === nombre.toLowerCase());
    if (yaExiste) {
      setNuevoDeporteTexto('');
      return;
    }
    setDeportesTemp((prev) => [...prev, { nombre, nivel: 3 }]);
    setNuevoDeporteTexto('');
  }

  function quitarDeporte(nombre: string) {
    setDeportesTemp((prev) => prev.filter((d) => d.nombre !== nombre));
  }

  function cambiarNivel(deporte: string, nivel: number) {
    setDeportesTemp((prev) => prev.map((d) => (d.nombre === deporte ? { ...d, nivel } : d)));
  }

  async function guardarDeportes() {
    if (!usuario) return;
    try {
      await updatePerfilExtra(usuario.id, { deportes: deportesTemp });
    } catch (e) {
      avisarError('No se pudieron guardar tus deportes', e);
      return;
    }
    setUsuario({ ...usuario, deportes: deportesTemp });
    setModalDeportesVisible(false);
  }

  function abrirEditorDisponibilidad() {
    setDispTemp(usuario?.disponibilidad ?? {});
    setModalDispVisible(true);
  }

  async function guardarDisponibilidad() {
    if (!usuario) return;
    try {
      await updatePerfilExtra(usuario.id, { disponibilidad: dispTemp });
    } catch (e) {
      avisarError('No se pudo guardar tu disponibilidad', e);
      return;
    }
    setUsuario({ ...usuario, disponibilidad: dispTemp });
    setModalDispVisible(false);
  }

  function abrirEditorObjetivos() {
    setObjTemp(usuario?.objetivos ?? []);
    setModalObjVisible(true);
  }

  function toggleObjetivo(objetivo: string) {
    setObjTemp((prev) => (prev.includes(objetivo) ? prev.filter((o) => o !== objetivo) : [...prev, objetivo]));
  }

  async function guardarObjetivos() {
    if (!usuario) return;
    try {
      await updatePerfilExtra(usuario.id, { objetivos: objTemp });
    } catch (e) {
      avisarError('No se pudieron guardar tus objetivos', e);
      return;
    }
    setUsuario({ ...usuario, objetivos: objTemp });
    setModalObjVisible(false);
  }

  const nombreCompleto = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Cargando...';
  const iniciales = usuario ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}` : '..';
  const resumenDisp = resumenDisponibilidad(usuario?.disponibilidad);

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
          <Text style={styles.statNumber}>{conexiones}</Text>
          <Text style={styles.statLabel}>Conexiones</Text>
        </View>
        <View style={styles.statBox}>
          <View style={styles.statValueRow}>
            {promedio !== null ? <Ionicons name="star" size={13} color="#FACC15" /> : null}
            <Text style={styles.statNumber}>{valoracion}</Text>
          </View>
          <Text style={styles.statLabel}>Valoración</Text>
        </View>
      </View>

      {/* Ubicación */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        {usuario?.comuna ? (
          <View>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.success} />
              <Text style={styles.locationText}>{usuario.comuna}</Text>
              <View style={styles.locationLinks}>
                <TouchableOpacity onPress={() => setPickerVisible(true)}>
                  <Text style={styles.linkInline}>Cambiar comuna</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleActivarUbicacion} disabled={pidiendoUbicacion}>
                  <Text style={styles.linkInline}>{pidiendoUbicacion ? 'Actualizando...' : 'Usar GPS'}</Text>
                </TouchableOpacity>
              </View>
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
            <View style={styles.locationButtonsRow}>
              <TouchableOpacity style={styles.locationButton} onPress={handleActivarUbicacion} disabled={pidiendoUbicacion}>
                <Ionicons name="navigate-outline" size={15} color={colors.accent} />
                <Text style={styles.locationButtonText}>
                  {pidiendoUbicacion ? 'Detectando...' : 'Activar mi ubicación'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.locationButton} onPress={() => setPickerVisible(true)}>
                <Ionicons name="list-outline" size={15} color={colors.accent} />
                <Text style={styles.locationButtonText}>Elegir mi comuna</Text>
              </TouchableOpacity>
            </View>

            {permisoNegado && (
              <Text style={[styles.sectionText, { marginTop: 10 }]}>
                No diste permiso de ubicación. Puedes elegir tu comuna de la lista para seguir usando la búsqueda por cercanía.
              </Text>
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
              <View key={d.nombre} style={styles.deporteChip}>
                <Text style={styles.deporteChipText}>{d.nombre} · {NOMBRES_NIVEL[d.nivel] ?? d.nivel}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sectionText}>Todavía no has agregado deportes a tu perfil.</Text>
        )}
      </View>

      {/* Disponibilidad */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Disponibilidad</Text>
          <TouchableOpacity onPress={abrirEditorDisponibilidad}>
            <Text style={styles.updateLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        {resumenDisp.length > 0 ? (
          <View style={styles.chipsWrap}>
            {resumenDisp.map((r) => (
              <View key={r.dia} style={styles.deporteChip}>
                <Text style={styles.deporteChipText}>{r.dia} · {r.texto}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sectionText}>Aún no has indicado cuándo puedes entrenar.</Text>
        )}
      </View>

      {/* Objetivos */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Objetivos</Text>
          <TouchableOpacity onPress={abrirEditorObjetivos}>
            <Text style={styles.updateLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        {usuario?.objetivos && usuario.objetivos.length > 0 ? (
          <View style={styles.chipsWrap}>
            {usuario.objetivos.map((o) => (
              <View key={o} style={styles.deporteChip}>
                <Text style={styles.deporteChipText}>{o}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sectionText}>Todavía no has elegido tus objetivos deportivos.</Text>
        )}
      </View>

      {/* Calificaciones recibidas */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Calificaciones recibidas</Text>
          {hayEjemplos ? (
            <View style={styles.ejemploTag}>
              <Text style={styles.ejemploTagText}>Ejemplo</Text>
            </View>
          ) : null}
        </View>
        {calificacionesRecibidas.length > 0 ? (
          calificacionesRecibidas.map((r) => (
            <View key={r.id} style={styles.resenaCard}>
              <View style={styles.resenaTop}>
                <Text style={styles.resenaNombre}>{r.de}</Text>
                <View style={styles.estrellasRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= r.estrellas ? 'star' : 'star-outline'}
                      size={12}
                      color={n <= r.estrellas ? '#FACC15' : colors.textMuted}
                    />
                  ))}
                </View>
              </View>
              {r.comentario ? <Text style={styles.resenaTexto}>{r.comentario}</Text> : null}
              <Text style={styles.resenaCuando}>{r.cuando}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>Todavía no has recibido calificaciones.</Text>
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
                <Ionicons name={op.icon} size={14} color={activo ? '#fff' : colors.textMuted} />
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

      {/* Selector de comuna */}
      <ComunaPicker
        visible={pickerVisible}
        seleccionada={usuario?.comuna}
        onElegir={handleElegirComuna}
        onCerrar={() => setPickerVisible(false)}
      />

      {/* Modal: editar biografía */}
      <Modal visible={modalBioVisible} transparent animationType="fade" onRequestClose={() => setModalBioVisible(false)}>
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
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mis deportes</Text>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.otroLabel}>Deportes sugeridos</Text>
              <View style={styles.chipsWrap}>
                {DEPORTES_DISPONIBLES.map((d) => {
                  const seleccionado = deportesTemp.some((x) => x.nombre === d);
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
              <View style={styles.agregarRow}>
                <View style={[styles.inputBoxSmall, { flex: 1, marginTop: 0, marginBottom: 0 }]}>
                  <TextInput
                    placeholder="Ej: Escalada, Box, Pádel..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={nuevoDeporteTexto}
                    onChangeText={setNuevoDeporteTexto}
                    onSubmitEditing={agregarDeportePersonalizado}
                    returnKeyType="done"
                  />
                </View>
                <TouchableOpacity style={styles.agregarBoton} onPress={agregarDeportePersonalizado}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {deportesTemp.length > 0 && (
                <View style={styles.nivelesBox}>
                  <Text style={styles.otroLabel}>Nivel por deporte</Text>
                  {deportesTemp.map((d) => (
                    <View key={d.nombre} style={styles.nivelRow}>
                      <View style={styles.nivelNombreRow}>
                        <Text style={styles.nivelNombre}>{d.nombre}</Text>
                        <TouchableOpacity onPress={() => quitarDeporte(d.nombre)}>
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.nivelBotones}>
                        {NIVELES.map((n) => (
                          <TouchableOpacity
                            key={n}
                            style={[styles.nivelBoton, d.nivel === n && styles.nivelBotonActivo]}
                            onPress={() => cambiarNivel(d.nombre, n)}
                          >
                            <Text style={[styles.nivelBotonTexto, d.nivel === n && styles.nivelBotonTextoActivo]}>{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

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

      {/* Modal: editar disponibilidad */}
      <Modal visible={modalDispVisible} transparent animationType="fade" onRequestClose={() => setModalDispVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>¿Cuándo puedes entrenar?</Text>
            <Text style={styles.modalHint}>Marca las franjas en las que sueles estar disponible.</Text>

            <ScrollView style={styles.modalScroll}>
              {DIAS.map((dia) => (
                <View key={dia.key} style={styles.diaRow}>
                  <Text style={styles.diaLabel}>{dia.corto}</Text>
                  {FRANJAS.map((f) => {
                    const activa = tieneFranja(dispTemp, dia.key, f.key);
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.franjaBoton, activa && styles.franjaBotonActivo]}
                        onPress={() => setDispTemp((prev) => toggleFranja(prev, dia.key, f.key))}
                      >
                        <Text style={[styles.franjaTexto, activa && styles.franjaTextoActivo]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalDispVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={guardarDisponibilidad}>
                <Text style={styles.loginButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: editar objetivos */}
      <Modal visible={modalObjVisible} transparent animationType="fade" onRequestClose={() => setModalObjVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mis objetivos</Text>
            <Text style={styles.modalHint}>Elige uno o varios. Ayudan a sugerirte compañeros afines.</Text>

            <View style={styles.chipsWrap}>
              {OBJETIVOS_DISPONIBLES.map((o) => {
                const seleccionado = objTemp.includes(o);
                return (
                  <TouchableOpacity
                    key={o}
                    style={[styles.selectChip, seleccionado && styles.selectChipActive]}
                    onPress={() => toggleObjetivo(o)}
                  >
                    <Text style={[styles.selectChipText, seleccionado && styles.selectChipTextActive]}>{o}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalObjVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={guardarObjetivos}>
                <Text style={styles.loginButtonText}>Guardar</Text>
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
    statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statNumber: { color: c.text, fontSize: 17, fontWeight: '700' },
    statLabel: { color: c.textMuted, fontSize: 9.5, marginTop: 2 },
    section: { width: '100%', marginBottom: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    sectionTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    sectionText: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    locationText: { color: c.text, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
    locationLinks: { marginLeft: 'auto', flexDirection: 'row', gap: 12 },
    linkInline: { color: c.accent, fontSize: 10.5, fontWeight: '700' },
    updateLink: { color: c.accent, fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },
    mapImage: { width: '100%', height: 140, borderRadius: 12, marginTop: 10, backgroundColor: c.card },
    locationButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    locationButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    },
    locationButtonText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    inputBoxSmall: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, marginBottom: 10,
    },
    input: { color: c.text, fontSize: 13 },
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

    ejemploTag: { backgroundColor: c.chip, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    ejemploTagText: { color: c.textMuted, fontSize: 9.5, fontWeight: '700' },
    resenaCard: {
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, padding: 12, marginBottom: 8,
    },
    resenaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    resenaNombre: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    estrellasRow: { flexDirection: 'row', gap: 1 },
    resenaTexto: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    resenaCuando: { color: c.textMuted, fontSize: 10, marginTop: 6 },

    themeRow: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
    themeOption: {
      flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 18,
    },
    themeOptionActive: { backgroundColor: c.primary, borderColor: c.primary },
    themeOptionText: { color: c.textMuted, fontSize: 10.5, fontWeight: '600' },
    themeOptionTextActive: { color: '#fff' },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    modalHint: { color: c.textMuted, fontSize: 11.5, marginBottom: 14, lineHeight: 16 },
    modalScroll: { maxHeight: 360, marginBottom: 6 },
    bioInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, height: 90, textAlignVertical: 'top',
    },
    charCount: { color: c.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4, marginBottom: 10 },
    selectChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 4 },
    selectChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    selectChipText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    selectChipTextActive: { color: '#fff' },
    otroLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 8, marginBottom: 6 },

    agregarRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14 },
    agregarBoton: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
    },

    nivelesBox: { width: '100%', marginBottom: 6 },
    nivelRow: { marginBottom: 12 },
    nivelNombreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    nivelNombre: { color: c.text, fontSize: 12, fontWeight: '700' },
    nivelBotones: { flexDirection: 'row', gap: 6 },
    nivelBoton: {
      width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.inputBg, alignItems: 'center', justifyContent: 'center',
    },
    nivelBotonActivo: { backgroundColor: c.primary, borderColor: c.primary },
    nivelBotonTexto: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    nivelBotonTextoActivo: { color: '#fff' },

    diaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    diaLabel: { width: 32, color: c.text, fontSize: 12, fontWeight: '700' },
    franjaBoton: {
      flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBg,
    },
    franjaBotonActivo: { backgroundColor: c.primary, borderColor: c.primary },
    franjaTexto: { color: c.textMuted, fontSize: 10.5, fontWeight: '600' },
    franjaTextoActivo: { color: '#fff' },

    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    modalSave: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  });