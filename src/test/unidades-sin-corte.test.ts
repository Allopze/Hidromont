import { describe, expect, it } from 'vitest';
import { unirTexto, unirUnidades } from '../utils/unidadesSinCorte.mjs';

const N = ' ';

describe('unirTexto', () => {
  it('une la cifra con su unidad', () => {
    expect(unirTexto('5,5 m de ancho y 40 t por conjunto')).toBe(
      `5,5${N}m de ancho y 40${N}t por conjunto`
    );
    expect(unirTexto('3.000 mm, 20 m.c.a. y 5 MW.')).toBe(`3.000${N}mm, 20${N}m.c.a. y 5${N}MW.`);
    expect(unirTexto('120 m² y 300 galones')).toBe(`120${N}m² y 300${N}galones`);
  });

  it('no confunde una unidad con el comienzo de una palabra', () => {
    expect(unirTexto('5 tableros y 2 compuertas')).toBe('5 tableros y 2 compuertas');
    expect(unirTexto('2 montajes, 3 metrologías')).toBe('2 montajes, 3 metrologías');
  });

  it('une los prefijos y las medidas compuestas', () => {
    expect(unirTexto('DN 600 PN 16 y Ø 2.600')).toBe(`DN${N}600 PN${N}16 y Ø${N}2.600`);
    expect(unirTexto('2.500 x 3.000 mm')).toBe(`2.500${N}x${N}3.000${N}mm`);
  });
});

describe('unirUnidades', () => {
  it('solo toca el texto visible', () => {
    const html = '<p title="5 m">Tramo de 5 m</p><script>const a = "5 m";</script><code>5 m</code>';
    expect(unirUnidades(html)).toBe(
      `<p title="5 m">Tramo de 5${N}m</p><script>const a = "5 m";</script><code>5 m</code>`
    );
  });
});
