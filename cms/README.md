# Hidromont CMS

CMS local/LAN para edición visual del sitio estático Astro.

## Comandos

- `npm run cms`: inicia la API CMS en `http://localhost:8787`.
- `npm run dev:cms`: inicia Astro y el CMS juntos.
- `npm run cms:import`: importa páginas, servicios y proyectos actuales a SQLite.
- `npm run cms:export`: exporta SQLite hacia `src/data/cms-content.json` y colecciones Markdown.

## Acceso inicial

Por defecto se crea un admin local:

- Email: `admin@hidromont.local`
- Password: `Hidromont-Admin-ChangeMe`

Configurar `CMS_ADMIN_EMAIL` y `CMS_ADMIN_PASSWORD` antes del primer arranque para credenciales reales.
