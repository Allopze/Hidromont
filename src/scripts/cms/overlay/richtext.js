/**
 * Editor de texto con formato del CMS.
 *
 * Hasta ahora `richtext` se pintaba con el mismo `<textarea>` pelado que
 * `textarea`, y además no se llegaba a él: el formulario de colección filtraba
 * el tipo, así que los 48 cuerpos en Markdown de servicios y proyectos —la
 * prosa de cada ficha— no eran editables desde ninguna parte del panel.
 *
 * Esto añade barra de formato, atajos y vista previa. La lógica de
 * transformación vive en `markdown.ts`, sin DOM y con pruebas; aquí solo queda
 * el cableado: leer la selección del textarea, aplicar la transformación y
 * devolver el cursor a su sitio.
 */

import { escapeHtml } from './html';
import { icon } from './icons';
import {
  alternarEnvoltura,
  alternarLista,
  alternarPrefijo,
  insertarEnlace,
  renderizarPrevisualizacion,
} from './markdown';
import {
  abrirDialogoEnlace,
  formatoVisual,
  markdownAHtmlEditable,
  sePuedeEditarVisualmente,
} from './richtext-visual';

/**
 * Los botones de la barra.
 *
 * `titulo` incluye el atajo porque es el único sitio donde el operador puede
 * descubrirlo: la barra no tiene espacio para rotularlos.
 */
const BOTONES = [
  { accion: 'bold', etiqueta: 'B', titulo: 'Negrita (Ctrl+B)', clase: 'hm-cms-rt-bold' },
  { accion: 'italic', etiqueta: 'I', titulo: 'Cursiva (Ctrl+I)', clase: 'hm-cms-rt-italic' },
  { separador: true },
  // P2-23: «H2»/«H3» y «Código» eran jerga; los títulos se rotulan con
  // palabras y el código, que no se usa en ninguna ficha, sale de la barra.
  { accion: 'h2', etiqueta: 'Título', titulo: 'Título de sección' },
  { accion: 'h3', etiqueta: 'Subtítulo', titulo: 'Subtítulo' },
  { separador: true },
  { accion: 'ul', icono: 'list', titulo: 'Lista con viñetas' },
  { accion: 'ol', icono: 'listOrdered', titulo: 'Lista numerada' },
  { accion: 'quote', icono: 'quote', titulo: 'Cita' },
  { accion: 'link', icono: 'link', titulo: 'Enlace (Ctrl+K)' },
];

/** Qué transformación aplica cada botón. */
const ACCIONES = {
  bold: (sel) => alternarEnvoltura(sel, '**'),
  italic: (sel) => alternarEnvoltura(sel, '*'),
  code: (sel) => alternarEnvoltura(sel, '`'),
  h2: (sel) => alternarPrefijo(sel, '## '),
  h3: (sel) => alternarPrefijo(sel, '### '),
  ul: (sel) => alternarPrefijo(sel, '- '),
  quote: (sel) => alternarPrefijo(sel, '> '),
  ol: (sel) => alternarLista(sel),
  link: (sel) => insertarEnlace(sel),
};

/** Los atajos de teclado, con la misma acción que su botón. */
const ATAJOS = { b: 'bold', i: 'italic', k: 'link' };

/**
 * El editor completo para un campo Markdown, con su rótulo.
 *
 * `name` es el del control, que cambia según dónde se pinte: `value` en el
 * editor de campo suelto y `field:body` en el formulario de colección.
 *
 * El rótulo se emite aquí dentro, y no lo pone quien llama, porque el
 * <textarea> no va envuelto en el <label> —entre medias está la barra de
 * formato— y entonces la asociación depende de un par id/for que es justo lo
 * que se descoloca al mover código. Emitiéndolos juntos no puede separarse:
 * antes el rótulo quedó de hermano suelto y el campo se quedó sin nombre
 * accesible, que es el único hallazgo grave que dejó la auditoría del panel.
 */
export function richtextMarkup(valor, name = 'value', etiqueta = 'Contenido') {
  const id = `hm-cms-rt-${String(name).replace(/[^a-z0-9]+/gi, '-')}`;
  const barra = BOTONES.map((b) =>
    b.separador
      ? '<span class="hm-cms-rt-sep" aria-hidden="true"></span>'
      : `<button type="button" class="hm-cms-rt-btn ${b.clase || ''}" data-action="rt-format"
           data-format="${b.accion}" title="${escapeHtml(b.titulo)}" tabindex="${
             b.accion === BOTONES.find((x) => !x.separador).accion ? '0' : '-1'
           }"
           aria-label="${escapeHtml(b.titulo)}">${b.icono ? icon(b.icono) : escapeHtml(b.etiqueta)}</button>`
  ).join('');

  const texto = String(valor ?? '');
  if (sePuedeEditarVisualmente(texto)) {
    // Editor visual: el textarea sigue siendo lo que se envía, oculto.
    return `
    <p class="hm-cms-label" id="${escapeHtml(id)}-rotulo">${etiqueta}</p>
    <div class="hm-cms-rt" data-richtext data-richtext-modo="visual">
      <div class="hm-cms-rt-bar" role="toolbar" aria-label="Formato del texto">
        ${barra}
      </div>
      <div class="hm-cms-rt-preview hm-cms-rt-visual" data-richtext-visual contenteditable="true"
        role="textbox" aria-multiline="true" aria-labelledby="${escapeHtml(id)}-rotulo"
        spellcheck="true">${markdownAHtmlEditable(texto)}</div>
      <textarea id="${escapeHtml(id)}" name="${escapeHtml(name)}" data-field-type="richtext"
        data-richtext-input hidden tabindex="-1" aria-hidden="true">${escapeHtml(texto)}</textarea>
      <p class="hm-cms-rt-help">
        Escribe como en un documento. Selecciona texto y usa los botones para darle formato;
        el aspecto final lo da el sitio.
      </p>
    </div>
  `;
  }

  return `
    <label for="${escapeHtml(id)}">${etiqueta}</label>
    <div class="hm-cms-rt" data-richtext data-richtext-modo="texto">
      <div class="hm-cms-rt-bar" role="toolbar" aria-label="Formato del texto">
        ${barra}
        <span class="hm-cms-rt-spacer"></span>
        <button type="button" class="hm-cms-rt-btn" data-action="rt-preview"
          title="Ver cómo queda" aria-pressed="false" tabindex="-1">Vista previa</button>
      </div>
      <textarea id="${escapeHtml(id)}" name="${escapeHtml(name)}" data-field-type="richtext"
        data-richtext-input rows="14" spellcheck="true">${escapeHtml(String(valor ?? ''))}</textarea>
      <div class="hm-cms-rt-preview" data-richtext-preview hidden></div>
      <p class="hm-cms-rt-help">
        Selecciona texto y usa los botones para darle formato. «Vista previa» muestra
        cómo queda; el aspecto final lo da el sitio.
      </p>
    </div>
  `;
}

/**
 * Aplica un formato al textarea del editor que contiene al botón pulsado.
 *
 * Se reasigna `value` entero y luego se restaura la selección porque
 * `setRangeText` no cubre los casos de prefijo de línea, que pueden tocar
 * texto fuera de la selección. Tras escribir se emite `input` para que el
 * autoguardado y el marcador de cambios sin guardar se enteren.
 */
export function aplicarFormato(boton) {
  const editor = boton.closest('[data-richtext]');
  const visual = editor?.querySelector('[data-richtext-visual]');
  if (visual) {
    if (boton.dataset.format === 'link') abrirDialogoEnlace(visual);
    else formatoVisual(visual, boton.dataset.format);
    return;
  }
  const area = editor?.querySelector('[data-richtext-input]');
  if (!area) return;

  const transformar = ACCIONES[boton.dataset.format];
  if (!transformar) return;

  const resultado = transformar({
    valor: area.value,
    inicio: area.selectionStart,
    fin: area.selectionEnd,
  });

  area.value = resultado.valor;
  area.focus();
  area.setSelectionRange(resultado.inicio, resultado.fin);
  area.dispatchEvent(new Event('input', { bubbles: true }));

  // Si la vista previa está abierta, lo que se acaba de aplicar debe verse.
  refrescarPrevisualizacion(editor);
}

/**
 * Atajos de teclado dentro del área de edición.
 *
 * Devuelve `true` si consumió la pulsación, para que quien llama pueda hacer
 * `preventDefault()` solo entonces: Ctrl+B sin editor abierto sigue siendo del
 * navegador.
 */
export function manejarAtajo(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  const accion = ATAJOS[event.key.toLowerCase()];
  if (!accion) return false;

  const area = event.target;
  const esVisual = area instanceof HTMLElement && area.matches('[data-richtext-visual]');
  if (
    !esVisual &&
    (!(area instanceof HTMLTextAreaElement) || !area.matches('[data-richtext-input]'))
  ) {
    return false;
  }
  const editor = area.closest('[data-richtext]');
  const boton = editor?.querySelector(`[data-format="${accion}"]`);
  if (!boton) return false;

  aplicarFormato(boton);
  return true;
}

/** Alterna entre escribir y ver el resultado. */
export function alternarPrevisualizacion(boton) {
  const editor = boton.closest('[data-richtext]');
  const area = editor?.querySelector('[data-richtext-input]');
  const vista = editor?.querySelector('[data-richtext-preview]');
  if (!area || !vista) return;

  const mostrando = vista.hidden;
  vista.hidden = !mostrando;
  area.hidden = mostrando;
  boton.setAttribute('aria-pressed', String(mostrando));
  boton.textContent = mostrando ? 'Seguir escribiendo' : 'Vista previa';

  if (mostrando) refrescarPrevisualizacion(editor);
  else area.focus();
}

/** Repinta la vista previa, si está abierta. */
export function refrescarPrevisualizacion(editor) {
  const vista = editor?.querySelector('[data-richtext-preview]');
  const area = editor?.querySelector('[data-richtext-input]');
  if (!vista || !area || vista.hidden) return;
  vista.innerHTML = renderizarPrevisualizacion(area.value);
}

/**
 * Navegación por flechas dentro de la barra de formato.
 *
 * `role="toolbar"` promete este comportamiento: un lector de pantalla anuncia
 * la barra como un único control y espera moverse con las flechas. Sin esto,
 * los once botones eran once paradas de tabulación antes de llegar al texto
 * —el control que de verdad se quiere usar—, y el rol mentía.
 *
 * Es *roving tabindex*: solo el botón activo lleva `tabindex="0"`, el resto
 * `-1`. Devuelve `true` si consumió la pulsación.
 */
export function navegarBarra(event) {
  const boton = event.target;
  if (!(boton instanceof HTMLElement) || !boton.matches('.hm-cms-rt-btn')) return false;
  const barra = boton.closest('.hm-cms-rt-bar');
  if (!barra) return false;

  const botones = [...barra.querySelectorAll('.hm-cms-rt-btn')];
  const actual = botones.indexOf(boton);
  const ultimo = botones.length - 1;

  let destino;
  if (event.key === 'ArrowRight') destino = actual === ultimo ? 0 : actual + 1;
  else if (event.key === 'ArrowLeft') destino = actual === 0 ? ultimo : actual - 1;
  else if (event.key === 'Home') destino = 0;
  else if (event.key === 'End') destino = ultimo;
  else return false;

  for (const b of botones) b.tabIndex = -1;
  botones[destino].tabIndex = 0;
  botones[destino].focus();
  return true;
}
