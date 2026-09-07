// ESTRUCT-3: labels para el enum FIJO `categoriaProyecto` de src/content.config.ts
// (tipo de trabajo de ingeniería en un proyecto). Las categorías de la galería
// (src/data/gallery.json / gallery_categories) son un vocabulario aparte e
// intencionalmente distinto: se gestionan en runtime desde el CMS (un admin
// puede crear/renombrar/reordenar categorías de fotos), mientras que este mapa
// es un enum de compilación validado por Zod. No deben unificarse en una sola
// taxonomía — clasifican dimensiones distintas (tipo de proyecto vs. contexto
// de la foto) y una es editable sin build, la otra no.
export const categoriaLabels: Record<string, string> = {
  compuertas: 'Compuertas y Válvulas',
  estructuras: 'Estructuras y Tanques',
  limpiarrejas: 'Limpiarrejas',
  electromecanicos: 'Montajes Especiales',
  tuberias: 'Tuberías y Blindajes',
};
