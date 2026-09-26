/**
 * P2-22 (auditoría 2026-09): el panel nombraba las fichas con su título
 * interno («Hero home», «Header», «Galería proyecto ch-besaya»).
 */
import { describe, expect, it } from 'vitest';
import { nombreDeFicha } from '../data/entry-names';

describe('nombreDeFicha', () => {
  it('nombra las fichas de página por la página y la parte', () => {
    expect(nombreDeFicha('home.hero', 'Hero home')).toBe('Portada — cabecera');
    expect(nombreDeFicha('layout.header', 'Header')).toBe('Cabecera y menú');
    expect(nombreDeFicha('proyectos.index.banco', 'Banco proyectos')).toBe(
      'Proyectos — listado de proyectos'
    );
  });

  it('las fotos de proyectos y servicios dicen de qué son', () => {
    expect(nombreDeFicha('project-image.ch-besaya', 'Imagen proyecto C.H. Besaya')).toBe(
      'Foto del proyecto C.H. Besaya'
    );
    expect(nombreDeFicha('project-gallery.ch-besaya', 'Galería proyecto ch-besaya')).toBe(
      'Fotos del proyecto C.H. Besaya'
    );
    expect(nombreDeFicha('service-gallery.tanques-especiales')).toBe(
      'Fotos del servicio Tanques Especiales'
    );
  });

  it('servicios y proyectos conservan su título, que es el del sitio', () => {
    expect(nombreDeFicha('servicios.compuertas', 'Compuertas')).toBe('Compuertas');
    expect(nombreDeFicha('proyectos.ch-pangal')).toBe('Proyecto C.H. Pangal');
  });

  it('una ficha desconocida conserva su título', () => {
    expect(nombreDeFicha('otra.cosa', 'Algo nuevo')).toBe('Algo nuevo');
  });
});
