import { describe, expect, it } from 'vitest';
import {
  clavesDeGrupos,
  convertirValor,
  esClaveLarga,
  etiquetaDeClave,
  formaDeLista,
  grupoVacio,
  tiposDeClaves,
} from '../scripts/cms/overlay/listas';

const PROCESOS = [
  { titulo: 'Ingeniería', descripcion: 'Diseño 3D en CAD y análisis por elementos finitos.' },
  { titulo: 'Montaje', descripcion: 'Instalación en obra.' },
];

describe('formaDeLista', () => {
  it('reconoce la lista de procesos como grupos, no como textos', () => {
    // La regresión: se pintaba con String(item) y guardaba «[object Object]».
    expect(formaDeLista(PROCESOS)).toBe('grupos');
  });

  it('las listas de textos siguen siendo textos', () => {
    expect(formaDeLista(['DIN 19705-1', 'ASME'])).toBe('textos');
  });

  it('una lista vacía de procesos se edita como grupos', () => {
    expect(formaDeLista([], 'procesos')).toBe('grupos');
    expect(formaDeLista([], 'normas')).toBe('textos');
  });

  it('lo que no puede editarse sin riesgo queda fijo', () => {
    expect(formaDeLista(['texto', { titulo: 'grupo' }])).toBe('fija');
    expect(formaDeLista([{ fotos: ['a.jpg'] }])).toBe('fija');
  });
});

describe('claves y tipos de los grupos', () => {
  it('conserva el orden de las claves', () => {
    expect(clavesDeGrupos(PROCESOS)).toEqual(['titulo', 'descripcion']);
    expect(clavesDeGrupos([], 'procesos')).toEqual(['titulo', 'descripcion']);
  });

  it('un número sigue siendo número al guardar', () => {
    const tipos = tiposDeClaves([{ nombre: 'A', anio: 1997 }], ['nombre', 'anio']);
    expect(tipos).toEqual({ nombre: 'text', anio: 'number' });
    expect(convertirValor('number', '2004')).toBe(2004);
    expect(convertirValor('number', '')).toBeNull();
    expect(convertirValor('text', 'Montaje')).toBe('Montaje');
    expect(grupoVacio(['nombre', 'anio'], tipos)).toEqual({ nombre: '', anio: null });
  });
});

describe('rótulos', () => {
  it('traduce las claves conocidas y humaniza el resto', () => {
    expect(etiquetaDeClave('titulo')).toBe('Título');
    expect(etiquetaDeClave('descripcion')).toBe('Descripción');
    expect(etiquetaDeClave('fecha_inicio')).toBe('Fecha inicio');
  });

  it('la descripción se escribe en varias líneas', () => {
    expect(esClaveLarga(PROCESOS, 'descripcion')).toBe(true);
    expect(esClaveLarga(PROCESOS, 'titulo')).toBe(false);
  });
});
