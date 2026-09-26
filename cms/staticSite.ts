import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config/unifiedConfig';

const distDir = config.cms.staticDir;
/**
 * P2-01 (auditoría 2026-09): el perfil del editor (compilado con
 * PUBLIC_ENABLE_CMS=1) vive aparte, en `<dist>-editor`, y solo se sirve en
 * `editor.*`. Si no existe —despliegue sin editor o un build de un solo
 * perfil—, todos los dominios ven `dist`, como antes.
 */
const editorDistDir = `${distDir.replace(/[\\/]+$/, '')}-editor`;

const esHostDelEditor = (host?: string) => !!host && host.toLowerCase().startsWith('editor.');
const esHostLocal = (host?: string) =>
  !host || /^(localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(host.replace(/:\d+$/, ''));

/** El directorio del build que corresponde a este dominio. */
export function distParaHost(host?: string): string {
  if (esHostDelEditor(host) && fs.existsSync(path.join(editorDistDir, 'index.html'))) {
    return editorDistDir;
  }
  return distDir;
}

/**
 * Con los dos perfiles desplegados, el dominio público no necesita la API del
 * CMS: el editor la usa desde `editor.*`. Local (health del despliegue, e2e)
 * sigue respondiendo.
 */
export function apiFueraDeEsteHost(host?: string): boolean {
  if (esHostDelEditor(host) || esHostLocal(host)) return false;
  return fs.existsSync(path.join(editorDistDir, 'index.html'));
}

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
  // P3-03: las fuentes salían como application/octet-stream.
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.avif': 'image/avif',
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

/**
 * P1-03 (auditoría 2026-09): redirecciones que crea el CMS al cambiar la
 * dirección de una ficha publicada. Viven en la base (tabla `redirects`) y no
 * en `public/_redirects`, que está versionado y no lo edita nadie en el
 * servidor. El CMS registra aquí de dónde leerlas; se consultan en cada
 * petición (son pocas filas y una lectura de SQLite en memoria).
 */
let redireccionesDelCms: () => Array<{ from: string; to: string }> = () => [];
export function setCmsRedirectProvider(provider: () => Array<{ from: string; to: string }>): void {
  redireccionesDelCms = provider;
}

function redirectFor(pathname: string): { to: string; status: number } | undefined {
  const fija = loadRedirects().find((r) => r.from === pathname);
  if (fija) return fija;
  // Con y sin barra final: el enlazado interno va sin barra y el sitemap con.
  const sinBarra = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  try {
    const cms = redireccionesDelCms().find((r) => r.from === sinBarra);
    // P2-27: directamente a la forma canónica, con barra, en un solo salto.
    if (cms) return { to: cms.to.endsWith('/') ? cms.to : `${cms.to}/`, status: 301 };
  } catch {
    // Sin base disponible, se sirve como si no hubiera redirecciones.
  }
  return undefined;
}

export function registerStaticSite(app: FastifyInstance): void {
  // P3-03 (auditoría 2026-09): con la ruta HEAD que Fastify crea sola, una
  // respuesta sin cuerpo salía con Content-Length 0 en todo el sitio. Con GET y
  // HEAD en la misma ruta, Fastify respeta la longitud que fija el handler.
  app.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    exposeHeadRoute: false,
    handler: serveStaticSite,
  });
}

/**
 * P2-27 (auditoría 2026-09): cada página respondía 200 en dos a cuatro
 * direcciones (`/x`, `/x/`, `/x/index.html`) y `//algo` devolvía la portada
 * con 200, porque `new URL('//algo', base)` lo toma por un host. Se elige la
 * forma con barra, la del sitemap y el canonical, y el resto redirige a ella
 * con 301, conservando la consulta (`?cms=1`, `?q=`).
 */
export async function direccionCanonica(url: string, raiz: string): Promise<string | null> {
  const corte = url.search(/[?#]/);
  const crudo = corte === -1 ? url : url.slice(0, corte);
  const consulta = corte === -1 ? '' : url.slice(corte);
  if (/\/{2,}/.test(crudo)) return crudo.replace(/\/{2,}/g, '/') + consulta;
  let ruta: string;
  try {
    ruta = decodeURIComponent(crudo);
  } catch {
    return null;
  }
  if (ruta.startsWith(`${config.cms.publicUploadBase}/`) || ruta.startsWith('/_assets/')) {
    return null;
  }
  if (/(^|\/)index\.html$/.test(ruta)) return crudo.replace(/index\.html$/, '') + consulta;
  const ultimo = ruta.slice(ruta.lastIndexOf('/') + 1);
  if (ruta !== '/' && !ruta.endsWith('/') && !ultimo.includes('.')) {
    const indice = await findContainedFile(raiz, path.join(ruta.slice(1), 'index.html'));
    if (indice) return `${crudo}/${consulta}`;
  }
  return null;
}

async function serveStaticSite(request: FastifyRequest, reply: FastifyReply) {
  const pathname = getPathname(request.url);
  const raiz = distParaHost(request.hostname);

  // `//algo` se mira antes que nada: `getPathname` ya lo habría leído como «/».
  const crudo = request.url.split(/[?#]/)[0];
  const redirect = /\/{2,}/.test(crudo) ? undefined : redirectFor(pathname);
  if (redirect) {
    return reply.status(redirect.status).header('Location', redirect.to).send();
  }
  const canonica = await direccionCanonica(request.url, raiz);
  if (canonica) {
    return reply.status(301).header('Location', canonica).send();
  }
  // P3-02 (auditoría 2026-09): `/_headers`, `/_redirects` y `/.htaccess` se
  // servían con 200 y enseñaban la configuración (con comentarios internos).
  // Son convenciones de otros hostings: aquí nadie los pide. Las redirecciones
  // se siguen leyendo del archivo, solo que no se sirve.
  if (/^\/(_headers|_redirects|\.htaccess)$/.test(pathname) || /\/\.[^/]/.test(pathname)) {
    const noEncontrado = await resolvePublicFile('/404.html', raiz);
    reply.status(404);
    if (noEncontrado) {
      return reply
        .type('text/html; charset=utf-8')
        .send(await fs.promises.readFile(noEncontrado.filePath));
    }
    return reply.send({ error: 'Not found' });
  }
  if (pathname === '/404.html') {
    // La página de error no es una página del sitio: se sirve, pero como 404.
    const resolvedError = await resolvePublicFile(pathname, raiz);
    if (resolvedError) {
      return reply
        .status(404)
        .type('text/html; charset=utf-8')
        .send(await fs.promises.readFile(resolvedError.filePath));
    }
  }

  const resolved = await resolvePublicFile(pathname, raiz);

  if (!resolved) {
    return reply.status(404).send({ error: 'Not found' });
  }

  const { filePath, statusCode } = resolved;
  const stat = await fs.promises.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] ?? 'application/octet-stream';

  // P3-03 (auditoría 2026-09): el HTML iba con `no-cache` pero sin validadores,
  // así que cada visita volvía a descargarlo entero. Con ETag y Last-Modified
  // el navegador pregunta y, si no cambió, recibe un 304 sin cuerpo.
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const modificado = new Date(Math.floor(stat.mtimeMs / 1000) * 1000);
  reply
    .type(contentType)
    .header('Accept-Ranges', 'bytes')
    .header('Cache-Control', cacheControlFor(pathname, extension))
    .header('ETag', etag)
    .header('Last-Modified', modificado.toUTCString());

  if (statusCode === 200 && sinCambios(request, etag, modificado)) {
    return reply.status(304).send('');
  }

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
  pathname: string,
  raiz: string = distDir
): Promise<{ filePath: string; statusCode: number } | null> {
  if (pathname.startsWith(`${config.cms.publicUploadBase}/`)) {
    const uploadPath = pathname.slice(config.cms.publicUploadBase.length + 1);
    const filePath = await findContainedFile(config.cms.uploadDir, uploadPath);
    return filePath ? { filePath, statusCode: 200 } : null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidates = [relativePath, path.join(relativePath, 'index.html')];

  for (const candidate of candidates) {
    const filePath = await findContainedFile(raiz, candidate);
    if (filePath) return { filePath, statusCode: 200 };
  }

  const notFoundPath = await findContainedFile(raiz, '404.html');
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

/** ¿Pide el navegador algo que ya tiene? (`If-None-Match` manda sobre la fecha.) */
function sinCambios(request: FastifyRequest, etag: string, modificado: Date): boolean {
  const siNo = request.headers['if-none-match'];
  if (typeof siNo === 'string') {
    return siNo.split(',').some((v) => v.trim() === etag || v.trim() === '*');
  }
  const desde = request.headers['if-modified-since'];
  if (typeof desde === 'string') {
    const fecha = Date.parse(desde);
    return Number.isFinite(fecha) && modificado.getTime() <= fecha;
  }
  return false;
}

function cacheControlFor(pathname: string, extension: string): string {
  // P3-03 (auditoría 2026-09): toda imagen salía `immutable` un año, también
  // las que se reemplazan con el mismo nombre (el logo, la imagen para redes,
  // los logos de clientes). Solo lo es lo que lleva un hash o un id único en el
  // nombre; el resto se revalida al día.
  if (
    pathname.startsWith('/_assets/') ||
    pathname.startsWith('/gallery/derived/') ||
    pathname.startsWith(`${config.cms.publicUploadBase}/`)
  ) {
    return 'public, max-age=31536000, immutable';
  }
  if (['.woff2', '.woff'].includes(extension)) {
    return 'public, max-age=31536000';
  }
  if (['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.avif', '.ico'].includes(extension)) {
    return 'public, max-age=86400';
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
