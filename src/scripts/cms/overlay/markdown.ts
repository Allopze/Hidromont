/**
 * Lógica del editor de texto con formato. Sin DOM: todo lo de este archivo es
 * transformación de cadenas, para que se pueda probar sin navegador.
 *
 * El formato guardado es Markdown, no HTML, y eso es deliberado. El campo
 * `richtext` del CMS es el cuerpo de `src/content/servicios/*.md` y
 * `src/content/proyectos/*.md`: entra por `matter.read` al importar y sale por
 * `matter.stringify` al exportar. Un editor que guardara HTML obligaría a
 * convertir HTML→Markdown en cada guardado, que es justo donde se pierde
 * fidelidad, y lo haría sobre 48 fichas que ya existen. Editando Markdown, el
 * viaje de ida y vuelta es la identidad.
 */

/** Un bloque de texto seleccionado dentro del área de edición. */
export interface Seleccion {
  valor: string;
  inicio: number;
  fin: number;
}

/** El resultado de aplicar un formato: texto nuevo y dónde queda el cursor. */
export interface Resultado {
  valor: string;
  inicio: number;
  fin: number;
}

/**
 * Envuelve la selección entre dos marcas, o las quita si ya están puestas.
 *
 * El comportamiento de quitar importa más de lo que parece: sin él, pulsar
 * «negrita» dos veces sobre la misma palabra deja `****texto****`, que
 * Markdown no interpreta como nada y el operador no sabe deshacer.
 */
export function alternarEnvoltura(sel: Seleccion, marca: string): Resultado {
  const { valor, inicio, fin } = sel;
  const dentro = valor.slice(inicio, fin);
  const largo = marca.length;

  // Ya envuelto por fuera de la selección: «**[texto]**»
  const antes = valor.slice(Math.max(0, inicio - largo), inicio);
  const despues = valor.slice(fin, fin + largo);
  if (antes === marca && despues === marca) {
    return {
      valor: valor.slice(0, inicio - largo) + dentro + valor.slice(fin + largo),
      inicio: inicio - largo,
      fin: fin - largo,
    };
  }

  // Ya envuelto por dentro de la selección: «[**texto**]»
  if (dentro.length >= largo * 2 && dentro.startsWith(marca) && dentro.endsWith(marca)) {
    const limpio = dentro.slice(largo, -largo);
    return {
      valor: valor.slice(0, inicio) + limpio + valor.slice(fin),
      inicio,
      fin: inicio + limpio.length,
    };
  }

  // Sin selección: deja el cursor entre las dos marcas, listo para escribir.
  if (inicio === fin) {
    return {
      valor: valor.slice(0, inicio) + marca + marca + valor.slice(fin),
      inicio: inicio + largo,
      fin: inicio + largo,
    };
  }

  return {
    valor: valor.slice(0, inicio) + marca + dentro + marca + valor.slice(fin),
    inicio: inicio + largo,
    fin: fin + largo,
  };
}

/** El índice donde empieza la línea que contiene `pos`. */
function inicioDeLinea(valor: string, pos: number): number {
  const salto = valor.lastIndexOf('\n', Math.max(0, pos - 1));
  return salto === -1 ? 0 : salto + 1;
}

/** El índice donde termina la línea que contiene `pos`. */
function finDeLinea(valor: string, pos: number): number {
  const salto = valor.indexOf('\n', pos);
  return salto === -1 ? valor.length : salto;
}

/**
 * Aplica un prefijo de línea (`## `, `- `, `> `) a todas las líneas tocadas
 * por la selección, o lo quita si ya lo llevan todas.
 *
 * Que el criterio sea «todas» y no «alguna» evita el caso molesto de una
 * selección medio formateada: la primera pulsación la uniforma, la segunda la
 * limpia. Con «alguna» se quedaba oscilando.
 */
export function alternarPrefijo(sel: Seleccion, prefijo: string): Resultado {
  const { valor } = sel;
  const desde = inicioDeLinea(valor, sel.inicio);
  const hasta = finDeLinea(valor, sel.fin);
  const lineas = valor.slice(desde, hasta).split('\n');

  // Un encabezado sustituye a otro: «## » sobre «### » no da «## ### ».
  const otroEncabezado = /^#{1,6} /;
  const esEncabezado = /^#{1,6} $/.test(prefijo);

  const todasLoLlevan = lineas.every((l) => l.startsWith(prefijo));
  const nuevas = lineas.map((linea) => {
    if (todasLoLlevan) return linea.slice(prefijo.length);
    const limpia = esEncabezado ? linea.replace(otroEncabezado, '') : linea;
    return prefijo + limpia;
  });

  const bloque = nuevas.join('\n');
  return {
    valor: valor.slice(0, desde) + bloque + valor.slice(hasta),
    inicio: desde,
    fin: desde + bloque.length,
  };
}

/**
 * Numera las líneas seleccionadas, o les quita la numeración.
 *
 * Se renumera siempre desde 1 en vez de conservar lo escrito: si el operador
 * borra un punto intermedio, lo que quiere es que la lista vuelva a ser
 * correlativa, no respetar un 4 huérfano.
 */
export function alternarLista(sel: Seleccion): Resultado {
  const { valor } = sel;
  const desde = inicioDeLinea(valor, sel.inicio);
  const hasta = finDeLinea(valor, sel.fin);
  const lineas = valor.slice(desde, hasta).split('\n');
  const numerada = /^\d+\. /;

  const todasLoLlevan = lineas.every((l) => numerada.test(l));
  const nuevas = lineas.map((linea, i) =>
    todasLoLlevan ? linea.replace(numerada, '') : `${i + 1}. ${linea.replace(/^- /, '')}`
  );

  const bloque = nuevas.join('\n');
  return {
    valor: valor.slice(0, desde) + bloque + valor.slice(hasta),
    inicio: desde,
    fin: desde + bloque.length,
  };
}

/**
 * Inserta un enlace Markdown.
 *
 * Si hay texto seleccionado se convierte en el rótulo y el cursor queda sobre
 * el destino, que es lo que falta por escribir.
 */
export function insertarEnlace(sel: Seleccion, href = ''): Resultado {
  const { valor, inicio, fin } = sel;
  const rotulo = valor.slice(inicio, fin) || 'texto del enlace';
  const fragmento = `[${rotulo}](${href})`;
  const posHref = inicio + rotulo.length + 3;
  return {
    valor: valor.slice(0, inicio) + fragmento + valor.slice(fin),
    inicio: posHref,
    fin: posHref + href.length,
  };
}

/** Escapa lo que va a entrar en HTML como texto. */
function escapar(texto: string): string {
  return texto.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c] as string
  );
}

/**
 * Solo se aceptan destinos que no puedan ejecutar código.
 *
 * La vista previa pinta lo que el operador escribe, así que un
 * `[pulsa](javascript:...)` se convertiría en un enlace activo dentro del
 * panel de administración, con su sesión abierta. Se permiten rutas
 * relativas, anclas, http(s) y mailto; cualquier otra cosa pierde el enlace y
 * conserva el rótulo.
 */
export function enlaceSeguro(href: string): string | null {
  const limpio = href.trim();
  if (!limpio) return null;
  if (/^(https?:|mailto:)/i.test(limpio)) return limpio;
  if (/^[/#]/.test(limpio)) return limpio;
  return null;
}

/**
 * Markdown → HTML, solo para la vista previa del panel.
 *
 * No pretende ser un analizador completo: cubre lo que aparece en las fichas
 * de servicios y proyectos (encabezados, negrita, cursiva, código, listas,
 * citas, enlaces y tablas) y nada más. Lo que no reconoce lo deja como texto escapado,
 * que es el modo correcto de fallar aquí: se ve raro, pero no ejecuta nada.
 *
 * El HTML del sitio lo sigue generando Astro al compilar; esto nunca se
 * publica.
 */
export function renderizarPrevisualizacion(markdown: string): string {
  const bloques = markdown.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const salida: string[] = [];

  for (const bruto of bloques) {
    const bloque = bruto.trim();
    if (!bloque) continue;

    const encabezado = bloque.match(/^(#{1,6}) (.*)$/);
    if (encabezado) {
      const nivel = encabezado[1].length;
      salida.push(`<h${nivel}>${enLinea(encabezado[2])}</h${nivel}>`);
      continue;
    }

    const lineas = bloque.split('\n');

    if (lineas.every((l) => /^- /.test(l))) {
      const items = lineas.map((l) => `<li>${enLinea(l.slice(2))}</li>`).join('');
      salida.push(`<ul>${items}</ul>`);
      continue;
    }

    if (lineas.every((l) => /^\d+\. /.test(l))) {
      const items = lineas.map((l) => `<li>${enLinea(l.replace(/^\d+\. /, ''))}</li>`).join('');
      salida.push(`<ol>${items}</ol>`);
      continue;
    }

    // Tablas con barras: las fichas de los tanques de GLP llevan una. Sin esto
    // la vista previa —y la página, al guardar desde ella— mostraba las barras.
    if (
      lineas.length >= 2 &&
      lineas.every((l) => /^\|.*\|$/.test(l.trim())) &&
      /^\|[\s:|-]+\|$/.test(lineas[1].trim())
    ) {
      const celdas = (l: string) =>
        l
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
      const cabecera = celdas(lineas[0])
        .map((c) => `<th>${enLinea(c)}</th>`)
        .join('');
      const filas = lineas
        .slice(2)
        .map(
          (l) =>
            `<tr>${celdas(l)
              .map((c) => `<td>${enLinea(c)}</td>`)
              .join('')}</tr>`
        )
        .join('');
      salida.push(`<table><thead><tr>${cabecera}</tr></thead><tbody>${filas}</tbody></table>`);
      continue;
    }

    if (lineas.every((l) => /^> ?/.test(l))) {
      const texto = lineas.map((l) => l.replace(/^> ?/, '')).join(' ');
      salida.push(`<blockquote>${enLinea(texto)}</blockquote>`);
      continue;
    }

    salida.push(`<p>${enLinea(lineas.join('\n'))}</p>`);
  }

  return salida.join('\n');
}

/**
 * Formato dentro de una línea.
 *
 * El código va primero y se aparta a un marcador: dentro de `` `...` `` no
 * debe interpretarse nada, y si se procesara junto al resto un `**` escrito
 * dentro de un ejemplo de código saldría en negrita.
 */
function enLinea(texto: string): string {
  // El marcador usa un carácter de uso privado (U+E000), que no puede
  // aparecer en un texto escrito por el operador ni tiene significado en HTML.
  const MARCA = '\uE000';
  const codigos: string[] = [];
  const conMarcadores = texto.replace(/`([^`]+)`/g, (_, contenido) => {
    codigos.push(`<code>${escapar(contenido)}</code>`);
    return `${MARCA}${codigos.length - 1}${MARCA}`;
  });

  let html = escapar(conMarcadores)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  // `_completo` es la coincidencia entera, que `String.replace` pasa siempre y
  // aquí no se usa: se reconstruye el enlace desde el rótulo y el destino. El
  // prefijo `_` es el convenio que ya siguen ESLint y TypeScript en este repo.
  html = html.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_completo, rotulo, href) => {
    const destino = enlaceSeguro(href);
    if (!destino) return rotulo;
    return `<a href="${escapar(destino)}" rel="noopener noreferrer" target="_blank">${rotulo}</a>`;
  });

  return html
    .replace(/\n/g, '<br />')
    .replace(new RegExp(`${MARCA}(\\d+)${MARCA}`, 'g'), (_, i) => codigos[Number(i)]);
}
