import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hidromontchile.cl',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_assets',
  },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
  // La barra de desarrollo de Astro se pinta abajo al centro, encima de la
  // barra del CMS, y en las pruebas E2E intercepta los clics de sus botones.
  // Playwright la apaga con ASTRO_DEV_TOOLBAR=0; en `npm run dev` sigue igual.
  devToolbar: { enabled: process.env.ASTRO_DEV_TOOLBAR !== '0' },
});
