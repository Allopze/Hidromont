import { describe, expect, it } from 'vitest';
import { campoTituloDe, sePuedeVaciar, seccionesDeFicha } from '../scripts/cms/overlay/secciones';
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
    const visibles = SERVICIO.filter((k) => k !== 'procesos');
    expect(todas.sort()).toEqual([...visibles, 'campoNuevo'].sort());
    expect(secciones[1].claves).toContain('campoNuevo');
  });

  it('no ofrece los campos que ninguna página muestra', () => {
    const servicio = seccionesDeFicha('servicio', SERVICIO).flatMap((s) => s.claves);
    expect(servicio).not.toContain('procesos');
    const proyecto = seccionesDeFicha('proyecto', ['nombre', 'alcance', 'anio', 'peso']).flatMap(
      (s) => s.claves
    );
    expect(proyecto).not.toContain('anio');
    expect(proyecto).toContain('peso');
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

describe('sePuedeVaciar', () => {
  it('no ofrece vaciar los campos que el sitio siempre pinta en una ficha', () => {
    expect(sePuedeVaciar('servicio', 'titulo', 'text')).toBe(false);
    expect(sePuedeVaciar('servicio', 'resumen', 'textarea')).toBe(false);
    expect(sePuedeVaciar('proyecto', 'nombre', 'text')).toBe(false);
    expect(sePuedeVaciar('proyecto', 'alcance', 'textarea')).toBe(false);
  });

  it('no ofrece vaciar imágenes, listas ni cuerpos con formato', () => {
    expect(sePuedeVaciar('page', 'image', 'image')).toBe(false);
    expect(sePuedeVaciar('servicio', 'tipos', 'list')).toBe(false);
    expect(sePuedeVaciar('proyecto', 'body', 'richtext')).toBe(false);
    // El video se quita con su propio botón; el icono, eligiendo otro.
    expect(sePuedeVaciar('settings', 'video', 'video')).toBe(false);
    expect(sePuedeVaciar('servicio', 'iconoPropio', 'icono')).toBe(false);
  });

  it('sí lo ofrece en los datos opcionales y en los textos de página', () => {
    expect(sePuedeVaciar('proyecto', 'peso', 'text')).toBe(true);
    expect(sePuedeVaciar('page', 'title', 'text')).toBe(true);
    expect(sePuedeVaciar('page', 'subtitle', 'textarea')).toBe(true);
  });
});
