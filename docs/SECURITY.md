# Seguridad

> Modelo de amenazas y medidas del sitio y del CMS de Hidromont Chile, tal como
> están en el código. Arquitectura en [`ARCHITECTURE.md`](./ARCHITECTURE.md);
> despliegue en [`DESPLIEGUE-VPS.md`](./DESPLIEGUE-VPS.md).
>
> Reescrito en septiembre de 2026 (auditoría, P2-08). La versión anterior
> suponía un sitio en Cloudflare Pages y un CMS que nunca se exponía a
> internet. Hoy el CMS se sirve en internet, en `editor.hidromontchile.cl`,
> detrás de HTTPS y autenticación.

## Modelo de despliegue

Un proceso Node (Fastify) detrás de Caddy sirve los dos dominios:

| Host                       | Qué recibe                                             | API `/api/cms/*`                                         |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| `hidromontchile.cl`        | `dist/`, compilado con `PUBLIC_ENABLE_CMS=0`           | 404 (con los dos perfiles desplegados)                   |
| `editor.hidromontchile.cl` | `dist-editor/`, con el editor; `X-Robots-Tag: noindex` | Sí: login, sesión y salud públicos; el resto, con sesión |

Decisiones del propietario que este documento da por fijadas: no hay
`basic_auth` ni filtro por IP delante de `/api/cms`, y el servicio corre como
`root` (`deploy/hidromont.service`, con `ProtectSystem=full`).

## Amenazas y medidas

| Vector                          | Estado                          | Medida                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS                             | Mitigado                        | Astro escapa lo que pinta. El cuerpo en Markdown se publica sin HTML crudo (`src/utils/rehypeSinHtml.mjs`). La vista previa del editor escapa y solo admite enlaces `http(s)`, `mailto` y rutas. Los SVG subidos se convierten a PNG. |
| Inyección SQL                   | Mitigado                        | Sentencias preparadas en todos los repositorios.                                                                                                                                                                                      |
| CSRF                            | Mitigado                        | Token ligado a la sesión en la cabecera `X-CSRF-Token`, comparado en tiempo constante; `requireCsrf` en todas las mutaciones.                                                                                                         |
| Autenticación                   | Mitigado                        | bcrypt (coste 12), comparación contra un hash ficticio si el usuario no existe, sesión aleatoria y cookie `__Host-…` `Secure` `HttpOnly` `SameSite=Lax` sin `Domain`.                                                                 |
| Fuerza bruta                    | Mitigado                        | 10 intentos por minuto y por IP, persistidos en SQLite, con `Retry-After`. `CMS_TRUST_PROXY=1` para leer la IP real detrás de Caddy.                                                                                                  |
| Contraseña por defecto          | Mitigado                        | Las guardas de arranque (`cms/server.ts`) no dejan arrancar con la contraseña de ejemplo, ni en el `.env` ni en la base, ni con una cookie insegura en un host expuesto.                                                              |
| Path traversal                  | Mitigado                        | `findContainedFile` resuelve la ruta y rechaza lo que salga de la raíz; los slugs siguen un patrón estricto; las subidas se contienen en `uploads/cms`.                                                                               |
| Subidas maliciosas              | Mitigado                        | Tipo por extensión y por contenido real (firma de bytes; sharp debe poder decodificar la imagen); límite de píxeles; tamaño máximo por tipo; el SVG se valida y se rasteriza.                                                         |
| Editor en el sitio público (H1) | Mitigado al desplegar esta rama | Dos perfiles de build: `dist/` sin editor para el host público y `dist-editor/` para `editor.*`. La API responde 404 en el host público. `e2e/build-gate.spec.ts` comprueba que `dist/` no lleve marcas del CMS.                      |
| Secretos                        | OK                              | `.env` fuera de git; `.env.example` y `.env.production.example` con valores de ejemplo comentados.                                                                                                                                    |
| Dependencias                    | Revisar en cada despliegue      | `npm audit`: 0 avisos (septiembre de 2026, tras pasar a Astro 7, Fastify 5.12, sharp 0.35 para todo el árbol y Vitest 5).                                                                                                             |

## Cabeceras

Las pone `cms/server.ts` en `onSend`. `public/_headers` es una convención de
Cloudflare Pages que aquí no se usa.

| Cabecera                    | Valor                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | HTML: `default-src 'self'`, `script-src 'self'` más los hashes de cada script inline del build servido (`cms/security/headers.ts`), `connect-src` y `form-action` a FormSubmit, `frame-src` a Google Maps, `frame-ancestors 'self'`. API: `default-src 'none'; frame-ancestors 'none'`. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` con cookie segura                                                                                                                                                                                                                                 |
| `X-Frame-Options`           | `SAMEORIGIN` en el sitio, `DENY` en la API                                                                                                                                                                                                                                              |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                                                                                                                                                               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                       |
| `Permissions-Policy`        | cámara, micrófono, geolocalización, pago, USB y `interest-cohort` desactivados                                                                                                                                                                                                          |
| `Cache-Control`             | HTML `no-cache`; `/_assets/` e imágenes, un año `immutable`; videos de `public/`, un día                                                                                                                                                                                                |

Los hashes de la CSP se recalculan al cambiar el build (la caché se invalida
por la fecha de `index.html` de cada perfil), así que no hay que mantenerlos a
mano. `style-src` conserva `'unsafe-inline'` porque Astro emite estilos por
componente.

## Formulario de contacto

- `fetch` a FormSubmit.co, con un tiempo máximo de 20 s y respaldo sin
  JavaScript (envío nativo a `/contacto/gracias`).
- Honeypot `_honey` y límite en el navegador de 3 envíos aceptados cada 5
  minutos. El límite real lo aplica FormSubmit.
- El destinatario sale de `PUBLIC_CONTACT_EMAIL`, con respaldo en el buzón
  corporativo.

## Auditoría y observabilidad

- `audit_events` registra accesos (correctos, fallidos y bloqueados), cambios
  de contenido, medios, galería, restauraciones, exportaciones,
  publicaciones y respaldos. Se consulta en «Administrar» → «Registro de
  actividad», con los detalles técnicos plegados.
- Sentry opcional (`SENTRY_DSN`), solo en el backend. Los errores que el panel
  explica a quien edita (`ErrorDeUsuario`) no se envían.
- Las publicaciones colgadas se descartan al arrancar.

## Credenciales y respaldos

```bash
npm run cms:reset-password                          # interactivo
npm run cms:reset-password -- correo@dominio Clave  # directo; invalida las sesiones
npm run cms:backup                                  # copia la base a cms/data/backups/
```

Cambiar `CMS_ADMIN_PASSWORD` en el `.env` no cambia el hash guardado: hay que
usar el script. `scripts/sync-datos-vps.sh` respalda la base remota antes de
sustituirla y pide confirmación si la remota es más reciente.

## Reportar un problema

No abras un issue público: escribe al equipo de desarrollo. Ten en cuenta que
el CMS es accesible desde internet en `editor.*`: un fallo que no requiera
sesión es grave.
