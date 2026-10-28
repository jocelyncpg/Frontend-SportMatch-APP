import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import ComunaPicker from '../../../components/ComunaPicker';
import FotosPerfil from '../../../components/FotosPerfil';
import { ApiError } from '../../../services/api';
import { DeporteConNivel, Usuario, fotosDe, getSession, logout, updateFotoPerfil, updatePerfilExtra, updateUbicacion } from '../../../services/auth';
import { OBJETIVOS_DISPONIBLES } from '../../../services/disponibilidad';
import {
  DIAS_HORARIO,
  HORAS_SUGERIDAS,
  MAX_HORAS_DIA,
  NOMBRE_DIA,
  agregarHora,
  diasSinHoras,
  parsearHorarios,
  quitarDia,
  quitarHora,
  serializarHorarios,
  type DiaHorario,
  type Horarios,
} from '../../../services/horarios';
import { GEOAPIFY_API_KEY, solicitarUbicacion } from '../../../services/location';
import { useMatches } from '../../../services/matchStore';
import { nombreDelPlan, usePlanActual } from '../../../services/planes';
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
  const planActual = usePlanActual('deportista');

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);
  // Mientras el dedo mueve el mapa, la pantalla no debe hacer scroll al mismo tiempo.
  const [scrollActivo, setScrollActivo] = useState(true);

  const [modalBioVisible, setModalBioVisible] = useState(false);
  const [bioTemp, setBioTemp] = useState('');
  const [modalDeportesVisible, setModalDeportesVisible] = useState(false);
  const [deportesTemp, setDeportesTemp] = useState<DeporteConNivel[]>([]);
  const [deporteActivo, setDeporteActivo] = useState<string | null>(null);
  const [nuevoDeporteTexto, setNuevoDeporteTexto] = useState('');
  const [modalDispVisible, setModalDispVisible] = useState(false);
  // Disponibilidad: días elegidos con sus horas, más el día que se está editando.
  const [horariosTemp, setHorariosTemp] = useState<Horarios>({});
  const [diaActivo, setDiaActivo] = useState<DiaHorario | null>(null);
  const [horaTexto, setHoraTexto] = useState('');
  const [dispError, setDispError] = useState('');
  // Texto libre de la versión anterior, si lo hay: no se puede convertir a horas, así que solo se avisa.
  const [dispAnterior, setDispAnterior] = useState('');
  const [modalObjVisible, setModalObjVisible] = useState(false);
  const [objTemp, setObjTemp] = useState<string[]>([]);
  const [verTodasResenas, setVerTodasResenas] = useState(false);

  // Reputación: Conexiones = tus matches confirmados; Valoración = promedio de lo que recibes.
  const { confirmados, calificacionesRecibidas } = useMatches();
  const conexiones = confirmados.length;
  const promedio = promedioEstrellas(calificacionesRecibidas);
  const valoracion = formatearPromedio(promedio);
  const hayEjemplos = calificacionesRecibidas.some((c) => c.simulada);
  const resenasVisibles = verTodasResenas ? calificacionesRecibidas : calificacionesRecibidas.slice(0, 1);

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
      // La foto del avatar es la principal: reemplaza a la primera de la galería y deja las demás.
      setUsuario({ ...usuario, fotoPerfil: uri, fotos: [uri, ...fotosDe(usuario).slice(1)] });
    }
  }

  function handleChangePhoto() {
    Alert.alert('Foto de perfil', '¿Cómo quieres agregar tu foto?', [
      { text: 'Tomar foto', onPress: tomarFoto },
      { text: 'Elegir de galería', onPress: elegirDeGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  // ---------- Ubicación ----------
  function abrirOpcionesUbicacion() {
    Alert.alert('Ubicación', usuario?.comuna ? `Ahora: ${usuario.comuna}` : 'Define dónde entrenas.', [
      { text: 'Usar mi GPS', onPress: handleActivarUbicacion },
      { text: 'Elegir comuna de la lista', onPress: () => setPickerVisible(true) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleActivarUbicacion() {
    if (!usuario || pidiendoUbicacion) return;
    setPidiendoUbicacion(true);
    try {
      const resultado = await solicitarUbicacion();
      if (resultado.ok && resultado.ubicacion) {
        const { latitud, longitud, comuna } = resultado.ubicacion;
        const comunaFinal = comuna ?? 'Ubicación detectada';
        await updateUbicacion(usuario.id, { comuna: comunaFinal, latitud, longitud });
        setUsuario({ ...usuario, comuna: comunaFinal, latitud, longitud });
      } else {
        Alert.alert(
          'Sin permiso de ubicación',
          'Puedes elegir tu comuna de la lista para seguir usando la búsqueda por cercanía.',
          [
            { text: 'Elegir comuna', onPress: () => setPickerVisible(true) },
            { text: 'Ahora no', style: 'cancel' },
          ]
        );
      }
    } catch (e) {
      avisarError('No se pudo obtener o guardar tu ubicación', e);
    } finally {
      setPidiendoUbicacion(false);
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
    setPickerVisible(false);
  }

  // ---------- Biografía ----------
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

  // ---------- Deportes: lista de elegidos + un solo selector de nivel para el deporte activo ----------
  function abrirEditorDeportes() {
    const actuales = usuario?.deportes ?? [];
    setDeportesTemp(actuales);
    setDeporteActivo(actuales[0]?.nombre ?? null);
    setNuevoDeporteTexto('');
    setModalDeportesVisible(true);
  }

  function agregarDeporte(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio) return;
    const existente = deportesTemp.find((d) => d.nombre.toLowerCase() === limpio.toLowerCase());
    if (existente) {
      setDeporteActivo(existente.nombre);
      return;
    }
    setDeportesTemp((prev) => [...prev, { nombre: limpio, nivel: 3 }]);
    setDeporteActivo(limpio);
  }

  function agregarDeportePersonalizado() {
    agregarDeporte(nuevoDeporteTexto);
    setNuevoDeporteTexto('');
  }

  function quitarDeporte(nombre: string) {
    const restantes = deportesTemp.filter((d) => d.nombre !== nombre);
    setDeportesTemp(restantes);
    if (deporteActivo === nombre) setDeporteActivo(restantes[0]?.nombre ?? null);
  }

  function cambiarNivel(nivel: number) {
    if (!deporteActivo) return;
    setDeportesTemp((prev) => prev.map((d) => (d.nombre === deporteActivo ? { ...d, nivel } : d)));
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

  // ---------- Disponibilidad: días de la semana + horas ----------
  // Se guarda como texto ("Lun 07:00, 18:00 · Sáb 10:00"). Si la sesión guardada viene de la versión anterior
  // (una grilla), se ignora y se muestra "Sin definir".
  const dispActual = typeof usuario?.disponibilidad === 'string' ? usuario.disponibilidad : '';

  function abrirEditorDisponibilidad() {
    const leido = parsearHorarios(dispActual);
    const base = leido ?? {};
    setHorariosTemp(base);
    setDiaActivo(DIAS_HORARIO.find((d) => base[d]) ?? null);
    setHoraTexto('');
    setDispError('');
    setDispAnterior(leido ? '' : dispActual);
    setModalDispVisible(true);
  }

  /** Tocar un día lo selecciona (aparece el reloj) y deja abierto su selector de horas. */
  function tocarDia(d: DiaHorario) {
    setDispError('');
    if (horariosTemp[d] === undefined) setHorariosTemp((prev) => ({ ...prev, [d]: [] }));
    setDiaActivo(d);
  }

  function quitarDiaElegido(d: DiaHorario) {
    const restantes = quitarDia(horariosTemp, d);
    setHorariosTemp(restantes);
    setDispError('');
    if (diaActivo === d) setDiaActivo(DIAS_HORARIO.find((x) => restantes[x]) ?? null);
  }

  /** Devuelve true si la hora se agregó. */
  function agregarHoraAlDia(hora: string): boolean {
    if (!diaActivo) return false;
    const r = agregarHora(horariosTemp, diaActivo, hora);
    if (!r.ok) {
      setDispError(r.motivo);
      return false;
    }
    setDispError('');
    setHorariosTemp(r.horarios);
    return true;
  }

  function tocarHora(hora: string) {
    if (!diaActivo) return;
    if ((horariosTemp[diaActivo] ?? []).includes(hora)) {
      setDispError('');
      setHorariosTemp(quitarHora(horariosTemp, diaActivo, hora));
    } else {
      agregarHoraAlDia(hora);
    }
  }

  function agregarHoraEscrita() {
    if (agregarHoraAlDia(horaTexto)) setHoraTexto('');
  }

  async function guardarDisponibilidad() {
    if (!usuario) return;
    const sinHoras = diasSinHoras(horariosTemp);
    if (sinHoras.length > 0) {
      setDispError(`Agrega al menos una hora a: ${sinHoras.join(', ')}, o quita el día.`);
      return;
    }
    // Si solo había texto libre antiguo y no se eligió nada, se deja como estaba.
    if (dispAnterior && Object.keys(horariosTemp).length === 0) {
      setModalDispVisible(false);
      return;
    }
    const texto = serializarHorarios(horariosTemp);
    try {
      await updatePerfilExtra(usuario.id, { disponibilidad: texto });
    } catch (e) {
      avisarError('No se pudo guardar tu disponibilidad', e);
      return;
    }
    setUsuario({ ...usuario, disponibilidad: texto });
    setModalDispVisible(false);
  }

  // ---------- Objetivos ----------
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
  const activo = deportesTemp.find((d) => d.nombre === deporteActivo);
  const sugeridosSinElegir = DEPORTES_DISPONIBLES.filter(
    (d) => !deportesTemp.some((x) => x.nombre.toLowerCase() === d.toLowerCase())
  );

  const textoUbicacion = pidiendoUbicacion
    ? 'Detectando tu ubicación...'
    : usuario?.comuna
      ? usuario.latitud && usuario.longitud ? `${usuario.comuna} · GPS` : usuario.comuna
      : '';
  // Mapa interactivo: solo si hay GPS guardado (elegir una comuna de la lista descarta las coordenadas).
  const tieneMapa = !!(usuario?.latitud && usuario?.longitud);
  // Teselas de Geoapify (mismo proveedor y misma API key de antes, ahora en un mapa que se mueve y hace zoom).
  const teselasUrl = `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;
  const filasInfo: { key: string; icono: keyof typeof Ionicons.glyphMap; titulo: string; valor: string; onPress: () => void }[] = [
    { key: 'ubicacion', icono: 'location-outline', titulo: 'Ubicación', valor: textoUbicacion, onPress: abrirOpcionesUbicacion },
    { key: 'disponibilidad', icono: 'time-outline', titulo: 'Disponibilidad', valor: dispActual, onPress: abrirEditorDisponibilidad },
    { key: 'objetivos', icono: 'flag-outline', titulo: 'Objetivos', valor: usuario?.objetivos?.join(', ') ?? '', onPress: abrirEditorObjetivos },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} scrollEnabled={scrollActivo}>
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

      {/* Fotos (hasta 5, como en las apps de citas): la primera es la que ven primero los demás */}
      <FotosPerfil
        usuario={usuario}
        subtitulo={
          usuario?.deportes?.[0]
            ? `${usuario.deportes[0].nombre} · ${NOMBRES_NIVEL[usuario.deportes[0].nivel] ?? usuario.deportes[0].nivel}`
            : undefined
        }
        onCambio={(fotos) => setUsuario((u) => (u ? { ...u, fotos, fotoPerfil: fotos[0] } : u))}
      />

      {/* Deportes */}
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

      {/* Sobre mí */}
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

      {/* Detalles: ubicación, disponibilidad y objetivos en una sola tarjeta */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Detalles</Text>
        <View style={styles.infoCard}>
          {filasInfo.map((f, i) => (
            <Fragment key={f.key}>
              <TouchableOpacity style={[styles.infoFila, i > 0 && styles.infoFilaBorde]} onPress={f.onPress}>
                <View style={styles.infoIcono}>
                  <Ionicons name={f.icono} size={16} color={colors.accent} />
                </View>
                <View style={styles.infoTextos}>
                  <Text style={styles.infoTitulo}>{f.titulo}</Text>
                  <Text numberOfLines={f.key === 'disponibilidad' ? 2 : 1} style={[styles.infoValor, !f.valor && styles.infoValorVacio]}>
                    {f.valor || 'Sin definir'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              {/* El mapa va pegado a la fila de Ubicación */}
              {f.key === 'ubicacion' && tieneMapa && usuario?.latitud && usuario?.longitud ? (
                <View style={styles.mapWrap}>
                  <MapView
                    // Cambia de key al detectar otra ubicación para que el mapa se vuelva a centrar.
                    key={`${usuario.latitud},${usuario.longitud}`}
                    style={styles.mapa}
                    initialRegion={{
                      latitude: usuario.latitud,
                      longitude: usuario.longitud,
                      latitudeDelta: 0.012,
                      longitudeDelta: 0.012,
                    }}
                    // Android: se oculta el mapa base de Google para mostrar solo las teselas de Geoapify.
                    mapType={Platform.OS === 'android' ? 'none' : 'standard'}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    onPanDrag={() => setScrollActivo(false)}
                    onRegionChangeComplete={() => setScrollActivo(true)}
                  >
                    <UrlTile urlTemplate={teselasUrl} maximumZ={19} shouldReplaceMapContent />
                    <Marker coordinate={{ latitude: usuario.latitud, longitude: usuario.longitud }} title="Tu ubicación" />
                  </MapView>
                  <Text style={styles.mapaCredito}>© Geoapify © OpenStreetMap</Text>
                </View>
              ) : null}
            </Fragment>
          ))}
        </View>
      </View>

      {/* Calificaciones recibidas */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.tituloConTag}>
            <Text style={styles.sectionTitle}>Calificaciones recibidas</Text>
            {hayEjemplos ? (
              <View style={styles.ejemploTag}>
                <Text style={styles.ejemploTagText}>Ejemplo</Text>
              </View>
            ) : null}
          </View>
          {calificacionesRecibidas.length > 1 ? (
            <TouchableOpacity onPress={() => setVerTodasResenas((v) => !v)}>
              <Text style={styles.updateLink}>
                {verTodasResenas ? 'Ver menos' : `Ver todas (${calificacionesRecibidas.length})`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {resenasVisibles.length > 0 ? (
          resenasVisibles.map((r) => (
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

      {/* Suscripción */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Suscripción</Text>
        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.infoFila} onPress={() => router.push('/(deportista)/planes')}>
            <View style={styles.infoIcono}>
              <Ionicons name="pricetags-outline" size={16} color={colors.accent} />
            </View>
            <View style={styles.infoTextos}>
              <Text style={styles.infoTitulo}>Planes y beneficios</Text>
              <Text numberOfLines={1} style={styles.infoValor}>Tu plan: {nombreDelPlan(planActual)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Apariencia */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Apariencia</Text>
        <View style={styles.themeRow}>
          {OPCIONES_TEMA.map((op) => {
            const seleccionada = mode === op.key;
            return (
              <TouchableOpacity
                key={op.key}
                style={[styles.themeOption, seleccionada && styles.themeOptionActive]}
                onPress={() => setMode(op.key)}
              >
                <Ionicons name={op.icon} size={14} color={seleccionada ? '#fff' : colors.textMuted} />
                <Text style={[styles.themeOptionText, seleccionada && styles.themeOptionTextActive]}>{op.label}</Text>
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
              {deportesTemp.length > 0 ? (
                <>
                  <Text style={styles.otroLabel}>Toca un deporte para cambiar su nivel</Text>
                  <View style={styles.chipsWrap}>
                    {deportesTemp.map((d) => {
                      const esActivo = d.nombre === deporteActivo;
                      return (
                        <TouchableOpacity
                          key={d.nombre}
                          style={[styles.miDeporte, esActivo && styles.miDeporteActivo]}
                          onPress={() => setDeporteActivo(d.nombre)}
                        >
                          <Text style={[styles.miDeporteTexto, esActivo && styles.miDeporteTextoActivo]}>
                            {d.nombre} · {d.nivel}
                          </Text>
                          <TouchableOpacity
                            onPress={() => quitarDeporte(d.nombre)}
                            accessibilityLabel={`Quitar ${d.nombre}`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close" size={13} color={esActivo ? '#fff' : colors.textMuted} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {activo ? (
                    <View style={styles.nivelPanel}>
                      <Text style={styles.nivelPanelTitulo}>Nivel en {activo.nombre}</Text>
                      <View style={styles.nivelBotones}>
                        {NIVELES.map((n) => (
                          <TouchableOpacity
                            key={n}
                            style={[styles.nivelBoton, activo.nivel === n && styles.nivelBotonActivo]}
                            onPress={() => cambiarNivel(n)}
                            accessibilityLabel={`Nivel ${n}`}
                          >
                            <Text style={[styles.nivelBotonTexto, activo.nivel === n && styles.nivelBotonTextoActivo]}>{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.nivelPanelNombre}>{NOMBRES_NIVEL[activo.nivel]}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.modalHint}>Todavía no elegiste deportes. Agrega uno abajo.</Text>
              )}

              <Text style={styles.otroLabel}>Agregar</Text>
              <View style={styles.chipsWrap}>
                {sugeridosSinElegir.map((d) => (
                  <TouchableOpacity key={d} style={styles.selectChip} onPress={() => agregarDeporte(d)}>
                    <Text style={styles.selectChipText}>+ {d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.agregarRow}>
                <View style={[styles.inputBoxSmall, { flex: 1, marginTop: 0, marginBottom: 0 }]}>
                  <TextInput
                    placeholder="Otro deporte: Escalada, Box, Pádel..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={nuevoDeporteTexto}
                    onChangeText={setNuevoDeporteTexto}
                    onSubmitEditing={agregarDeportePersonalizado}
                    returnKeyType="done"
                  />
                </View>
                <TouchableOpacity style={styles.agregarBoton} onPress={agregarDeportePersonalizado} accessibilityLabel="Agregar deporte">
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
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

      {/* Modal: editar disponibilidad (mismo formato que los deportes: se elige el día y luego sus horas) */}
      <Modal visible={modalDispVisible} transparent animationType="fade" onRequestClose={() => setModalDispVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>¿Cuándo puedes entrenar?</Text>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalHint}>Toca un día y elige las horas que te acomodan.</Text>

              {dispAnterior ? (
                <Text style={styles.dispAnterior}>
                  Antes escribiste: “{dispAnterior}”. Si eliges días y horas, se reemplaza al guardar.
                </Text>
              ) : null}

              <View style={styles.chipsWrap}>
                {DIAS_HORARIO.map((d) => {
                  const elegido = horariosTemp[d] !== undefined;
                  const esActivo = d === diaActivo;
                  if (!elegido) {
                    return (
                      <TouchableOpacity key={d} style={styles.selectChip} onPress={() => tocarDia(d)} accessibilityLabel={`Elegir ${NOMBRE_DIA[d]}`}>
                        <Text style={styles.selectChipText}>{d}</Text>
                      </TouchableOpacity>
                    );
                  }
                  const cantidad = horariosTemp[d]?.length ?? 0;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.miDeporte, esActivo && styles.miDeporteActivo]}
                      onPress={() => tocarDia(d)}
                      accessibilityLabel={`Editar las horas del ${NOMBRE_DIA[d]}`}
                    >
                      <Ionicons name="time-outline" size={14} color={esActivo ? '#fff' : colors.accent} />
                      <Text style={[styles.miDeporteTexto, esActivo && styles.miDeporteTextoActivo]}>
                        {d}{cantidad > 0 ? ` · ${cantidad}` : ''}
                      </Text>
                      <TouchableOpacity
                        onPress={() => quitarDiaElegido(d)}
                        accessibilityLabel={`Quitar ${NOMBRE_DIA[d]}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={13} color={esActivo ? '#fff' : colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {diaActivo ? (
                <View style={styles.nivelPanel}>
                  <Text style={styles.nivelPanelTitulo}>
                    Horas del {NOMBRE_DIA[diaActivo]} ({horariosTemp[diaActivo]?.length ?? 0} de {MAX_HORAS_DIA})
                  </Text>
                  <View style={styles.chipsWrap}>
                    {[...new Set([...HORAS_SUGERIDAS, ...(horariosTemp[diaActivo] ?? [])])].sort().map((h) => {
                      const marcada = (horariosTemp[diaActivo] ?? []).includes(h);
                      return (
                        <TouchableOpacity
                          key={h}
                          style={[styles.selectChip, marcada && styles.selectChipActive]}
                          onPress={() => tocarHora(h)}
                          accessibilityState={{ selected: marcada }}
                        >
                          <Text style={[styles.selectChipText, marcada && styles.selectChipTextActive]}>{h}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.agregarRow}>
                    <View style={[styles.inputBoxSmall, { flex: 1, marginTop: 0, marginBottom: 0 }]}>
                      <TextInput
                        placeholder="Otra hora: 18:30"
                        placeholderTextColor={colors.textMuted}
                        style={styles.input}
                        value={horaTexto}
                        onChangeText={setHoraTexto}
                        onSubmitEditing={agregarHoraEscrita}
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                        returnKeyType="done"
                      />
                    </View>
                    <TouchableOpacity style={styles.agregarBoton} onPress={agregarHoraEscrita} accessibilityLabel="Agregar hora">
                      <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.modalHint}>Aún no elegiste ningún día.</Text>
              )}

              {dispError ? <Text accessibilityRole="alert" style={styles.dispError}>{dispError}</Text> : null}
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

    section: { width: '100%', marginBottom: 18 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    tituloConTag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    sectionText: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    updateLink: { color: c.accent, fontSize: 10.5, fontWeight: '700', marginLeft: 'auto' },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    deporteChip: { backgroundColor: c.chip, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    deporteChipText: { color: c.accent, fontSize: 11.5, fontWeight: '700' },

    infoCard: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 14, overflow: 'hidden' },
    infoFila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    infoFilaBorde: { borderTopWidth: 1, borderTopColor: c.border },
    mapWrap: { width: '100%', height: 200, backgroundColor: c.inputBg },
    mapa: { width: '100%', height: '100%' },
    mapaCredito: {
      position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: '#374151',
      backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 4, borderRadius: 3,
    },
    infoIcono: { width: 30, height: 30, borderRadius: 9, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' },
    infoTextos: { flex: 1 },
    infoTitulo: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    infoValor: { color: c.text, fontSize: 11.5, marginTop: 2 },
    infoValorVacio: { color: c.textMuted, fontStyle: 'italic' },

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

    logoutButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderWidth: 1, borderColor: c.danger, borderRadius: 13,
      paddingVertical: 12, paddingHorizontal: 24, marginTop: 4,
    },
    logoutText: { color: c.danger, fontSize: 13, fontWeight: '700' },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 },
    modalBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    modalHint: { color: c.textMuted, fontSize: 11.5, marginBottom: 14, lineHeight: 16 },
    modalScroll: { maxHeight: 380, marginBottom: 6 },
    bioInput: {
      backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      padding: 12, color: c.text, fontSize: 13, height: 90, textAlignVertical: 'top',
    },
    dispAnterior: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginBottom: 12 },
    dispError: { color: c.danger, fontSize: 12, marginTop: 8 },
    charCount: { color: c.textMuted, fontSize: 10, textAlign: 'right', marginTop: 4, marginBottom: 10 },
    otroLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 8 },
    loginButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    selectChip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    selectChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    selectChipText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    selectChipTextActive: { color: '#fff' },

    miDeporte: {
      flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 12,
      borderRadius: 20, backgroundColor: c.chip, borderWidth: 1, borderColor: c.chip,
    },
    miDeporteActivo: { backgroundColor: c.primary, borderColor: c.primary },
    miDeporteTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
    miDeporteTextoActivo: { color: '#fff' },

    nivelPanel: {
      marginTop: 12, marginBottom: 6, padding: 12, borderRadius: 12,
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border,
    },
    nivelPanelTitulo: { color: c.text, fontSize: 12, fontWeight: '700', marginBottom: 8 },
    nivelBotones: { flexDirection: 'row', gap: 6 },
    nivelBoton: {
      flex: 1, height: 36, borderRadius: 9, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    },
    nivelBotonActivo: { backgroundColor: c.primary, borderColor: c.primary },
    nivelBotonTexto: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    nivelBotonTextoActivo: { color: '#fff' },
    nivelPanelNombre: { color: c.textMuted, fontSize: 11.5, marginTop: 8, textAlign: 'center' },

    agregarRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12, marginBottom: 6 },
    inputBoxSmall: {
      backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, marginBottom: 10,
    },
    input: { color: c.text, fontSize: 13 },
    agregarBoton: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
    },

    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    modalCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    modalSave: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  });