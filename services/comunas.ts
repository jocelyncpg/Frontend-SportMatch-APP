// Comunas de la Región Metropolitana de Santiago (52), que es la zona de operación del proyecto.
// Vive en un archivo propio para que sirva igual con la versión simulada y con la real.

const MAPA: Record<string, string> = {
    á: 'a', à: 'a', ä: 'a', â: 'a',
    é: 'e', è: 'e', ë: 'e', ê: 'e',
    í: 'i', ì: 'i', ï: 'i', î: 'i',
    ó: 'o', ò: 'o', ö: 'o', ô: 'o',
    ú: 'u', ù: 'u', ü: 'u', û: 'u',
    ñ: 'n',
  };
  
  /** Minúsculas y sin tildes ni ñ, para comparar "Ñuñoa" con "nunoa". */
  export function normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .replace(/[áàäâéèëêíìïîóòöôúùüûñ]/g, (ch) => MAPA[ch] ?? ch)
      .trim();
  }
  
  const SIN_ORDENAR = [
    // Provincia de Santiago
    'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba',
    'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina',
    'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa',
    'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura', 'Quinta Normal',
    'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Santiago', 'Vitacura',
    // Provincia de Cordillera
    'Puente Alto', 'Pirque', 'San José de Maipo',
    // Provincia de Chacabuco
    'Colina', 'Lampa', 'Tiltil',
    // Provincia de Maipo
    'Buin', 'Calera de Tango', 'Paine', 'San Bernardo',
    // Provincia de Melipilla
    'Alhué', 'Curacaví', 'María Pinto', 'Melipilla', 'San Pedro',
    // Provincia de Talagante
    'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor', 'Talagante',
  ];
  
  export const COMUNAS_RM: string[] = [...SIN_ORDENAR].sort((a, b) => {
    const na = normalizar(a);
    const nb = normalizar(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
  
  /**
   * Busca comunas ignorando mayúsculas y tildes. Primero van las que EMPIEZAN con
   * el texto y después las que lo contienen. Sin texto devuelve toda la lista.
   */
  export function buscarComunas(texto: string, lista: string[] = COMUNAS_RM): string[] {
    const q = normalizar(texto);
    if (!q) return lista;
    const empiezan = lista.filter((c) => normalizar(c).startsWith(q));
    const contienen = lista.filter((c) => !normalizar(c).startsWith(q) && normalizar(c).includes(q));
    return [...empiezan, ...contienen];
  }