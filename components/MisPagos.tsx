import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, EncabezadoPantalla, Tarjeta } from './ui';
import { cargarComprobante, cargarHistorialPagos, cargarHistorialPeriodos, cargarMiSuscripcion, formatearCLP,
  type PaginaHistorial, type PagoHistorial, type PeriodoSuscripcion, type SuscripcionApi } from '../services/planes';
import { useAppTheme } from '../theme/ThemeContext';

const estados = { APPROVED: 'Aprobado', REJECTED: 'Rechazado', CANCELLED: 'Anulado', PENDING: 'Pendiente' };
const fecha = (value: string) => new Date(value).toLocaleDateString('es-CL');

export default function MisPagos() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [actual, setActual] = useState<SuscripcionApi | null>(null);
  const [pagos, setPagos] = useState<PaginaHistorial<PagoHistorial> | null>(null);
  const [periodos, setPeriodos] = useState<PaginaHistorial<PeriodoSuscripcion> | null>(null);
  const [paginaPago, setPaginaPago] = useState(1);
  const [paginaPeriodo, setPaginaPeriodo] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargando, setDescargando] = useState<string | null>(null);
  const descargaEnCurso = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setCargando(true);
    Promise.all([cargarMiSuscripcion(), cargarHistorialPagos(paginaPago), cargarHistorialPeriodos(paginaPeriodo)])
      .then(([s, p, h]) => { if (active) { setActual(s); setPagos(p); setPeriodos(h); setError(''); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  // El contador reinicia la carga de foco y descarta la respuesta del intento anterior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaPago, paginaPeriodo, intento]));

  async function descargar(id: string) {
    if (descargaEnCurso.current) return;
    descargaEnCurso.current = true;
    setDescargando(id);
    try {
      const contenido = await cargarComprobante(id);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([contenido], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = `comprobante-${id}.html`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const fileSystem = await import('expo-file-system/legacy');
        const sharing = await import('expo-sharing');
        if (!fileSystem.cacheDirectory || !(await sharing.isAvailableAsync())) {
          throw new Error('Este dispositivo no permite abrir el comprobante. Puedes descargarlo desde SportMatch en tu navegador.');
        }
        const path = `${fileSystem.cacheDirectory}comprobante-${id}.html`;
        await fileSystem.writeAsStringAsync(path, contenido);
        try { await sharing.shareAsync(path, { mimeType: 'text/html', UTI: 'public.html', dialogTitle: 'Comprobante SportMatch' }); }
        finally { await fileSystem.deleteAsync(path, { idempotent: true }); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar el comprobante.'); }
    finally { setDescargando(null); descargaEnCurso.current = false; }
  }
  const texto = { color: colors.text, fontSize: 15 };
  const titulo = { ...texto, fontSize: 18, fontWeight: '700' as const };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
    <EncabezadoPantalla titulo="Mis pagos" subtitulo="Tu plan, períodos y comprobantes de pago." />
    {error ? <View accessibilityRole="alert" style={{ gap: 8 }}><Text style={{ color: colors.danger }}>{error}</Text><Boton texto="Reintentar" onPress={() => setIntento(intento + 1)} /></View> : null}
    {cargando ? <ActivityIndicator accessibilityLabel="Cargando historial" color={colors.primary} /> : null}
    <Tarjeta><Text style={titulo}>{actual?.estado === 'ACTIVE' ? actual.plan.nombre : 'Sin plan pagado vigente'}</Text>
      {actual ? <Text style={texto}>{actual.estado === 'ACTIVE' ? 'Vence el' : 'Venció el'} {fecha(actual.fecha_fin)}</Text> : null}
    </Tarjeta>
    <Text style={titulo}>Historial de pagos</Text>
    {!cargando && pagos?.total === 0 ? <Text style={texto}>Aún no tienes pagos registrados.</Text> : null}
    {pagos?.items.map((pago) => <Tarjeta key={pago.transaccion_id}>
      <View style={{ gap: 8 }}><Text style={titulo}>{pago.plan.nombre} · {formatearCLP(pago.amount)}</Text>
        <Text style={texto}>{fecha(pago.fecha)} · {estados[pago.status]}</Text>
        <Text style={{ color: colors.textMuted }}>Orden {pago.buy_order}</Text>
        {pago.periodo ? <Text style={texto}>Período: {fecha(pago.periodo.fecha_inicio)} al {fecha(pago.periodo.fecha_fin)}</Text> : null}
        {pago.status === 'APPROVED' ? <Boton texto={descargando === pago.transaccion_id ? 'Descargando…' : 'Descargar comprobante'} deshabilitado={descargando !== null} onPress={() => void descargar(pago.transaccion_id)} variante="secundario" /> : null}
      </View>
    </Tarjeta>)}
    {pagos && pagos.total > pagos.page_size ? <View style={{ gap: 8 }}>
      <Text style={texto}>Página {paginaPago}</Text>
      <Boton texto="Pagos anteriores" deshabilitado={cargando || paginaPago * pagos.page_size >= pagos.total} onPress={() => setPaginaPago(paginaPago + 1)} />
      <Boton texto="Volver a pagos recientes" deshabilitado={cargando || paginaPago === 1} onPress={() => setPaginaPago(paginaPago - 1)} variante="secundario" />
    </View> : null}
    <Text style={titulo}>Períodos de suscripción</Text>
    {!cargando && periodos?.total === 0 ? <Text style={texto}>Aún no tienes períodos pagados.</Text> : null}
    {periodos?.items.map((periodo) => <Tarjeta key={periodo.id}>
      <Text style={titulo}>{periodo.plan_nombre} · {formatearCLP(periodo.precio_pagado)}</Text>
      <Text style={texto}>{fecha(periodo.fecha_inicio)} al {fecha(periodo.fecha_fin)}</Text>
      <Text style={texto}>{periodo.vigente ? 'Vigente' : new Date(periodo.fecha_inicio) > new Date() ? 'Programado' : 'Finalizado'}</Text>
    </Tarjeta>)}
    {periodos && periodos.total > periodos.page_size ? <View style={{ gap: 8 }}>
      <Text style={texto}>Página {paginaPeriodo}</Text>
      <Boton texto="Períodos anteriores" deshabilitado={cargando || paginaPeriodo * periodos.page_size >= periodos.total} onPress={() => setPaginaPeriodo(paginaPeriodo + 1)} />
      <Boton texto="Volver a períodos recientes" deshabilitado={cargando || paginaPeriodo === 1} onPress={() => setPaginaPeriodo(paginaPeriodo - 1)} variante="secundario" />
    </View> : null}
  </ScrollView>;
}
