import { describe, expect, it } from 'vitest';
import { formatDN } from '../utils/format';

describe('formatDN', () => {
  it('adds Chilean thousands separators to DN values', () => {
    expect(formatDN('DN 2200')).toBe('DN 2.200');
    expect(formatDN('DN 1200 / DN 1000')).toBe('DN 1.200 / DN 1.000');
    expect(formatDN('DN 1600 / DN 1400 / DN 800 / DN 700 / DN 350')).toBe(
      'DN 1.600 / DN 1.400 / DN 800 / DN 700 / DN 350'
    );
  });

  it('normalizes spacing and casing around DN', () => {
    expect(formatDN('Blindaje DN 4000 / DN 2600; chimenea DN 6000; válvulas DN 2700')).toBe(
      'Blindaje DN 4.000 / DN 2.600; chimenea DN 6.000; válvulas DN 2.700'
    );
    expect(formatDN('tubería dn1600 de 360 m')).toBe('tubería DN 1.600 de 360 m');
  });

  it('leaves non-DN numbers untouched', () => {
    expect(formatDN('2.448 t de peso total')).toBe('2.448 t de peso total');
    expect(formatDN('550 m de tubería')).toBe('550 m de tubería');
    expect(formatDN('sin diametros')).toBe('sin diametros');
  });
});
