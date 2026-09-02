export function paginateMatches<T>(
  items: readonly T[],
  matches: (item: T) => boolean,
  visibleLimit: number
) {
  const matching = items.filter(matches);
  const safeLimit = Math.max(0, Math.floor(visibleLimit));

  return {
    visible: matching.slice(0, safeLimit),
    total: matching.length,
    hasMore: matching.length > safeLimit,
  };
}
