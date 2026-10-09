import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import MatchModal from '../../components/MatchModal';
import { Usuario, getSession } from '../../services/auth';
import {
    DEPORTES_BUSQUEDA,
    DISTANCIAS_BUSQUEDA,
    FILTROS_VACIOS,
    FRANJAS_BUSQUEDA,
    FiltrosBusqueda,
    NIVELES_BUSQUEDA,
    contarFiltros,
    disponibilidadDe,
    filtrarPersonas,
    todasLasPersonas,
} from '../../services/busqueda';
import { Persona, darLike, useMatches } from '../../services/matchStore';
import { Colors, useAppTheme } from '../../theme/ThemeContext';

type Relacion = 'match' | 'enviada' | 'solicitud' | 'libre';

export default function BuscarScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const estado = useMatches();

  const [filtros, setFiltros] = useState<FiltrosBusqueda>(FILTROS_VACIOS);
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nuevoMatch, setNuevoMatch] = useState<Persona | null>(null);

  useEffect(() => {
    getSession().then(setUsuario);
  }, []);

  const resultados = useMemo(() => filtrarPersonas(todasLasPersonas(estado), filtros), [estado, filtros]);
  const activos = contarFiltros(filtros);
  const hayBusqueda = activos > 0 || filtros.texto.trim().length > 0;

  const idsMatch = new Set(estado.confirmados.map((p) => p.id));
  const idsSolicitud = new Set(estado.solicitudes.map((p) => p.id));
  const idsEnviada = new Set(estado.enviadas);
  function relacionCon(p: Persona): Relacion {
    if (idsMatch.has(p.id)) return 'match';
    if (idsEnviada.has(p.id)) return 'enviada';
    if (idsSolicitud.has(p.id)) return 'solicitud';
    return 'libre';
  }

  function cambiar(cambio: Partial<FiltrosBusqueda>) {
    setFiltros((prev) => ({ ...prev, ...cambio }));
  }

  function alternarNivel(nivel: string) {
    setFiltros((prev) => ({
      ...prev,
      niveles: prev.niveles.includes(nivel) ? prev.niveles.filter((n) => n !== nivel) : [...prev.niveles, nivel],
    }));
  }

  function limpiar() {
    setFiltros(FILTROS_VACIOS);
  }

  async function handleLike(persona: Persona) {
    try {
      const resultado = await darLike(persona);
      if (resultado.matchId) setNuevoMatch(resultado);
    } catch (e) {
      Alert.alert('No se pudo enviar la solicitud', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    }
  }

  function verPerfil(persona: Persona) {
    router.push({
      pathname: '/(deportista)/perfil/[id]',
      params: persona.matchId ? { id: persona.id, matchId: persona.matchId } : { id: persona.id },
    });
  }

  function enviarMensajeDesdeMatch() {
    const persona = nuevoMatch;
    setNuevoMatch(null);
    if (!persona?.matchId) return;
    router.push({ pathname: '/(deportista)/chat/[id]', params: { id: persona.matchId } });
  }

  const miNombre = usuario ? `${usuario.nombre} ${usuario.apellidoPaterno}` : 'Yo';

  const chip = (key: string, label: string, activo: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} style={[styles.chip, activo && styles.chipActivo]} onPress={onPress}>
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </TouchableOpacity>
  );

  const grupo = (titulo: string, chips: ReactNode) => (
    <View style={styles.grupo}>
      <Text style={styles.grupoTitulo}>{titulo}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsFila}>
        {chips}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Buscar deportistas</Text>
      </View>

      {/* Búsqueda por texto */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          placeholder="Buscar por nombre o deporte..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={filtros.texto}
          onChangeText={(texto) => cambiar({ texto })}
          autoCorrect={false}
          returnKeyType="search"
        />
        {filtros.texto.length > 0 ? (
          <TouchableOpacity onPress={() => cambiar({ texto: '' })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros: se pueden ocultar para ver más resultados */}
      <View style={styles.filtrosHeader}>
        <TouchableOpacity style={styles.filtrosToggle} onPress={() => setMostrarFiltros((v) => !v)}>
          <Ionicons name="options-outline" size={16} color={colors.accent} />
          <Text style={styles.filtrosTitulo}>Filtros{activos > 0 ? ` (${activos})` : ''}</Text>
          <Ionicons name={mostrarFiltros ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
        </TouchableOpacity>
        {hayBusqueda ? (
          <TouchableOpacity onPress={limpiar}>
            <Text style={styles.limpiarLink}>Limpiar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {mostrarFiltros ? (
        <View style={styles.filtrosPanel}>
          {grupo(
            'Deporte',
            <>
              {chip('dep-todos', 'Todos', filtros.deporte === null, () => cambiar({ deporte: null }))}
              {DEPORTES_BUSQUEDA.map((d) =>
                chip(`dep-${d}`, d, filtros.deporte === d, () => cambiar({ deporte: filtros.deporte === d ? null : d }))
              )}
            </>
          )}
          {grupo(
            'Nivel',
            NIVELES_BUSQUEDA.map((n) => chip(`niv-${n}`, n, filtros.niveles.includes(n), () => alternarNivel(n)))
          )}
          {grupo(
            'Horario',
            FRANJAS_BUSQUEDA.map((f) =>
              chip(`fra-${f.key}`, f.label, filtros.franja === f.key, () => cambiar({ franja: filtros.franja === f.key ? null : f.key }))
            )
          )}
          {grupo(
            'Distancia',
            DISTANCIAS_BUSQUEDA.map((d) =>
              chip(`dis-${d.label}`, d.label, filtros.radioKm === d.km, () => cambiar({ radioKm: d.km }))
            )
          )}
        </View>
      ) : null}

      <Text style={styles.contador}>
        {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
      </Text>

      {/* Resultados */}
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {resultados.map((persona) => {
          const relacion = relacionCon(persona);
          const disponibilidad = filtros.franja ? disponibilidadDe(persona) : undefined;
          return (
            <View key={persona.id} style={styles.card}>
              <TouchableOpacity style={styles.cardTap} onPress={() => verPerfil(persona)} activeOpacity={0.7}>
                <Avatar
                  name={persona.name}
                  colorFrom={persona.colorFrom}
                  uri={persona.fotoUri}
                  style={styles.avatar}
                  fontSize={18}
                  overlayStyle={styles.avatarOverlay}
                >
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{persona.compatibility}%</Text>
                  </View>
                </Avatar>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{persona.name}</Text>
                  <Text style={styles.cardMeta}>
                    {persona.sport} · {persona.level}{persona.distance ? ` · ${persona.distance}` : ''}
                  </Text>
                  {disponibilidad ? (
                    <View style={styles.dispRow}>
                      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.dispTexto} numberOfLines={1}>{disponibilidad}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>

              {relacion === 'libre' ? (
                <TouchableOpacity style={styles.likeButton} onPress={() => handleLike(persona)} accessibilityLabel={`Enviar solicitud a ${persona.name}`}>
                  <Ionicons name="heart" size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.tag, relacion === 'match' && styles.tagMatch, relacion === 'solicitud' && styles.tagSolicitud]}>
                  <Text style={[styles.tagTexto, relacion === 'match' && styles.tagTextoMatch, relacion === 'solicitud' && styles.tagTextoSolicitud]}>
                    {relacion === 'match' ? 'Match' : relacion === 'enviada' ? 'Enviada' : 'Te envió solicitud'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {resultados.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.emptyText}>No encontramos deportistas con esos filtros.</Text>
            {hayBusqueda ? (
              <TouchableOpacity style={styles.vacioBoton} onPress={limpiar}>
                <Text style={styles.vacioBotonTexto}>Limpiar filtros</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* ¡ES UN MATCH! */}
      <MatchModal
        visible={nuevoMatch !== null}
        miNombre={miNombre}
        miFoto={usuario?.fotoPerfil}
        nombre={nuevoMatch?.name ?? ''}
        colorFrom={nuevoMatch?.colorFrom ?? '#7C3AED'}
        fotoUri={nuevoMatch?.fotoUri}
        onEnviarMensaje={enviarMensajeDesdeMatch}
        onCerrar={() => setNuevoMatch(null)}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
    backButton: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    title: { color: c.text, fontSize: 18, fontWeight: '700' },

    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.inputBg,
      borderWidth: 1, borderColor: c.border, borderRadius: 13,
      paddingHorizontal: 14, paddingVertical: 11, marginHorizontal: 20, marginBottom: 12,
    },
    searchInput: { color: c.text, fontSize: 13, flex: 1, padding: 0 },

    filtrosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
    filtrosToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    filtrosTitulo: { color: c.text, fontSize: 13, fontWeight: '700' },
    limpiarLink: { color: c.accent, fontSize: 11.5, fontWeight: '700' },

    filtrosPanel: { marginBottom: 6 },
    grupo: { marginBottom: 8 },
    grupoTitulo: { color: c.textMuted, fontSize: 10.5, fontWeight: '600', paddingHorizontal: 20, marginBottom: 5 },
    chipsFila: { paddingHorizontal: 20, gap: 8 },
    chip: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7 },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipTexto: { color: c.textMuted, fontSize: 11.5, fontWeight: '600' },
    chipTextoActivo: { color: '#fff' },

    contador: { color: c.textMuted, fontSize: 11.5, paddingHorizontal: 20, marginBottom: 8 },

    list: { paddingHorizontal: 20, paddingBottom: 30 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
      borderRadius: 14, padding: 10, marginBottom: 10,
    },
    cardTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 56, height: 56, borderRadius: 12 },
    avatarOverlay: { alignItems: 'flex-end', padding: 4 },
    badge: { backgroundColor: c.badgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: c.success, fontSize: 9, fontWeight: '700' },
    cardInfo: { flex: 1 },
    cardName: { color: c.text, fontSize: 13, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    dispRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    dispTexto: { color: c.textMuted, fontSize: 10.5, flexShrink: 1 },

    likeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#DB2777', alignItems: 'center', justifyContent: 'center' },
    tag: { backgroundColor: c.chip, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    tagTexto: { color: c.textMuted, fontSize: 10.5, fontWeight: '700' },
    tagMatch: { backgroundColor: c.badgeBg },
    tagTextoMatch: { color: c.success },
    tagSolicitud: { backgroundColor: c.chip },
    tagTextoSolicitud: { color: c.accent },

    vacio: { alignItems: 'center', marginTop: 30, gap: 12 },
    emptyText: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
    vacioBoton: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
    vacioBotonTexto: { color: c.accent, fontSize: 12, fontWeight: '700' },
  });