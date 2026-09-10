import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hidromont.cl',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_assets',
  },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
});
