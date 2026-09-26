import { describe, expect, it } from 'vitest';
import { coincide, normalizarBusqueda as n } from '../utils/busqueda';

describe('P2-30: búsqueda de proyectos', () => {
  const indice = n('Embalse Ancoa Tubería Ø 1.600 C.H. Ralco Colbún Biobío');
  it.each([
    'Ø 1.600',
    '1600',
    'ø1600',
    'ø 1600',
    'C.H. Ralco',
    'CH Ralco',
    'ch ralco',
    'colbun',
    'BIOBÍO',
    'ralco ancoa',
  ])('«%s» encuentra la ficha', (consulta) => {
    expect(coincide(indice, n(consulta))).toBe(true);
  });
  it('una palabra que no está no coincide', () => {
    expect(coincide(indice, n('pangal'))).toBe(false);
  });
  it('lo que no es texto no rompe nada', () => {
    expect(n('<script>%"')).toBe('script');
  });
});
