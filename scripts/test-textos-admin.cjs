const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

// Los motivos, nombres, descripciones y beneficios los escriben personas: en las pantallas de admin y en el catálogo
// se pintan siempre con <Text> (texto plano), nunca como HTML ni como un enlace que se abra solo.

const leer = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const PANTALLAS = [
  'app/(admin)/home.tsx',
  'components/CatalogoPlanes.tsx', 'components/ContratarPlanModal.tsx', 'app/(club)/planes.tsx', 'app/(deportista)/planes.tsx',
];

test('ninguna pantalla de admin ni del catálogo interpreta HTML ni abre enlaces escritos por personas', () => {
  for (const rel of PANTALLAS) {
    const fuente = leer(rel);
    assert.doesNotMatch(fuente, /dangerouslySetInnerHTML|innerHTML|WebView|RenderHtml|react-native-render-html|HTML\b.*<Text/, rel);
    assert.doesNotMatch(fuente, /Linking\.openURL|openBrowserAsync\((?!urlPago\b|urlPendiente\b)/, rel);   // solo se abre el puente firmado de Webpay
    assert.doesNotMatch(fuente, /\bhtml\s*=/i, rel);
  }
});

test('la app no tiene un componente de HTML entre sus dependencias', () => {
  const paquete = JSON.parse(leer('package.json'));
  const dependencias = Object.keys({ ...paquete.dependencies, ...paquete.devDependencies });
  assert.deepEqual(dependencias.filter((d) => /render-html|webview|markdown|html-to/i.test(d)), []);
});

test('el texto de la suspensión se pinta con Alert (texto plano), sin título ni diseño nuevos', () => {
  const layout = leer('app/_layout.tsx');
  assert.match(layout, /Alert\.alert\('Cuenta suspendida', texto\)/);
});
