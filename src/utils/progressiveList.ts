export function paginateMatches<T>(
  items: readonly T[],
  matches: (item: T) => boolean,
  visibleLimit: number
) {
  const matching = items.filter(matches);
  const safeLimit = Math.max(0, Math.floor(visibleLimit));

  return {
    visible: matching.slice(0, safeLimit),
    // El conjunto completo que coincide con el filtro, no solo lo ya
    // paginado a la vista. La galería lo usa para que el visor navegue por
    // todas las fotos de la categoría activa, no solo por las que ya
    // cargó el scroll infinito.
    matching,
    total: matching.length,
    hasMore: matching.length > safeLimit,
  };
}

/**
 * Cuántos elementos entrega realmente el próximo clic de «ver más».
 *
 * El botón de /proyectos prometía un lote fijo de 12 escrito a mano en el
 * marcado: con 30 obras en el banco, el segundo clic entregaba 6 mientras el
 * rótulo seguía diciendo 12. Con un filtro activo fallaba casi siempre.
 */
export function nextBatchSize(total: number, visibleCount: number, pageSize: number): number {
  return Math.max(0, Math.min(pageSize, total - visibleCount));
}
