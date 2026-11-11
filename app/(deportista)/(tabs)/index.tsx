import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AthleteCard from '../../../components/AthleteCard';
import TrainingRow from '../../../components/TrainingRow';
import { AvatarMini, EncabezadoMarca } from '../../../components/ui';
import {
  FILTROS_ACTIVIDADES_VACIOS,
  filtrarActividades,
  formatearCuando,
  useActividades,
  cargarActividades,
} from '../../../services/actividades';
import { Usuario, getSession } from '../../../services/auth';
import { cargarSugerencias, sugerencias, useMatches } from '../../../services/matchStore';
import { useNotificaciones } from '../../../services/notificaciones';
import { Colors, espacio, radio, tipo, useAppTheme } from '../../../theme/ThemeContext';

// Texto sobre fondos de color fuerte.
const SOBRE_COLOR = '#FFFFFF';

// Cuántas actividades se ven en Inicio antes de tocar "Ver más".
const ACTIVIDADES_VISIBLES = 4;

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const estado = useMatches();
  const { noLeidas } = useNotificaciones();
  const actividades = useActividades();
  // Todas las actividades abiertas, para verlas directo en Inicio.
  const abiertas = filtrarActividades(actividades, FILTROS_ACTIVIDADES_VACIOS);
  const recomendados = useMemo(() => sugerencias(estado).slice(0, 5), [estado]);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? abiertas : abiertas.slice(0, ACTIVIDADES_VISIBLES);

  // Cada vez que se vuelve a esta pestaña se traen los deportistas actualizados.
  useFocusEffect(
    useCallback(() => {
      getSession().then(setUsuario);
      void cargarSugerencias();
      void cargarActividades().catch(() => {});
    }, [])
  );

  const iniciales = usuario
    ? `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`
    : '..';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Encabezado */}
      <EncabezadoMarca
        margenHorizontal={0}
        derecha={
          <>
            {/* Campanita: abre la bandeja y muestra cuántos avisos faltan por leer */}
            <TouchableOpacity
              onPress={() => router.push('/(deportista)/notificaciones')}
              style={styles.bell}
              accessibilityRole="button"
              accessibilityLabel={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {noLeidas > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{noLeidas > 9 ? '9+' : noLeidas}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <AvatarMini
              uri={usuario?.fotoPerfil}
              iniciales={iniciales}
              onPress={() => router.push('/(deportista)/(tabs)/profile')}
            />
          </>
        }
      />

      <Text style={styles.greeting}>
        ¡Hola, {usuario?.nombre ?? '...'}!
      </Text>

      <Text style={styles.subtitle}>
        ¿Qué deporte quieres practicar hoy?
      </Text>

      {/* Buscador: abre la pantalla de búsqueda con filtros */}
      <TouchableOpacity
        style={styles.searchBox}
        onPress={() => router.push('/(deportista)/buscar')}
        accessibilityRole="button"
        accessibilityLabel="Buscar deportistas"
        activeOpacity={0.7}
      >
        <Ionicons
          name="search"
          size={16}
          color={colors.textMuted}
        />

        <Text style={styles.searchPlaceholder} numberOfLines={1}>
          Buscar deportistas
        </Text>

        <Ionicons
          name="options-outline"
          size={16}
          color={colors.accent}
        />
      </TouchableOpacity>

      {/* Acceso a las convocatorias de los clubes */}
      <TouchableOpacity
        style={[styles.clubBanner, styles.clubBannerSeguido]}
        onPress={() => router.push('/(deportista)/convocatorias')}
        accessibilityRole="button"
      >
        <Ionicons name="megaphone-outline" size={18} color={colors.accent} />
        <Text style={styles.clubBannerText}>Explorar convocatorias</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Acceso al directorio de clubes */}
      <TouchableOpacity
        style={styles.clubBanner}
        onPress={() => router.push('/(deportista)/clubs')}
        accessibilityRole="button"
      >
        <Ionicons name="shield-outline" size={18} color={colors.accent} />
        <Text style={styles.clubBannerText}>Explorar clubes</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Sección: Deportistas recomendados */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          Deportistas recomendados
        </Text>

        <TouchableOpacity
          onPress={() => router.push('/(deportista)/(tabs)/discover')}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.sectionLink}>
            Ver todos
          </Text>
        </TouchableOpacity>
      </View>

      {recomendados.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {recomendados.map((persona) => (
            <AthleteCard
              key={persona.id}
              name={persona.name}
              sport={persona.sport}
              level={persona.level}
              distance={persona.distance}
              compatibility={persona.compatibility}
              colorFrom={persona.colorFrom}
              fotoUri={persona.fotoUri}
              onPress={() => router.push('/(deportista)/(tabs)/discover')}
            />
          ))}
        </ScrollView>
      ) : estado.cargando ? (
        <Text style={styles.emptyText}>Cargando deportistas...</Text>
      ) : estado.error ? (
        <TouchableOpacity
          onPress={() =>
            estado.sesionExpirada ? router.replace('/(auth)/login') : void cargarSugerencias()
          }
        >
          <Text style={styles.emptyText}>{estado.error}</Text>
          <Text style={styles.sectionLink}>
            {estado.sesionExpirada ? 'Iniciar sesión' : 'Reintentar'}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.emptyText}>
          {estado.catalogo.length === 0
            ? 'Aún no hay otros deportistas registrados.'
            : 'Ya viste a todos los deportistas cerca de ti por ahora.'}
        </Text>
      )}

      {/* Sección: Entrenamientos cerca de ti (todas las actividades abiertas, aquí mismo) */}
      <View style={[styles.sectionRow, { marginTop: espacio.xxl }]}>
        <Text style={styles.sectionTitle}>
          Entrenamientos cerca de ti
        </Text>

        {abiertas.length > 0 ? (
          <Text style={styles.sectionCount}>
            {abiertas.length} {abiertas.length === 1 ? 'abierta' : 'abiertas'}
          </Text>
        ) : null}
      </View>

      <View style={styles.actividadesAcciones}>
        <TouchableOpacity
          style={styles.accionSecundaria}
          onPress={() => router.push({ pathname: '/(deportista)/activities', params: { tab: 'mias' } })}
          accessibilityRole="button"
          accessibilityLabel="Mis actividades"
        >
          <Ionicons name="calendar-outline" size={15} color={colors.accent} />
          <Text style={styles.accionSecundariaTexto}>Mis actividades</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.accionPrimaria}
          onPress={() => router.push('/(deportista)/activity/nueva')}
          accessibilityRole="button"
          accessibilityLabel="Crear actividad"
        >
          <Ionicons name="add" size={16} color={SOBRE_COLOR} />
          <Text style={styles.accionPrimariaTexto}>Crear actividad</Text>
        </TouchableOpacity>
      </View>

      {abiertas.length > 0 ? (
        visibles.map((a) => {
          return (
            <TouchableOpacity
              key={a.id}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/(deportista)/activity/[id]', params: { id: a.id } })}
            >
              <TrainingRow
                deporte={a.deporte}
                title={a.titulo}
                time={formatearCuando(a.fecha)}
                distance={a.comuna}
              />
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.emptyText}>No hay actividades abiertas por ahora.</Text>
      )}

      {abiertas.length > ACTIVIDADES_VISIBLES ? (
        <TouchableOpacity
          style={styles.verMasBtn}
          onPress={() => setVerTodas((v) => !v)}
          activeOpacity={0.7}
          accessibilityLabel={verTodas ? 'Ver menos actividades' : 'Ver más actividades'}
        >
          <Text style={styles.verMasTexto}>
            {verTodas ? 'Ver menos' : `Ver más (${abiertas.length - ACTIVIDADES_VISIBLES})`}
          </Text>
          <Ionicons name={verTodas ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },

    content: {
      paddingHorizontal: espacio.xl,
      paddingBottom: espacio.xxl + espacio.s,
    },

    bell: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    bellBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: espacio.xs,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },

    bellBadgeText: {
      color: '#FFFFFF',
      ...tipo.etiqueta,
      fontWeight: '800',
    },

    greeting: {
      color: c.text,
      ...tipo.titulo,
      marginBottom: espacio.xs,
    },

    subtitle: {
      color: c.textMuted,
      ...tipo.cuerpo,
      marginBottom: espacio.l,
    },

    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.s,
      minHeight: 48,
      backgroundColor: c.inputBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.control,
      paddingHorizontal: espacio.l,
      marginBottom: espacio.m,
    },

    searchPlaceholder: {
      color: c.textMuted,
      ...tipo.cuerpo,
      flex: 1,
    },

    clubBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espacio.m,
      minHeight: 48,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.control,
      paddingHorizontal: espacio.l,
      marginBottom: espacio.xl + 2,
    },

    clubBannerSeguido: {
      marginBottom: espacio.m,
    },

    clubBannerText: {
      color: c.text,
      ...tipo.cuerpoFuerte,
      flex: 1,
    },

    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: espacio.m,
    },

    sectionTitle: {
      color: c.text,
      ...tipo.seccion,
    },

    sectionLink: {
      color: c.accent,
      ...tipo.cuerpoFuerte,
    },

    sectionCount: {
      color: c.textMuted,
      ...tipo.etiqueta,
    },

    actividadesAcciones: {
      flexDirection: 'row',
      gap: espacio.m,
      marginBottom: espacio.l,
    },

    accionSecundaria: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espacio.s - 2,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.control,
    },

    accionSecundariaTexto: {
      color: c.accent,
      ...tipo.cuerpoFuerte,
    },

    accionPrimaria: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espacio.xs,
      backgroundColor: c.primary,
      borderRadius: radio.control,
    },

    accionPrimariaTexto: {
      color: '#FFFFFF',
      ...tipo.cuerpoFuerte,
    },

    verMasBtn: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espacio.s - 2,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radio.control,
      marginTop: 2,
    },

    verMasTexto: {
      color: c.accent,
      ...tipo.cuerpoFuerte,
    },

    emptyText: {
      color: c.textMuted,
      ...tipo.cuerpo,
    },
  });