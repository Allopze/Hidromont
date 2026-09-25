/**
 * Edición en contexto: el elemento de la página que se está editando.
 *
 * Mientras el panel edita un campo, el elemento se resalta y muestra lo que
 * se escribe, al momento y sin guardar. Si se cierra el panel o se pasa a otro
 * campo sin guardar, vuelve a como estaba: la página nunca enseña un texto que
 * no está en el CMS.
 *
 * Solo depende del DOM, así que lo usan el panel, los campos y el selector de
 * medios sin crear dependencias circulares entre ellos.
 */

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
  if (elementChildren.length === 0) {
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
