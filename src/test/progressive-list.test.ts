import { describe, expect, it } from 'vitest';
import { paginateMatches } from '../utils/progressiveList';

describe('paginateMatches', () => {
  const items = Array.from({ length: 201 }, (_, index) => ({
    id: index + 1,
    label: index === 180 ? 'Central escondida' : `Proyecto ${index + 1}`,
  }));

  it('returns deterministic gallery batches of 24', () => {
    expect(paginateMatches(items, () => true, 24).visible).toHaveLength(24);
    expect(paginateMatches(items, () => true, 48).visible).toHaveLength(48);
    expect(paginateMatches(items, () => true, 240)).toMatchObject({
      total: 201,
      hasMore: false,
    });
  });

  it('searches the complete collection before applying the visible limit', () => {
    const result = paginateMatches(items, (item) => item.label.includes('escondida'), 24);
    expect(result.visible.map((item) => item.id)).toEqual([181]);
  });

  it('supports project batches of 12', () => {
    const result = paginateMatches(items, (item) => item.id % 2 === 0, 12);
    expect(result.visible).toHaveLength(12);
    expect(result.total).toBe(100);
    expect(result.hasMore).toBe(true);
  });
});
