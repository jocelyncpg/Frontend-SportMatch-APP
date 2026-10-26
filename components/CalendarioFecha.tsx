import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useAppTheme } from '../theme/ThemeContext';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type Props = {
  // Fecha elegida, AAAA-MM-DD; vacío si aún no hay.
  valor: string;
  // Primer día que se puede elegir, AAAA-MM-DD. Los anteriores se ven apagados y no se pueden tocar.
  minimo: string;
  onElegir: (iso: string) => void;
};

type Celda = { clave: string; dia: number | null };

const p2 = (n: number) => String(n).padStart(2, '0');
const aISO = (a: number, m: number, d: number) => `${a}-${p2(m + 1)}-${p2(d)}`;
const partes = (iso: string): [number, number] | null => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  return m ? [Number(m[1]), Number(m[2]) - 1] : null;
};

/** Mini calendario de un mes: se elige un día y se devuelve como AAAA-MM-DD. Sin librerías externas. */
export default function CalendarioFecha({ valor, minimo, onElegir }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Mes que se muestra: el de la fecha elegida o, si no hay, el del primer día disponible.
  const inicio = partes(valor) ?? partes(minimo) ?? [new Date().getFullYear(), new Date().getMonth()];
  const [anio, setAnio] = useState(inicio[0]);
  const [mes, setMes] = useState(inicio[1]);

  const minMes = partes(minimo);
  const enElPrimerMes = minMes != null && anio === minMes[0] && mes === minMes[1];

  function cambiarMes(delta: number) {
    const f = new Date(anio, mes + delta, 1);
    setAnio(f.getFullYear());
    setMes(f.getMonth());
  }

  // Todas las casillas del mes en una sola lista (con huecos al inicio y al final para completar las semanas).
  // Semana que empieza en lunes: getDay() 0 = domingo → se corre para que lunes sea 0.
  const celdas = useMemo(() => {
    const huecos = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const diasDelMes = new Date(anio, mes + 1, 0).getDate();
    const lista: Celda[] = [];
    for (let i = 0; i < huecos; i++) lista.push({ clave: `h${i}`, dia: null });
    for (let d = 1; d <= diasDelMes; d++) lista.push({ clave: `d${d}`, dia: d });
    let relleno = 0;
    while (lista.length % 7 !== 0) lista.push({ clave: `f${relleno++}`, dia: null });
    return lista;
  }, [anio, mes]);

  return (
    <View style={styles.caja}>
      <View style={styles.cabecera}>
        <TouchableOpacity
          onPress={() => cambiarMes(-1)}
          disabled={enElPrimerMes}
          style={[styles.flecha, enElPrimerMes && styles.apagado]}
          accessibilityLabel="Mes anterior"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.mes} accessibilityLiveRegion="polite">{MESES[mes]} {anio}</Text>
        <TouchableOpacity onPress={() => cambiarMes(1)} style={styles.flecha} accessibilityLabel="Mes siguiente">
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Una sola grilla que se parte en filas de 7: cada casilla mide 1/7 del ancho. */}
      <View style={styles.grilla}>
        {DIAS.map((d, i) => (
          <View key={`s${i}`} style={styles.casilla}>
            <Text allowFontScaling={false} style={styles.diaSemana}>{d}</Text>
          </View>
        ))}
        {celdas.map((c) => {
          if (c.dia === null) return <View key={c.clave} style={styles.casilla} />;
          const iso = aISO(anio, mes, c.dia);
          const deshabilitado = iso < minimo;
          const elegido = iso === valor;
          return (
            <TouchableOpacity
              key={c.clave}
              style={styles.casilla}
              disabled={deshabilitado}
              onPress={() => onElegir(iso)}
              accessibilityRole="button"
              accessibilityState={{ selected: elegido, disabled: deshabilitado }}
              accessibilityLabel={`${c.dia} de ${MESES[mes]} de ${anio}`}
            >
              <View style={[styles.dia, elegido && styles.diaElegido]}>
                {/* Una sola línea, sin escalar con el tamaño de letra y con el peso de letra definido: así "12" nunca se corta. */}
                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={[styles.diaTexto, deshabilitado && styles.apagado, elegido && styles.diaTextoElegido]}
                >
                  {String(c.dia)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    caja: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, marginBottom: 12 },
    cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    flecha: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    mes: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    grilla: { flexDirection: 'row', flexWrap: 'wrap' },
    // 100 / 7 = 14.2857 %: siete casillas por fila.
    casilla: { width: '14.2857%', height: 36, alignItems: 'center', justifyContent: 'center' },
    diaSemana: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    // Círculo con ancho mínimo (no fijo): si el número es más ancho, el círculo crece y nunca se parte en dos líneas.
    dia: { minWidth: 34, height: 32, borderRadius: 16, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
    diaElegido: { backgroundColor: c.primary },
    // fontWeight explícito en todos los días (no solo en el elegido): con "Texto en negrita" de Android, un texto sin peso
    // definido se mide más angosto de lo que se dibuja y se corta.
    diaTexto: { color: c.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    diaTextoElegido: { color: '#fff', fontWeight: '700' },
    apagado: { opacity: 0.3 },
  });