/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

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
    <button type="button" class="secondary" data-action="collections" data-auth hidden>Colecciones</button>
    <button type="button" class="secondary" data-action="gallery" data-auth hidden>Galería</button>
    <button type="button" class="secondary" data-action="jobs" data-auth hidden>Historial</button>
    <button type="button" class="secondary" data-action="admin" data-auth hidden title="Registro de actividad, respaldos de la base y cambio de contraseña.">Administrar</button>
    <button type="button" data-action="publish" data-auth hidden title="Exporta el contenido, compila el sitio y lo deja servido. El comando de validación es configurable (CMS_PUBLISH_CHECK_COMMAND).">Exportar y validar</button>
    <button type="button" class="secondary" data-action="logout" data-auth hidden>Salir</button>
  </div>
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

document.body.appendChild(shell);

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
