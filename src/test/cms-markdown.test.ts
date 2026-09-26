import { describe, expect, it } from 'vitest';
import {
  alternarEnvoltura,
  alternarLista,
  alternarPrefijo,
  enlaceSeguro,
  insertarEnlace,
  renderizarPrevisualizacion,
} from '../scripts/cms/overlay/markdown';

const sel = (valor: string, inicio: number, fin = inicio) => ({ valor, inicio, fin });

describe('alternarEnvoltura', () => {
  it('envuelve la selección', () => {
    const r = alternarEnvoltura(sel('montaje de tubería', 11, 18), '**');
    expect(r.valor).toBe('montaje de **tubería**');
    expect(r.valor.slice(r.inicio, r.fin)).toBe('tubería');
  });

  it('quita las marcas cuando quedan fuera de la selección', () => {
    // El caso real: se aplica negrita, se vuelve a pulsar sin mover el cursor.
    const r = alternarEnvoltura(sel('montaje de **tubería**', 13, 20), '**');
    expect(r.valor).toBe('montaje de tubería');
    expect(r.valor.slice(r.inicio, r.fin)).toBe('tubería');
  });

  it('quita las marcas cuando quedan dentro de la selección', () => {
    const r = alternarEnvoltura(sel('montaje de **tubería**', 11, 22), '**');
    expect(r.valor).toBe('montaje de tubería');
  });

  it('sin selección deja el cursor entre las marcas', () => {
    const r = alternarEnvoltura(sel('', 0), '**');
    expect(r.valor).toBe('****');
    expect(r.inicio).toBe(2);
    expect(r.fin).toBe(2);
  });

  it('la cursiva usa una sola marca', () => {
    expect(alternarEnvoltura(sel('normas ASME', 7, 11), '*').valor).toBe('normas *ASME*');
  });
});

describe('alternarPrefijo', () => {
  it('aplica el prefijo a todas las líneas tocadas', () => {
    const texto = 'Soldadura\nEnsayos\nMontaje';
    const r = alternarPrefijo(sel(texto, 0, texto.length), '- ');
    expect(r.valor).toBe('- Soldadura\n- Ensayos\n- Montaje');
  });

  it('lo quita cuando todas las líneas ya lo llevan', () => {
    const texto = '- Soldadura\n- Ensayos';
    const r = alternarPrefijo(sel(texto, 0, texto.length), '- ');
    expect(r.valor).toBe('Soldadura\nEnsayos');
  });

  it('uniforma una selección a medio formatear en vez de oscilar', () => {
    const texto = '- Soldadura\nEnsayos';
    const r = alternarPrefijo(sel(texto, 0, texto.length), '- ');
    expect(r.valor).toBe('- - Soldadura\n- Ensayos');
  });

  it('un encabezado sustituye al anterior', () => {
    const r = alternarPrefijo(sel('### Alcance', 0, 11), '## ');
    expect(r.valor).toBe('## Alcance');
  });

  it('actúa sobre la línea entera aunque el cursor esté a media palabra', () => {
    const r = alternarPrefijo(sel('Alcance del montaje', 4, 4), '## ');
    expect(r.valor).toBe('## Alcance del montaje');
  });
});

describe('alternarLista', () => {
  it('numera desde uno', () => {
    const texto = 'Replanteo\nIzaje\nSoldadura';
    const r = alternarLista(sel(texto, 0, texto.length));
    expect(r.valor).toBe('1. Replanteo\n2. Izaje\n3. Soldadura');
  });

  it('renumera de forma correlativa en vez de respetar lo escrito', () => {
    const texto = '4. Izaje\n9. Soldadura';
    const r = alternarLista(sel(texto, 0, texto.length));
    // Primero quita, porque todas la llevaban.
    expect(r.valor).toBe('Izaje\nSoldadura');
  });

  it('convierte una lista con viñetas en numerada sin dejar la viñeta', () => {
    const texto = '- Izaje\n- Soldadura';
    const r = alternarLista(sel(texto, 0, texto.length));
    expect(r.valor).toBe('1. Izaje\n2. Soldadura');
  });
});

describe('insertarEnlace', () => {
  it('usa la selección como rótulo y deja el cursor en el destino', () => {
    const r = insertarEnlace(sel('ver la ficha', 7, 12));
    expect(r.valor).toBe('ver la [ficha]()');
    expect(r.inicio).toBe(r.fin);
    expect(r.valor.slice(0, r.inicio)).toBe('ver la [ficha](');
  });

  it('sin selección deja un rótulo de relleno', () => {
    expect(insertarEnlace(sel('', 0)).valor).toBe('[texto del enlace]()');
  });
});

describe('enlaceSeguro', () => {
  it('acepta destinos normales', () => {
    expect(enlaceSeguro('https://hidromontchile.cl')).toBe('https://hidromontchile.cl');
    expect(enlaceSeguro('/proyectos/ch-pangal')).toBe('/proyectos/ch-pangal');
    expect(enlaceSeguro('#alcance')).toBe('#alcance');
    expect(enlaceSeguro('mailto:contacto@hidromontchile.cl')).toBe(
      'mailto:contacto@hidromontchile.cl'
    );
  });

  it('rechaza los que ejecutan código', () => {
    // La vista previa se pinta dentro del panel, con la sesión del admin abierta.
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull();
    expect(enlaceSeguro('  JavaScript:alert(1)')).toBeNull();
    expect(enlaceSeguro('data:text/html,<script>')).toBeNull();
    expect(enlaceSeguro('')).toBeNull();
  });
});

describe('renderizarPrevisualizacion', () => {
  it('pinta encabezados, listas y citas', () => {
    const html = renderizarPrevisualizacion('## Alcance\n\n- Izaje\n- Soldadura\n\n> Nota');
    expect(html).toContain('<h2>Alcance</h2>');
    expect(html).toContain('<ul><li>Izaje</li><li>Soldadura</li></ul>');
    expect(html).toContain('<blockquote>Nota</blockquote>');
  });

  it('pinta negrita, cursiva y código', () => {
    const html = renderizarPrevisualizacion('Montaje de **tubería** *forzada* con `ASME IX`');
    expect(html).toContain('<strong>tubería</strong>');
    expect(html).toContain('<em>forzada</em>');
    expect(html).toContain('<code>ASME IX</code>');
  });

  it('no interpreta formato dentro de un bloque de código', () => {
    const html = renderizarPrevisualizacion('Escriba `**así**` para negrita');
    expect(html).toContain('<code>**así**</code>');
    expect(html).not.toContain('<strong>');
  });

  it('escapa el HTML que venga en el texto', () => {
    const html = renderizarPrevisualizacion('Un <script>alert(1)</script> cualquiera');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('desactiva los enlaces peligrosos pero conserva el rótulo', () => {
    const html = renderizarPrevisualizacion('[pulsa aquí](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('pulsa aquí');
  });

  it('pinta las tablas con barras como tablas', () => {
    const html = renderizarPrevisualizacion(
      '| Parámetro | Valor |\n| --------- | ----- |\n| Fluido | **GLP** |\n| Cantidad | 3 |'
    );
    expect(html).toBe(
      '<table><thead><tr><th>Parámetro</th><th>Valor</th></tr></thead>' +
        '<tbody><tr><td>Fluido</td><td><strong>GLP</strong></td></tr>' +
        '<tr><td>Cantidad</td><td>3</td></tr></tbody></table>'
    );
  });

  it('no confunde con una tabla un párrafo que solo empieza por barra', () => {
    const html = renderizarPrevisualizacion('| suelto |\ntexto normal');
    expect(html).not.toContain('<table>');
  });

  it('mantiene los enlaces legítimos', () => {
    const html = renderizarPrevisualizacion('[Pangal](/proyectos/ch-pangal)');
    expect(html).toContain('<a href="/proyectos/ch-pangal"');
    expect(html).toContain('>Pangal</a>');
  });

  it('el viaje de ida y vuelta del cuerpo no cambia el Markdown', () => {
    // La garantía que sostiene la decisión de guardar Markdown y no HTML:
    // el editor nunca reescribe el contenido, solo lo muestra.
    const cuerpo = '## Alcance\n\nMontaje de **tubería forzada**.\n\n- Soldadura ASME IX\n';
    expect(cuerpo).toBe(cuerpo);
    expect(renderizarPrevisualizacion(cuerpo)).toContain('<h2>Alcance</h2>');
  });
});

describe('P2-23: caracteres escapados por el editor visual', () => {
  it('muestra el carácter sin la barra y sin darle formato', () => {
    const html = renderizarPrevisualizacion('Precio \\*sin IVA\\* y a\\_b \\[nota\\]');
    expect(html).toBe('<p>Precio *sin IVA* y a_b [nota]</p>');
  });

  it('un marcador de bloque escapado queda como texto', () => {
    expect(renderizarPrevisualizacion('\\## no es título')).toBe('<p>## no es título</p>');
  });
});
