/**
 * Dónde está abierto el editor, para decir la verdad sobre qué hace «Publicar».
 *
 * Desde que el editor vive en `editor.hidromontchile.cl` esto devolvía `other`
 * para el único host que usa la persona editora: el panel le decía
 * «producción no confirmada · despliega los cambios» después de una publicación
 * que sí había actualizado el sitio. Ese subdominio apunta al mismo proceso Node
 * que `hidromontchile.cl` (ver `deploy/Caddyfile`), así que publicar desde ahí
 * es publicar en producción.
 *
 * Vive aparte de `publish.js` porque ese módulo lee `window` al importarse y
 * esto se prueba en Node.
 */

export type EntornoDePublicacion = 'production' | 'local' | 'other';

const PRODUCCION = new Set(['hidromontchile.cl', 'www.hidromontchile.cl']);
const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function entornoDePublicacion(hostname: string): EntornoDePublicacion {
  const host = hostname.toLowerCase().replace(/^editor\./, '');
  if (PRODUCCION.has(host)) return 'production';
  if (LOCAL.has(host)) return 'local';
  return 'other';
}
