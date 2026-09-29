import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeSinHtml from './src/utils/rehypeSinHtml.mjs';
import rehypeDiametros from './src/utils/rehypeDiametros.mjs';
import enlacesConBarra from './src/utils/enlacesConBarra.mjs';
import imagenesParaRedes from './src/utils/imagenesParaRedes.mjs';

export default defineConfig({
  site: 'https://hidromontchile.cl',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_assets',
  },
  // P2-27: enlaces internos a la forma canónica, con barra (ver el archivo).
  integrations: [
    // P3-06: fuera del sitemap las páginas que no se indexan.
    sitemap({ filter: (pagina) => !/\/(contacto\/gracias|404)\/?$/.test(pagina) }),
    enlacesConBarra(),
    imagenesParaRedes(),
  ],
  // P2-02: el cuerpo de las fichas no publica HTML crudo (ver el plugin).
  // P3-09: y la misma notación de DN y Ø que el resto de la ficha.
  // Astro 7 deja obsoleto `markdown.rehypePlugins`: los plugins van en el
  // procesador. Si una versión futura dejara de leer la forma antigua, el HTML
  // de las fichas volvería a publicarse sin avisar; `src/test/markdown-sin-html`
  // lo comprueba contra esta misma configuración.
  markdown: { processor: unified({ rehypePlugins: [rehypeSinHtml, rehypeDiametros] }) },
  // La barra de desarrollo de Astro se pinta abajo al centro, encima de la
  // barra del CMS, y en las pruebas E2E intercepta los clics de sus botones.
  // Playwright la apaga con ASTRO_DEV_TOOLBAR=0; en `npm run dev` sigue igual.
  devToolbar: { enabled: process.env.ASTRO_DEV_TOOLBAR !== '0' },
});
