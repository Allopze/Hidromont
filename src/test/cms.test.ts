import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

// getCmsText lee este JSON al importarse, así que lo mockeamos para poder
// construir los casos límite (clave vacía, clave ausente, campo de imagen)
// sin depender del contenido real del sitio.
vi.mock('../data/cms-content.json', () => ({
  default: {
    entries: {
      'test.entry': {
        fields: {
          conTexto: { type: 'text', value: 'Texto real' },
          vacio: { type: 'text', value: '' },
          vacioTextarea: { type: 'textarea', value: '' },
          imagenVacia: { type: 'image', value: '' },
          imagen: { type: 'image', value: '/fotos/real.webp' },
          noEsString: { type: 'text', value: 42 },
        },
      },
      'test.imagen': {
        fields: {
          image: { type: 'image', value: '' },
          imageAlt: { type: 'text', value: '' },
          imageWidth: { type: 'number', value: 800 },
        },
      },
    },
  },
}));

const { getCmsText, getCmsImage } = await import('../data/cms');

// warnIfMissing escribe en consola cuando la clave no existe (solo en DEV, y
// vitest corre en DEV). Lo silenciamos para no ensuciar la salida del test.
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  warnSpy.mockRestore();
});

describe('getCmsText', () => {
  it('devuelve el valor del CMS cuando la clave tiene texto', () => {
    expect(getCmsText('test.entry', 'conTexto', 'fallback')).toBe('Texto real');
  });

  it('devuelve cadena vacía cuando la clave existe pero está vacía', () => {
    // El caso que motivó el cambio: vaciar un campo en el panel del CMS tiene
    // que borrar el texto del sitio. Antes reaparecía el fallback del código y
    // no había forma de eliminar un rótulo sin editar el .astro.
    expect(getCmsText('test.entry', 'vacio', 'Casos de referencia')).toBe('');
    expect(getCmsText('test.entry', 'vacioTextarea', 'Bajada por defecto')).toBe('');
  });

  it('usa el fallback cuando la clave no existe', () => {
    expect(getCmsText('test.entry', 'noExiste', 'fallback')).toBe('fallback');
  });

  it('usa el fallback cuando la entrada completa no existe', () => {
    expect(getCmsText('entrada.inexistente', 'campo', 'fallback')).toBe('fallback');
  });

  it('usa el fallback cuando el valor no es un string', () => {
    expect(getCmsText('test.entry', 'noEsString', 'fallback')).toBe('fallback');
  });

  it('usa el fallback en campos de tipo image aunque estén vacíos', () => {
    // Una ruta vacía no significa "sin texto" sino <img src="">, que hace al
    // navegador volver a pedir la página actual. Los campos image conservan el
    // comportamiento antiguo.
    expect(getCmsText('test.entry', 'imagenVacia', '/fotos/defecto.webp')).toBe(
      '/fotos/defecto.webp'
    );
  });

  it('respeta el valor de un campo image no vacío', () => {
    expect(getCmsText('test.entry', 'imagen', '/fotos/defecto.webp')).toBe('/fotos/real.webp');
  });
});

describe('getCmsImage', () => {
  it('cae al fallback cuando el src guardado está vacío', () => {
    const img = getCmsImage('test.imagen', {
      src: '/fotos/defecto.webp',
      alt: 'Alt por defecto',
      width: 1200,
      height: 630,
    });
    expect(img.src).toBe('/fotos/defecto.webp');
    expect(img.width).toBe(800); // este sí viene del CMS
    expect(img.height).toBe(630);
  });
});
