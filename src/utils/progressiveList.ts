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
