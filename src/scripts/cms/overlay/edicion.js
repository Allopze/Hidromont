/**
 * Edición en contexto: el elemento de la página que se está editando.
 *
 * Mientras el panel edita un campo, el elemento se resalta y muestra lo que
 * se escribe, al momento y sin guardar. Si se cierra el panel o se pasa a otro
 * campo sin guardar, vuelve a como estaba: la página nunca enseña un texto que
 * no está en el CMS.
 *
 * Solo depende del DOM (y del conversor de Markdown, que es puro), así que lo
 * usan el panel, los campos y el selector de medios sin crear dependencias
 * circulares entre ellos.
 */

import { renderizarPrevisualizacion } from './markdown';

let actual = null;

/**
 * X-001: actualiza el texto editable de un elemento sin destruir el marcado
 * anidado (iconos, badges, spans hermanos).
 *
 *   - Sin hijos elemento: `textContent`, el caso más común.
 *   - Con hijos elemento: se actualiza el primer nodo de texto con contenido;
 *     si no lo hay, se inserta uno delante del primer hijo.
 */
export function escribirTexto(element, valor) {
  const children = Array.from(element.childNodes);
  const elementChildren = children.filter((node) => node.nodeType === Node.ELEMENT_NODE);
  // Cifras como «40+ años»: el valor va repartido en varios nodos y
  // reemplazar solo uno dejaba «40» delante del texto nuevo.
  if (elementChildren.length === 0 || element.hasAttribute('data-cms-texto-entero')) {
    element.textContent = valor;
    return;
  }
  const textNodes = children.filter(
    (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim().length > 0
  );
  if (textNodes.length > 0) textNodes[0].nodeValue = valor;
  else element.insertBefore(document.createTextNode(valor), elementChildren[0]);
}

/**
 * Cambia la foto que se ve en la página.
 *
 * Las imágenes del CMS llevan `srcset` con los derivados, y el navegador
 * prefiere el `srcset` al `src`. Cambiar solo el `src` —como se hacía al
 * guardar— dejaba la foto anterior en pantalla: parecía que no se había
 * guardado nada.
 */
/**
 * Pinta una lista guardada en su elemento de la página (`<ul>` de tipos,
 * insignias de normas…). Cada elemento nuevo es una copia del primero que ya
 * había, así que conserva su viñeta o su estilo; solo cambia su texto.
 *
 * Hasta ahora ninguna lista se editaba desde la página, y al guardarla el
 * valor se habría escrito como texto: «Compuerta vagón,Compuerta clapeta…»
 * delante de la lista vieja.
 *
 * `data-cms-list-max` limita cuántos se ven, como hace la página: la tarjeta de
 * /servicios muestra solo los tres primeros tipos. Si la lista trae algo que
 * no es texto (grupos), no se toca nada: la página queda como estaba y el
 * cambio se verá al publicar.
 */
export function escribirLista(element, items) {
  const plantilla = element.firstElementChild;
  if (!plantilla || !Array.isArray(items)) return;
  if (!items.every((item) => typeof item === 'string')) return;
  const max = Number(element.dataset.cmsListMax) || items.length;
  const nuevos = items
    .filter((item) => item.trim())
    .slice(0, max)
    .map((item) => {
      const copia = plantilla.cloneNode(true);
      escribirTexto(copia, item);
      return copia;
    });
  element.replaceChildren(...nuevos);
}

/**
 * Pinta un cuerpo en Markdown con la misma vista previa del panel. Es
 * aproximada —el HTML definitivo lo genera Astro al publicar—, pero es la
 * única forma de que la página refleje lo guardado: escribirlo como texto
 * dejaba el Markdown crudo delante del cuerpo anterior.
 */
export function escribirFormato(element, markdown) {
  element.innerHTML = renderizarPrevisualizacion(String(markdown ?? ''));
}

export function mostrarImagen(img, src) {
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
  img.setAttribute('src', src);
}

function capturar(element) {
  if (element instanceof HTMLImageElement) {
    return {
      src: element.getAttribute('src'),
      srcset: element.getAttribute('srcset'),
      sizes: element.getAttribute('sizes'),
      alt: element.getAttribute('alt'),
      // El encuadre vive en `style` (object-position).
      style: element.getAttribute('style'),
    };
  }
  return { html: element.innerHTML };
}

function restaurar(element, original) {
  if ('html' in original) {
    element.innerHTML = original.html;
    return;
  }
  for (const [atributo, valor] of Object.entries(original)) {
    if (valor === null) element.removeAttribute(atributo);
    else element.setAttribute(atributo, valor);
  }
}

/** Empieza a editar `element`. Termina antes la edición anterior, si la hay. */
export function empezarEdicion(element) {
  terminarEdicion();
  actual = { element, original: capturar(element), pendiente: false };
  element.classList.add('hm-cms-editing');
}

/** Muestra en la página el texto que se está escribiendo. */
export function previsualizarTexto(valor) {
  if (!actual || actual.element instanceof HTMLImageElement) return;
  escribirTexto(actual.element, valor);
  actual.pendiente = true;
}

/** Muestra en la página la foto elegida o subida, antes de guardar. */
export function previsualizarImagen(src) {
  if (!actual || !(actual.element instanceof HTMLImageElement) || !src) return;
  mostrarImagen(actual.element, src);
  actual.pendiente = true;
}

/** Muestra en la página el encuadre que se está eligiendo. */
export function previsualizarEnfoque(posicion) {
  if (!actual || !(actual.element instanceof HTMLImageElement)) return;
  actual.element.style.objectPosition = posicion;
  actual.pendiente = true;
}

/** Tras guardar: lo que se ve ya es lo que está en el CMS. */
export function confirmarEdicion() {
  if (!actual) return;
  actual.original = capturar(actual.element);
  actual.pendiente = false;
}

/** Deja el elemento como estaba si quedó algo sin guardar, y quita el resalte. */
export function terminarEdicion() {
  if (!actual) return;
  if (actual.pendiente) restaurar(actual.element, actual.original);
  actual.element.classList.remove('hm-cms-editing');
  actual = null;
}

/** ¿Se está editando este elemento? */
export function editando(element) {
  return actual?.element === element;
}
