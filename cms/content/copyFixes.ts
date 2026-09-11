import type { AuditedValueRule } from './auditedMigration';

/**
 * Correcciones de copy derivadas de la auditoría de septiembre de 2026.
 *
 * Cada regla verifica el valor previo (`from`) antes de escribir: si la base ya
 * no dice lo que esperábamos, la tanda aborta en vez de pisar una edición hecha
 * desde el panel. Ver `cms/scripts/apply-copy-fixes.ts`.
 *
 * `batch` agrupa las reglas para poder aplicarlas y revisarlas por partes
 * (`--batch=reconciliacion`), porque un diff de 73 textos no lo revisa nadie.
 */
export interface CopyFixRule extends AuditedValueRule {
  batch: string;
  /** Por qué cambia este texto. Sin esto, en seis meses alguien lo revierte. */
  nota: string;
}

export const copyFixRules: CopyFixRule[] = [
  // ── Tanda 0 · reconciliación ────────────────────────────────────────────
  // Estos seis textos ya se corrigieron en los archivos del repo, pero la base
  // —que es la fuente de verdad— seguía con la versión vieja. Sin esta tanda,
  // el próximo `cms:export` los revertía en silencio.
  {
    batch: 'reconciliacion',
    entryId: 'home.hero',
    key: 'subtitle',
    from: 'Tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para embalses y centrales hidroeléctricas. En España desde 1983 y en Chile desde 1997, con taller en Los Ángeles.',
    to: 'Tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para embalses y centrales hidroeléctricas. En España desde 1983 y en Chile desde 1997, con taller en Los Ángeles, Región del Biobío.',
    nota: 'Sin la región, «Los Ángeles» se lee como California — y esto es la meta description de la portada.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'empresa.cta',
    key: 'subtitle',
    from: 'Cuéntenos el alcance de su obra y revisamos qué parte podemos ejecutar en el taller de Los Ángeles y qué parte en terreno.',
    to: 'Cuéntenos el alcance de su obra y revisamos qué podemos fabricar y montar nosotros.',
    nota: 'El reparto interno de trabajo no le importa al cliente; leído desde fuera sonaba a limitación.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'empresa.instalaciones',
    key: 'title',
    from: 'El taller de Los Ángeles',
    to: 'El taller',
    nota: 'El artículo determinado más el topónimo presuponía que el lector ya sabe cuál taller es.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'servicios.index.banner',
    key: 'subtitle',
    from: 'En Los Ángeles contamos con terreno para acopio y premontaje, además de talleres de calderería, mecanizado y pintura industrial.',
    to: 'Contamos con terreno para acopio y premontaje, además de taller de calderería, mecanizado y pintura industrial.',
    nota: 'Contradecía a /empresa, que dice que todo ocurre en la misma nave. Singular, y sin el topónimo de más.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'servicios.tanques-especiales',
    key: 'body',
    mode: 'substring',
    from: 'En el taller de Los Ángeles se ejecutan el rolado',
    to: 'En el taller se ejecutan el rolado',
    nota: 'La ficha abría con geografía interna en vez del proceso.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'servicios.tuberias-forzadas',
    key: 'body',
    mode: 'substring',
    from: 'Nuestro taller en Los Ángeles, Región del Biobío, cuenta con equipamiento',
    to: 'Nuestro taller cuenta con equipamiento',
    nota: 'La ubicación ya está dicha en la portada y en /empresa; aquí solo estorbaba el ritmo.',
  },
];
