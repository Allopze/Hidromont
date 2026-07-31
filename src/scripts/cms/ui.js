import { overlayStyles } from './styles.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[char];
  });
}

export function formatDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function initUI(state) {
  const style = document.createElement('style');
  style.textContent = overlayStyles;
  document.head.appendChild(style);

  const shell = document.createElement('div');
  shell.className = 'hm-cms-shell';
  shell.innerHTML = `
    <div class="hm-cms-bar">
      <strong>Hidromont CMS</strong>
      <span class="hm-cms-badge" data-state-badge style="display:none"></span>
      <button type="button" class="secondary" data-action="collections">Colecciones</button>
      <button type="button" class="secondary" data-action="gallery">Galería</button>
      <button type="button" class="secondary" data-action="jobs">Historial</button>
      <button type="button" data-action="publish" title="Exporta el contenido a los archivos del sitio y ejecuta la validación (astro check). El despliegue a hidromont.cl es un paso aparte.">Exportar y validar</button>
      <button type="button" class="secondary" data-action="logout">Salir</button>
    </div>
    <aside class="hm-cms-panel" aria-label="Editor CMS">
      <header>
        <h2 data-panel-title>Editor</h2>
        <button type="button" class="secondary" data-action="close">Cerrar</button>
      </header>
      <main data-panel-body></main>
    </aside>
  `;
  document.body.appendChild(shell);

  const panel = shell.querySelector('.hm-cms-panel');
  const panelBody = shell.querySelector('[data-panel-body]');
  const stateBadge = shell.querySelector('[data-state-badge]');

  function setGlobalState(stateKey) {
    if (!stateBadge) return;
    if (!stateKey) {
      stateBadge.style.display = 'none';
      return;
    }
    const map = {
      unsaved: { label: '● Sin exportar', cls: 'failed' },
      exported: { label: '✓ Exportado · falta desplegar', cls: 'succeeded' },
      error: { label: '✗ Error', cls: 'failed' },
    };
    const s = map[stateKey] || { label: stateKey, cls: '' };
    stateBadge.textContent = s.label;
    stateBadge.className = `hm-cms-badge ${s.cls}`;
    stateBadge.style.display = '';
  }

  function setButtonLoading(button, isLoading, loadingText = '') {
    if (!button || !(button instanceof Element)) return;
    const btn = button.closest('button');
    if (!btn) return;
    if (isLoading) {
      if (!btn.hasAttribute('data-orig-html')) {
        btn.setAttribute('data-orig-html', btn.innerHTML);
      }
      btn.setAttribute('data-loading', 'true');
      btn.disabled = true;
      const label = loadingText || btn.textContent.trim();
      btn.innerHTML = `<span class="hm-cms-spinner"></span>${escapeHtml(label)}`;
    } else {
      btn.removeAttribute('data-loading');
      btn.disabled = false;
      const orig = btn.getAttribute('data-orig-html');
      if (orig) {
        btn.innerHTML = orig;
        btn.removeAttribute('data-orig-html');
      }
    }
  }

  function setPanelTitle(title) {
    const titleEl = shell.querySelector('[data-panel-title]');
    if (titleEl) titleEl.textContent = title;
  }

  function openPanel(html) {
    if (document.activeElement && !panel.contains(document.activeElement)) {
      state.lastActiveElement = document.activeElement;
    }
    panelBody.innerHTML = html;
    panel.classList.add('open');

    setTimeout(() => {
      const firstFocusable = panel.querySelector(
        'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable && typeof firstFocusable.focus === 'function') {
        firstFocusable.focus();
      }
    }, 50);
  }

  function closePanel() {
    panel.classList.remove('open');
    state.selected = null;
    state.entry = null;

    if (state.lastActiveElement && typeof state.lastActiveElement.focus === 'function') {
      state.lastActiveElement.focus();
      state.lastActiveElement = null;
    }
  }

  return {
    shell,
    panel,
    panelBody,
    setGlobalState,
    setButtonLoading,
    setPanelTitle,
    openPanel,
    closePanel,
  };
}
