/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { apiBase, config, state } from './context';
import { escapeHtml } from './html';
import { panel, panelBody, setAuthenticatedUI } from './shell';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';

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
    <form data-login>
      <label>Correo electrónico
        <input name="email" type="email" autocomplete="username" value="${escapeHtml(email)}" required />
      </label>
      <label>Contraseña
        <input name="password" type="password" autocomplete="current-password" required />
      </label>
      ${error ? `<p class="hm-cms-error">${escapeHtml(error)}</p>` : ''}
      <button type="submit">Entrar</button>
      ${config.isDev ? `<p class="hm-cms-muted">Servidor CMS: ${apiBase}</p>` : ''}
    </form>
  `);
}

export async function ensureSession() {
  try {
    const session = await api('/api/cms/session');
    if (!session.authenticated) {
      setAuthenticatedUI(false);
      loginView();
      return false;
    }
    state.csrfToken = session.csrfToken;
    setAuthenticatedUI(true);
    return true;
  } catch (error) {
    setAuthenticatedUI(false);
    loginView(error.message);
    return false;
  }
}
