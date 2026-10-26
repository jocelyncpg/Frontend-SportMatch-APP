import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { HORARIOS, formatearDia, formatearHora, opcionesDias } from '../services/actividades';
import {
  agregarDeporteClub,
  listarDeportesClub,
  type ClubGestionado,
  type DeporteClub,
} from '../services/clubes';
import {
  cambiarChatPostulantes,
  cerrarConvocatoria,
  chatPostulantesHabilitado,
  listarConvocatorias,
  publicarConvocatoria,
  type Convocatoria,
  type CrearConvocatoria,
} from '../services/convocatorias';
import { Colors, useAppTheme } from '../theme/ThemeContext';
const ESTADOS = ['ABIERTA', 'CERRADA', 'FINALIZADA'] as const;

async function todasLasConvocatorias(clubId: string) {
  const paginas = await Promise.all(ESTADOS.map(async (estado) => {
    const primera = await listarConvocatorias(clubId, estado);
    const items = [...primera.items];
    let pagina = primera.page;
    while (items.length < primera.total) {
      pagina += 1;
      const siguiente = await listarConvocatorias(clubId, estado, pagina);
      if (siguiente.items.length === 0) break;
      items.push(...siguiente.items);
    }
    return items;
  }));
  return paginas.flat().sort((a, b) => Date.parse(a.fecha_prueba) - Date.parse(b.fecha_prueba));
}

export function ConvocatoriasClub({ club }: {
  club: ClubGestionado
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dias = useMemo(() => opcionesDias(Date.now()), []);
  const [lista, setLista] = useState<Convocatoria[]>([]);
  const [catalogo, setCatalogo] = useState<DeporteClub[]>([]);
  const [ofrecidos, setOfrecidos] = useState<number[]>(club.deportes.map((deporte) => deporte.id));
  const [error, setError] = useState('');
  const [errorLista, setErrorLista] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [deporteId, setDeporteId] = useState<number | null>(null);
  const [categoria, setCategoria] = useState('');
  const [edadMinima, setEdadMinima] = useState('');
  const [edadMaxima, setEdadMaxima] = useState('');
  const [fecha, setFecha] = useState('');
  const [minutos, setMinutos] = useState(19 * 60);
  const [requisitos, setRequisitos] = useState<string[]>(['']);
  const [cupos, setCupos] = useState('');
  const [direccion, setDireccion] = useState('');
  const [comuna, setComuna] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const cargar = useCallback(async () => {
    try {
      setLista(await todasLasConvocatorias(club.id));
      setError('');
      setErrorLista(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las convocatorias.');
      setErrorLista(true);
    }
  }, [club.id]);
  useEffect(() => {
    async function inicializar() {
      await cargar();
      try {
        setCatalogo(await listarDeportesClub());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo de deportes.');
        setErrorLista(false);
      }
    }
    inicializar();
  }, [cargar]);

  useEffect(() => {
    setOfrecidos(club.deportes.map((deporte) => deporte.id));
  }, [club.deportes]);
  const deportesOfrecidos = catalogo.filter((deporte) => ofrecidos.includes(deporte.id));

  async function agregarDeporte(deporteId: number) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setErrorLista(false);
    try {
      await agregarDeporteClub(club.id, deporteId);
      setOfrecidos((actuales) => [...actuales, deporteId]);
      setDeporteId(deporteId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar el deporte al club.');
    } finally {
      setOcupado(false);
    }
  }
  function cambiarRequisito(indice: number, valor: string) {
    setRequisitos((actuales) => actuales.map((actual, i) => i === indice ? valor : actual));
  }
  function datosFormulario(): CrearConvocatoria {
    if (deporteId === null || !deportesOfrecidos.some((deporte) => deporte.id === deporteId)) {
      throw new Error('Selecciona un deporte que ofrezca tu club.');
    }
    if (categoria.trim().length < 2 || categoria.trim().length > 40) {
      throw new Error('La categoría debe tener entre 2 y 40 caracteres.');
    }
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
    if (!partes) throw new Error('Ingresa la fecha con formato AAAA-MM-DD.');
    const [anio, mes, dia] = partes.slice(1).map(Number);
    const fechaLocal = new Date(anio, mes - 1, dia, Math.floor(minutos / 60), minutos % 60);
    if (fechaLocal.getFullYear() !== anio || fechaLocal.getMonth() !== mes - 1 || fechaLocal.getDate() !== dia) {
      throw new Error('La fecha ingresada no existe.');
    }
    const diasHastaPrueba = (fechaLocal.getTime() - Date.now()) / 86400000;
    if (diasHastaPrueba <= 0 || diasHastaPrueba > 365) {
      throw new Error('La prueba debe ser futura y dentro de los próximos 365 días.');
    }
    const minimo = edadMinima.trim() ? Number(edadMinima) : undefined;
    const maximo = edadMaxima.trim() ? Number(edadMaxima) : undefined;
    if ([minimo, maximo].some((edad) => edad !== undefined && (!Number.isInteger(edad) || edad < 4 || edad > 99))) {
      throw new Error('Las edades deben ser números enteros entre 4 y 99.');
    }
    if (minimo !== undefined && maximo !== undefined && minimo > maximo) {
      throw new Error('La edad mínima no puede superar la máxima.');
    }
    const listaRequisitos = requisitos.map((requisito) => requisito.trim());
    if (listaRequisitos.length < 1 || listaRequisitos.length > 15
      || listaRequisitos.some((requisito) => requisito.length < 2 || requisito.length > 200)) {
      throw new Error('Ingresa entre 1 y 15 requisitos de 2 a 200 caracteres.');
    }
    const cantidad = Number(cupos);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
      throw new Error('Los cupos deben estar entre 1 y 1000.');
    }
    if (direccion.trim().length < 5 || direccion.trim().length > 255) {
      throw new Error('La dirección debe tener entre 5 y 255 caracteres.');
    }
    if (comuna.trim() && (comuna.trim().length < 2 || comuna.trim().length > 80)) {
      throw new Error('La comuna debe tener entre 2 y 80 caracteres.');
    }
    if (titulo.trim() && (titulo.trim().length < 3 || titulo.trim().length > 120)) {
      throw new Error('El título debe tener entre 3 y 120 caracteres.');
    }
    if (descripcion.trim().length > 2000) throw new Error('La descripción no puede superar 2000 caracteres.');
    return {
      deporte_id: deporteId,
      categoria_edad: categoria.trim(),
      ...(minimo !== undefined ? { edad_minima: minimo } : {}),
      ...(maximo !== undefined ? { edad_maxima: maximo } : {}),
      fecha_prueba: fechaLocal.toISOString(),
      requisitos: listaRequisitos,
      cupos: cantidad,
      direccion: direccion.trim(),
      ...(comuna.trim() ? { comuna: comuna.trim() } : {}),
      ...(titulo.trim() ? { titulo: titulo.trim() } : {}),
      ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
    };
  }
  async function publicar() {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setErrorLista(false);
    try {
      await publicarConvocatoria(club.id, datosFormulario());
      await cargar();
      setTitulo('');
      setDescripcion('');
      setCategoria('');
      setRequisitos(['']);
      setFecha('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar la convocatoria.');
    } finally {
      setOcupado(false);
    }
  }
  /** El club decide si los postulantes pueden escribir en el chat de esta convocatoria. */
  async function cambiarChat(convocatoria: Convocatoria, habilitado: boolean) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setErrorLista(false);
    try {
      await cambiarChatPostulantes(club.id, convocatoria.id, habilitado);
      setLista((actuales) => actuales.map((c) => c.id === convocatoria.id
        ? { ...c, chat_postulantes_habilitado: habilitado } : c));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el chat de postulantes.');
    } finally {
      setOcupado(false);
    }
  }
  async function cerrar(id: string) {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    setErrorLista(false);
    try {
      await cerrarConvocatoria(club.id, id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar la convocatoria.');
    } finally {
      setOcupado(false);
    }
  }
  const campo = (
    etiqueta: string,
    valor: string,
    cambiar: (valor: string) => void,
    opciones: {
      numerico?: boolean;
      multilinea?: boolean;
      limite?: number;
      ayuda?: string
    } = {},
  ) => (
    <View>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[styles.entrada, opciones.multilinea && styles.multilinea]}
        value={valor}
        onChangeText={cambiar}
        placeholder={opciones.ayuda}
        placeholderTextColor={colors.textMuted}
        keyboardType={opciones.numerico ? 'number-pad' : 'default'}
        multiline={opciones.multilinea}
        maxLength={opciones.limite}
      />
    </View>
  );
  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Convocatorias</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {errorLista ? (
        <TouchableOpacity onPress={cargar}>
          <Text style={styles.enlace}>Reintentar listado</Text>
        </TouchableOpacity>
      ) : null}
      {catalogo.length === 0 && error && !errorLista ? (
        <TouchableOpacity onPress={() => listarDeportesClub().then((deportes) => {
          setCatalogo(deportes);
          setError('');
        }).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.'))}>
          <Text style={styles.enlace}>Reintentar deportes</Text>
        </TouchableOpacity>
      ) : null}
      {lista.length === 0 ? <Text style={styles.info}>Aún no hay convocatorias.</Text> : null}
      {lista.map((convocatoria) => (
        <View key={convocatoria.id} style={styles.tarjeta}>
          <Text style={styles.nombre}>
            {convocatoria.titulo || `${convocatoria.deporte.nombre} · ${convocatoria.categoria_edad}`}
          </Text>
          <Text style={styles.info}>
            {convocatoria.estado} · {new Date(convocatoria.fecha_prueba).toLocaleString('es-CL')}
          </Text>
          <Text style={styles.info}>{convocatoria.cupos_disponibles} cupos disponibles</Text>
          <View style={styles.filaSwitch}>
            <View style={styles.expandir}>
              <Text style={styles.nombre}>Chat con postulantes</Text>
              <Text style={styles.info}>
                {chatPostulantesHabilitado(convocatoria)
                  ? 'Los postulantes pueden escribir y responder.'
                  : 'Los postulantes solo pueden leer los mensajes del club.'}
              </Text>
            </View>
            <Switch
              value={chatPostulantesHabilitado(convocatoria)}
              disabled={ocupado}
              onValueChange={(valor) => { void cambiarChat(convocatoria, valor); }}
              trackColor={{ false: colors.border, true: colors.primary }}
              accessibilityLabel={`Chat con postulantes de ${convocatoria.titulo || convocatoria.deporte.nombre}`}
            />
          </View>
          {convocatoria.estado === 'ABIERTA' ? (
            <TouchableOpacity disabled={ocupado} onPress={() => cerrar(convocatoria.id)}>
              <Text style={styles.enlace}>Cerrar convocatoria</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      <Text style={styles.titulo}>Publicar convocatoria</Text>
      <Text style={styles.etiqueta}>Deporte que ofrece el club</Text>
      {deportesOfrecidos.length === 0 ? (
        <Text style={styles.info}>Agrega un deporte al club para publicar.</Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {deportesOfrecidos.map((deporte) => (
          <TouchableOpacity
            key={deporte.id}
            style={[styles.chip, deporteId === deporte.id && styles.chipActivo]}
            onPress={() => setDeporteId(deporte.id)}
          >
            <Text style={styles.nombre}>{deporte.nombre}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.etiqueta}>Agregar otro deporte al club</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {catalogo.filter((deporte) => !ofrecidos.includes(deporte.id)).map((deporte) => (
          <TouchableOpacity
            key={deporte.id}
            style={styles.chip}
            disabled={ocupado}
            onPress={() => agregarDeporte(deporte.id)}
          >
            <Text style={styles.nombre}>+ {deporte.nombre}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {campo('Categoría de edad', categoria, setCategoria, { limite: 40, ayuda: 'Ej: Sub-17' })}
      {campo('Edad mínima (opcional)', edadMinima, setEdadMinima, { numerico: true, limite: 2 })}
      {campo('Edad máxima (opcional)', edadMaxima, setEdadMaxima, { numerico: true, limite: 2 })}
      <Text style={styles.etiqueta}>Día de la prueba</Text>
      {campo('Fecha AAAA-MM-DD', fecha, setFecha, { limite: 10, ayuda: '2026-11-07' })}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {dias.map((dia) => {
          const fechaDia = new Date(dia);
          const anio = fechaDia.getFullYear();
          const mes = String(fechaDia.getMonth() + 1).padStart(2, '0');
          const diaMes = String(fechaDia.getDate()).padStart(2, '0');
          const valor = `${anio}-${mes}-${diaMes}`;
          return (
            <TouchableOpacity
              key={dia}
              style={[styles.chip, fecha === valor && styles.chipActivo]}
              onPress={() => setFecha(valor)}
            >
              <Text style={styles.nombre}>{formatearDia(dia, Date.now())}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.etiqueta}>Hora</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {HORARIOS.map((hora) => (
          <TouchableOpacity
            key={hora}
            style={[styles.chip, minutos === hora && styles.chipActivo]}
            onPress={() => setMinutos(hora)}
          >
            <Text style={styles.nombre}>{formatearHora(hora)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {campo('Cupos', cupos, setCupos, { numerico: true, limite: 4 })}
      {campo('Dirección', direccion, setDireccion, { limite: 255 })}
      {campo('Comuna (opcional)', comuna, setComuna, { limite: 80 })}
      <Text style={styles.etiqueta}>Requisitos</Text>
      {requisitos.map((requisito, indice) => (
        <View key={indice} style={styles.fila}>
          <TextInput
            style={[styles.entrada, styles.expandir]}
            value={requisito}
            onChangeText={(valor) => cambiarRequisito(indice, valor)}
            placeholder={`Requisito ${indice + 1}`}
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />
          {requisitos.length > 1 ? (
            <TouchableOpacity onPress={() => setRequisitos((actuales) => actuales.filter((_, i) => i !== indice))}>
              <Text style={styles.enlace}>Quitar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {requisitos.length < 15 ? (
        <TouchableOpacity onPress={() => setRequisitos((actuales) => [...actuales, ''])}>
          <Text style={styles.enlace}>Agregar requisito</Text>
        </TouchableOpacity>
      ) : null}
      {campo('Título (opcional)', titulo, setTitulo, { limite: 120 })}
      {campo('Descripción (opcional)', descripcion, setDescripcion, { multilinea: true, limite: 2000 })}
      <TouchableOpacity
        style={[styles.boton, (ocupado || deportesOfrecidos.length === 0) && styles.deshabilitado]}
        disabled={ocupado || deportesOfrecidos.length === 0}
        onPress={publicar}
      >
        <Text style={styles.botonTexto}>{ocupado ? 'Guardando...' : 'Publicar convocatoria'}</Text>
      </TouchableOpacity>
    </View>
  );
}
const makeStyles = (c: Colors) => StyleSheet.create({
  contenedor: {
    backgroundColor: c.card,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  titulo: { color: c.text, fontSize: 16, fontWeight: '700' },
  nombre: { color: c.text, fontSize: 13, fontWeight: '600' },
  info: { color: c.textMuted, fontSize: 12 },
  error: { color: c.danger, fontSize: 12 },
  enlace: { color: c.accent, fontSize: 12, fontWeight: '700', paddingVertical: 8 },
  etiqueta: { color: c.text, fontSize: 12, marginBottom: 4 },
  entrada: {
    color: c.text,
    backgroundColor: c.inputBg,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10
  },
  multilinea: { minHeight: 90, textAlignVertical: 'top' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandir: { flex: 1 },
  tarjeta: { borderTopColor: c.border, borderTopWidth: 1, paddingTop: 8, gap: 4 },
  filaSwitch: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  chip: { backgroundColor: c.chip, borderRadius: 10, padding: 10, marginRight: 8 },
  chipActivo: { borderColor: c.primary, borderWidth: 2 },
  boton: { backgroundColor: c.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  botonTexto: { color: '#fff', fontWeight: '700' },
  deshabilitado: { opacity: 0.5 },
});
