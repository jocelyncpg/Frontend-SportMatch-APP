import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import { getSession } from '../../services/auth';
import { horaCorta } from '../../services/chat';
import { cargarHilosClub, sinResponder, useEstadoConsultas, useHilosDelClub } from '../../services/consultas';
import { alCambiar, crearSondeo } from '../../services/sondeo';
import { Colors, useAppTheme } from '../../theme/ThemeContext';
export default function ConsultasClubScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [clubId, setClubId] = useState('');
  const [clubNombre, setClubNombre] = useState('');
  const [errorSesion, setErrorSesion] = useState('');
  const estado = useEstadoConsultas();
  useEffect(() => {
    getSession().then((s) => {
      setClubId(s?.clubId ?? '');
      setClubNombre(s?.clubNombre ?? '');
      if (!s?.clubId) setErrorSesion('Tu sesión expiró o ya no administras un club.');
    });
  }, []);
  useFocusEffect(useCallback(() => {
    if (!clubId) return;
    const sondeo = crearSondeo('listas:club:' + clubId, () => cargarHilosClub(clubId, clubNombre)
      .catch(() => false), { minMs: 10000, maxMs: 60000, factor: 1.5 });
    const quitarAviso = alCambiar(({ tipo }) => {
      if (tipo === 'consulta_club') sondeo.ahora();
    });
    sondeo.iniciar();
    return () => {
      sondeo.detener();
      quitarAviso();
    };
  }, [clubId, clubNombre]));
  const hilos = useHilosDelClub(clubId);
  const pendientes = sinResponder(hilos).length;
  function abrir(id: string) {
    router.push({ pathname: '/(club)/consulta/[id]', params: { id } } as never);
  }
  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Consultas</Text>
          <Text style={styles.sub}>
            {pendientes > 0 ? `${pendientes} sin responder` : 'Todo al día'} · bandeja compartida del club
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {errorSesion ? <Text style={styles.vacioTexto}>{errorSesion}</Text> : null}
        {estado.cargando ? <Text style={styles.vacioTexto}>Cargando consultas...</Text> : null}
        {estado.error ? <Text style={styles.vacioTexto}>{estado.error}</Text> : null}
        {hilos.map((h) => {
          const ultimo = h.mensajes[h.mensajes.length - 1];
          const sinResp = ultimo?.de === 'postulante';
          return (
            <TouchableOpacity key={h.id} style={styles.card} onPress={() => abrir(h.id)} activeOpacity={0.8}>
              <Avatar name={h.postulanteNombre} colorFrom="#7C3AED" style={styles.avatar} fontSize={15} />
              <View style={styles.info}>
                <Text style={styles.nombre}>{h.postulanteNombre}</Text>
                <Text style={[styles.mensaje, h.noLeidosClub > 0 && styles.mensajeSinLeer]} numberOfLines={1}>
                  {ultimo ? `${ultimo.de === 'club' ? 'Club: ' : ''}${ultimo.texto}` : ''}
                </Text>
              </View>
              <View style={styles.derecha}>
                {ultimo ? <Text style={styles.hora}>{horaCorta(ultimo.enviadoEn)}</Text> : null}
                {sinResp ? (
                  <View style={styles.pendiente}>
                    <Text style={styles.pendienteTexto}>Sin responder</Text>
                  </View>
                ) : (
                  <Ionicons name="checkmark-done" size={14} color={colors.success} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        {hilos.length === 0 && (
          <View style={styles.vacio}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.vacioTitulo}>Aún no hay consultas</Text>
            <Text style={styles.vacioTexto}>
              Cuando un deportista te escriba sobre tu convocatoria, la consulta aparecerá aquí.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
    backButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center'
    },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    sub: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    list: { paddingHorizontal: 20, paddingBottom: 30 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10
    },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    info: { flex: 1 },
    nombre: { color: c.text, fontSize: 13, fontWeight: '700' },
    mensaje: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    mensajeSinLeer: { color: c.text, fontWeight: '700' },
    derecha: { alignItems: 'flex-end', gap: 6 },
    hora: { color: c.textMuted, fontSize: 10 },
    pendiente: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    pendienteTexto: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
    vacio: { alignItems: 'center', paddingHorizontal: 30, marginTop: 60, gap: 8 },
    vacioTitulo: { color: c.text, fontSize: 14, fontWeight: '700', marginTop: 6 },
    vacioTexto: { color: c.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  });
