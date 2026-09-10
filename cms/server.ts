import path from 'node:path';
import fastify from 'fastify';
import { config } from './config/unifiedConfig';
import { registerCmsRoutes } from './routes/cmsRoutes';
import { publicContentSecurityPolicy } from './security/headers';
import { registerStaticSite } from './staticSite';
import { captureException, initErrorTracking } from './utils/errorTracking';

initErrorTracking();

const DEFAULT_PASSWORD = 'Hidromont-Admin-ChangeMe';

/**
 * Bajo Passenger (el modo «Node.js App» de cPanel) `CMS_HOST` y `CMS_PORT` no
 * se usan para nada: Passenger engancha el primer `http.Server` que llama a
 * `listen()` y lo pone en un socket Unix suyo, así que «el número de puerto que
 * se pasa a listen() es irrelevante y no tiene efecto» —su documentación—.
 *
 * Eso invertía dos guardas de abajo. `CMS_HOST` se queda en su valor por
 * defecto, `127.0.0.1`, así que `isLocalOnly` daba `true` y el servidor se
 * consideraba local... mientras Passenger lo publicaba en el dominio. El
 * guarda que impide arrancar con la contraseña por defecto quedaba desactivado
 * justo en el único escenario donde importa.
 */
const isPassenger =
  typeof (globalThis as { PhusionPassenger?: unknown }).PhusionPassenger !== 'undefined' ||
  !!process.env._PASSENGER_NODE_CONTROL_SERVER;

const isLoopbackHost =
  config.cms.host === '127.0.0.1' || config.cms.host === 'localhost' || config.cms.host === '::1';

// Detrás de un servidor de aplicaciones, el host al que decimos escuchar no
// dice nada sobre quién nos alcanza.
const isLocalOnly = isLoopbackHost && !isPassenger;

if (isPassenger) {
  process.stderr.write(
    '[CMS] Detectado Passenger: CMS_HOST y CMS_PORT se ignoran (el socket lo asigna Passenger).\n'
  );
}

// H2: si el CMS escucha en una interfaz expuesta (0.0.0.0 u otra no-loopback),
// la cookie de sesión DEBE ser segura (HTTPS) para no viajar en claro por la red.
// Sin esto, un atacante en la misma LAN podría capturar la sesión de admin.
if (!isLocalOnly && !config.cms.cookieSecure && !config.cms.allowInsecureCookie) {
  process.stderr.write(
    '[CMS] ERROR: El CMS está expuesto a la red (CMS_HOST=' +
      config.cms.host +
      ') con CMS_COOKIE_SECURE=0.\n' +
      '[CMS] La cookie de sesión viajaría en texto plano (HTTP) → riesgo de secuestro de sesión.\n' +
      '[CMS] Opciones:\n' +
      '[CMS]   - Servir el CMS bajo HTTPS y fijar CMS_COOKIE_SECURE=1, o\n' +
      '[CMS]   - Restringir a CMS_HOST=127.0.0.1 (local) y editar por túnel SSH, o\n' +
      '[CMS]   - Para LAN sin SSL explícitamente aceptada, definir CMS_ALLOW_INSECURE_COOKIE=1.\n'
  );
  process.exit(1);
}

if (!isLocalOnly && !config.cms.cookieSecure && config.cms.allowInsecureCookie) {
  process.stderr.write(
    '[CMS] ADVERTENCIA: CMS_ALLOW_INSECURE_COOKIE=1 activo en host expuesto (' +
      config.cms.host +
      '). La cookie de sesión viaja en claro. Aceptable solo en LAN de confianza.\n'
  );
}

// La contraseña por defecto está en el repositorio y en la documentación, así
// que en producción no hay ninguna configuración que la haga aceptable. Este
// guarda no depende de detectar Passenger ni de adivinar la exposición: si
// NODE_ENV dice producción, se niega a arrancar. cPanel fija NODE_ENV desde su
// «Modo de aplicación», así que cubre el caso aunque la detección falle.
if (config.admin.password === DEFAULT_PASSWORD && process.env.NODE_ENV === 'production') {
  process.stderr.write(
    '[CMS] ERROR: NODE_ENV=production con la contraseña de administrador por defecto.\n' +
      '[CMS] Esa contraseña es pública: está en el repositorio y en la documentación.\n' +
      '[CMS] Defina CMS_ADMIN_PASSWORD antes de arrancar en producción.\n'
  );
  process.exit(1);
}

if (config.admin.password === DEFAULT_PASSWORD && !isLocalOnly) {
  process.stderr.write(
    '[CMS] ERROR: No se puede iniciar el CMS expuesto a la red con la contraseña por defecto.\n' +
      '[CMS] Defina CMS_ADMIN_PASSWORD con una contraseña segura o use CMS_HOST=127.0.0.1.\n'
  );
  process.exit(1);
}

// CMS-8: CMS_HOST=127.0.0.1 no garantiza que el servicio sea inalcanzable desde
// fuera — un túnel SSH (`ssh -L 8787:localhost:8787`) o un `kubectl port-forward`
// lo exponen igual. No bloqueamos el arranque local (romperia el primer `npm run
// cms` de un clon nuevo antes de correr cms:reset-password), pero la advertencia
// debe ser imposible de ignorar.
if (config.admin.password === DEFAULT_PASSWORD && isLocalOnly) {
  process.stderr.write(
    '[CMS] ADVERTENCIA: el CMS arrancó con la contraseña de administrador por defecto.\n' +
      '[CMS] CMS_HOST=' +
      config.cms.host +
      ' solo evita conexiones directas desde la red — un túnel SSH o un\n' +
      '[CMS] port-forward igual lo expondrían con esta credencial conocida públicamente.\n' +
      '[CMS] Ejecute `npm run cms:reset-password` antes de exponer este servidor de cualquier forma.\n'
  );
}

// C-2: el directorio de subidas NUNCA debe caer dentro de public/. Astro copia
// public/ entero a dist/ en cada build, así que ahí dentro los 2+ GB de
// originales se duplicarían en cada compilación. El .env del proyecto apuntaba
// a ./public/uploads/cms — un directorio que ni siquiera existía — y el
// resultado fueron 1.705 de 2.140 medios sirviendo 404 sin un solo error.
const publicDir = path.join(config.rootDir, 'public');
const resolvedUploadDir = path.resolve(config.cms.uploadDir);
if (resolvedUploadDir === publicDir || resolvedUploadDir.startsWith(`${publicDir}${path.sep}`)) {
  process.stderr.write(
    '[CMS] ERROR: CMS_UPLOAD_DIR apunta dentro de public/ (' +
      resolvedUploadDir +
      ').\n' +
      '[CMS] Astro copia public/ a dist/ en cada build: los originales subidos\n' +
      '[CMS] se duplicarían en cada compilación y engordarían el sitio publicado.\n' +
      '[CMS] Use una ruta fuera de public/, por ejemplo CMS_UPLOAD_DIR=./uploads/cms.\n' +
      '[CMS] El servidor del CMS ya los sirve en /uploads/cms sin necesidad de que\n' +
      '[CMS] estén en public/ (ver cms/staticSite.ts).\n'
  );
  process.exit(1);
}

const app = fastify({
  logger: {
    level: 'info',
  },
  bodyLimit: config.cms.uploadMaxBytes,
  trustProxy: config.cms.trustProxy,
});

// Cabeceras de seguridad.
//
// Fase 4 (cPanel): `public/_headers` es una convención exclusiva de Cloudflare
// Pages y no hace nada cuando este proceso sirve el sitio, así que la CSP y la
// Permissions-Policy del sitio público desaparecían al migrar. `.htaccess`
// tampoco trae CSP y solo aplica si Apache sirve los archivos.
app.addHook('onSend', async (request, reply) => {
  const esApi = request.url.startsWith('/api/');

  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  // La API no debe poder enmarcarse en ningún caso; el sitio público sí en su
  // propio origen, que es lo que declaraba _headers.
  reply.header('X-Frame-Options', esApi ? 'DENY' : 'SAMEORIGIN');

  if (config.cms.cookieSecure) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (esApi) {
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    return;
  }

  // Solo el HTML necesita CSP: los assets se sirven con su propio tipo y la
  // política no aporta nada sobre ellos.
  const tipo = reply.getHeader('content-type');
  if (typeof tipo === 'string' && tipo.startsWith('text/html')) {
    reply.header('Content-Security-Policy', publicContentSecurityPolicy(config.cms.staticDir));
  }
});

try {
  await registerCmsRoutes(app);
  registerStaticSite(app);
  await app.listen({ host: config.cms.host, port: config.cms.port });
} catch (error) {
  captureException(error, { action: 'startCmsServer' });
  process.exit(1);
}
