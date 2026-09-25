/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { botonesDeBarra } from './actions';
import { icon } from './icons';
import { overlayStyles } from './styles';

const hojaDeEstilos = document.createElement('style');
hojaDeEstilos.textContent = overlayStyles;
document.head.appendChild(hojaDeEstilos);

export const shell = document.createElement('div');

shell.className = 'hm-cms-shell';

shell.innerHTML = `
  <div class="hm-cms-bar">
    <strong class="hm-cms-brand">Hidromont CMS</strong>
    <span class="hm-cms-badge" data-state-badge role="status" aria-live="polite" aria-atomic="true" hidden></span>
    <span class="hm-cms-autosave-indicator" data-dirty-indicator title="Hay cambios sin guardar" aria-hidden="true"></span>
    ${botonesDeBarra()}
  </div>
  <!--
    El aviso de deshacer vive aquí, hermano de la barra, y NO dentro del panel:
    los cuatro borradores llaman acto seguido a un cargador que pasa por
    openPanel, que hace panelBody.innerHTML = html. Un aviso dentro del panel
    se destruiría milisegundos después de nacer.

    Existe desde el montaje, vacío: una región viva insertada y rellenada en el
    mismo fotograma no se anuncia de forma fiable.
  -->
  <div class="hm-cms-undo" data-undo-host role="status" aria-live="polite" aria-atomic="true" hidden></div>
  <!--
    UI-03: backdrop semitransparente que enfoca la atención en el panel y
    permite cerrarlo con clic fuera. aria-hidden porque no aporta nada al
    árbol accesible; el panel ya se gestiona como dialog modal.
  -->
  <div class="hm-cms-backdrop" data-cms-backdrop data-action="close" aria-hidden="true"></div>
  <!--
    Ni <aside> ni <header> ni <main>: el overlay se inyecta en TODAS las
    páginas del sitio, así que esas etiquetas añadían un segundo landmark
    "main" y un segundo "banner" al documento —dos avisos de axe en cada
    escena— y ponían un "complementary" alrededor del editor. Encima,
    role="dialog" sobre un <aside> no es una combinación válida.

    Un <div role="dialog"> no aporta landmark propio y sí el rol correcto.
    El rótulo pasa de aria-label a aria-labelledby para que sea el mismo <h2>
    que ya se ve en pantalla el que nombre el diálogo. El role="dialog" NO va
    aquí: panel.js lo pone al abrir y lo quita al cerrar, a propósito (B-2),
    para no anunciar un diálogo que no está en pantalla.
  -->
  <div class="hm-cms-panel" aria-labelledby="hm-cms-panel-title">
    <div class="hm-cms-panel-head">
      <h2 id="hm-cms-panel-title" data-panel-title>Editor</h2>
      <button type="button" class="icon" data-action="close" aria-label="Cerrar" title="Cerrar">${icon('x', { size: 20 })}</button>
    </div>
    <div class="hm-cms-panel-body" data-panel-body></div>
  </div>
`;

/*
 * `prepend`, no `appendChild`: el shell es `position: fixed; inset: 0`, así que
 * su sitio en el DOM no cambia nada de lo que se ve, pero sí el orden de
 * tabulación. Montado al final había que atravesar la página pública entera
 * —56 pulsaciones de Tab, medidas— antes de alcanzar la barra del editor, y 62
 * antes del panel. Al principio son 0.
 *
 * El coste es que los 7 controles de la barra van ahora antes del contenido de
 * la página. Es el orden correcto para quien viene a editar, que es la única
 * persona que ve esto: en producción, el overlay solo existe en `editor.*`.
 */
document.body.prepend(shell);

document.body.classList.add('hm-cms-active');

// Las acciones de la barra solo existen con sesión iniciada: sin sesión se
// muestra el rótulo "Hidromont CMS" y nada más (antes "Salir" aparecía sin
// haber entrado, y Colecciones/Galería/Historial invitaban a clicks fallidos).
export function setAuthenticatedUI(isAuthenticated) {
  shell.querySelectorAll('[data-auth]').forEach((el) => {
    // «Editar esta ficha» necesita además saber qué entrada es la página.
    const faltaFicha = el.hasAttribute('data-page-entry') && !el.dataset.entryId;
    el.hidden = !isAuthenticated || faltaFicha;
  });
}

export const panel = shell.querySelector('.hm-cms-panel');

export const panelBody = shell.querySelector('[data-panel-body]');

const stateBadge = shell.querySelector('[data-state-badge]');

/*
 * Los glifos (● ✓ ⚠ ✗) salen del texto: cada fuente los dibujaba distinto y un
 * lector de pantalla los leía en voz alta. El punto de color lo pone la hoja de
 * estilos según la clase. «Cambios sin publicar» deja de pintarse en rojo de
 * error: es el estado normal después de guardar, no un fallo.
 */
const ESTADOS_GLOBALES = {
  unsaved: { label: 'Cambios sin publicar', cls: 'pending' },
  exported: { label: 'Archivos preparados · falta publicar', cls: 'pending' },
  'exported-warning': { label: 'Preparado con avisos · revisar', cls: 'warning' },
  published: { label: 'Sitio actualizado', cls: 'succeeded' },
  'published-warning': { label: 'Publicado con avisos · revisar', cls: 'warning' },
  'local-built': { label: 'Compilado en local · falta desplegar', cls: 'succeeded' },
  'local-warning': { label: 'Compilado con avisos · falta desplegar', cls: 'warning' },
  'other-built': { label: 'Compilado aquí · producción sin confirmar', cls: 'succeeded' },
  'other-warning': { label: 'Compilado con avisos · producción sin confirmar', cls: 'warning' },
  error: { label: 'No se pudo completar', cls: 'failed' },
};

export function setGlobalState(stateKey) {
  if (!stateBadge) return;
  if (!stateKey) {
    stateBadge.hidden = true;
    return;
  }
  const s = ESTADOS_GLOBALES[stateKey] || { label: stateKey, cls: '' };
  stateBadge.textContent = s.label;
  stateBadge.className = `hm-cms-badge hm-cms-state ${s.cls}`;
  stateBadge.hidden = false;
}

export let isFormDirty = false;

/**
 * A-11: el estado sucio se marcaba pero nunca se limpiaba, ni siquiera tras
 * guardar. El aviso del navegador al salir saltaba para siempre desde la
 * primera tecla, así que se aprendía a ignorarlo — y era la única
 * protección que había. Ahora se apaga en cada guardado correcto y al
 * abrir un formulario nuevo, y enciende el punto ámbar de la barra, que
 * tenía estilos definidos y ningún consumidor.
 */
export function setFormDirty(value) {
  isFormDirty = value;
  const indicator = shell.querySelector('[data-dirty-indicator]');
  if (indicator) indicator.classList.toggle('visible', value);
}

window.addEventListener('beforeunload', (event) => {
  if (isFormDirty) {
    event.preventDefault();
  }
});
