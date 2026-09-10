// A-7: las etiquetas viven ahora en el vocabulario compartido
// (src/data/content-vocabulary.ts), del que también consumen el validador del
// CMS y el gate del export, en vez de estar duplicadas a mano.
//
// Se reexporta con el nombre y el tipo laxo antiguos para no tocar a sus
// consumidores (proyectos/[slug].astro, ProjectFilters.astro,
// ProjectTable.astro), que indexan el mapa con un valor que Astro infiere
// como `any` desde la colección. La estrictez se conserva donde importa: en
// la declaración del vocabulario.
import { CATEGORIA_PROYECTO_LABEL } from './content-vocabulary';

export const categoriaLabels: Record<string, string> = CATEGORIA_PROYECTO_LABEL;
