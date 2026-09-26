import { describe, expect, it } from 'vitest';
import { resumirDescripcion } from '../utils/seo';

describe('P3-06: resumirDescripcion', () => {
  it('deja igual lo que ya cabe', () => {
    expect(resumirDescripcion('Montaje de compuertas.')).toBe('Montaje de compuertas.');
  });
  it('corta por la última frase completa que quepa', () => {
    const texto = `${'Primera frase con bastante contenido para superar ochenta caracteres de largo aquí'}. Segunda frase que ya no cabe entera dentro del límite de ciento cincuenta y cinco caracteres.`;
    const r = resumirDescripcion(texto);
    expect(r.length).toBeLessThanOrEqual(155);
    expect(r.endsWith('aquí.')).toBe(true);
  });
  it('si no hay frase corta, corta por palabra y añade «…»', () => {
    const r = resumirDescripcion('palabra '.repeat(40));
    expect(r.length).toBeLessThanOrEqual(155);
    expect(r.endsWith('palabra…')).toBe(true);
  });
});
