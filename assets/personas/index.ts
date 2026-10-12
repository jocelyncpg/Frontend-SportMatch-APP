import { Image } from 'react-native';

// Convierte una imagen local en el texto (uri) que ya entienden Avatar y las cards.
// Los require deben tener la ruta escrita tal cual: Metro no acepta rutas armadas con variables.
const uri = (fuente: number): string => Image.resolveAssetSource(fuente).uri;

// La clave es el id de la persona en services/matchStore.ts.
// Los archivos van en esta misma carpeta, con el nombre en minúsculas (camila.png, jorge.png...).
export const FOTOS: Record<string, string> = {
  camila: uri(require('./camila.png')),
  catalina: uri(require('./catalina.png')),
  fernanda: uri(require('./fernanda.png')),
  ignacia: uri(require('./ignacia.png')),
  ignacio: uri(require('./ignacio.png')),
  jorge: uri(require('./jorge.png')),
  matias: uri(require('./matias.png')),
};