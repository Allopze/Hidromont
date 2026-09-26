import { describe, expect, it } from 'vitest';
import { formatDiameters } from '../utils/format';

describe('formatDiameters', () => {
  it('adds Chilean thousands separators to DN values', () => {
    expect(formatDiameters('DN 2200')).toBe('DN 2.200');
    expect(formatDiameters('DN 1200 / DN 1000')).toBe('DN 1.200 / DN 1.000');
    expect(formatDiameters('DN 1600 / DN 1400 / DN 800 / DN 700 / DN 350')).toBe(
      'DN 1.600 / DN 1.400 / DN 800 / DN 700 / DN 350'
    );
  });

  it('formats Ø the same way and unifies the ∅ variant', () => {
    expect(formatDiameters('Ø 4000 / Ø 2600')).toBe('Ø 4.000 / Ø 2.600');
    expect(formatDiameters('Blindaje Ø5500')).toBe('Blindaje Ø 5.500');
    expect(formatDiameters('∅ 18800')).toBe('Ø 18.800');
    expect(formatDiameters('Ø 1.016')).toBe('Ø 1.016');
  });

  it('normalizes spacing and casing around the prefix', () => {
    expect(formatDiameters('Blindaje Ø 4000 / Ø 2600; válvulas mariposa DN 2700')).toBe(
      'Blindaje Ø 4.000 / Ø 2.600; válvulas mariposa DN 2.700'
    );
    expect(formatDiameters('tubería dn1600 de 360 m')).toBe('tubería DN 1.600 de 360 m');
  });

  it('leaves decimals alone so they are not regrouped into another number', () => {
    expect(formatDiameters('Ø 2,4 m')).toBe('Ø 2,4 m');
    expect(formatDiameters('válvula de 1,2 x 1,2 m')).toBe('válvula de 1,2 x 1,2 m');
  });

  it('leaves non-diameter numbers untouched', () => {
    expect(formatDiameters('2.448 t de peso total')).toBe('2.448 t de peso total');
    expect(formatDiameters('550 m de tubería')).toBe('550 m de tubería');
    expect(formatDiameters('sin diametros')).toBe('sin diametros');
  });
});

describe('P3-09: notación de DN y Ø en el cuerpo en Markdown', () => {
  it('se aplica a los textos y respeta el código', async () => {
    const { default: rehypeDiametros } = await import('../utils/rehypeDiametros.mjs');
    const arbol = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [{ type: 'text', value: 'válvulas DN 2700 y Ø1600' }],
        },
        { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'DN 2700' }] },
      ],
    };
    rehypeDiametros()(arbol);
    expect(arbol.children[0].children[0].value).toBe('válvulas DN 2.700 y Ø 1.600');
    expect(arbol.children[1].children[0].value).toBe('DN 2700');
  });
});
