import fastify from 'fastify';
import { config } from './config/unifiedConfig';
import { registerCmsRoutes } from './routes/cmsRoutes';
import { registerStaticSite } from './staticSite';
import { captureException, initErrorTracking } from './utils/errorTracking';

initErrorTracking();

const DEFAULT_PASSWORD = 'Hidromont-Admin-ChangeMe';
const isLocalOnly =
  config.cms.host === '127.0.0.1' || config.cms.host === 'localhost' || config.cms.host === '::1';

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

const app = fastify({
  logger: {
    level: 'info',
  },
  bodyLimit: config.cms.uploadMaxBytes,
  trustProxy: config.cms.trustProxy,
});

// Cabeceras de seguridad básicas
app.addHook('onSend', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // H-13: Restringir APIs del navegador no necesarias en el CMS.
  reply.header(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  // CMS-11: CSP/HSTS solo para la API del CMS (JSON), no para el sitio estático que
  // este mismo proceso puede servir via registerStaticSite (server.mjs/npm start) —
  // ese HTML incluye el bootstrap inline del overlay (CmsOverlay.astro) cuando
  // PUBLIC_ENABLE_CMS=1, y una CSP estricta aqui sin hashear ese script lo rompería.
  // El sitio estático en producción (Cloudflare Pages) ya trae su propia CSP via
  // public/_headers.
  if (request.url.startsWith('/api/')) {
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    if (config.cms.cookieSecure) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
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
