/**
 * P3-06 (auditoría 2026-09): las vistas previas en WhatsApp o LinkedIn usaban
 * la foto de la ficha tal cual: pequeñas (429×491), verticales (1086×1448) y
 * en WebP, sin ancho ni alto declarados. Las redes esperan 1200×630.
 *
 * Al terminar el build, cada `og:image` que apunte a una foto del sitio se
 * sustituye por un JPG de 1200×630, recortado por la zona con más interés
 * (`attention` de sharp), y se declaran `og:image:width`, `og:image:height` y
 * `og:image:type`. Se generan en `dist/og/` con el nombre por hash del
 * origen, así que no se repiten entre páginas ni entre builds.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ANCHO = 1200;
const ALTO = 630;
const META_OG = /<meta property="og:image" content="([^"]+)"\s*\/?>/;

function archivosHtml(dir) {
  const salida = [];
  for (const nombre of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, nombre.name);
    if (nombre.isDirectory()) salida.push(...archivosHtml(ruta));
    else if (nombre.name.endsWith('.html')) salida.push(ruta);
  }
  return salida;
}

/** La versión para redes de `origen` (ruta en `raiz`), creándola si falta. */
async function versionParaRedes(raiz, rutaPublica, cache) {
  if (cache.has(rutaPublica)) return cache.get(rutaPublica);
  const origen = path.join(raiz, decodeURIComponent(rutaPublica));
  let resultado = null;
  if (fs.existsSync(origen)) {
    const meta = await sharp(origen).metadata();
    if (meta.width === ANCHO && meta.height === ALTO && meta.format === 'jpeg') {
      resultado = rutaPublica;
    } else {
      const hash = crypto
        .createHash('md5')
        .update(fs.readFileSync(origen))
        .digest('hex')
        .slice(0, 10);
      const nombre = `/og/${hash}-${ANCHO}x${ALTO}.jpg`;
      const destino = path.join(raiz, nombre);
      if (!fs.existsSync(destino)) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        await sharp(origen)
          .resize(ANCHO, ALTO, { fit: 'cover', position: sharp.strategy.attention })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 82, mozjpeg: true })
          .toFile(destino);
      }
      resultado = nombre;
    }
  }
  cache.set(rutaPublica, resultado);
  return resultado;
}

export default function imagenesParaRedes() {
  return {
    name: 'hidromont:imagenes-para-redes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const cache = new Map();
        let paginas = 0;
        for (const archivo of archivosHtml(raiz)) {
          const html = fs.readFileSync(archivo, 'utf8');
          const m = META_OG.exec(html);
          if (!m) continue;
          let url;
          try {
            url = new URL(m[1]);
          } catch {
            continue;
          }
          const nueva = await versionParaRedes(raiz, url.pathname, cache);
          if (!nueva) continue;
          const absoluta = new URL(nueva, url).toString();
          const declaracion =
            `<meta property="og:image" content="${absoluta}" />` +
            `<meta property="og:image:width" content="${ANCHO}" />` +
            `<meta property="og:image:height" content="${ALTO}" />` +
            '<meta property="og:image:type" content="image/jpeg" />';
          const resultado = html
            .replace(m[0], declaracion)
            .replace(
              /<meta name="twitter:image" content="[^"]+"\s*\/?>/,
              `<meta name="twitter:image" content="${absoluta}" />`
            );
          if (resultado !== html) {
            fs.writeFileSync(archivo, resultado);
            paginas += 1;
          }
        }
        logger.info(`imagen para redes de ${ANCHO}×${ALTO} en ${paginas} página(s)`);
      },
    },
  };
}
