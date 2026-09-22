/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { botonesDeBarra } from './actions';
import { overlayStyles } from './styles';

const hojaDeEstilos = document.createElement('style');
hojaDeEstilos.textContent = overlayStyles;
document.head.appendChild(hojaDeEstilos);

export const shell = document.createElement('div');

shell.className = 'hm-cms-shell';

shell.innerHTML = `
  <div class="hm-cms-bar">
    <strong>Hidromont CMS</strong>
    <span class="hm-cms-badge" data-state-badge style="display:none"></span>
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
      <button type="button" class="secondary" data-action="close">Cerrar</button>
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
 * persona que ve esto: el overlay solo existe con `?cms=1`.
 */
document.body.prepend(shell);

document.body.classList.add('hm-cms-active');

// Las acciones de la barra solo existen con sesión iniciada: sin sesión se
// muestra el rótulo "Hidromont CMS" y nada más (antes "Salir" aparecía sin
// haber entrado, y Colecciones/Galería/Historial invitaban a clicks fallidos).
export function setAuthenticatedUI(isAuthenticated) {
  shell.querySelectorAll('[data-auth]').forEach((el) => {
    el.hidden = !isAuthenticated;
  });
}

export const panel = shell.querySelector('.hm-cms-panel');

export const panelBody = shell.querySelector('[data-panel-body]');

const stateBadge = shell.querySelector('[data-state-badge]');

export function setGlobalState(stateKey) {
  if (!stateBadge) return;
  if (!stateKey) {
    stateBadge.style.display = 'none';
    return;
  }
  // Etiquetas honestas: el CMS exporta y valida, pero NO despliega a producción.
  // «Exportado» no significa «visible en hidromont.cl» — eso requiere build+deploy.
  const map = {
    unsaved: { label: '● Sin exportar', cls: 'failed' },
    exported: { label: '✓ Exportado · falta desplegar', cls: 'succeeded' },
    warning: { label: '⚠ Exportado con omisiones', cls: 'failed' },
    error: { label: '✗ Error', cls: 'failed' },
  };
  const s = map[stateKey] || { label: stateKey, cls: '' };
  stateBadge.textContent = s.label;
  stateBadge.className = `hm-cms-badge ${s.cls}`;
  stateBadge.style.display = '';
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
