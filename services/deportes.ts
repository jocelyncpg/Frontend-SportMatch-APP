// La app muestra nombres ("Tenis") y Ms_Users guarda códigos ("tennis").
// Los deportes de la lista del perfil tienen código fijo; los escritos a mano
// se convierten a un código simple ("Escalada deportiva" -> "escalada_deportiva").
const CODIGOS: Record<string, string> = {
  Running: 'running',
  Fútbol: 'futbol',
  Ciclismo: 'ciclismo',
  Yoga: 'yoga',
  Tenis: 'tennis',
  Natación: 'natacion',
  Trekking: 'trekking',
};

const NOMBRES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CODIGOS).map(([nombre, codigo]) => [codigo, nombre])),
  tenis: 'Tenis',
  basquetbol: 'Básquetbol',
  padel: 'Pádel',
  voleibol: 'Vóleibol',
};

export function codigoDeporte(nombre: string): string {
  const conocido = CODIGOS[nombre.trim()];
  if (conocido) return conocido;
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export function nombreDeporte(codigo: string): string {
  const conocido = NOMBRES[codigo.toLowerCase()];
  if (conocido) return conocido;
  const texto = codigo.replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
