/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { state } from './context';
import { isFormDirty, panel, panelBody, setFormDirty, shell } from './shell';
import { offerDraft } from './drafts';
import { confirmar } from './confirm';
import { terminarEdicion } from './edicion';

const backdrop = shell.querySelector('[data-cms-backdrop]');

let lastActiveElement = null;

// El panel sigue montado cuando está cerrado. aria-hidden quita su contenido
// del árbol accesible e inert evita que sus campos reciban foco por Tab.
panel.inert = true;
panel.setAttribute('aria-hidden', 'true');
panel.tabIndex = -1;

/*
 * P2-21 (auditoría 2026-09): el panel, fijo a la derecha, tapaba lo que se
 * estaba editando si quedaba en la mitad derecha (el botón «Contáctenos», las
 * listas de una ficha) y, con una ficha abierta, cortaba la barra en
 * «Publica…». En escritorio la página cede el ancho del panel mientras está
 * abierto; en pantallas estrechas el panel ocupa todo y no hay nada que ceder.
 */
const ESCRITORIO = window.matchMedia('(min-width: 1101px)');

function reservarEspacio() {
  const html = document.documentElement;
  const abierto = panel.classList.contains('open');
  if (!abierto || !ESCRITORIO.matches) {
    html.classList.remove('hm-cms-con-panel');
    html.style.removeProperty('--hm-cms-reserva');
    return;
  }
  const ancho = panel.classList.contains('is-wide') ? 680 : 440;
  html.style.setProperty('--hm-cms-reserva', `${Math.min(ancho, window.innerWidth)}px`);
  html.classList.add('hm-cms-con-panel');
}

/** Si lo que se edita quedó fuera de la vista al estrecharse la página, se trae. */
function mostrarLoEditado() {
  const el = document.querySelector('.hm-cms-editing');
  if (!(el instanceof HTMLElement)) return;
  const caja = el.getBoundingClientRect();
  if (caja.top < 0 || caja.bottom > window.innerHeight) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}

ESCRITORIO.addEventListener('change', reservarEspacio);

/**
 * @param autofocus Mover el foco al primer control del panel. Se desactiva
 *   al repintar una lista filtrada: el foco debe quedarse en el buscador que
 *   el operador está usando, y este autofoco (diferido 50 ms) se lo robaba.
 *   Con `'panel'` el foco va al propio panel: en Administración el primer
 *   campo es «Contraseña actual», al fondo de la vista, y enfocarlo desplazaba
 *   el panel hasta allí nada más abrirlo.
 * @param modal Oscurecer la página detrás. Al editar un campo va a `false`:
 *   la página es la vista previa, y taparla era justo lo contrario de lo que
 *   se necesita para ver el cambio.
 * @param wide Panel ancho, para las fichas de colección: con cuerpo en
 *   Markdown y cuatro listas no cabían en 440 px.
 */
export function openPanel(html, { autofocus = true, modal = true, wide = false } = {}) {
  if (document.activeElement && !panel.contains(document.activeElement)) {
    lastActiveElement = document.activeElement;
  }
  // Cada openPanel destruye el formulario anterior: arrastrar el estado
  // sucio de una vista a la siguiente siempre sería incorrecto. Lo mismo la
  // vista previa en la página: si no se guardó, vuelve a como estaba.
  setFormDirty(false);
  terminarEdicion();
  panelBody.innerHTML = html;
  panel.classList.toggle('is-wide', wide);
  // E-2: un solo punto para los tres formularios que se autoguardan. Si hay
  // una copia local que difiere de lo que se acaba de pintar, se ofrece
  // aquí, antes de que el editor empiece a escribir encima.
  for (const form of panelBody.querySelectorAll(
    '[data-edit], [data-entry-form], [data-gallery-item-form]'
  )) {
    offerDraft(form);
  }
  panel.classList.add('open');
  reservarEspacio();
  // `empezarEdicion` marca el elemento justo después de abrir el panel.
  requestAnimationFrame(mostrarLoEditado);
  if (backdrop) backdrop.classList.toggle('visible', modal);
  panel.inert = false;
  panel.removeAttribute('aria-hidden');
  // B-2: solo mientras está abierto. Marcarlo siempre haría que un lector
  // de pantalla anunciara un diálogo que no está en pantalla.
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  // H-02: Mover el foco al primer elemento interactivo del panel
  if (!autofocus) return;
  setTimeout(() => {
    if (!panel.classList.contains('open') || panel.inert) return;
    // Si en estos 50 ms la persona ya se puso en un campo del panel, no se le
    // quita el foco: lo que escribiera iría a parar a otro campo (pasaba con
    // el acceso: la contraseña acababa pegada al correo).
    const activo = document.activeElement;
    if (activo && activo !== panel && panel.contains(activo)) return;
    if (autofocus === 'panel') {
      panelBody.scrollTop = 0;
      panel.focus();
      return;
    }

    // Prioriza el campo que la persona vino a editar. En las vistas sin
    // campos (por ejemplo, una lista) enfoca el primer control de su contenido,
    // nunca el botón «Cerrar» del encabezado.
    const firstFocusable =
      panelBody.querySelector(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      ) ||
      panelBody.querySelector(
        'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ||
      panel;
    if (firstFocusable && typeof firstFocusable.focus === 'function') {
      firstFocusable.focus();
      // P3-11 (auditoría 2026-09): el cursor quedaba al principio y lo que se
      // tecleaba se anteponía al texto (se guardó « xIngeniería…»).
      if (
        (firstFocusable instanceof HTMLInputElement &&
          ['text', 'search', 'url', 'tel'].includes(firstFocusable.type)) ||
        firstFocusable instanceof HTMLTextAreaElement
      ) {
        const fin = firstFocusable.value.length;
        firstFocusable.setSelectionRange(fin, fin);
      }
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

/*
 * El ciclo se recorre explícitamente en vez de interceptar solo en los
 * extremos.
 *
 * Con el aviso de deshacer fuera del panel, el enfoque anterior —«si estoy en
 * el último, salta al primero»— dejaba de funcionar: el «último» pasaba a ser
 * un botón que el Tab nativo nunca alcanzaba desde dentro del panel, así que
 * la trampa se abría sola y el foco se iba a la página.
 */
panel.addEventListener('keydown', manejarTab);

function manejarTab(event) {
  if (event.key !== 'Tab' || !panel.classList.contains('open')) return;

  const avisoDeshacer = shell.querySelector('[data-undo-host]:not([hidden])');
  const ciclo = [
    ...panel.querySelectorAll(FOCUSABLES),
    ...(avisoDeshacer ? avisoDeshacer.querySelectorAll(FOCUSABLES) : []),
  ].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (ciclo.length === 0) return;

  const actual = ciclo.indexOf(document.activeElement);
  if (actual === -1) return;

  const siguiente = event.shiftKey
    ? (actual - 1 + ciclo.length) % ciclo.length
    : (actual + 1) % ciclo.length;
  event.preventDefault();
  ciclo[siguiente].focus();
}

// El aviso vive fuera del panel, así que sus pulsaciones no burbujean hasta
// él: se escucha también ahí para que el ciclo funcione en los dos sentidos.
shell.addEventListener('keydown', (event) => {
  if (!event.target.closest?.('[data-undo-host]')) return;
  manejarTab(event);
});

/**
 * Cierra el panel. Devuelve si se cerró: con cambios sin guardar pregunta
 * antes, y la respuesta llega de forma asíncrona.
 */
export async function closePanel(force = false) {
  /*
   * Mientras hay una escritura en curso, cerrar no es una opción.
   *
   * `saveEntryForm` manda hasta nueve PATCH en serie. Cerrar o navegar a media
   * tanda aborta los que faltan SIN ningún aviso: los primeros campos quedan
   * escritos, el resto no, y el panel vuelve a la lista como si todo hubiera
   * ido bien. Reproducido al escribir las pruebas del editor de texto.
   *
   * La confirmación de «cambios sin guardar» de abajo no cubre esto: ahí lo
   * escrito sigue a salvo en el borrador local, aquí se perdería a medias.
   */
  const ocupado = panelBody.querySelector('[data-busy="true"]');
  if (ocupado) return false;

  // A-11: Escape y «Cerrar» descartaban lo escrito sin preguntar, aunque el
  // estado sucio ya se estaba registrando para el aviso del navegador.
  // E-2: cerrar ya no pierde nada, así que el aviso lo dice. Antes ponía
  // «¿Cerrar y descartarlos?», que era cierto y por eso daba miedo.
  if (
    !force &&
    isFormDirty &&
    !(await confirmar({
      titulo: 'Tienes cambios sin guardar',
      mensaje:
        'Si cierras ahora, quedará una copia local que podrás recuperar al volver a abrir este formulario.',
      aceptar: 'Cerrar de todos modos',
      cancelar: 'Seguir editando',
    }))
  ) {
    return false;
  }
  setFormDirty(false);
  terminarEdicion();
  panel.classList.remove('open');
  reservarEspacio();
  if (backdrop) backdrop.classList.remove('visible');
  panel.inert = true;
  panel.setAttribute('aria-hidden', 'true');
  panel.removeAttribute('role');
  panel.removeAttribute('aria-modal');
  state.selected = null;
  state.entry = null;

  // H-02: Restaurar el foco al elemento interactivo previo al cerrar
  if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
    lastActiveElement.focus();
    lastActiveElement = null;
  }
  return true;
}

export function setPanelTitle(title) {
  const titleEl = shell.querySelector('[data-panel-title]');
  if (titleEl) titleEl.textContent = title;
}
