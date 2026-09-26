/**
 * P2-34 (auditoría 2026-09): relación entre servicios y proyectos.
 *
 * Las fichas de proyecto enlazaban a su servicio, pero no al revés: la página
 * de «Tanques Especiales» mencionaba Coyhaique y Puerto Williams, que tienen
 * ficha, sin enlazarlas, y su botón abría /proyectos/ sin filtrar.
 *
 * Casi ninguna ficha declara `servicio`; la mayoría solo tiene `categoria`,
 * que es otra clasificación (tipo de trabajo). Esta tabla las cruza: es la
 * misma que usaba la ficha de proyecto para su enlace «Ver servicio».
 */
import type { CollectionEntry } from 'astro:content';

/** El servicio al que remite cada categoría de proyecto, si la ficha no declara uno. */
export const SERVICIO_DE_CATEGORIA: Record<string, string> = {
  tuberias: 'tuberias-forzadas',
  compuertas: 'compuertas',
  electromecanicos: 'otros-montajes',
  limpiarrejas: 'limpiarrejas',
  estructuras: 'otros-montajes',
};

/** La categoría del listado de proyectos que corresponde a cada servicio. */
export const CATEGORIA_DE_SERVICIO: Record<string, string> = {
  'tuberias-forzadas': 'tuberias',
  compuertas: 'compuertas',
  valvulas: 'compuertas',
  limpiarrejas: 'limpiarrejas',
  'otros-montajes': 'electromecanicos',
  turbinas: 'electromecanicos',
  'tanques-especiales': 'estructuras',
  infraestructuras: 'estructuras',
};

/** ¿Pertenece este proyecto a este servicio? */
export function esDelServicio(proyecto: CollectionEntry<'proyectos'>, servicio: string): boolean {
  const declarado = proyecto.data.servicio;
  if (declarado) return declarado === servicio;
  return SERVICIO_DE_CATEGORIA[proyecto.data.categoria] === servicio;
}

/** Los proyectos con página propia de un servicio, en el orden del listado. */
export function proyectosDelServicio(
  proyectos: CollectionEntry<'proyectos'>[],
  servicio: string
): CollectionEntry<'proyectos'>[] {
  return proyectos
    .filter((p) => p.data.tipo === 'destacado' && esDelServicio(p, servicio))
    .sort((a, b) => (a.data.orden ?? 0) - (b.data.orden ?? 0));
}
