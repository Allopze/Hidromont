/**
 * P2-27 (auditoría 2026-09): los 1.233 enlaces internos iban sin barra final
 * (`/servicios/compuertas`), mientras el sitemap, el canonical y las migas
 * usan la forma con barra. El servidor ya redirige la forma sin barra, pero
 * enlazar directamente a la canónica evita un salto por clic y la señal
 * contradictoria para los buscadores.
 *
 * Se hace al terminar el build, sobre el HTML generado, porque muchos de
 * esos enlaces no están en el código sino en el contenido del CMS (el menú,
 * los botones), que quien edita escribe como quiera. Solo se toca un enlace
 * interno que no tiene barra ni extensión y cuya página existe como
 * directorio en el build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENLACE = /(\bhref=")(\/(?!\/)[^"?#]*)([?#][^"]*)?"/g;

export function conBarra(html, existe) {
  return html.replace(ENLACE, (todo, inicio, ruta, resto = '') => {
    if (ruta === '/' || ruta.endsWith('/')) return todo;
    const ultimo = ruta.slice(ruta.lastIndexOf('/') + 1);
    if (ultimo.includes('.')) return todo;
    if (!existe(ruta)) return todo;
    return `${inicio}${ruta}/${resto}"`;
  });
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

export default function enlacesConBarra() {
  return {
    name: 'hidromont:enlaces-con-barra',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const cache = new Map();
        const existe = (ruta) => {
          if (!cache.has(ruta)) {
            let decodificada = ruta;
            try {
              decodificada = decodeURIComponent(ruta);
            } catch {
              /* se deja tal cual */
            }
            cache.set(ruta, fs.existsSync(path.join(raiz, decodificada, 'index.html')));
          }
          return cache.get(ruta);
        };
        let cambiados = 0;
        for (const archivo of archivosHtml(raiz)) {
          const antes = fs.readFileSync(archivo, 'utf8');
          const despues = conBarra(antes, existe);
          if (despues !== antes) {
            fs.writeFileSync(archivo, despues);
            cambiados += 1;
          }
        }
        logger.info(`enlaces internos con barra final en ${cambiados} página(s)`);
      },
    },
  };
}
