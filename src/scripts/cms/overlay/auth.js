// @ts-check
/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { apiBase, config, state } from './context';
import { escapeHtml } from './html';
import { panel, panelBody, setAuthenticatedUI } from './shell';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { setInlineEditAccessibility } from './inline-edit-accessibility';
import { detectarFicha } from './ficha';
import { iniciarPendientes } from './pendientes';

export function loginView(error = '', email = '') {
  // Si el formulario ya está en pantalla y no hay un error nuevo que mostrar,
  // no se vuelve a renderizar: recrear el <form> descarta lo que el operador
  // ya escribió. `ensureSession()` corre al cargar la página y otra vez en
  // cada acción, así que dos llamadas seguidas borraban la contraseña a medio
  // tipear y dejaban huérfano el botón que se estaba por pulsar.
  if (!error && panelBody.querySelector('form[data-login]')) {
    panel.classList.add('open');
    return;
  }

  // M-2: el camino con error SÍ recreaba el formulario, así que una
  // contraseña mal escrita obligaba a teclear otra vez el correo — con diez
  // intentos por minuto antes de que el rate-limit bloquee. Se conserva.
  setPanelTitle('Acceso');
  openPanel(`
    <form data-login class="hm-cms-login-form">
      <div class="hm-cms-login-head">
        <h3>Entra para editar el sitio</h3>
        <p class="hm-cms-hint">Usa el correo y la contraseña que te dio quien administra el CMS.</p>
      </div>
      <label>Correo electrónico
        <input name="email" type="email" autocomplete="username" value="${escapeHtml(email)}" required />
      </label>
      <label>Contraseña
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      ${error ? `<p class="hm-cms-notice is-danger" role="alert">${escapeHtml(error)}</p>` : ''}
      <button type="submit">Entrar</button>
      ${config.isDev ? `<p class="hm-cms-hint">Servidor CMS (solo en desarrollo): ${apiBase}</p>` : ''}
    </form>
  `);
}

let limitesPedidos = false;
/** P3-04: una vez por carga, los topes de subida del servidor. */
function cargarLimites() {
  if (limitesPedidos) return;
  limitesPedidos = true;
  api('/api/cms/schema')
    .then((schema) => {
      const l = schema?.limites;
      if (l && Number.isFinite(l.fotoBytes) && Number.isFinite(l.videoBytes)) state.limites = l;
    })
    .catch(() => {
      limitesPedidos = false;
    });
}

export async function ensureSession() {
  try {
    const session = await api('/api/cms/session');
    if (!session.authenticated) {
      setAuthenticatedUI(false);
      setInlineEditAccessibility(false);
      loginView();
      return false;
    }
    state.csrfToken = session.csrfToken;
    cargarLimites();
    setAuthenticatedUI(true);
    setInlineEditAccessibility(true);
    detectarFicha();
    iniciarPendientes();
    return true;
  } catch (error) {
    setAuthenticatedUI(false);
    setInlineEditAccessibility(false);
    loginView(error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * P2-04/P2-18 (auditoría 2026-09): cualquier fallo al abrir un campo (404, 500,
 * red caída) mostraba la pantalla de «Acceso» aunque la sesión siguiera
 * abierta, y la persona volvía a escribir su contraseña sin motivo. Solo un
 * 401 pide entrar de nuevo; el resto se explica en el panel.
 */
/** @param {any} error */
export function errorAlAbrir(error) {
  if (error?.status === 401) {
    setAuthenticatedUI(false);
    setInlineEditAccessibility(false);
    loginView('Tu sesión terminó. Vuelve a entrar para seguir editando.');
    return;
  }
  setPanelTitle('No se pudo abrir');
  openPanel(`
    <div class="hm-cms-view hm-cms-stack">
      <p class="hm-cms-notice is-danger" role="alert">No se pudo abrir este elemento. ${escapeHtml(error?.message || '')}</p>
      <div class="hm-cms-actions">
        <button type="button" class="ghost" data-action="close">Cerrar</button>
      </div>
    </div>
  `);
}
