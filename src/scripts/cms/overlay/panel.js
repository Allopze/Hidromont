/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { state } from './context';
import { isFormDirty, panel, panelBody, setFormDirty, shell } from './shell';
import { offerDraft } from './drafts';

let lastActiveElement = null;

/**
 * @param autofocus Mover el foco al primer control del panel. Se desactiva
 *   al repintar una lista filtrada: el foco debe quedarse en el buscador que
 *   el operador está usando, y este autofoco (diferido 50 ms) se lo robaba.
 */
export function openPanel(html, { autofocus = true } = {}) {
  if (document.activeElement && !panel.contains(document.activeElement)) {
    lastActiveElement = document.activeElement;
  }
  // Cada openPanel destruye el formulario anterior: arrastrar el estado
  // sucio de una vista a la siguiente siempre sería incorrecto.
  setFormDirty(false);
  panelBody.innerHTML = html;
  // E-2: un solo punto para los tres formularios que se autoguardan. Si hay
  // una copia local que difiere de lo que se acaba de pintar, se ofrece
  // aquí, antes de que el editor empiece a escribir encima.
  for (const form of panelBody.querySelectorAll(
    '[data-edit], [data-entry-form], [data-gallery-item-form]'
  )) {
    offerDraft(form);
  }
  panel.classList.add('open');
  // B-2: solo mientras está abierto. Marcarlo siempre haría que un lector
  // de pantalla anunciara un diálogo que no está en pantalla.
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  // H-02: Mover el foco al primer elemento interactivo del panel
  if (!autofocus) return;
  setTimeout(() => {
    const firstFocusable = panel.querySelector(
      'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable && typeof firstFocusable.focus === 'function') {
      firstFocusable.focus();
    }
  }, 50);
}

/**
 * B-2: el panel movía el foco a su primer control al abrir y lo restituía al
 * cerrar, pero no lo confinaba: tabulando se salía a la página de detrás,
 * que sigue siendo interactiva, y se podía editar el fondo sin darse cuenta.
 * El visor de galería ya resolvía esto en este mismo repositorio con
 * `role="dialog"` + `aria-modal` y ciclo de Tab; se replica aquí.
 */
const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

panel.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || !panel.classList.contains('open')) return;
  const focusables = [...panel.querySelectorAll(FOCUSABLES)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
  if (focusables.length === 0) return;
  const primero = focusables[0];
  const ultimo = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === primero) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault();
    primero.focus();
  }
});

export function closePanel(force = false) {
  // A-11: Escape y «Cerrar» descartaban lo escrito sin preguntar, aunque el
  // estado sucio ya se estaba registrando para el aviso del navegador.
  if (
    !force &&
    isFormDirty &&
    // E-2: cerrar ya no pierde nada, así que el aviso lo dice. Antes ponía
    // «¿Cerrar y descartarlos?», que era cierto y por eso daba miedo.
    !window.confirm(
      'Hay cambios sin guardar. Se cerrará el panel y quedará una copia local que podrás recuperar al volver a abrir este formulario. ¿Cerrar?'
    )
  ) {
    return;
  }
  setFormDirty(false);
  panel.classList.remove('open');
  panel.removeAttribute('role');
  panel.removeAttribute('aria-modal');
  state.selected = null;
  state.entry = null;

  // H-02: Restaurar el foco al elemento interactivo previo al cerrar
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
    lastActiveElement = null;
  }
}

export function setPanelTitle(title) {
  const titleEl = shell.querySelector('[data-panel-title]');
  if (titleEl) titleEl.textContent = title;
}
