// Tailwind 3 por PostCSS. Con Astro 7 ya no hay integración oficial para esta
// versión (@astrojs/tailwind admite hasta Astro 5); las directivas siguen en
// src/styles/global.css, que era lo que hacía `applyBaseStyles: false`.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
