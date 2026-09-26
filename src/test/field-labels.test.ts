/**
 * E-3 — El panel rotulaba cada campo con su clave de la base. Estos tests
 * fijan las tres capas de `fieldLabel` y, sobre todo, que ninguna clave real
 * del proyecto se quede sin rótulo legible: la comprobación se hace contra las
 * claves que siembra `defaultContent.ts`, que es la lista que de verdad llega a
 * una base nueva.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIELD_LABELS, fieldLabel } from '../data/field-labels';

describe('fieldLabel', () => {
  it('usa el diccionario para las claves conocidas', () => {
    expect(fieldLabel('seoDescription')).toBe('Descripción para buscadores');
    expect(fieldLabel('eyebrow')).toBe('Texto pequeño sobre el título');
    expect(fieldLabel('orden')).toBe('Orden de aparición');
    expect(fieldLabel('alcance')).toBe('Alcance de los trabajos');
  });

  it('resuelve las familias numeradas', () => {
    expect(fieldLabel('gallery2Alt')).toBe('Foto de la galería 2 · texto alternativo');
    expect(fieldLabel('gallery3')).toBe('Foto de la galería 3');
    expect(fieldLabel('card1Label')).toBe('Tarjeta 1 · rótulo');
    expect(fieldLabel('card4Value')).toBe('Tarjeta 4 · valor');
    expect(fieldLabel('item5Desc')).toBe('Punto 5 · descripción');
    expect(fieldLabel('item7')).toBe('Punto 7');
    expect(fieldLabel('p2Title')).toBe('Párrafo 2 · título');
  });

  it('resuelve menús y enlaces por sección', () => {
    expect(fieldLabel('navGaleria')).toBe('Menú · Galería');
    expect(fieldLabel('hrefContacto')).toBe('Enlace · Contacto');
    expect(fieldLabel('navServiciosLimpiarrejas')).toBe('Menú · Servicios · Limpiarrejas');
    expect(fieldLabel('hrefServiciosTuberias')).toBe('Enlace · Servicios · Tuberías');
  });

  it('resuelve los logos de clientes', () => {
    expect(fieldLabel('logo-acciona')).toBe('Logo · Acciona');
    expect(fieldLabel('logo-aes-andes')).toBe('Logo · Aes Andes');
  });

  it('resuelve los sufijos del formulario', () => {
    // P2-22: con el nombre que ve el visitante, no la clave en inglés.
    expect(fieldLabel('nameLabel')).toBe('Nombre del campo «Nombre»');
    expect(fieldLabel('companyLabel')).toBe('Nombre del campo «Empresa»');
    expect(fieldLabel('emailPlaceholder')).toBe('Texto de ejemplo del campo «Correo»');
    expect(fieldLabel('phonePlaceholder')).toBe('Texto de ejemplo del campo «Teléfono»');
    expect(fieldLabel('messageRequiredError')).toBe('Error si «Mensaje» está vacío');
    expect(fieldLabel('emailInvalidError')).toBe('Error si «Correo» no es válido');
    expect(fieldLabel('nameTooShortError')).toBe('Error si «Nombre» es demasiado corto');
    expect(fieldLabel('genericTooShortError')).toBe('Error si un campo es demasiado corto');
  });

  it('humaniza cualquier clave desconocida en vez de devolverla cruda', () => {
    expect(fieldLabel('campoInventadoNuevo')).toBe('Campo inventado nuevo');
    expect(fieldLabel('otro_campo-raro')).toBe('Otro campo raro');
    // Nunca vacío, ni siquiera con una clave degenerada.
    expect(fieldLabel('___')).toBe('___');
    expect(fieldLabel('x')).toBe('X');
  });

  /**
   * La red de seguridad: toda clave que el proyecto siembra tiene que salir
   * distinta de su propia clave. Si alguien añade un campo con un nombre que
   * ninguna regla reconoce, este test lo dice antes de que el editor se
   * encuentre `miCampoRaro` como rótulo.
   *
   * Se excluyen a propósito las claves cuyo nombre ya ES la palabra legible
   * (`title`, `email`): humanizarlas devuelve la misma cadena capitalizada y
   * eso está bien.
   */
  it('ninguna clave sembrada se queda sin rótulo legible', () => {
    const seed = readFileSync('cms/content/defaultContent.ts', 'utf8');
    // Las claves aparecen como `nombreClave: { type: ...` dentro de `fields`.
    const claves = [
      ...new Set(
        [...seed.matchAll(/^\s{4,}'?([A-Za-z][A-Za-z0-9_-]*)'?:\s*\{\s*type:/gm)].map((m) => m[1])
      ),
    ];
    expect(claves.length).toBeGreaterThan(100);

    const sinRotulo = claves.filter((key) => {
      const label = fieldLabel(key);
      if (!label) return true;
      // Un rótulo que solo capitaliza la clave de una palabra es aceptable.
      const soloCapitalizada = label.toLowerCase() === key.toLowerCase();
      return soloCapitalizada && !FIELD_LABELS[key];
    });
    expect(sinRotulo).toEqual([]);
  });

  /**
   * P2-22 (auditoría 2026-09): «Rótulo del campo company», «Error si generic
   * es demasiado corto». Ningún rótulo de una clave sembrada puede llevar una
   * palabra en inglés de las que forman las claves.
   */
  it('ningún rótulo sembrado deja a la vista una clave en inglés', () => {
    const seed = readFileSync('cms/content/defaultContent.ts', 'utf8');
    const claves = [
      ...new Set(
        [...seed.matchAll(/^\s{4,}'?([A-Za-z][A-Za-z0-9_-]*)'?:\s*\{\s*type:/gm)].map((m) => m[1])
      ),
    ];
    const INGLES =
      /\b(name|company|email|phone|message|generic|label|placeholder|title|subtitle|value|desc|href|alt|image|button|link|required|invalid|body|text)\b/i;
    const conIngles = claves
      .map((key) => [key, fieldLabel(key)] as const)
      .filter(([, label]) => INGLES.test(label));
    expect(conIngles).toEqual([]);
  });
});
