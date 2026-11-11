import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTecladoVisible } from '../../../hooks/use-teclado';
import Avatar from '../../../components/Avatar';
import MapaEstatico from '../../../components/MapaEstatico';
import VisorFoto from '../../../components/VisorFoto';
import ReportarModal from '../../../components/ReportarModal';
import { ApiError } from '../../../services/api';
import {
  abrirChat, cerrarChat, ENVIO_DE_FOTOS_DISPONIBLE, enviarMensaje, enviarUbicacion, getChat, getMensajes, MensajeApi,
  silenciarChat, useSilenciados, resumenMensaje, type UbicacionChat, type RespuestaCitada,
} from '../../../services/chat';
import { solicitarUbicacion } from '../../../services/location';
import { Persona } from '../../../services/matchStore';
import { bloquear, desbloquear, useBloqueados, type TipoReporte } from '../../../services/reportes';
import { alCambiar, crearSondeo } from '../../../services/sondeo';
import { Colors, useAppTheme, espacio, radio, tipo } from '../../../theme/ThemeContext';

/** Lo que se está reportando desde el chat (HU-42): la persona o un mensaje suyo. */
type ObjetivoReporte = { tipo: TipoReporte; id: string; nombre: string };

function FotoChat({ uri }: { uri: string }) {
  const [proporcion, setProporcion] = useState(1);
  useEffect(() => {
    let activo = true;
    Image.getSize(uri, (ancho, alto) => {
      if (activo && ancho > 0 && alto > 0) setProporcion(Math.min(1.5, Math.max(0.7, ancho / alto)));
    }, () => {});
    return () => { activo = false; };
  }, [uri]);
  return <Image source={{ uri }} style={{ width: 240, aspectRatio: proporcion }} resizeMode="cover" accessibilityLabel="Foto enviada" />;
}

function fusionar(actuales: MensajeApi[], nuevos: MensajeApi[]) {
  return [...new Map([...actuales, ...nuevos].map((m) => [m.id, m])).values()]
    .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
}

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const tecladoVisible = useTecladoVisible();
  const margenInferior = tecladoVisible ? espacio.s : insets.bottom + espacio.m;
  // id = match; personaId = la otra persona (lo manda la lista, para poder desbloquear aunque el chat no abra).
  const { id, personaId: personaParam } = useLocalSearchParams<{ id: string; personaId?: string }>();
  const [persona, setPersona] = useState<Persona | null>(null);
  const personaId = persona?.id ?? personaParam ?? '';
  const silenciado = useSilenciados().includes(personaId);
  const bloqueado = useBloqueados().includes(personaId);
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const [miId, setMiId] = useState('');
  const [mensajes, setMensajes] = useState<MensajeApi[]>([]);
  const [texto, setTexto] = useState('');
  const [citando, setCitando] = useState<MensajeApi | null>(null);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);
  const [destinoCita, setDestinoCita] = useState<string | null>(null);
  const intentosDesplazar = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [anteriores, setAnteriores] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const actualizarRef = useRef<() => void>(() => {});
  const sondeoRef = useRef<{ ahora(): void } | null>(null);
  const listaRef = useRef<FlatList<MensajeApi>>(null);
  const ultimoId = useRef<string | undefined>(undefined);
  const generacion = useRef(0);
  const envioPendiente = useRef<{ text: string; clientId: string; replyTo?: string } | null>(null);
  const envioEnCurso = useRef(false);
  const desplazar = useRef(true);
  const [reporte, setReporte] = useState<ObjetivoReporte | null>(null);
  // Se recuerda el último objetivo para que el formulario no cambie de texto mientras se cierra.
  const ultimoReporte = useRef<ObjetivoReporte>({ tipo: 'usuario', id: '', nombre: '' });
  if (reporte) ultimoReporte.current = reporte;

  const mostrarError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'No se pudo conectar con el chat.');
    if (e instanceof ApiError && [401, 403, 404].includes(e.status)) {
      setDisponible(false);
      setMensajes([]); setCitando(null);
      ultimoId.current = undefined;
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const version = ++generacion.current;
    let activo = true;
    let fichaCargada = false;
    setPersona(null); setMensajes([]); setDisponible(false); setCargando(true); setError(null);
    setCargandoAnteriores(false); desplazar.current = true;
    setCitando(null); setFotoAbierta(null); setDestinoCita(null);
    setTexto(''); setEnviando(false); envioEnCurso.current = false; envioPendiente.current = null;
    ultimoId.current = undefined;
    async function actualizar(): Promise<boolean> {
      if (!activo) return false;
      try {
        if (!fichaCargada) {
          const chat = await getChat(id);
          if (!activo || version !== generacion.current) return false;
          setPersona(chat.persona);
          setMiId(chat.userId);
          fichaCargada = true;
        }
        const nuevos = await getMensajes(id, { after: ultimoId.current });
        if (!activo || version !== generacion.current) return false;
        setDisponible(true); setError(null);
        if (!ultimoId.current) setAnteriores(nuevos.length === 50);
        if (nuevos.length) {
          ultimoId.current = nuevos[nuevos.length - 1].id;
          setMensajes((prev) => fusionar(prev, nuevos));
        }
        return nuevos.length > 0;
      } catch (e) {
        if (activo && version === generacion.current) mostrarError(e);
        return false;
      } finally {
        if (activo && version === generacion.current) setCargando(false);
      }
    }
    const sondeo = crearSondeo('chat:' + id, actualizar, { minMs: 3000, maxMs: 15000, factor: 1.5 });
    sondeoRef.current = sondeo;
    actualizarRef.current = () => sondeo.ahora();
    // Mientras este chat está abierto, sus mensajes cuentan como leídos y no llegan avisos de él.
    abrirChat(id);
    const quitarAviso = alCambiar(({ tipo, id: avisoId }) => {
      if (tipo === 'chat' && avisoId === id) sondeo.ahora();
    });
    sondeo.iniciar();
    return () => {
      activo = false; ++generacion.current; actualizarRef.current = () => {}; sondeoRef.current = null;
      sondeo.detener(); quitarAviso();
      cerrarChat(id);
    };
  }, [id, mostrarError]));

  async function enviar(contenido?: string) {
    const t = (contenido ?? texto).trim();
    if (!disponible || !t || envioEnCurso.current) return;
    envioEnCurso.current = true; setEnviando(true);
    const version = generacion.current;
    // A failed request keeps the same id for a retry; the server deduplicates it.
    if (envioPendiente.current?.text !== t || envioPendiente.current?.replyTo !== citando?.id) {
      envioPendiente.current = { text: t, clientId: Crypto.randomUUID(), replyTo: citando?.id };
    }
    try {
      const mensaje = await enviarMensaje(id, t, envioPendiente.current.clientId, envioPendiente.current.replyTo);
      if (version !== generacion.current) return;
      setMensajes((prev) => fusionar(prev, [mensaje]));
      // The polling cursor only advances from reads, so simultaneous peer messages are not skipped.
      envioPendiente.current = null; setDestinoCita(null); setTexto(''); setCitando(null); setError(null); desplazar.current = true;
      sondeoRef.current?.ahora();
    } catch (e) {
      if (version === generacion.current) { setTexto(t); mostrarError(e); }
    } finally {
      if (version === generacion.current) { envioEnCurso.current = false; setEnviando(false); }
    }
  }

  /** Comparte tu ubicación actual (HU-58). Usa el mismo reintento sin duplicar que el texto. */
  async function compartirUbicacion() {
    if (!disponible || obteniendoUbicacion || envioEnCurso.current) return;
    setObteniendoUbicacion(true);
    const version = generacion.current;
    try {
      const r = await solicitarUbicacion();
      if (!r.ok || !r.ubicacion) {
        Alert.alert(
          'Permiso necesario',
          r.motivo === 'permiso_denegado'
            ? 'Necesitamos acceso a tu ubicación para compartirla. Puedes activarlo en los ajustes del teléfono.'
            : 'No pudimos obtener tu ubicación.',
        );
        return;
      }
      envioEnCurso.current = true; setEnviando(true);
      const mensaje = await enviarUbicacion(id, r.ubicacion, Crypto.randomUUID());
      if (version !== generacion.current) return;
      setMensajes((prev) => fusionar(prev, [mensaje])); setError(null); desplazar.current = true;
      sondeoRef.current?.ahora();
    } catch (e) {
      if (version === generacion.current) mostrarError(e);
    } finally {
      if (version === generacion.current) { envioEnCurso.current = false; setEnviando(false); setObteniendoUbicacion(false); }
    }
  }

  function abrirAdjuntos() {
    Alert.alert('Adjuntar', `¿Qué quieres compartir con ${primerNombre}?`, [
      { text: 'Mi ubicación', onPress: compartirUbicacion },
      { text: 'Foto', onPress: avisarFotos },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function avisarFotos() {
    if (ENVIO_DE_FOTOS_DISPONIBLE) return;
    Alert.alert('Fotos no disponibles todavía', 'Para enviar fotos falta habilitar el almacenamiento de archivos en el servidor. Mientras tanto puedes compartir tu ubicación.');
  }

  /** Menú del chat (HU-59): silenciar o bloquear a la persona. */
  function abrirOpciones() {
    if (!personaId) return;
    Alert.alert(nombre, undefined, [
      {
        text: silenciado ? 'Reactivar avisos' : 'Silenciar avisos',
        onPress: () => silenciarChat(personaId, !silenciado).catch((e) =>
          Alert.alert('No se pudo completar', e instanceof Error ? e.message : 'Inténtalo de nuevo.')),
      },
      bloqueado
        ? { text: `Desbloquear a ${primerNombre}`, onPress: cambiarBloqueo }
        : { text: `Bloquear a ${primerNombre}`, style: 'destructive', onPress: confirmarBloqueo },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function confirmarBloqueo() {
    Alert.alert(
      `¿Bloquear a ${primerNombre}?`,
      'No podrán enviarse mensajes mientras esté bloqueado. Puedes desbloquearlo cuando quieras desde este chat.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: cambiarBloqueo },
      ],
    );
  }

  async function cambiarBloqueo() {
    const r = bloqueado ? await desbloquear(personaId) : await bloquear(personaId);
    if (!r.ok) Alert.alert('No se pudo completar', r.motivo);
    else if (bloqueado) actualizarRef.current();
  }

  /** Abre el punto en la app de mapas del teléfono. */
  function abrirEnMapas(u: UbicacionChat) {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${u.latitud},${u.longitud}`).catch(() =>
      Alert.alert('No pudimos abrir el mapa', 'Intenta de nuevo o abre tu app de mapas manualmente.'),
    );
  }

  /** Lo que va dentro de la burbuja: foto, ubicación, archivo o texto. */
  function contenido(m: MensajeApi, propio: boolean) {
    const color = propio ? '#fff' : colors.text;
    if (m.message_type === 'IMAGE' && m.attachment_url) {
      return (
        <View style={{ gap: 6 }}>
          <FotoChat uri={m.attachment_url} />
          {m.text ? <Text style={propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{m.text}</Text> : null}
        </View>
      );
    }
    if (m.message_type === 'LOCATION' && m.latitude != null && m.longitude != null) {
      const u = { latitud: m.latitude, longitud: m.longitude, comuna: m.location_name ?? undefined };
      return (
        <View>
          <MapaEstatico latitud={u.latitud} longitud={u.longitud} alto={130} />
          <View style={styles.ubicacionPie}>
            <Ionicons name="location" size={20} color={colors.accent} />
            <View style={styles.ubicacionTextos}>
              <Text style={styles.ubicacionTitulo}>{u.comuna || 'Ubicación compartida'}</Text>
              <Text style={styles.ubicacionAccion}>Abrir en mapas</Text>
            </View>
          </View>
        </View>
      );
    }
    if (m.message_type === 'FILE' && m.attachment_url) {
      const url = m.attachment_url;
      return (
        <TouchableOpacity style={styles.ubicacionFila} onPress={() => Linking.openURL(url).catch(() => {})} accessibilityLabel="Abrir archivo">
          <Ionicons name="document-attach-outline" size={18} color={color} />
          <Text style={[styles.ubicacionTitulo, { color }]} numberOfLines={1}>{m.attachment_name || m.text || 'Archivo'}</Text>
        </TouchableOpacity>
      );
    }
    return <Text style={propio ? styles.bubbleTextOwn : styles.bubbleTextOther}>{m.text}</Text>;
  }

  function opcionesMensaje(m: MensajeApi) {
    if (!disponible || bloqueado) return;
    Alert.alert('Mensaje', undefined, [
      { text: 'Responder', onPress: () => setCitando(m) },
      ...(m.sender_id === miId ? [] : [{ text: 'Reportar mensaje', style: 'destructive' as const, onPress: () => reportarMensaje(m) }]),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  async function irAlMensaje(c: RespuestaCitada) {
    if (!c.available || !c.id) return;
    const version = generacion.current;
    try {
      if (!mensajes.some((m) => m.id === c.id)) {
        const pagina = await getMensajes(id, { around: c.id });
        if (version !== generacion.current) return;
        if (!pagina.some((m) => m.id === c.id)) {
          Alert.alert('Mensaje no disponible');
          return;
        }
        // Fill the gap as well: before/after cursors must not skip messages between pages.
        const primero = mensajes[0]?.id;
        let cursor = pagina[pagina.length - 1]?.id;
        const recuperados = [...pagina];
        while (primero && cursor && BigInt(cursor) < BigInt(primero)) {
          const siguiente = await getMensajes(id, { after: cursor });
          if (version !== generacion.current) return;
          const ultimo = siguiente[siguiente.length - 1]?.id;
          if (!ultimo || BigInt(ultimo) <= BigInt(cursor)) break;
          recuperados.push(...siguiente);
          cursor = ultimo;
        }
        desplazar.current = false;
        setMensajes((prev) => fusionar(prev, recuperados));
        setAnteriores(pagina.length === 50);
      }
      desplazar.current = false;
      intentosDesplazar.current = 0;
      setDestinoCita(c.id);
      const index = mensajes.findIndex((m) => m.id === c.id);
      if (index >= 0) listaRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } catch (e) {
      if (version === generacion.current) mostrarError(e);
    }
  }

  function desplazarAlDestino() {
    if (!destinoCita) return;
    const index = mensajes.findIndex((m) => m.id === destinoCita);
    if (index >= 0) listaRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }

  useEffect(() => {
    if (!destinoCita) return;
    const index = mensajes.findIndex((m) => m.id === destinoCita);
    if (index < 0) return;
    // FlatList measures rows after the page arrives; retry briefly if the target is not measured yet.
    const timer = setTimeout(() => listaRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 250);
    return () => clearTimeout(timer);
  }, [destinoCita, mensajes]);

  function cita(m: MensajeApi) {
    const c = m.reply_to;
    if (!c) return null;
    const propio = m.sender_id === miId;
    return (
      <TouchableOpacity style={[styles.cita, propio ? styles.citaPropia : styles.citaAjena]} disabled={!c.available} onPress={() => irAlMensaje(c)} accessibilityLabel="Ir al mensaje citado">
        <View style={[styles.citaBarra, { backgroundColor: propio ? '#fff' : colors.accent }]} />
        <View style={styles.citaCuerpo}>
        <Text style={[styles.citaAutor, { color: propio ? '#fff' : colors.accent }]} numberOfLines={1}>
          {c.available ? (c.sender_id === miId ? 'Tú' : primerNombre) : 'Mensaje no disponible'}
        </Text>
        {c.available ? <Text style={[styles.citaTexto, { color: propio ? 'rgba(255,255,255,0.85)' : colors.textMuted }]} numberOfLines={2}>{c.text || (c.message_type === 'IMAGE' ? 'Foto' : c.message_type === 'LOCATION' ? 'Ubicación compartida' : 'Archivo')}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  }

  async function cargarAnteriores() {
    if (!mensajes.length || cargandoAnteriores) return;
    setCargandoAnteriores(true);
    const version = generacion.current;
    try {
      const pagina = await getMensajes(id, { before: mensajes[0].id });
      if (version !== generacion.current) return;
      desplazar.current = false;
      setMensajes((prev) => fusionar(prev, pagina)); setAnteriores(pagina.length === 50);
    } catch (e) {
      if (version === generacion.current) mostrarError(e);
    } finally {
      if (version === generacion.current) setCargandoAnteriores(false);
    }
  }

  const nombre = persona?.name ?? 'Chat';
  const primerNombre = nombre.split(' ')[0];
  const deporte = persona && persona.sport !== 'Sin deporte aún' ? persona.sport : null;
  const sugerencias = [
    '¡Hola! 👋',
    `¿Entrenamos ${deporte ? deporte.toLowerCase() : 'juntos'}?`,
    '¿Qué días te acomodan?',
  ];

  function reportarMensaje(m: MensajeApi) {
    const texto = m.text || (m.message_type === 'LOCATION' ? 'Ubicación compartida' : m.message_type === 'IMAGE' ? 'Foto' : 'Archivo');
    const resumen = texto.length > 60 ? `${texto.slice(0, 60)}…` : texto;
    setReporte({ tipo: 'mensaje', id: `${id}:${m.id}`, nombre: `Mensaje de ${primerNombre}: "${resumen}"` });
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.topbar, { paddingTop: insets.top + espacio.m }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity disabled={!disponible} onPress={() => router.push({ pathname: '/(deportista)/athlete/[id]', params: { id } })} accessibilityLabel={`Ver perfil de ${nombre}`}><Avatar name={nombre} colorFrom={persona?.colorFrom ?? '#7C3AED'} uri={persona?.fotoUri} style={styles.avatar} fontSize={13} /></TouchableOpacity>
        <TouchableOpacity style={styles.topbarTextos} disabled={!disponible} accessibilityLabel={`Ver perfil de ${nombre}`}
          onPress={() => router.push({ pathname: '/(deportista)/athlete/[id]', params: { id } })}>
          <Text style={styles.name}>{nombre}</Text>
          <View style={styles.subtitulo}>
            <Text style={styles.sport}>{persona ? `${deporte ?? 'Deportista'} · Ver perfil` : ''}</Text>
            {silenciado && !bloqueado ? (
              <View style={styles.etiqueta}>
                <Ionicons name="notifications-off-outline" size={11} color={colors.textMuted} />
                <Text style={styles.etiquetaTexto}>Silenciado</Text>
              </View>
            ) : null}
            {bloqueado ? (
              <View style={styles.etiqueta}>
                <Ionicons name="ban-outline" size={11} color={colors.danger} />
                <Text style={[styles.etiquetaTexto, { color: colors.danger }]}>Bloqueado</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        {personaId ? (
          <TouchableOpacity onPress={abrirOpciones} style={styles.reportButton} accessibilityLabel={`Opciones de ${nombre}`}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
        {persona ? (
          <TouchableOpacity
            onPress={() => setReporte({ tipo: 'usuario', id: persona.id, nombre })}
            style={styles.reportButton}
            accessibilityLabel={`Reportar a ${nombre}`}
          >
            <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && !bloqueado && <TouchableOpacity onPress={() => actualizarRef.current()}><Text style={styles.introTexto}>{error} · Reintentar</Text></TouchableOpacity>}
      <FlatList ref={listaRef} data={mensajes} keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, mensajes.length === 0 && styles.listVacia]}
        onContentSizeChange={() => { if (destinoCita) desplazarAlDestino(); else if (desplazar.current) listaRef.current?.scrollToEnd({ animated: true }); }}
        onLayout={desplazarAlDestino}
        onScrollBeginDrag={() => setDestinoCita(null)}
        onScrollToIndexFailed={({ averageItemLength, index }) => {
          if (++intentosDesplazar.current <= 3) {
            listaRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
          } else setDestinoCita(null);
        }}
        ListHeaderComponent={anteriores ? <TouchableOpacity disabled={cargandoAnteriores} onPress={cargarAnteriores}><Text style={styles.introTexto}>{cargandoAnteriores ? 'Cargando...' : 'Ver mensajes anteriores'}</Text></TouchableOpacity> : null}
        ListEmptyComponent={
          <View style={styles.intro}>
            {cargando ? <Text style={styles.introTexto}>Cargando conversación...</Text> : disponible ? <>
              <View style={styles.introIcono}><Ionicons name="heart" size={22} color="#fff" /></View>
              <Text style={styles.introTitulo}>Hiciste match con {primerNombre}</Text>
              <Text style={styles.introTexto}>Rompe el hielo y coordinen su primer entrenamiento.</Text>
              <View style={styles.sugerencias}>{sugerencias.map((s) => <TouchableOpacity key={s} disabled={enviando} style={styles.sugerencia} onPress={() => enviar(s)}><Text style={styles.sugerenciaTexto}>{s}</Text></TouchableOpacity>)}</View>
            </> : bloqueado ? null : <Text style={styles.introTexto}>El chat estará disponible cuando ambos tengan un match aceptado.</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const foto = item.message_type === 'IMAGE' && !!item.attachment_url;
          const mapa = item.message_type === 'LOCATION' && item.latitude != null && item.longitude != null;
          const propio = item.sender_id === miId;
          return (
            <TouchableOpacity activeOpacity={0.8} delayLongPress={350}
              onPress={foto ? () => setFotoAbierta(item.attachment_url ?? null) : mapa ? () => abrirEnMapas({ latitud: item.latitude!, longitud: item.longitude! }) : undefined}
              onLongPress={() => opcionesMensaje(item)}
              style={[styles.bubble, propio ? styles.bubbleOwn : styles.bubbleOther, foto && styles.bubbleFoto, mapa && styles.bubbleMapa]}
              accessibilityHint="Mantén presionado para responder o reportar este mensaje">
              {cita(item)}
              {contenido(item, propio)}
            </TouchableOpacity>
          );
        }}
      />
      {bloqueado ? (
        // Persona bloqueada (HU-59): no se puede escribir hasta desbloquearla.
        <View style={[styles.bloqueadoBox, { paddingBottom: margenInferior }]}>
          <Ionicons name="ban-outline" size={18} color={colors.danger} />
          <Text style={styles.bloqueadoTexto}>Bloqueaste a {primerNombre}. No pueden enviarse mensajes.</Text>
          <TouchableOpacity style={styles.desbloquearBtn} onPress={cambiarBloqueo}>
            <Text style={styles.desbloquearTexto}>Desbloquear</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <View style={styles.pie}>
      {citando ? <View style={styles.respondiendo}>
        <View style={styles.respondiendoBarra} />
        <View style={styles.respondiendoTextos}>
          <Text style={styles.respondiendoAutor}>{citando.sender_id === miId ? 'Tú' : primerNombre}</Text>
          <Text style={styles.respondiendoTexto} numberOfLines={1}>{resumenMensaje(citando)}</Text>
        </View>
        <TouchableOpacity onPress={() => setCitando(null)} accessibilityLabel="Cancelar respuesta" style={styles.respondiendoCerrar}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View> : null}
      <View style={[styles.inputRow, { paddingBottom: margenInferior }]}>
        <TouchableOpacity
          style={[styles.adjuntarButton, !disponible && { opacity: 0.5 }]}
          onPress={abrirAdjuntos}
          disabled={!disponible || obteniendoUbicacion || enviando}
          accessibilityLabel="Adjuntar ubicación o foto"
        >
          {obteniendoUbicacion ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Ionicons name="add" size={20} color={colors.textMuted} />}
        </TouchableOpacity>
        <TextInput placeholder="Escribe un mensaje..." placeholderTextColor={colors.textMuted} style={styles.input} value={texto} onChangeText={setTexto} onSubmitEditing={() => enviar()} returnKeyType="send" editable={disponible && !enviando} maxLength={2000} />
        <TouchableOpacity style={[styles.sendButton, (!disponible || enviando) && { opacity: 0.5 }]} disabled={!disponible || enviando || !texto.trim()} onPress={() => enviar()} accessibilityLabel="Enviar mensaje"><Ionicons name="send" size={16} color="#fff" /></TouchableOpacity>
      </View>
      </View>
      )}
      <VisorFoto uri={fotoAbierta} onClose={() => setFotoAbierta(null)} />

      {/* Reportar persona o mensaje (HU-42) */}
      <ReportarModal
        visible={reporte !== null}
        onClose={() => setReporte(null)}
        tipo={ultimoReporte.current.tipo}
        objetivoId={ultimoReporte.current.id}
        objetivoNombre={ultimoReporte.current.nombre}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bubbleFoto: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, overflow: 'hidden' },
    bubbleMapa: { width: 240, maxWidth: '78%', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 0, overflow: 'hidden' },
    citaPropia: { backgroundColor: 'rgba(0,0,0,0.22)' },
    citaAjena: { backgroundColor: c.chip },
    citaBarra: { width: 4 },
    citaCuerpo: { flexShrink: 1, paddingHorizontal: espacio.s, paddingVertical: espacio.xs, gap: 1 },
    citaAutor: { ...tipo.etiqueta },
    citaTexto: { ...tipo.dato },
    pie: { borderTopWidth: 1, borderColor: c.border },
    respondiendoBarra: { alignSelf: 'stretch', width: 4, backgroundColor: c.accent },
    respondiendoTextos: { flex: 1, paddingHorizontal: espacio.m, paddingVertical: espacio.s },
    respondiendoAutor: { color: c.accent, ...tipo.etiqueta },
    respondiendoTexto: { color: c.textMuted, ...tipo.dato },
    respondiendoCerrar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    ubicacionPie: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.m, paddingVertical: espacio.s, minHeight: 48 },
    ubicacionTextos: { flex: 1 },

    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingHorizontal: espacio.l, paddingBottom: espacio.m, borderBottomWidth: 1, borderColor: c.border },
    backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topbarTextos: { flex: 1 },
    reportButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    name: { color: c.text, ...tipo.seccion },
    sport: { color: c.textMuted, ...tipo.dato },
    subtitulo: { flexDirection: 'row', alignItems: 'center', gap: espacio.s },
    etiqueta: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
    etiquetaTexto: { color: c.textMuted, ...tipo.etiqueta },
    list: { padding: espacio.xl, gap: espacio.m },
    listVacia: { flexGrow: 1, justifyContent: 'center' },
    bubble: { maxWidth: '78%', borderRadius: radio.tarjeta, paddingHorizontal: espacio.l - 2, paddingVertical: espacio.m - 1, marginBottom: espacio.xs },
    bubbleOther: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: espacio.xs },
    bubbleOwn: { backgroundColor: c.primary, alignSelf: 'flex-end', borderBottomRightRadius: espacio.xs },
    bubbleTextOther: { color: c.text, ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    bubbleTextOwn: { color: '#FFFFFF', ...tipo.cuerpo, fontSize: 14, lineHeight: 20 },
    cita: { flexDirection: 'row', borderRadius: radio.control, overflow: 'hidden', marginBottom: espacio.xs },
    respondiendo: { flexDirection: 'row', alignItems: 'center', marginHorizontal: espacio.l, marginTop: espacio.s, borderRadius: radio.control, overflow: 'hidden', backgroundColor: c.chip },
    bubbleMedia: { padding: 6, width: 240 },
    imagen: { width: 240, borderRadius: radio.tarjeta },
    ubicacion: { paddingHorizontal: espacio.s, paddingVertical: 6, gap: espacio.xs, minHeight: 44, justifyContent: 'center' },
    ubicacionFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ubicacionTitulo: { color: c.text, ...tipo.cuerpoFuerte },
    ubicacionAccion: { color: c.accent, ...tipo.dato },
    intro: { alignItems: 'center', paddingHorizontal: espacio.m },
    introIcono: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: espacio.m },
    introTitulo: { color: c.text, ...tipo.titulo },
    introTexto: { color: c.textMuted, ...tipo.cuerpo, lineHeight: 19, marginTop: espacio.xs, textAlign: 'center' },
    sugerencias: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: espacio.s, marginTop: espacio.xl },
    sugerencia: { backgroundColor: c.chip, borderRadius: radio.control, paddingHorizontal: espacio.l, minHeight: 44, justifyContent: 'center' },
    sugerenciaTexto: { color: c.accent, ...tipo.cuerpoFuerte },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingTop: espacio.m, paddingHorizontal: espacio.l },
    input: { flex: 1, minHeight: 44, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: espacio.l, paddingVertical: espacio.s, color: c.text, fontSize: 14, fontWeight: '400' },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    adjuntarButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    bloqueadoBox: {
      flexDirection: 'row', alignItems: 'center', gap: espacio.m, flexWrap: 'wrap',
      paddingTop: espacio.m, paddingHorizontal: espacio.l, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card,
    },
    bloqueadoTexto: { flex: 1, color: c.textMuted, ...tipo.dato, lineHeight: 17 },
    desbloquearBtn: { minHeight: 44, paddingHorizontal: espacio.l },
    desbloquearTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });
