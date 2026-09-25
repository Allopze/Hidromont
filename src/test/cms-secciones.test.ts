import { describe, expect, it } from 'vitest';
import { campoTituloDe, seccionesDeFicha } from '../scripts/cms/overlay/secciones';
import { fichaDeRuta } from '../scripts/cms/overlay/rutas';

const SERVICIO = [
  'aplicaciones',
  'body',
  'icono',
  'normas',
  'orden',
  'procesos',
  'resumen',
  'tipos',
  'titulo',
];

describe('seccionesDeFicha', () => {
  it('pone el título del servicio primero, no al final del alfabeto', () => {
    const secciones = seccionesDeFicha('servicio', SERVICIO);
    expect(secciones.map((s) => s.titulo)).toEqual([
      'Contenido',
      'Detalles del servicio',
      'Cómo aparece en el sitio',
    ]);
    expect(secciones[0].claves).toEqual(['titulo', 'resumen', 'body']);
  });

  it('ningún campo desaparece por no estar en el plan', () => {
    const secciones = seccionesDeFicha('servicio', [...SERVICIO, 'campoNuevo']);
    const todas = secciones.flatMap((s) => s.claves);
    expect(todas.sort()).toEqual([...SERVICIO, 'campoNuevo'].sort());
    expect(secciones[1].claves).toContain('campoNuevo');
  });

  it('omite las secciones vacías y deja las páginas en una sola', () => {
    expect(seccionesDeFicha('servicio', ['titulo']).length).toBe(1);
    expect(seccionesDeFicha('page', ['title', 'lead'])).toEqual([
      { titulo: '', claves: ['title', 'lead'] },
    ]);
  });

  it('sabe qué campo es el título que muestra el sitio', () => {
    expect(campoTituloDe('servicio', SERVICIO)).toBe('titulo');
    expect(campoTituloDe('proyecto', ['nombre', 'alcance'])).toBe('nombre');
    expect(campoTituloDe('proyecto', ['alcance'])).toBeNull();
    expect(campoTituloDe('page', ['title'])).toBeNull();
  });
});

describe('fichaDeRuta', () => {
  it('reconoce las fichas de servicios y proyectos', () => {
    expect(fichaDeRuta('/servicios/compuertas/')).toMatchObject({
      kind: 'servicio',
      slug: 'compuertas',
    });
    expect(fichaDeRuta('/proyectos/ch-aillin')).toMatchObject({
      kind: 'proyecto',
      slug: 'ch-aillin',
    });
  });

  it('no confunde los índices ni otras páginas con una ficha', () => {
    expect(fichaDeRuta('/servicios/')).toBeNull();
    expect(fichaDeRuta('/proyectos')).toBeNull();
    expect(fichaDeRuta('/empresa/')).toBeNull();
    expect(fichaDeRuta('/')).toBeNull();
  });
});
