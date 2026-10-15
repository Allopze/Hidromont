/**
 * Una cifra y su unidad no se separan al cortar la línea: «3.000» al final de
 * un renglón y «mm» al comienzo del siguiente se lee mal. Lo mismo vale para
 * los prefijos que van delante de la cifra (DN 600, PN 16, Ø 2.600) y para las
 * medidas compuestas (2.500 x 3.000 mm).
 *
 * Se hace al terminar el build, sobre el HTML generado, porque las cifras
 * están repartidas entre el Markdown, las fichas del CMS y las plantillas, y
 * quien edita escribe un espacio normal. Aquí ese espacio se cambia por uno
 * de no separación (U+00A0), solo en el texto visible: no se tocan atributos
 * ni el contenido de `script`, `style`, `textarea`, `pre` ni `code`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NBSP = ' ';

// Las más largas primero, para que «m.c.a.» no se quede en «m» ni «m²» en «m».
const UNIDADES = [
  'm\\.c\\.a\\.?',
  'mca',
  'm³/s',
  'm3/s',
  'l/s',
  'km',
  'cm',
  'mm',
  'm²',
  'm³',
  'm2',
  'm3',
  'metros?',
  'ML',
  'm',
  'toneladas?',
  'ton',
  'kg',
  't',
  '[Gg]alones',
  'gal',
  'litros?',
  'pulgadas?',
  'MVA',
  'kVA',
  'MW',
  'kW',
  'kV',
  'Hz',
  'rpm',
  'bar',
  'psi',
  '[°º]C',
  '[°º]',
  '%',
  '[½¼¾]',
  '["”″]',
].join('|');

// Cifra + espacio + unidad. La unidad no puede seguir con letra ni dígito:
// «5 tableros» no es «5 t».
const CIFRA_UNIDAD = new RegExp(`(\\d)[ \\t\\n]+(?=(?:${UNIDADES})(?![\\p{L}\\d]))`, 'gu');
// Fracción + pulgadas: «4 ½ ”».
const FRACCION_PULGADA = /([½¼¾])[ \t\n]+(?=["”″])/g;
// Prefijo + cifra: DN 600, PN 16, Ø 2.600.
const PREFIJO_CIFRA = /((?:^|[^\p{L}\d])(?:DN|PN)|[Øø∅])[ \t\n]+(?=\d)/gu;
// Medidas compuestas: 2.500 x 3.000.
const POR = /(\d)[ \t\n]+([x×])[ \t\n]+(?=[\dØø])/g;

export function unirTexto(texto) {
  return texto
    .replace(CIFRA_UNIDAD, `$1${NBSP}`)
    .replace(FRACCION_PULGADA, `$1${NBSP}`)
    .replace(PREFIJO_CIFRA, `$1${NBSP}`)
    .replace(POR, `$1${NBSP}$2${NBSP}`);
}

const SIN_TOCAR = /<(script|style|textarea|pre|code)\b[\s\S]*?<\/\1>/gi;

export function unirUnidades(html) {
  // Se separa el HTML en lo que no se toca y el resto; del resto solo se
  // modifica el texto entre etiquetas.
  let salida = '';
  let desde = 0;
  for (const bloque of html.matchAll(SIN_TOCAR)) {
    salida += unirFuera(html.slice(desde, bloque.index)) + bloque[0];
    desde = bloque.index + bloque[0].length;
  }
  return salida + unirFuera(html.slice(desde));
}

function unirFuera(html) {
  return html.replace(/>([^<]+)</g, (_, texto) => `>${unirTexto(texto)}<`);
}

function archivosHtml(dir) {
  const salida = [];
  for (const nombre of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, nombre.name);
    if (nombre.isDirectory()) salida.push(...archivosHtml(ruta));
    else if (nombre.name.endsWith('.html')) salida.push(ruta);
  }
  return salida;
}

export default function unidadesSinCorte() {
  return {
    name: 'hidromont:unidades-sin-corte',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        let cambiados = 0;
        for (const archivo of archivosHtml(fileURLToPath(dir))) {
          const antes = fs.readFileSync(archivo, 'utf8');
          const despues = unirUnidades(antes);
          if (despues !== antes) {
            fs.writeFileSync(archivo, despues);
            cambiados += 1;
          }
        }
        logger.info(`cifras unidas a su unidad en ${cambiados} página(s)`);
      },
    },
  };
}
