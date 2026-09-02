import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

const disableShortLivedDependencyScan = {
  name: 'hidromont-disable-short-lived-dependency-scan',
  enforce: 'post',
  configResolved(config) {
    config.optimizeDeps.include = [];
    config.optimizeDeps.noDiscovery = true;
  },
};

export default defineConfig({
  site: 'https://hidromont.cl',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_assets',
  },
  vite: {
    // `astro check` closes its short-lived Vite server while dependency
    // discovery is still running. Disabling discovery avoids a noisy,
    // harmless esbuild cancellation without changing the static output.
    plugins: [disableShortLivedDependencyScan],
  },
  integrations: [tailwind({ applyBaseStyles: false }), sitemap()],
});
