/**
 * P2-23 (auditoría 2026-09): el cuerpo de servicios y proyectos se editaba en
 * Markdown crudo. Quien edita veía `## Proyectos destacados` y `**C.H. San
 * Pedro**`, y borrar un asterisco rompía el formato en el sitio.
 *
 * Esto es un editor visual que sigue guardando Markdown. El textarea de
 * siempre queda en el formulario, oculto, como la fuente de lo que se envía:
 * cada cambio en la zona visual se traduce a Markdown y se escribe en él. Así
 * los borradores, el aviso de cambios sin guardar y el guardado no cambian.
 *
 * Solo se ofrece cuando el viaje de ida y vuelta no pierde nada: si un cuerpo
 * trae algo que este editor no sabe reproducir, se abre el editor de texto de
 * antes. Mejor ver símbolos que perder contenido sin darse cuenta.
 */

import { escapeHtml } from './html';
import { enlaceSeguro, renderizarPrevisualizacion } from './markdown';

/** Escapa lo que en Markdown tendría significado, dentro de un texto normal. */
function escaparTexto(texto) {
  return texto.replace(/([\\`*_[\]])/g, '\\$1');
}

/** Protege los marcadores de bloque al principio de una línea. */
function escaparInicioDeLinea(linea) {
  return linea
    .replace(/^(\s*)(#{1,6} )/, '$1\\$2')
    .replace(/^(\s*)([-+] )/, '$1\\$2')
    .replace(/^(\s*)(\d+)\. /, '$1$2\\. ')
    .replace(/^(\s*)>/, '$1\\>')
    .replace(/^(\s*)\|/, '$1\\|');
}

/**
 * Envuelve con `marca` sin dejar espacios pegados a ella: `** texto**` no es
 * negrita en Markdown, y el navegador suele incluir el espacio al seleccionar.
 */
function envolver(interior, marca) {
  const m = interior.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return interior;
  return `${m[1]}${marca}${m[2]}${marca}${m[3]}`;
}

/**
 * @param sinNegrita En los títulos: ya se ven en negrita, y la que arrastra
 *   el navegador al pulsar Intro tras un texto en negrita daba `## **Título**`.
 */
function enLinea(nodo, sinNegrita = false) {
  let salida = '';
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === Node.TEXT_NODE) {
      salida += escaparTexto(hijo.textContent.replace(/\u00a0/g, ' '));
      continue;
    }
    if (hijo.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = hijo.tagName;
    if (tag === 'BR') salida += '\n';
    else if (tag === 'STRONG' || tag === 'B') {
      salida += sinNegrita ? enLinea(hijo, true) : envolver(enLinea(hijo), '**');
    } else if (tag === 'EM' || tag === 'I') salida += envolver(enLinea(hijo, sinNegrita), '*');
    else if (tag === 'CODE') salida += `\`${hijo.textContent}\``;
    else if (tag === 'A') {
      const href = hijo.getAttribute('href') || '';
      const rotulo = enLinea(hijo, sinNegrita);
      salida += href ? `[${rotulo}](${href})` : rotulo;
    } else salida += enLinea(hijo, sinNegrita);
  }
  return salida;
}

/** El texto de un bloque, con cada línea protegida y sin saltos sobrantes. */
function lineas(texto) {
  return texto
    .replace(/\n+$/, '')
    .split('\n')
    .map((l) => escaparInicioDeLinea(l.replace(/\s+$/, '')))
    .join('\n');
}

function tabla(nodo) {
  const filas = [...nodo.querySelectorAll('tr')].map((tr) =>
    [...tr.children].map((celda) => enLinea(celda).replace(/\n/g, ' ').replace(/\|/g, '\\|').trim())
  );
  if (!filas.length) return '';
  const fila = (celdas) => `| ${celdas.join(' | ')} |`;
  return [fila(filas[0]), fila(filas[0].map(() => '---')), ...filas.slice(1).map(fila)].join('\n');
}

/** HTML del editor visual → Markdown. */
export function htmlAMarkdown(raiz) {
  const bloques = [];
  let suelto = null;
  const cerrarSuelto = () => {
    if (suelto !== null && suelto.trim()) bloques.push(lineas(suelto.trim()));
    suelto = null;
  };

  for (const nodo of raiz.childNodes) {
    const esBloque =
      nodo.nodeType === Node.ELEMENT_NODE &&
      /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE|TABLE)$/.test(nodo.tagName);
    if (!esBloque) {
      // Texto escrito directamente en el editor, sin párrafo alrededor.
      const temporal = document.createElement('span');
      temporal.append(nodo.cloneNode(true));
      suelto = (suelto ?? '') + enLinea(temporal);
      continue;
    }
    cerrarSuelto();
    const tag = nodo.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const texto = enLinea(nodo, true).replace(/\n/g, ' ').trim();
      if (texto) bloques.push(`${'#'.repeat(Number(tag[1]))} ${texto}`);
    } else if (tag === 'UL' || tag === 'OL') {
      const items = [...nodo.children]
        .filter((li) => li.tagName === 'LI')
        .map((li) => enLinea(li).replace(/\n/g, ' ').trim())
        .filter(Boolean);
      if (items.length) {
        bloques.push(items.map((t, i) => `${tag === 'UL' ? '-' : `${i + 1}.`} ${t}`).join('\n'));
      }
    } else if (tag === 'BLOCKQUOTE') {
      const texto = enLinea(nodo).replace(/\n+/g, ' ').trim();
      if (texto) bloques.push(`> ${texto}`);
    } else if (tag === 'TABLE') {
      const t = tabla(nodo);
      if (t) bloques.push(t);
    } else {
      const texto = lineas(enLinea(nodo).trim());
      if (texto) bloques.push(texto);
    }
  }
  cerrarSuelto();
  return bloques.join('\n\n');
}

/** Lo que se pinta en la zona visual para un Markdown dado. */
export function markdownAHtmlEditable(markdown) {
  const html = renderizarPrevisualizacion(String(markdown ?? ''));
  // Dentro del editor un enlace no debe abrir otra pestaña al pulsarlo.
  return html.replace(/ rel="noopener noreferrer" target="_blank"/g, '');
}

/**
 * ¿Se puede editar este Markdown visualmente sin perder nada? Se compara lo
 * que se vería antes y después del viaje de ida y vuelta.
 */
/**
 * Lo que el sitio entiende y este editor no: imágenes, separadores, código en
 * bloque, HTML, listas anidadas o con `*`/`+`, títulos subrayados y enlaces
 * por referencia. La comparación de abajo no los detecta porque la vista
 * previa tampoco los conoce, así que se miran aparte.
 */
const NO_VISUAL = [
  /!\[/,
  /^[ \t]*([*_-])([ \t]*\1){2,}[ \t]*$/m,
  /^[ \t]*(```|~~~)/m,
  /<[a-z!/][^>]*>/i,
  /^[ \t]+([-*+]|\d+\.) /m,
  /^[*+] /m,
  /^.+\n[=-]+[ \t]*$/m,
  /^ {4,}\S/m,
  /^[ \t]*\[[^\]]+\]:/m,
  /\]\[[^\]]*\]/,
];

export function sePuedeEditarVisualmente(markdown) {
  const valor = String(markdown ?? '');
  if (!valor.trim()) return true;
  if (NO_VISUAL.some((patron) => patron.test(valor))) return false;
  const zona = document.createElement('div');
  zona.innerHTML = markdownAHtmlEditable(valor);
  const vuelta = htmlAMarkdown(zona);
  return renderizarPrevisualizacion(vuelta) === renderizarPrevisualizacion(valor);
}

/** Copia la zona visual al textarea y avisa como si se hubiera tecleado. */
export function volcarVisual(visual) {
  const editor = visual.closest('[data-richtext]');
  const area = editor?.querySelector('[data-richtext-input]');
  if (!area) return;
  const markdown = htmlAMarkdown(visual);
  if (markdown === area.value) return;
  area.value = markdown;
  area.dataset.desdeVisual = '1';
  area.dispatchEvent(new Event('input', { bubbles: true }));
  delete area.dataset.desdeVisual;
}

/**
 * El textarea cambió por otra vía (un borrador recuperado): la zona visual
 * se repinta para que muestre lo mismo que se va a guardar.
 */
export function repintarVisual(area) {
  if (area.dataset.desdeVisual) return;
  const visual = area.closest('[data-richtext]')?.querySelector('[data-richtext-visual]');
  if (visual) visual.innerHTML = markdownAHtmlEditable(area.value);
}

function bloqueActual(visual) {
  const sel = window.getSelection();
  let nodo = sel?.anchorNode ?? null;
  while (nodo && nodo !== visual) {
    if (nodo.nodeType === Node.ELEMENT_NODE && nodo.parentNode === visual) return nodo;
    nodo = nodo.parentNode;
  }
  return null;
}

/** Aplica un formato de la barra en la zona visual. */
export function formatoVisual(visual, accion) {
  visual.focus();
  document.execCommand('defaultParagraphSeparator', false, 'p');
  const bloque = bloqueActual(visual);
  const alternarBloque = (tag) => {
    const yaLoEs = bloque?.tagName === tag.toUpperCase();
    document.execCommand('formatBlock', false, yaLoEs ? 'p' : tag);
  };
  if (accion === 'bold') document.execCommand('bold');
  else if (accion === 'italic') document.execCommand('italic');
  else if (accion === 'h2') alternarBloque('h2');
  else if (accion === 'h3') alternarBloque('h3');
  else if (accion === 'quote') alternarBloque('blockquote');
  else if (accion === 'ul') document.execCommand('insertUnorderedList');
  else if (accion === 'ol') document.execCommand('insertOrderedList');
  volcarVisual(visual);
}

let seleccionGuardada = null;

/**
 * Enlace con un diálogo propio: texto y dirección por separado. Antes el
 * botón insertaba `[texto del enlace]()` y había que escribir la dirección
 * entre los paréntesis.
 */
export function abrirDialogoEnlace(visual) {
  const editor = visual.closest('[data-richtext]');
  if (!editor || editor.querySelector('[data-rt-enlace]')) return;
  const sel = window.getSelection();
  seleccionGuardada =
    sel && sel.rangeCount && visual.contains(sel.anchorNode)
      ? sel.getRangeAt(0).cloneRange()
      : null;
  const texto = seleccionGuardada ? seleccionGuardada.toString() : '';
  const enlaceActual = sel?.anchorNode?.parentElement?.closest?.('a');
  visual.insertAdjacentHTML(
    'afterend',
    `<div class="hm-cms-rt-enlace" data-rt-enlace role="group" aria-label="Poner un enlace">
      <label>Texto que se verá
        <input type="text" data-rt-enlace-texto value="${escapeHtml(texto)}" />
      </label>
      <label>Dirección
        <input type="text" data-rt-enlace-href inputmode="url"
          placeholder="/contacto o https://…" value="${escapeHtml(enlaceActual?.getAttribute('href') || '')}" />
      </label>
      <p class="hm-cms-error" data-rt-enlace-error role="alert" hidden></p>
      <div class="hm-cms-actions">
        <button type="button" class="secondary small" data-action="rt-enlace-poner">Poner enlace</button>
        <button type="button" class="ghost small" data-action="rt-enlace-cancelar">Cancelar</button>
      </div>
    </div>`
  );
  const campo = editor.querySelector(texto ? '[data-rt-enlace-href]' : '[data-rt-enlace-texto]');
  campo?.focus();
}

export function cerrarDialogoEnlace(boton, poner) {
  const editor = boton.closest('[data-richtext]');
  const dialogo = editor?.querySelector('[data-rt-enlace]');
  const visual = editor?.querySelector('[data-richtext-visual]');
  if (!dialogo || !visual) return;
  if (poner) {
    const texto = dialogo.querySelector('[data-rt-enlace-texto]').value.trim();
    const href = dialogo.querySelector('[data-rt-enlace-href]').value.trim();
    const error = dialogo.querySelector('[data-rt-enlace-error]');
    const destino = enlaceSeguro(href);
    if (!texto || !destino) {
      error.hidden = false;
      error.textContent = !texto
        ? 'Escribe el texto que se verá.'
        : 'La dirección debe empezar por / (una página del sitio), https:// o mailto:.';
      return;
    }
    visual.focus();
    const sel = window.getSelection();
    if (seleccionGuardada) {
      sel.removeAllRanges();
      sel.addRange(seleccionGuardada);
    } else {
      const rango = document.createRange();
      rango.selectNodeContents(visual);
      rango.collapse(false);
      sel.removeAllRanges();
      sel.addRange(rango);
    }
    document.execCommand(
      'insertHTML',
      false,
      `<a href="${escapeHtml(destino)}">${escapeHtml(texto)}</a>`
    );
    volcarVisual(visual);
  }
  seleccionGuardada = null;
  dialogo.remove();
  visual.focus();
}

/** Pegar trae solo el texto: el formato de Word o de otra web no se arrastra. */
export function pegarComoTexto(event) {
  const visual = event.target instanceof Element && event.target.closest('[data-richtext-visual]');
  if (!visual) return false;
  event.preventDefault();
  const texto = event.clipboardData?.getData('text/plain') ?? '';
  document.execCommand('insertText', false, texto);
  return true;
}
