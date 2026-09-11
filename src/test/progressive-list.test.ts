import { describe, expect, it } from 'vitest';
import { nextBatchSize, paginateMatches } from '../utils/progressiveList';

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

describe('nextBatchSize', () => {
  it('promises the full page while there is enough left', () => {
    expect(nextBatchSize(30, 12, 12)).toBe(12);
  });

  it('promises only the remainder on the last batch', () => {
    // El caso real que mentía: banco de 30, segundo clic, quedan 6.
    expect(nextBatchSize(30, 24, 12)).toBe(6);
  });

  it('promises one when a filter leaves a single match over', () => {
    expect(nextBatchSize(13, 12, 12)).toBe(1);
  });

  it('never promises anything once everything is visible', () => {
    expect(nextBatchSize(30, 30, 12)).toBe(0);
  });

  it('stays at zero if the limit overshot the total', () => {
    expect(nextBatchSize(30, 36, 12)).toBe(0);
  });
});
