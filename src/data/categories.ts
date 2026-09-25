// A-7: las etiquetas viven en el vocabulario compartido
// (src/data/content-vocabulary.ts), del que también consumen el validador del
// CMS y el gate del export, en vez de estar duplicadas a mano.
//
// Se reexporta con el nombre y el tipo laxo antiguos para no tocar a sus
// consumidores (proyectos/[slug].astro, ProjectFilters.astro,
// ProjectTable.astro), que indexan el mapa con un valor que Astro infiere
// como `any` desde la colección. La estrictez se conserva donde importa: en
// la declaración del vocabulario.
//
// El nombre visible de cada categoría sale del CMS (`proyectos.categorias`,
// un campo por código): el código (`tuberias`) sigue fijo porque lo valida el
// schema de las fichas, pero cómo se llama en el sitio ya no exige tocar el
// código. El vocabulario queda como respaldo.
import { getCmsText } from './cms';
import { CATEGORIA_PROYECTO, CATEGORIA_PROYECTO_LABEL } from './content-vocabulary';

export const categoriaLabels: Record<string, string> = Object.fromEntries(
  CATEGORIA_PROYECTO.map((codigo) => [
    codigo,
    getCmsText('proyectos.categorias', codigo, CATEGORIA_PROYECTO_LABEL[codigo]),
  ])
);
