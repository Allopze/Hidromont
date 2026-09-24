# Seguridad

> Modelo de amenazas, mitigaciones y hardening del proyecto Hidromont Chile.
> Para el detalle de hallazgos y remediación, ver [`AUDITORIA_LOGICA_UIUX.md`](./AUDITORIA_LOGICA_UIUX.md).

## Modelo de despliegue

```
┌─────────────────────────────────────────┐
│  PRODUCCIÓN (público)                   │
│  Cloudflare Pages sirve dist/ estático. │
│  NO hay backend expuesto.               │
│  CSP, HSTS, X-Frame-Options en _headers.│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  EDICIÓN (local/LAN, NO público)        │
│  CMS Fastify en :8787.                  │
│  Overlay en dev (PUBLIC_ENABLE_CMS=1).  │
│  Auth bcrypt + CSRF + rate-limit.       │
└─────────────────────────────────────────┘
```

**Principio:** el sitio público es 100% estático. El CMS **nunca** se expone a internet; corre solo en la máquina del operador o LAN de la oficina. El canal entre ambos es el export de archivos (JSON + .md), que el build convierte en el `dist/` que se sirve.

> **Cambio de modelo (Fase 4).** Con el despliegue integrado el CMS y el sitio corren en el mismo proceso Node y sus APIs quedan detrás de HTTPS y autenticación. La interfaz visual de producción se activa desde `editor.*`; `?cms=1` solo funciona en desarrollo. El perfil integrado requiere `PUBLIC_ENABLE_CMS=1`; el perfil público estático usa `0`. Eso obliga a HTTPS con `CMS_COOKIE_SECURE=1`, contraseña fuerte y `CMS_ALLOW_INSECURE_COOKIE` sin definir — los guards de arranque de `cms/server.ts` rechazan las combinaciones peligrosas. `e2e/build-gate.spec.ts` verifica que el build estático no arrastre credenciales ni rutas del servidor.
>
> Las cabeceras de seguridad ya no vienen de `public/_headers` (convención exclusiva de Cloudflare Pages, inerte fuera de él) sino de `cms/security/headers.ts`, que además calcula los hashes de la CSP leyendo el build en vez de mantenerlos a mano.

## Matriz de amenazas y mitigaciones

| Vector                                 | Estado      | Mitigación                                                                                                                                                                                    |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **XSS reflejado/almacenado**           | ✅ Mitigado | Astro auto-escapa todo contenido. `set:html` solo en SVG estático (iconos ServiceCard). SVG bloqueado en uploads de usuario (stored-XSS vía `<script>` embebido).                             |
| **Inyección SQL**                      | ✅ Mitigado | Sentencias preparadas en todos los repositories (better-sqlite3). Sin concatenación SQL.                                                                                                      |
| **CSRF**                               | ✅ Mitigado | Doble token: cookie de sesión + header `X-CSRF-Token`. `requireCsrf` en todas las mutaciones.                                                                                                 |
| **Path traversal (servir)**            | ✅ Mitigado | `findContainedFile` en `staticSite.ts` resuelve paths absolutos y rechaza si no están bajo root. URL decodificada antes del check.                                                            |
| **Path traversal (export/upload)**     | ✅ Mitigado | Regex de slug `/^[a-z0-9/._-]+$/` + `.refine` rechaza `..`. Slugs con subdirectorio crean el dir recursivamente (no fallan). Contención de ruta en upload (`fullPath.startsWith(uploadDir)`). |
| **AuthN/AuthZ**                        | ✅ Mitigado | bcrypt cost 12. `requireAuth` en todas las rutas privadas. Sesión `nanoid(48)`, cookie `httpOnly` + `sameSite: lax` + `secure` configurable.                                                  |
| **Brute force login**                  | ✅ Mitigado | Rate limit: 10 intentos / 60s por IP, persistido en SQLite, con `Retry-After`. Cleanup al arranque + intervalo de 5 min.                                                                      |
| **Fuga del CMS al build público (H1)** | ✅ Mitigado | `PUBLIC_ENABLE_CMS=0` en build de producción. Test e2e `build-gate.spec.ts` verifica que `dist/` no contenga `data-cms-entry` ni `__HIDROMONT_CMS__`. CI lo ejecuta en cada PR.               |
| **Cookie insegura en LAN (H2)**        | ✅ Mitigado | Guard de arranque bloquea `CMS_HOST=0.0.0.0` + `CMS_COOKIE_SECURE=0` salvo escape hatch explícito `CMS_ALLOW_INSECURE_COOKIE=1`.                                                              |
| **Secretos en repo**                   | ✅ OK       | `.env` en `.gitignore`, ausente del historial. `.env.example` con placeholders.                                                                                                               |
| **Dependencias**                       | ✅ OK       | `npm audit --omit=dev` → 0 vulnerabilidades. `js-yaml` resuelto correctamente (gray-matter usa v3 parcheada, astro top-level v4).                                                             |

## CSP (Content-Security-Policy)

Definida en `public/_headers` para Cloudflare Pages:

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'self';
img-src 'self' data: https:;
font-src 'self';
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline'
  'sha256-/x7W7R75k8Roq0WaVRQX9blP4OufE5xbAdzklGxsgpw='   /* .js classList */
  'sha256-KzHXOF/rDV03VPBunw3imiCWpJVLi2nvUNu3mxXrVd8=';  /* JSON-LD Organization */
frame-src https://maps.google.com https://www.google.com;
form-action 'self' https://formsubmit.co https://api.web3forms.com;
upgrade-insecure-requests;
```

- `'unsafe-inline'` en `script-src` se mantiene porque Astro genera scripts inline adicionales en páginas de detalle (ContactForm JSON, gallery) cuyos contenidos varían. Los dos hashes cubren los scripts estáticos idénticos en todas las páginas (`.js classList` + JSON-LD Organization).
- Migrar a nonces requeriría SSR; queda como mejora futura.

## Cabeceras de seguridad

| Cabecera                  | Valor                                                  | Origen                              |
| ------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `Content-Security-Policy` | ver arriba                                             | `public/_headers` (Cloudflare)      |
| `X-Content-Type-Options`  | `nosniff`                                              | `_headers` + `cms/server.ts` onSend |
| `X-Frame-Options`         | `SAMEORIGIN` (`_headers`) / `DENY` (server.ts)         | ambos                               |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                      | `_headers` + server.ts              |
| Cache-Control             | HTML 600s revalidate; assets/fonts/img 1 año immutable | `_headers`                          |

## Formulario de contacto

- POST directo a FormSubmit.co (tercero) vía fetch.
- **Honeypot** `_honey` (campo oculto, `aria-hidden`, `tabindex=-1`).
- **Rate-limit client-side**: 3 envíos / 5 min (sessionStorage).
- Validación JS con mensajes centralizados en JSON embebido.
- `PUBLIC_CONTACT_EMAIL` defaultea a `contacto@hidromont.cl` (no cuenta personal).

## Endurecimiento del CMS en LAN

Si el CMS se sirve en la red de la oficina:

1. **Recomendado:** HTTPS + `CMS_COOKIE_SECURE=1`.
2. **Alternativo:** `CMS_HOST=127.0.0.1` + túnel SSH (sin exponer el puerto).
3. **LAN de confianza:** `CMS_HOST=0.0.0.0` + `CMS_COOKIE_SECURE=0` + `CMS_ALLOW_INSECURE_COOKIE=1` (el CMS emite advertencia al arrancar).

El guard de arranque (`cms/server.ts`) **bloquea** la combinación host expuesto + cookie insegura sin el escape hatch.

## Auditoría y observabilidad

- **Audit log:** `audit_events` registra login (success/failed/rate_limited), logout, CRUD de entries/media/gallery, exports, publishes, backups. Visible en `GET /api/cms/audit`.
- **Error tracking:** Sentry opcional (`SENTRY_DSN`). `captureException` en puntos críticos.
- **Publish jobs:** tracking con status `running`/`succeeded`/`failed`, logs detallados, crash recovery (reap de jobs stale al arranque).

## Rotación de credenciales

```bash
# Cambiar contraseña del admin (re-hashea + invalida sesiones)
npm run cms:reset-password
npm run cms:reset-password -- nuevo@email.cl NuevaPassword123
```

Si se cambia `CMS_ADMIN_PASSWORD` en `.env` sin este script, el hash almacenado **no** se actualiza (el `ensureAdminUser` del arranque preserva ediciones).

## Backup

```bash
npm run cms:backup    # copia el .sqlite a cms/data/backups/
```

Restaurar: reemplazar `cms/data/hidromont-cms.sqlite` con el backup. Las migraciones al arranque son idempotentes (no dañan un backup más viejo).

## Reportar un problema de seguridad

Si encuentras una vulnerabilidad, no abras un issue público. Contacta al equipo de desarrollo directamente. El modelo de amenazas asume que el CMS no está expuesto a internet; cualquier issue que requiera acceso autenticado al CMS es de severidad menor salvo que permita escalado o RCE.

## Referencias

- [`AUDITORIA_LOGICA_UIUX.md`](./AUDITORIA_LOGICA_UIUX.md) — auditoría técnica completa + registro de remediación.
- [`public/_headers`](../public/_headers) — CSP y cabeceras de Cloudflare.
- [`cms/server.ts`](../cms/server.ts) — guard de arranque (H2).
- [`cms/middleware/security.ts`](../cms/middleware/security.ts) — requireAuth, requireCsrf, CORS.
