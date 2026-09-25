import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config/unifiedConfig';

const distDir = config.cms.staticDir;

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  // Sin estos, el video de la cabecera de Limpiarrejas salía como
  // application/octet-stream con `nosniff`, y Safari no lo reproduce.
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * Fase 4 (cPanel): `public/_redirects` también es de Cloudflare Pages. Sin
 * esto, los 301 de /proyectos/ch-dorias → /proyectos/ch-doiras se pierden al
 * servir desde Node y las URLs antiguas empiezan a dar 404.
 *
 * Se leen del propio archivo del build para no duplicar la lista: sigue
 * siendo la misma fuente que usa Cloudflare mientras convivan los dos.
 */
interface Redirect {
  from: string;
  to: string;
  status: number;
}

let redirects: Redirect[] | undefined;

/**
 * Se memoriza el resultado, pero solo cuando el archivo existía: memorizar la
 * ausencia dejaba el sitio sin redirecciones hasta el siguiente reinicio.
 *
 * Pasó en el primer despliegue. El proceso arrancó antes de que `dist`
 * estuviera extraído, la primera petición cacheó «no hay redirecciones», y al
 * aparecer `dist` las páginas empezaron a servirse bien —eso se lee del disco
 * en cada petición— mientras los 301 seguían devolviendo 404. Un fallo que
 * solo se nota en la ruta que menos se prueba.
 */
function loadRedirects(): Redirect[] {
  if (redirects) return redirects;
  const acumulado: Redirect[] = [];
  const file = path.join(distDir, '_redirects');
  if (!fs.existsSync(file)) return acumulado;
  redirects = acumulado;

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [from, to, code] = trimmed.split(/\s+/);
    if (!from || !to) continue;
    // El comodín `/* /404.html 404` es el fallback de Pages; aquí ya lo cubre
    // resolvePublicFile devolviendo 404.html, así que se ignora.
    if (from.includes('*')) continue;
    const status = Number(code);
    acumulado.push({ from, to, status: Number.isFinite(status) ? status : 301 });
  }
  return acumulado;
}

/**
 * Un rango `Range: bytes=…` válido para un archivo de `tamano` bytes, o null si
 * no hay cabecera o no se puede servir (se responde entero). Safari e iOS piden
 * los videos por trozos y no los reproducen si el servidor no contesta 206.
 */
export function rangoPedido(
  cabecera: string | undefined,
  tamano: number
): { inicio: number; fin: number } | 'fuera' | null {
  if (!cabecera) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let inicio: number;
  let fin: number;
  if (m[1] === '') {
    // Los últimos N bytes.
    const n = Number(m[2]);
    inicio = Math.max(0, tamano - n);
    fin = tamano - 1;
  } else {
    inicio = Number(m[1]);
    fin = m[2] === '' ? tamano - 1 : Math.min(Number(m[2]), tamano - 1);
  }
  if (inicio >= tamano || inicio > fin) return 'fuera';
  return { inicio, fin };
}

export function registerStaticSite(app: FastifyInstance): void {
  app.get('/*', serveStaticSite);
}

async function serveStaticSite(request: FastifyRequest, reply: FastifyReply) {
  const pathname = getPathname(request.url);

  const redirect = loadRedirects().find((r) => r.from === pathname);
  if (redirect) {
    return reply.status(redirect.status).header('Location', redirect.to).send();
  }

  const resolved = await resolvePublicFile(pathname);

  if (!resolved) {
    return reply.status(404).send({ error: 'Not found' });
  }

  const { filePath, statusCode } = resolved;
  const stat = await fs.promises.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] ?? 'application/octet-stream';

  reply
    .type(contentType)
    .header('Accept-Ranges', 'bytes')
    .header('Cache-Control', cacheControlFor(pathname, extension));

  const rango = statusCode === 200 ? rangoPedido(request.headers.range, stat.size) : null;
  if (rango === 'fuera') {
    return reply.status(416).header('Content-Range', `bytes */${stat.size}`).send();
  }
  if (rango) {
    reply
      .status(206)
      .header('Content-Range', `bytes ${rango.inicio}-${rango.fin}/${stat.size}`)
      .header('Content-Length', rango.fin - rango.inicio + 1);
    if (request.method === 'HEAD') return reply.send();
    return reply.send(fs.createReadStream(filePath, { start: rango.inicio, end: rango.fin }));
  }

  reply.status(statusCode).header('Content-Length', stat.size);
  if (request.method === 'HEAD') {
    return reply.send();
  }

  return reply.send(fs.createReadStream(filePath));
}

async function resolvePublicFile(
  pathname: string
): Promise<{ filePath: string; statusCode: number } | null> {
  if (pathname.startsWith(`${config.cms.publicUploadBase}/`)) {
    const uploadPath = pathname.slice(config.cms.publicUploadBase.length + 1);
    const filePath = await findContainedFile(config.cms.uploadDir, uploadPath);
    return filePath ? { filePath, statusCode: 200 } : null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidates = [relativePath, path.join(relativePath, 'index.html')];

  for (const candidate of candidates) {
    const filePath = await findContainedFile(distDir, candidate);
    if (filePath) return { filePath, statusCode: 200 };
  }

  const notFoundPath = await findContainedFile(distDir, '404.html');
  return notFoundPath ? { filePath: notFoundPath, statusCode: 404 } : null;
}

async function findContainedFile(root: string, relativePath: string): Promise<string | null> {
  const normalizedRoot = path.resolve(root);
  const target = path.resolve(normalizedRoot, relativePath);

  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${path.sep}`)) {
    return null;
  }

  try {
    const stat = await fs.promises.stat(target);
    return stat.isFile() ? target : null;
  } catch {
    return null;
  }
}

function getPathname(url: string): string {
  try {
    return decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return '/';
  }
}

function cacheControlFor(pathname: string, extension: string): string {
  if (
    pathname.startsWith('/_assets/') ||
    ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(extension)
  ) {
    return 'public, max-age=31536000, immutable';
  }

  // Los videos subidos llevan un sufijo único en el nombre: no cambian nunca.
  // Los de public/videos sí pueden cambiar con el mismo nombre.
  if (['.mp4', '.webm'].includes(extension)) {
    return pathname.startsWith(`${config.cms.publicUploadBase}/`)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400';
  }

  if (extension === '.html') {
    return 'no-cache';
  }

  return 'public, max-age=600, must-revalidate';
}
