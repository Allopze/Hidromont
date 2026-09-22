/**
 * Hace descubribles con teclado los campos de edición contextual que ya están
 * pintados en la página. Las activaciones sintéticas usan `click()` para que
 * las atienda la delegación de eventos existente en `events.js`.
 */

const EDITABLES = '[data-cms-entry]';
const TEXT_CONTROLS = 'input, textarea, select';
const EDIT_HELP = 'Campo editable. Pulsa Intro o Espacio para abrir el editor.';

let enabled = false;
let keyboardTargets = new WeakMap();
const managedAttributes = new Map();

function setManagedAttribute(element, name, value) {
  let previous = managedAttributes.get(element);
  if (!previous) {
    previous = new Map();
    managedAttributes.set(element, previous);
  }
  if (!previous.has(name)) previous.set(name, element.getAttribute(name));
  element.setAttribute(name, value);
}

function restoreManagedAttributes() {
  for (const [element, attributes] of managedAttributes) {
    for (const [name, value] of attributes) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
  }
  managedAttributes.clear();
  keyboardTargets = new WeakMap();
}

function describeEditable(element) {
  if (!element.hasAttribute('aria-description')) {
    setManagedAttribute(element, 'aria-description', EDIT_HELP);
  }
}

function markEditable(element) {
  setManagedAttribute(element, 'data-cms-editable-ready', '');
  describeEditable(element);
}

function prepareEditable(element) {
  if (element.closest('.hm-cms-panel')) return;

  // No se inserta un control interactivo dentro de un enlace. Si el enlace
  // contiene un único campo editable, el propio enlace ya es el punto de foco;
  // su Enter/Espacio editará ese campo y conservará su rol y nombre de enlace.
  const link = element.closest('a[href]');
  if (link && link !== element) {
    const targets = link.querySelectorAll(EDITABLES);
    if (targets.length === 1) {
      keyboardTargets.set(link, element);
      setManagedAttribute(link, 'data-cms-editable-host', '');
      markEditable(link);
    }
    return;
  }

  markEditable(element);
  if (
    !element.hasAttribute('tabindex') &&
    !element.matches('a[href], button, input, select, textarea, summary')
  ) {
    setManagedAttribute(element, 'tabindex', '0');
  }

  // Los campos de texto conservan su uso nativo. Los demás nodos enfocables
  // no interactivos reciben Enter/Espacio como activadores de su click actual.
  if (!element.matches(TEXT_CONTROLS)) {
    setManagedAttribute(element, 'data-cms-keyboard-activate', '');
  }
}

function activateFromKeyboard(event) {
  if (event.isComposing || event.repeat) return;
  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;

  const focused = event.target instanceof Element ? event.target : null;
  if (!focused || focused.closest('.hm-cms-panel')) return;

  const editable = focused.closest('[data-cms-keyboard-activate]') || keyboardTargets.get(focused);
  if (!editable) return;

  event.preventDefault();
  event.stopPropagation();
  editable.click();
}

/** Activa o retira el acceso de teclado cuando cambia el estado de sesión. */
export function setInlineEditAccessibility(isAuthenticated) {
  if (!isAuthenticated) {
    if (!enabled) return;
    document.removeEventListener('keydown', activateFromKeyboard, true);
    enabled = false;
    restoreManagedAttributes();
    return;
  }

  if (!enabled) {
    document.addEventListener('keydown', activateFromKeyboard, true);
    enabled = true;
  }
  document.querySelectorAll(EDITABLES).forEach(prepareEditable);
}
