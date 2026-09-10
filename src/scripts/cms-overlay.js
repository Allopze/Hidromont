(() => {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('cms') === '1' || window.localStorage.getItem('hidromont:cms') === '1';
  if (!enabled) return;
  window.localStorage.setItem('hidromont:cms', '1');

  const config = window.__HIDROMONT_CMS__ || {};
  const apiBase = config.apiBase || `${location.protocol}//${location.hostname}:8787`;
  const state = {
    csrfToken: '',
    selected: null,
    entry: null,
    mediaItems: [],
  };

  const style = document.createElement('style');
  style.textContent = `
    [data-cms-entry] {
      cursor: crosshair;
      outline-offset: 4px;
    }
    [data-cms-entry]:hover {
      outline: 2px solid #0065A9;
      box-shadow: 0 0 0 4px rgba(0,101,169,0.2);
    }
    .hm-cms-shell {
      position: fixed;
      z-index: 99999;
      inset: 0;
      pointer-events: none;
      font-family: Inter, system-ui, sans-serif;
    }
    .hm-cms-bar {
      pointer-events: auto;
      position: fixed;
      left: 16px;
      bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: #0F2433;
      color: white;
      border: 1px solid #D9E2EC;
      border-radius: 0px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.24);
    }
    .hm-cms-bar button,
    .hm-cms-panel button {
      border: 0;
      border-radius: 0px;
      padding: 9px 12px;
      min-height: 44px;
      min-width: 44px;
      font-weight: 700;
      background: #0065A9;
      color: #fff;
      cursor: pointer;
      transition: background-color 150ms ease;
    }
    .hm-cms-bar button:hover,
    .hm-cms-panel button:hover {
      background: #004B7D;
    }
    /* H-03: estilos :focus-visible para navegacion por teclado (WCAG 2.2 SC 2.4.7) */
    .hm-cms-bar button:focus-visible,
    .hm-cms-panel button:focus-visible {
      outline: 2px solid #00A6D6;
      outline-offset: 2px;
    }
    .hm-cms-bar button.secondary,
    .hm-cms-panel button.secondary {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    .hm-cms-bar button.secondary:hover,
    .hm-cms-panel button.secondary:hover {
      background: rgba(255,255,255,0.2);
    }
    /* H-06: estilo destructivo consistente para botones de eliminacion */
    .hm-cms-bar button.destructive,
    .hm-cms-panel button.destructive {
      background: #fee2e2;
      color: #991b1b;
    }
    .hm-cms-bar button.destructive:hover,
    .hm-cms-panel button.destructive:hover {
      background: #fecaca;
    }
    /* La barra flotante tapa el final de la página: damos aire al contenido. */
    body.hm-cms-active {
      padding-bottom: 84px;
    }
    .hm-cms-panel {
      pointer-events: auto;
      position: fixed;
      top: 0;
      right: 0;
      width: min(420px, 100vw);
      height: 100dvh;
      background: #F5F8FA;
      color: #1F2933;
      border-left: 1px solid #D9E2EC;
      box-shadow: -20px 0 60px rgba(15,36,51,0.24);
      transform: translateX(104%);
      transition: transform 180ms ease;
      display: flex;
      flex-direction: column;
    }
    .hm-cms-panel.open {
      transform: translateX(0);
    }
    .hm-cms-panel header {
      padding: 18px;
      background: #0F2433;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .hm-cms-panel header h2 {
      font-size: 16px;
      margin: 0;
      color: #fff;
    }
    .hm-cms-panel main {
      padding: 18px;
      overflow: auto;
      display: grid;
      gap: 14px;
    }
    .hm-cms-panel label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #1F2933;
    }
    .hm-cms-panel input,
    .hm-cms-panel textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #D9E2EC;
      border-radius: 0px;
      padding: 10px;
      font: inherit;
      color: #1F2933;
      background: white;
    }
    .hm-cms-panel input:focus-visible,
    .hm-cms-panel textarea:focus-visible,
    .hm-cms-panel select:focus-visible {
      outline: 2px solid #0065A9;
      outline-offset: 0;
      border-color: #0065A9;
      box-shadow: 0 0 0 3px rgba(0,101,169,0.2);
    }
    .hm-cms-panel textarea {
      min-height: 150px;
      resize: vertical;
    }
    .hm-cms-error {
      color: #C62828;
      font-size: 13px;
    }
    .hm-cms-muted {
      color: #5B6770;
      font-size: 12px;
      line-height: 1.5;
    }
    .hm-cms-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    /* H-05: spinner para operaciones asincronas */
    @keyframes hm-cms-spin {
      to { transform: rotate(360deg); }
    }
    .hm-cms-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: white;
      border-radius: 50%;
      animation: hm-cms-spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    button[data-loading] {
      opacity: 0.7;
      cursor: not-allowed;
      pointer-events: none;
    }
    .hm-cms-job-list {
      display: grid;
      gap: 10px;
    }
    .hm-cms-job {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid #D9E2EC;
      border-radius: 0px;
      background: white;
    }
    .hm-cms-job-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
      color: #1F2933;
    }
    .hm-cms-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 0px;
      padding: 3px 8px;
      background: #E6F2FA;
      color: #004B7D;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .hm-cms-badge.succeeded {
      background: #e8f5e9;
      color: #2E7D32;
    }
    .hm-cms-badge.failed {
      background: #ffebee;
      color: #C62828;
    }
    .hm-cms-log {
      max-height: 150px;
      overflow: auto;
      margin: 0;
      padding: 8px;
      border-radius: 0px;
      background: #0f172a;
      color: #dbeafe;
      font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
    }
    .hm-cms-image-preview {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid #cbd5e1;
      border-radius: 0px;
      background: white;
    }
    .hm-cms-image-preview img {
      width: 100%;
      max-height: 180px;
      object-fit: contain;
      background: #e2e8f0;
      border-radius: 0px;
    }
    .hm-cms-media-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      max-height: 260px;
      overflow: auto;
      padding-right: 2px;
    }
    .hm-cms-media-item {
      display: grid;
      gap: 6px;
      border: 1px solid #cbd5e1;
      border-radius: 0px;
      padding: 6px;
      background: white;
      color: #172331;
      text-align: left;
      cursor: pointer;
    }
    .hm-cms-media-item:hover,
    .hm-cms-media-item.selected {
      border-color: #0065A9;
      box-shadow: 0 0 0 3px rgba(0,101,169,0.16);
    }
    .hm-cms-media-item img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 0px;
      background: #e2e8f0;
    }
    .hm-cms-media-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 11px;
      color: #475569;
    }
    .hm-cms-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .hm-cms-revisions {
      display: grid;
      gap: 8px;
    }
    .hm-cms-revision-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 0px;
      background: white;
    }
    .hm-cms-revision-item.current {
      border-color: #0065A9;
      background: #eff8ff;
    }
    .hm-cms-revision-info {
      display: grid;
      gap: 2px;
    }
    .hm-cms-revision-version {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .hm-cms-revision-date {
      font-size: 11px;
      color: #64748b;
    }
    .hm-cms-collection-list {
      display: grid;
      gap: 6px;
    }
    .hm-cms-collection-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 0px;
      background: white;
    }
    .hm-cms-collection-item:hover {
      border-color: #0065A9;
    }
    .hm-cms-collection-info {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .hm-cms-collection-title {
      font-size: 13px;
      font-weight: 700;
      color: #172331;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .hm-cms-collection-meta {
      font-size: 11px;
      color: #64748b;
    }
    .hm-cms-collection-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .hm-cms-collection-actions button {
      font-size: 12px;
      padding: 5px 9px;
    }
    .hm-cms-tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: #e2e8f0;
      border-radius: 0px;
      margin-bottom: 12px;
    }
    .hm-cms-tab {
      flex: 1;
      padding: 7px 8px;
      border: 0;
      border-radius: 0px;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      background: transparent;
      color: #475569;
    }
    .hm-cms-tab.active {
      background: white;
      color: #172331;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    /* Sin este relevo de especificidad, la regla genérica
       ".hm-cms-panel button" (azul) pisaba a ".hm-cms-tab": las pestañas
       inactivas se veían rellenas de azul y la activa blanca, al revés. */
    .hm-cms-panel .hm-cms-tab {
      background: transparent;
      color: #475569;
      border: 0;
    }
    .hm-cms-panel .hm-cms-tab.active {
      background: white;
      color: #172331;
    }
    /* Los botones secundarios del cuerpo claro del panel (Editar, Volver,
       Cancelar) necesitan fondo visible: el "secondary" blanco al 10% está
       pensado para el header oscuro y aquí desaparecía. */
    .hm-cms-panel main button.secondary {
      background: white;
      color: #1f2933;
      border: 1px solid #cbd5e1;
    }
    .hm-cms-panel main button.secondary:hover {
      background: #f1f5f9;
    }
    .hm-cms-entry-form {
      display: grid;
      gap: 12px;
    }
    .hm-cms-entry-form label {
      display: grid;
      gap: 5px;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .hm-cms-entry-form input,
    .hm-cms-entry-form select,
    .hm-cms-entry-form textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 0px;
      padding: 9px 10px;
      font: inherit;
      color: #172331;
      background: white;
    }
    .hm-cms-entry-form textarea {
      min-height: 120px;
      resize: vertical;
    }
    .hm-cms-badge.draft { background: #fef3c7; color: #92400e; }
    .hm-cms-badge.published { background: #dcfce7; color: #166534; }
    .hm-cms-gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    .hm-cms-gallery-thumb {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 0px;
      border: 2px solid transparent;
      cursor: pointer;
      background: #e2e8f0;
    }
    .hm-cms-gallery-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hm-cms-gallery-thumb:hover { border-color: #0065A9; }
    .hm-cms-gallery-thumb .hm-cms-gallery-featured {
      position: absolute;
      top: 3px;
      right: 3px;
      background: #00A6D6;
      color: white;
      font-size: 9px;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 0px;
      text-transform: uppercase;
    }
    .hm-cms-gallery-cat-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 0px;
      background: white;
      cursor: pointer;
      text-align: left;
      font: inherit;
      font-size: 13px;
      color: #172331;
    }
    .hm-cms-gallery-cat-btn:hover { border-color: #0065A9; }
    .hm-cms-gallery-cat-name { font-weight: 700; }
    .hm-cms-gallery-cat-slug { font-size: 11px; color: #64748b; font-family: ui-monospace, monospace; }
    @media (max-width: 640px) {
      .hm-cms-bar {
        left: 8px;
        right: 8px;
        bottom: 8px;
        justify-content: space-between;
      }
      .hm-cms-panel {
        width: 100vw;
      }
    }
    /* H-08: indicador de cambios sin guardar */
    .hm-cms-autosave-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f59e0b;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 200ms ease;
    }
    .hm-cms-autosave-indicator.visible {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  const shell = document.createElement('div');
  shell.className = 'hm-cms-shell';
  shell.innerHTML = `
    <div class="hm-cms-bar">
      <strong>Hidromont CMS</strong>
      <span class="hm-cms-badge" data-state-badge style="display:none"></span>
      <span class="hm-cms-autosave-indicator" data-dirty-indicator title="Hay cambios sin guardar" aria-hidden="true"></span>
      <button type="button" class="secondary" data-action="collections" data-auth hidden>Colecciones</button>
      <button type="button" class="secondary" data-action="gallery" data-auth hidden>Galería</button>
      <button type="button" class="secondary" data-action="jobs" data-auth hidden>Historial</button>
      <button type="button" data-action="publish" data-auth hidden title="Exporta el contenido, compila el sitio y lo deja servido. El comando de validación es configurable (CMS_PUBLISH_CHECK_COMMAND).">Exportar y validar</button>
      <button type="button" class="secondary" data-action="logout" data-auth hidden>Salir</button>
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
  document.body.classList.add('hm-cms-active');

  // Las acciones de la barra solo existen con sesión iniciada: sin sesión se
  // muestra el rótulo "Hidromont CMS" y nada más (antes "Salir" aparecía sin
  // haber entrado, y Colecciones/Galería/Historial invitaban a clicks fallidos).
  function setAuthenticatedUI(isAuthenticated) {
    shell.querySelectorAll('[data-auth]').forEach((el) => {
      el.hidden = !isAuthenticated;
    });
  }

  const panel = shell.querySelector('.hm-cms-panel');
  const panelBody = shell.querySelector('[data-panel-body]');
  const stateBadge = shell.querySelector('[data-state-badge]');

  function setGlobalState(stateKey) {
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

  let lastActiveElement = null;
  let isFormDirty = false;

  /**
   * A-11: el estado sucio se marcaba pero nunca se limpiaba, ni siquiera tras
   * guardar. El aviso del navegador al salir saltaba para siempre desde la
   * primera tecla, así que se aprendía a ignorarlo — y era la única
   * protección que había. Ahora se apaga en cada guardado correcto y al
   * abrir un formulario nuevo, y enciende el punto ámbar de la barra, que
   * tenía estilos definidos y ningún consumidor.
   */
  function setFormDirty(value) {
    isFormDirty = value;
    const indicator = shell.querySelector('[data-dirty-indicator]');
    if (indicator) indicator.classList.toggle('visible', value);
  }

  window.addEventListener('beforeunload', (event) => {
    if (isFormDirty) {
      event.preventDefault();
    }
  });

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

  async function api(path, options = {}) {
    const headers = options.headers || {};
    if (state.csrfToken && options.method && options.method !== 'GET') {
      headers['X-CSRF-Token'] = state.csrfToken;
    }
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // P0-D: el status y el detalle estructurado se pierden si solo se
      // propaga el mensaje. Los necesitan A-1 (campos inválidos), A-3
      // (distinguir el 409 de conflicto de edición) y B-1.
      throw Object.assign(new Error(data.error || 'Error CMS'), {
        status: response.status,
        details: data.details,
        // M-2: el servidor manda Retry-After en el 429 del rate-limit y
        // nadie lo leía, así que el aviso decía «espere» sin decir cuánto.
        retryAfter: Number(response.headers.get('Retry-After')) || undefined,
      });
    }
    return data;
  }

  /**
   * @param autofocus Mover el foco al primer control del panel. Se desactiva
   *   al repintar una lista filtrada: el foco debe quedarse en el buscador que
   *   el operador está usando, y este autofoco (diferido 50 ms) se lo robaba.
   */
  function openPanel(html, { autofocus = true } = {}) {
    if (document.activeElement && !panel.contains(document.activeElement)) {
      lastActiveElement = document.activeElement;
    }
    // Cada openPanel destruye el formulario anterior: arrastrar el estado
    // sucio de una vista a la siguiente siempre sería incorrecto.
    setFormDirty(false);
    panelBody.innerHTML = html;
    panel.classList.add('open');

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

  function closePanel(force = false) {
    // A-11: Escape y «Cerrar» descartaban lo escrito sin preguntar, aunque el
    // estado sucio ya se estaba registrando para el aviso del navegador.
    if (
      !force &&
      isFormDirty &&
      !window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')
    ) {
      return;
    }
    setFormDirty(false);
    panel.classList.remove('open');
    state.selected = null;
    state.entry = null;

    // H-02: Restaurar el foco al elemento interactivo previo al cerrar
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
      lastActiveElement = null;
    }
  }

  function loginView(error = '', email = '') {
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

  async function ensureSession() {
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

  function fieldEditor(element, entry, field) {
    const cmsType = element.dataset.cmsType || 'text';
    const current = entry.fields[field]?.value ?? '';
    const altField = element.dataset.cmsAltField;
    const altValue = altField
      ? (entry.fields[altField]?.value ?? element.getAttribute('alt') ?? '')
      : '';

    if (cmsType === 'image') {
      return `
        <div class="hm-cms-image-preview">
          <img src="${escapeHtml(String(current))}" alt="${escapeHtml(String(altValue))}" data-image-preview />
          <p class="hm-cms-muted" data-selected-media-label>Imagen actual</p>
        </div>
        <label>Ruta de imagen
          <input name="value" value="${escapeHtml(String(current))}" />
        </label>
        ${
          altField
            ? `<label>Texto alternativo
          <input name="alt" value="${escapeHtml(String(altValue))}" />
        </label>`
            : ''
        }
        <input name="mediaId" type="hidden" value="" />
        <div class="hm-cms-two">
          <label>Foco X
            <input name="focalX" type="number" min="0" max="1" step="0.01" value="0.5" />
          </label>
          <label>Foco Y
            <input name="focalY" type="number" min="0" max="1" step="0.01" value="0.5" />
          </label>
        </div>
        <label>Subir imagen
          <input name="file" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <label>Biblioteca de medios
          <input name="mediaSearch" type="search" placeholder="Buscar por nombre o alt" data-media-search />
        </label>
        <div data-media-grid class="hm-cms-media-grid">
          <p class="hm-cms-muted">Cargando medios...</p>
        </div>
      `;
    }

    if (cmsType === 'textarea' || cmsType === 'richtext') {
      return `
        <label>Contenido
          <textarea name="value">${escapeHtml(String(current))}</textarea>
        </label>
      `;
    }

    if (cmsType === 'list') {
      return `
        <p class="hm-cms-muted" style="margin:0 0 8px">Items de la lista:</p>
        ${listEditorMarkup(asList(current), 'value')}
      `;
    }

    if (cmsType === 'number') {
      return `
        <label>Valor numérico
          <input name="value" type="number" value="${escapeHtml(String(current))}" step="any" />
        </label>
      `;
    }

    if (cmsType === 'link') {
      const link =
        typeof current === 'object' && current !== null
          ? current
          : { label: String(current), href: '' };
      return `
        <label>Texto del enlace
          <input name="link-label" value="${escapeHtml(String(link.label ?? ''))}" />
        </label>
        <label>URL
          <input name="link-href" value="${escapeHtml(String(link.href ?? ''))}" />
        </label>
        <input name="value" type="hidden" value="${escapeHtml(JSON.stringify(link))}" />
      `;
    }

    return `
      <label>Contenido
        <input name="value" value="${escapeHtml(String(current))}" />
      </label>
    `;
  }

  /**
   * A-8: markup del editor de listas, reutilizado por el editor de campo
   * suelto y por el formulario de colección. `inputName` existe porque el
   * formulario de colección puede tener varias listas a la vez (tipos,
   * aplicaciones, normas) y cada una necesita su propio hidden.
   */
  function listEditorMarkup(items, inputName) {
    return `
        <div data-list-editor>
          <div data-list-items style="display:grid;gap:6px;margin-bottom:8px">
            ${items
              .map(
                (item, i) => `
              <div style="display:flex;gap:6px;align-items:center">
                <input type="text" data-list-item="${i}" value="${escapeHtml(String(item))}" style="flex:1;border:1px solid #cbd5e1;border-radius:0px;padding:8px 10px;font:inherit" />
                <button type="button" class="secondary destructive" data-action="remove-list-item" data-index="${i}" style="font-weight:700">×</button>
              </div>
            `
              )
              .join('')}
          </div>
          <button type="button" data-action="add-list-item" style="border:1px dashed #cbd5e1;background:white;color:#334155;border-radius:0px;padding:8px 12px;cursor:pointer;font:inherit;width:100%;text-align:left">+ Agregar item</button>
          <input name="${escapeHtml(inputName)}" type="hidden" data-field-type="list" value="${escapeHtml(JSON.stringify(items))}" />
        </div>
      `;
  }

  function asList(value) {
    if (Array.isArray(value)) return value;
    return typeof value === 'string' && value ? [value] : [];
  }

  /**
   * A-8: se acota al `[data-list-editor]` que contiene el input tocado. Antes
   * buscaba en todo el formulario y el hidden fijo `[name="value"]`, lo que
   * bastaba con un solo editor por formulario pero colisiona en cuanto hay
   * varias listas, como en el formulario de colección.
   */
  function syncListValue(scope) {
    const editor = scope?.closest?.('[data-list-editor]') ?? scope;
    if (!editor) return;
    const items = Array.from(editor.querySelectorAll('[data-list-item]')).map(
      (input) => input.value
    );
    const hidden = editor.querySelector('input[type="hidden"]');
    if (hidden) hidden.value = JSON.stringify(items);
  }

  function syncLinkValue(form) {
    const label = form.querySelector('[name="link-label"]')?.value || '';
    const href = form.querySelector('[name="link-href"]')?.value || '';
    const hidden = form.querySelector('[name="value"]');
    if (hidden) hidden.value = JSON.stringify({ label, href });
  }

  // JS-8: several callers pass API fields straight through (item.id, item.alt,
  // cat.name, etc.) without knowing whether the API actually returned a
  // string — a null/number field made this throw and abort the whole panel
  // render with no visible error. Coerce first so it never does.
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return map[char];
    });
  }

  async function selectElement(element) {
    if (!(await ensureSession())) return;

    const entryId = element.dataset.cmsEntry;
    const field = element.dataset.cmsField;
    if (!entryId || !field) return;

    const entry = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`);
    state.selected = element;
    state.entry = entry;

    openPanel(`
      <form data-edit>
        <p class="hm-cms-muted">${entryId}.${field}</p>
        ${fieldEditor(element, entry, field)}
        <div class="hm-cms-actions">
          <button type="submit">Guardar</button>
          ${
            element.dataset.cmsType === 'image'
              ? ''
              : `<button type="button" class="secondary destructive" data-action="clear-field">Vaciar este texto</button>`
          }
          <button type="button" class="secondary" data-action="export">Exportar</button>
          <button type="button" class="secondary" data-action="revisions" data-entry-id="${escapeHtml(entryId)}">Revisiones</button>
        </div>
        <p class="hm-cms-muted" data-status>Sin cambios guardados.</p>
      </form>
    `);

    if (element.dataset.cmsType === 'image') {
      loadMediaPicker();
    }
  }

  /**
   * A-2 — Un solo selector de medios, paginado y con búsqueda en el servidor.
   *
   * Antes había dos implementaciones casi idénticas y ambas pedían
   * `/api/cms/media` sin parámetros: recibían las 100 más recientes y
   * filtraban en memoria. Con 2.122 assets en el catálogo, 2.022 eran
   * inalcanzables desde la interfaz — y el editor acababa subiendo
   * duplicados de fotos que ya estaban en el sistema. El servidor ya sabía
   * paginar y buscar sobre name/alt/path; solo faltaba usarlo.
   */
  const MEDIA_PAGE_SIZE = 60;
  const mediaPicker = { query: '', page: 1, pages: 1, total: 0, loading: false, seq: 0 };
  let mediaSearchTimer;

  function mediaTileMarkup(item, { action, selected }) {
    // C-2: un asset cuyo archivo no está en disco se marca en vez de
    // renderizarse como una miniatura rota sin explicación.
    const cuerpo = item.missing
      ? `<span class="hm-cms-media-name" style="display:grid;place-items:center;aspect-ratio:4/3;background:#f1f5f9;color:#991b1b;text-align:center">⚠ archivo<br />no encontrado</span>`
      : `<img src="${escapeHtml(item.path)}" alt="${escapeHtml(item.alt || item.name)}" loading="lazy" />`;
    return `
      <button
        type="button"
        class="hm-cms-media-item ${selected ? 'selected' : ''}"
        data-action="${action}"
        data-media-id="${escapeHtml(item.id)}"
        ${item.missing ? 'disabled title="El archivo no existe en disco"' : ''}
      >
        ${cuerpo}
        <span class="hm-cms-media-name">${escapeHtml(item.name)}</span>
        ${item.usageCount > 0 ? `<span class="hm-cms-badge" style="font-size:10px;align-self:start">Usado: ${item.usageCount}</span>` : ''}
      </button>
    `;
  }

  /** Descriptor del selector activo: el del editor de campo o el de galería. */
  function activeMediaPicker() {
    const galleryGrid = panelBody.querySelector('[data-gallery-media-grid]');
    if (galleryGrid) {
      const form = panelBody.querySelector('[data-gallery-item-form]');
      return {
        grid: galleryGrid,
        action: 'gallery-select-media',
        selectedId: form?.querySelector('[name="mediaId"]')?.value || '',
        selectedPath: '',
      };
    }
    const grid = panelBody.querySelector('[data-media-grid]');
    if (!grid) return null;
    const form = panelBody.querySelector('[data-edit]');
    return {
      grid,
      action: 'select-media',
      selectedId: '',
      selectedPath: form?.elements.value?.value || '',
    };
  }

  function renderMediaPicker() {
    const picker = activeMediaPicker();
    if (!picker) return;

    if (!state.mediaItems.length) {
      picker.grid.innerHTML = mediaPicker.loading
        ? '<p class="hm-cms-muted">Buscando...</p>'
        : '<p class="hm-cms-muted">No hay medios que coincidan.</p>';
      return;
    }

    const restantes = Math.max(0, mediaPicker.total - state.mediaItems.length);
    picker.grid.innerHTML =
      state.mediaItems
        .map((item) =>
          mediaTileMarkup(item, {
            action: picker.action,
            selected: picker.selectedId
              ? item.id === picker.selectedId
              : item.path === picker.selectedPath,
          })
        )
        .join('') +
      `<p class="hm-cms-muted" style="grid-column:1/-1;margin:4px 0 0">Mostrando ${state.mediaItems.length} de ${mediaPicker.total}.</p>` +
      (restantes > 0
        ? `<button type="button" class="secondary" data-action="load-more-media" style="grid-column:1/-1">${
            mediaPicker.loading ? 'Cargando...' : `Cargar más (${restantes} restantes)`
          }</button>`
        : '');
  }

  async function loadMediaPicker({ reset = true } = {}) {
    const picker = activeMediaPicker();
    if (!picker || mediaPicker.loading) return;

    if (reset) {
      mediaPicker.page = 1;
      state.mediaItems = [];
    }
    mediaPicker.loading = true;
    const seq = ++mediaPicker.seq;
    renderMediaPicker();

    try {
      const params = new URLSearchParams({
        page: String(mediaPicker.page),
        limit: String(MEDIA_PAGE_SIZE),
      });
      if (mediaPicker.query) params.set('q', mediaPicker.query);
      const data = await api(`/api/cms/media?${params}`);
      // Descartar respuestas fuera de orden: con LIKE sobre tres columnas sin
      // índice, escribir rápido las devuelve desordenadas.
      if (seq !== mediaPicker.seq) return;

      const nuevos = data.items || [];
      // `state.mediaItems` es buffer acumulado a propósito: los handlers de
      // selección resuelven el asset por id contra él.
      state.mediaItems = reset ? nuevos : [...state.mediaItems, ...nuevos];
      mediaPicker.total = data.total ?? state.mediaItems.length;
      mediaPicker.pages = data.pages ?? 1;
      mediaPicker.loading = false;
      renderMediaPicker();
    } catch (error) {
      mediaPicker.loading = false;
      if (seq !== mediaPicker.seq) return;
      picker.grid.innerHTML = `<p class="hm-cms-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function searchMediaPicker(query) {
    mediaPicker.query = query.trim();
    clearTimeout(mediaSearchTimer);
    mediaSearchTimer = setTimeout(() => loadMediaPicker({ reset: true }), 300);
  }

  function applyMediaSelection(asset) {
    const form = panelBody.querySelector('[data-edit]');
    if (!form) return;

    form.elements.value.value = asset.path;
    form.elements.mediaId.value = asset.id;
    if (form.elements.alt && asset.alt) form.elements.alt.value = asset.alt;
    if (form.elements.focalX) form.elements.focalX.value = asset.focalX ?? 0.5;
    if (form.elements.focalY) form.elements.focalY.value = asset.focalY ?? 0.5;

    const preview = panelBody.querySelector('[data-image-preview]');
    if (preview) {
      preview.setAttribute('src', asset.path);
      preview.setAttribute('alt', asset.alt || asset.name);
    }

    const label = panelBody.querySelector('[data-selected-media-label]');
    if (label)
      label.textContent = `${asset.name}${asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}`;

    renderMediaPicker();
  }

  function formatDate(value) {
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

  /**
   * A-7/A-9: lo que el export dejó fuera y lo que volvió al texto por
   * defecto. Antes esto solo salía por el stderr del servidor mientras el job
   * se cerraba como correcto, así que un proyecto podía dejar de publicarse
   * sin que el editor se enterara.
   */
  function exportNoticeMarkup(exported) {
    const omitidas = exported?.skipped || [];
    const revertidas = exported?.revertedToFallback || [];
    if (!omitidas.length && !revertidas.length) return '';

    const lista = (titulo, filas) =>
      filas.length
        ? `<p style="margin:0 0 4px"><strong>${escapeHtml(titulo)}</strong></p>
           <ul style="margin:0 0 8px;padding-left:18px">
             ${filas.join('')}
           </ul>`
        : '';

    return `
      <div class="hm-cms-muted" style="background:#fffbeb;border:1px solid #fde68a;border-radius:0px;padding:10px 12px;margin-bottom:10px">
        ${lista(
          'No se publicaron (corrige el campo y vuelve a exportar):',
          omitidas.map(
            (e) =>
              `<li>${escapeHtml(e.slug)} — ${escapeHtml(e.reason)}
                 <button type="button" class="secondary" style="font-size:11px;padding:3px 7px;margin-left:6px" data-action="edit-entry" data-entry-id="${escapeHtml(e.id)}">Editar</button>
               </li>`
          )
        )}
        ${lista(
          'En borrador: el sitio muestra el texto por defecto del código',
          revertidas.map((e) => `<li>${escapeHtml(e.title)} (${escapeHtml(e.id)})</li>`)
        )}
      </div>
    `;
  }

  function renderPublishJobs(items) {
    if (!items.length) {
      openPanel('<p class="hm-cms-muted">Aun no hay publicaciones registradas.</p>');
      return;
    }

    openPanel(`
      <section class="hm-cms-job-list">
        <p class="hm-cms-muted">Historial de exportaciones y validaciones.</p>
        <p class="hm-cms-muted" style="background:#eff8ff;border:1px solid #bae6fd;border-radius:0px;padding:8px 10px">
          ℹ️ «Publicar» exporta el contenido y compila el sitio. Cuando el CMS corre en el mismo servidor que el sitio, el cambio queda en línea al terminar; si editas en local, falta subir el resultado.
        </p>
        ${items
          .map(
            (job) => `
          <article class="hm-cms-job">
            <div class="hm-cms-job-title">
              <span>${escapeHtml(job.action === 'export' ? 'Exportacion' : 'Publicacion')}</span>
              <span class="hm-cms-badge ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
            </div>
            <p class="hm-cms-muted">${escapeHtml(formatDate(job.createdAt))}${job.completedAt ? ` - ${escapeHtml(formatDate(job.completedAt))}` : ''}</p>
            <p class="hm-cms-muted">${escapeHtml(job.id)}</p>
            <pre class="hm-cms-log" tabindex="0" aria-label="Registro de la publicación">${escapeHtml((job.logs || []).slice(-8).join('\n'))}</pre>
          </article>
        `
          )
          .join('')}
      </section>
    `);
  }

  async function loadRevisions(entryId) {
    if (!(await ensureSession())) return;
    openPanel(`<p class="hm-cms-muted">Cargando revisiones de ${escapeHtml(entryId)}...</p>`);
    try {
      const data = await api(`/api/cms/revisions/${encodeURIComponent(entryId)}`);
      const revisions = data.revisions || [];

      if (!revisions.length) {
        openPanel(`
          <p class="hm-cms-muted">Sin revisiones registradas para <strong>${escapeHtml(entryId)}</strong>.</p>
          <button type="button" class="secondary" data-action="back-to-editor">← Volver</button>
        `);
        return;
      }

      const currentVersion = revisions[0]?.version ?? 0;

      openPanel(`
        <div style="display:grid;gap:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <strong style="font-size:14px">Revisiones de ${escapeHtml(entryId)}</strong>
            <button type="button" class="secondary" data-action="back-to-editor">← Volver</button>
          </div>
          <p class="hm-cms-muted">Haga clic en «Restaurar» para volver a esa versión.</p>
          <div class="hm-cms-revisions">
            ${revisions
              .map(
                (rev) => `
              <div class="hm-cms-revision-item${rev.version === currentVersion ? ' current' : ''}">
                <div class="hm-cms-revision-info">
                  <span class="hm-cms-revision-version">v${rev.version}${rev.version === currentVersion ? ' · actual' : ''}</span>
                  <span class="hm-cms-revision-date">${escapeHtml(formatDate(rev.createdAt))}</span>
                </div>
                ${
                  rev.version !== currentVersion
                    ? `
                  <button
                    type="button"
                    class="secondary"
                    style="font-size:12px;padding:6px 10px"
                    data-action="restore-revision"
                    data-entry-id="${escapeHtml(entryId)}"
                    data-revision-id="${escapeHtml(rev.id)}"
                    data-revision-version="${rev.version}"
                  >Restaurar</button>
                `
                    : '<span class="hm-cms-badge" style="font-size:10px">Versión actual</span>'
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  async function loadPublishJobs() {
    if (!(await ensureSession())) return;
    openPanel('<p class="hm-cms-muted">Cargando historial...</p>');
    try {
      const data = await api('/api/cms/publish/jobs');
      renderPublishJobs(data.items || []);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  /**
   * X-001: actualiza el contenido de texto editable de un elemento sin destruir
   * markup anidado (iconos, badges, spans hermanos).
   *
   * Estrategia:
   *   - Si el elemento tiene un unico child node de tipo texto, lo actualiza in place.
   *   - Si tiene varios nodos, busca el primer textNode directo y lo actualiza,
   *     preservando el resto. Si no hay textNode directo, inserta uno al inicio.
   *   - Solo recurre a `textContent` cuando el elemento no tiene hijos elemento
   *     (caso texto plano, el mas comun).
   */
  function updateEditableText(element, newValue) {
    const children = Array.from(element.childNodes);
    const elementChildren = children.filter((node) => node.nodeType === Node.ELEMENT_NODE);

    // Caso simple: solo texto (o vacio). textNode seguro, no destruye nada.
    if (elementChildren.length === 0) {
      element.textContent = newValue;
      return;
    }

    // Hay markup anidado: preservarlo, actualizar solo el texto editable.
    const textNodes = children.filter(
      (node) =>
        node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim().length > 0
    );
    if (textNodes.length > 0) {
      // Actualizar el primer textNode significativo.
      textNodes[0].nodeValue = newValue;
    } else {
      // No habia textNode directo: insertar uno antes del primer elemento hijo.
      element.insertBefore(document.createTextNode(newValue), elementChildren[0]);
    }
  }

  /**
   * A-3: pinta un conflicto de edición sin destruir lo que el editor escribió.
   * Ofrece ver el valor que hay ahora en el servidor y, si aun así quiere
   * imponer el suyo, reintentar contra la versión actual.
   */
  function renderConflict(form, entryId, field, message) {
    const status = form.querySelector('[data-status]');
    if (!status) return;
    status.innerHTML = `
      <span class="hm-cms-error">${escapeHtml(message)}</span>
      <span class="hm-cms-actions" style="margin-top:8px">
        <button type="button" class="secondary" data-action="show-server-value"
          data-entry-id="${escapeHtml(entryId)}" data-field="${escapeHtml(field)}">Ver valor del servidor</button>
        <button type="button" class="secondary" data-action="force-save">Guardar de todos modos</button>
      </span>
      <span data-server-value></span>
    `;
  }

  async function saveEdit(form) {
    const element = state.selected;
    if (!element || !state.entry) return;

    const entryId = element.dataset.cmsEntry;
    const field = element.dataset.cmsField;
    const status = form.querySelector('[data-status]');
    status.textContent = 'Guardando...';

    const file = form.elements.file?.files?.[0];
    let value = form.elements.value.value;

    if (file) {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('alt', form.elements.alt?.value || '');
      const uploaded = await fetch(`${apiBase}/api/cms/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': state.csrfToken },
        body: payload,
      }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al subir imagen');
        return data;
      });
      value = uploaded.path;
      form.elements.value.value = value;
      form.elements.mediaId.value = uploaded.id;
      state.mediaItems = [uploaded, ...state.mediaItems.filter((item) => item.id !== uploaded.id)];
      applyMediaSelection(uploaded);
    }

    if (element.dataset.cmsType === 'image' && form.elements.mediaId?.value) {
      await api(`/api/cms/media/${encodeURIComponent(form.elements.mediaId.value)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alt: form.elements.alt?.value || undefined,
          focalX: Number.parseFloat(form.elements.focalX?.value || '0.5'),
          focalY: Number.parseFloat(form.elements.focalY?.value || '0.5'),
        }),
      });
    }

    // A-3: el servidor ya sabía detectar ediciones concurrentes
    // (ContentRepository.updateField compara `expectedVersion` contra la
    // versión actual y lanza un conflicto detallado), pero el overlay nunca
    // se la enviaba: con dos pestañas abiertas ganaba la última escritura,
    // en silencio y sin rastro visible.
    let updated;
    try {
      updated = await api(
        `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(field)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          // A-4: `mediaId` alimenta media_usages, que es lo que permite
          // avisar de en qué páginas se usa una foto antes de borrarla.
          body: JSON.stringify({
            value,
            expectedVersion: state.entry.version,
            mediaId: form.elements.mediaId?.value || undefined,
          }),
        }
      );
    } catch (error) {
      if (error.status === 409) {
        // No se re-renderiza el formulario: lo que el editor escribió sigue
        // en pantalla y puede copiarlo antes de decidir.
        renderConflict(form, entryId, field, error.message);
        return;
      }
      throw error;
    }
    // Imprescindible: sin esto el segundo guardado del mismo panel mandaría
    // una versión rancia y el editor entraría en conflicto consigo mismo.
    state.entry = updated;

    if (element.dataset.cmsType === 'image') {
      element.setAttribute('src', value);
      const altField = element.dataset.cmsAltField;
      if (altField && form.elements.alt) {
        const altValue = form.elements.alt.value;
        state.entry = await api(
          `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(altField)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: altValue, expectedVersion: state.entry.version }),
          }
        );
        element.setAttribute('alt', altValue);
      }
    } else {
      // X-001: actualizar el contenido de texto sin destruir markup anidado.
      // Antes se hacia `element.textContent = value`, lo que borraba cualquier hijo
      // elemento (iconos, badges, spans) dentro de un <EditableText as="h1"> con slot
      // multi-nodo. Ahora editamos solo el textNode editable, preservando el resto.
      const newValue = updated.fields[field]?.value ?? value;
      updateEditableText(element, newValue);
    }

    status.textContent =
      'Guardado en la base de datos. Usa «Exportar y validar» para escribir los archivos del sitio.';
    setGlobalState('unsaved');
    // A-11: este es el único guardado que no reabre el panel (los formularios
    // de colección y galería vuelven a su listado, y openPanel ya lo limpia).
    setFormDirty(false);
  }

  // ─── Gallery management ──────────────────────────────────────────────────

  // Gallery view state tracking

  async function loadGallery() {
    if (!(await ensureSession())) return;
    galleryView = 'main';
    setPanelTitle('Galería');
    openPanel('<p class="hm-cms-muted">Cargando galería...</p>');
    try {
      const [catsData, albumsData, itemsData] = await Promise.all([
        api('/api/cms/gallery/categories'),
        api('/api/cms/gallery/albums'),
        api('/api/cms/gallery/items'),
      ]);
      const cats = catsData.items || [];
      const albums = albumsData.items || [];
      const items = itemsData.items || [];
      openPanel(`
        <div style="display:grid;gap:12px">
          <p class="hm-cms-muted">Gestiona las imágenes que aparecen en la página de galería del sitio.</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            <button type="button" data-action="gallery-cats" style="padding:16px;border:1px solid #cbd5e1;border-radius:0px;background:white;cursor:pointer;text-align:center">
              <strong style="display:block;font-size:24px;color:#0065A9">${cats.length}</strong>
              <span style="font-size:12px;color:#475569">Categorías</span>
            </button>
            <button type="button" data-action="gallery-albums" style="padding:16px;border:1px solid #cbd5e1;border-radius:0px;background:white;cursor:pointer;text-align:center">
              <strong style="display:block;font-size:24px;color:#0065A9">${albums.length}</strong>
              <span style="font-size:12px;color:#475569">Álbumes</span>
            </button>
            <button type="button" data-action="gallery-items" style="padding:16px;border:1px solid #cbd5e1;border-radius:0px;background:white;cursor:pointer;text-align:center">
              <strong style="display:block;font-size:24px;color:#0065A9">${items.length}</strong>
              <span style="font-size:12px;color:#475569">Imágenes</span>
            </button>
          </div>
          <button type="button" data-action="gallery-cats">Gestionar categorías</button>
          <button type="button" data-action="gallery-albums">Gestionar álbumes</button>
          <button type="button" data-action="gallery-items">Gestionar imágenes</button>
        </div>
      `);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  async function loadGalleryCategories() {
    if (!(await ensureSession())) return;
    galleryView = 'categories';
    setPanelTitle('Categorías de galería');
    openPanel('<p class="hm-cms-muted">Cargando categorías...</p>');
    try {
      const data = await api('/api/cms/gallery/categories');
      const cats = data.items || [];
      openPanel(`
        <div style="display:grid;gap:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="font-size:13px;color:#64748b">${cats.length} categorías</span>
            <button type="button" data-action="gallery-new-cat">+ Nueva categoría</button>
          </div>
          <div style="display:grid;gap:6px">
            ${cats
              .map(
                (cat) => `
              <div class="hm-cms-gallery-cat-btn" data-cat-id="${escapeHtml(cat.id)}">
                <div>
                  <span class="hm-cms-gallery-cat-name">${escapeHtml(cat.name)}</span>
                  <span class="hm-cms-gallery-cat-slug">${escapeHtml(cat.slug)}</span>
                </div>
                <div style="display:flex;gap:4px">
                  <button type="button" class="secondary" style="font-size:11px;padding:4px 8px" data-action="gallery-edit-cat" data-cat-id="${escapeHtml(cat.id)}">Editar</button>
                  <button type="button" class="secondary destructive" style="font-size:11px;padding:4px 8px" data-action="gallery-delete-cat" data-cat-id="${escapeHtml(cat.id)}" data-cat-name="${escapeHtml(cat.name)}">×</button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          <button type="button" class="secondary" data-action="gallery">← Volver a galería</button>
        </div>
      `);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  async function showGalleryCategoryForm(catId = null) {
    if (!(await ensureSession())) return;
    setPanelTitle(catId ? 'Editar categoría' : 'Nueva categoría');

    let cat = { name: '', slug: '' };
    if (catId) {
      try {
        const data = await api('/api/cms/gallery/categories');
        cat = (data.items || []).find((c) => c.id === catId) || cat;
      } catch {
        /* use defaults */
      }
    }

    openPanel(`
      <form data-gallery-cat-form data-cat-id="${catId ? escapeHtml(catId) : ''}">
        <label>Nombre
          <input name="name" value="${escapeHtml(cat.name)}" required />
        </label>
        <label>Slug (URL)
          <input name="slug" value="${escapeHtml(cat.slug)}" pattern="[a-z0-9-]+" placeholder="auto-generado" />
        </label>
        <p class="hm-cms-muted">El slug se usa en la URL y los filtros. Solo letras minúsculas, números y guiones.</p>
        <div class="hm-cms-actions">
          <button type="submit">${catId ? 'Guardar cambios' : 'Crear categoría'}</button>
          <button type="button" class="secondary" data-action="gallery-cats">Cancelar</button>
        </div>
        <p class="hm-cms-muted" data-status></p>
      </form>
    `);

    // Auto-generate slug from name
    const form = panelBody.querySelector('[data-gallery-cat-form]');
    const nameInput = form?.querySelector('[name="name"]');
    const slugInput = form?.querySelector('[name="slug"]');
    if (nameInput && slugInput && !catId) {
      nameInput.addEventListener('input', () => {
        slugInput.value = nameInput.value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      });
    }
  }

  async function loadGalleryAlbums() {
    if (!(await ensureSession())) return;
    galleryView = 'albums';
    setPanelTitle('Álbumes de galería');
    openPanel('<p class="hm-cms-muted">Cargando álbumes...</p>');
    try {
      const data = await api('/api/cms/gallery/albums');
      const albums = data.items || [];
      openPanel(`
        <div style="display:grid;gap:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="font-size:13px;color:#64748b">${albums.length} álbumes</span>
            <button type="button" data-action="gallery-new-album">+ Nuevo álbum</button>
          </div>
          <div style="display:grid;gap:6px">
            ${albums
              .map(
                (album) => `
              <div class="hm-cms-gallery-cat-btn" data-album-slug="${escapeHtml(album.slug)}">
                <div>
                  <span class="hm-cms-gallery-cat-name">${escapeHtml(album.name)}</span>
                  <span class="hm-cms-gallery-cat-slug">${escapeHtml(album.slug)} · ${album.itemCount} foto${album.itemCount === 1 ? '' : 's'}</span>
                </div>
                <div style="display:flex;gap:4px">
                  <button type="button" class="secondary" style="font-size:11px;padding:4px 8px" data-action="gallery-edit-album" data-album-slug="${escapeHtml(album.slug)}">Editar</button>
                  <button type="button" class="secondary destructive" style="font-size:11px;padding:4px 8px" data-action="gallery-delete-album" data-album-slug="${escapeHtml(album.slug)}" data-album-name="${escapeHtml(album.name)}">×</button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          <p class="hm-cms-muted">El álbum agrupa las fotos de una obra y su nombre es el que ve el visitante. Las fotos se asignan desde "Gestionar imágenes".</p>
          <button type="button" class="secondary" data-action="gallery">← Volver a galería</button>
        </div>
      `);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  async function showGalleryAlbumForm(albumSlug = null) {
    if (!(await ensureSession())) return;
    setPanelTitle(albumSlug ? 'Editar álbum' : 'Nuevo álbum');

    let album = { name: '', slug: '', itemCount: 0 };
    if (albumSlug) {
      try {
        const data = await api('/api/cms/gallery/albums');
        album = (data.items || []).find((a) => a.slug === albumSlug) || album;
      } catch {
        /* use defaults */
      }
    }

    openPanel(`
      <form data-gallery-album-form data-album-slug="${albumSlug ? escapeHtml(albumSlug) : ''}">
        <label>Nombre
          <input name="name" value="${escapeHtml(album.name)}" required />
        </label>
        <label>Slug (URL del proyecto)
          <input name="slug" value="${escapeHtml(album.slug)}" pattern="[a-z0-9-]+" placeholder="auto-generado" ${albumSlug ? 'readonly' : ''} />
        </label>
        <p class="hm-cms-muted">${
          albumSlug
            ? 'El slug no se puede cambiar: es lo que enlaza las fotos del álbum con /proyectos/&lt;slug&gt;. El nombre sí, y es el que ve el visitante.'
            : 'El slug enlaza el álbum con la página del proyecto (/proyectos/&lt;slug&gt;). Solo letras minúsculas, números y guiones.'
        }</p>
        <div class="hm-cms-actions">
          <button type="submit">${albumSlug ? 'Guardar cambios' : 'Crear álbum'}</button>
          <button type="button" class="secondary" data-action="gallery-albums">Cancelar</button>
        </div>
        <p class="hm-cms-muted" data-status></p>
      </form>
    `);

    // Auto-generate slug from name
    const form = panelBody.querySelector('[data-gallery-album-form]');
    const nameInput = form?.querySelector('[name="name"]');
    const slugInput = form?.querySelector('[name="slug"]');
    if (nameInput && slugInput && !albumSlug) {
      nameInput.addEventListener('input', () => {
        slugInput.value = nameInput.value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      });
    }
  }

  // M-1: la lista pintaba las 177 fotos de golpe, sin buscador ni filtro, en
  // un panel de 420 px. Encontrar una foto concreta era imposible en la
  // práctica. El filtrado es local porque el catálogo entero cabe en una
  // petición; lo que se acota es cuántas miniaturas se pintan.
  const GALLERY_PAGE_SIZE = 60;
  const galleryFilter = { q: '', album: '', categoria: '', limite: GALLERY_PAGE_SIZE };
  let galleryItemsCache = [];
  let galleryAlbumsCache = [];
  let galleryCatsCache = [];
  let galleryFilterTimer;

  function galleryItemsFiltrados() {
    const q = galleryFilter.q.trim().toLowerCase();
    return galleryItemsCache.filter((item) => {
      if (galleryFilter.album && (item.projectSlug || '') !== galleryFilter.album) return false;
      if (galleryFilter.categoria && (item.categoryId || '') !== galleryFilter.categoria) {
        return false;
      }
      if (!q) return true;
      return `${item.alt || ''} ${item.projectSlug || ''} ${item.categoryName || ''}`
        .toLowerCase()
        .includes(q);
    });
  }

  function renderGalleryItemsList(albums, cats, { autofocus = true } = {}) {
    const filtrados = galleryItemsFiltrados();
    const visibles = filtrados.slice(0, galleryFilter.limite);
    const restantes = filtrados.length - visibles.length;
    const opciones = (lista, valorActual, claveValor, claveTexto) =>
      lista
        .map(
          (x) =>
            `<option value="${escapeHtml(x[claveValor])}"${x[claveValor] === valorActual ? ' selected' : ''}>${escapeHtml(x[claveTexto])}</option>`
        )
        .join('');

    openPanel(
      `
      <div style="display:grid;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:13px;color:#64748b">
            ${
              filtrados.length === galleryItemsCache.length
                ? `${galleryItemsCache.length} imágenes`
                : `${filtrados.length} de ${galleryItemsCache.length}`
            }
          </span>
          <button type="button" data-action="gallery-new-item">+ Agregar imagen</button>
        </div>
        <label>Buscar
          <input name="galleryFilterQ" type="search" data-gallery-filter-q
            placeholder="Texto alternativo, álbum o categoría" value="${escapeHtml(galleryFilter.q)}" />
        </label>
        <div class="hm-cms-two">
          <label>Álbum
            <select data-gallery-filter-album>
              <option value="">Todos</option>
              ${opciones(albums, galleryFilter.album, 'slug', 'name')}
            </select>
          </label>
          <label>Categoría
            <select data-gallery-filter-cat>
              <option value="">Todas</option>
              ${opciones(cats, galleryFilter.categoria, 'id', 'name')}
            </select>
          </label>
        </div>
        ${
          filtrados.length === 0
            ? '<p class="hm-cms-muted">Ninguna foto coincide con el filtro.</p>'
            : `<div class="hm-cms-gallery-grid">
                ${visibles
                  .map(
                    (item) => `
                  <div class="hm-cms-gallery-thumb" data-action="gallery-edit-item" data-item-id="${escapeHtml(item.id)}" title="${escapeHtml(item.alt)}">
                    <img src="${escapeHtml(item.mediaPath)}" alt="${escapeHtml(item.alt)}" loading="lazy" />
                    ${item.featured ? '<span class="hm-cms-gallery-featured">★</span>' : ''}
                  </div>
                `
                  )
                  .join('')}
              </div>
              ${
                restantes > 0
                  ? `<button type="button" class="secondary" data-action="gallery-load-more">Ver ${Math.min(restantes, GALLERY_PAGE_SIZE)} más (${restantes} restantes)</button>`
                  : ''
              }`
        }
        <button type="button" class="secondary" data-action="gallery">← Volver a galería</button>
      </div>
    `,
      { autofocus }
    );
  }

  async function loadGalleryItemsList({ recargar = true } = {}) {
    if (!(await ensureSession())) return;
    galleryView = 'items';
    setPanelTitle('Imágenes de galería');
    if (recargar) {
      openPanel('<p class="hm-cms-muted">Cargando imágenes...</p>');
      try {
        const [itemsData, albumsData, catsData] = await Promise.all([
          api('/api/cms/gallery/items'),
          api('/api/cms/gallery/albums'),
          api('/api/cms/gallery/categories'),
        ]);
        galleryItemsCache = itemsData.items || [];
        galleryAlbumsCache = albumsData.items || [];
        galleryCatsCache = catsData.items || [];
        galleryFilter.limite = GALLERY_PAGE_SIZE;
      } catch (error) {
        openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        return;
      }
    }
    renderGalleryItemsList(galleryAlbumsCache, galleryCatsCache, { autofocus: recargar });
  }

  async function showGalleryItemForm(itemId = null) {
    if (!(await ensureSession())) return;
    setPanelTitle(itemId ? 'Editar imagen' : 'Agregar imagen');

    let item = {
      mediaId: '',
      categoryId: null,
      alt: '',
      featured: false,
      status: 'published',
    };
    let catsData = { items: [] };
    let albumsData = { items: [] };

    try {
      [catsData, albumsData] = await Promise.all([
        api('/api/cms/gallery/categories'),
        api('/api/cms/gallery/albums'),
      ]);
      if (itemId) {
        item = await api(`/api/cms/gallery/items/${encodeURIComponent(itemId)}`);
      }
    } catch {
      /* use defaults */
    }

    const cats = catsData.items || [];
    const albums = albumsData.items || [];

    openPanel(`
      <form data-gallery-item-form data-item-id="${itemId ? escapeHtml(itemId) : ''}">
        <input name="mediaId" type="hidden" value="${escapeHtml(item.mediaId || '')}" />
        <img data-gallery-media-preview src="${item.mediaPath ? escapeHtml(item.mediaPath) : ''}" alt=""
          style="width:100%;max-height:180px;object-fit:contain;background:#e2e8f0;border-radius:0px;${item.mediaPath ? '' : 'display:none'}" />
        <label>Seleccionar imagen
          <input name="mediaSearch" type="search" placeholder="Buscar en la biblioteca de medios..." data-gallery-media-search />
        </label>
        <label>O subir nueva imagen
          <input name="file" type="file" accept="image/png,image/jpeg,image/webp" data-gallery-upload />
        </label>
        <div data-gallery-media-grid class="hm-cms-media-grid" style="max-height:200px">
          <p class="hm-cms-muted">Cargando medios...</p>
        </div>
        <label>Texto alternativo (accesibilidad)
          <input name="alt" value="${escapeHtml(item.alt)}" required />
        </label>
        <p class="hm-cms-muted">La galería muestra las fotos agrupadas por álbum, sin título ni descripción. El texto alternativo no se ve en pantalla: es lo que leen los lectores de pantalla y lo que busca el filtro de la galería.</p>
        <label>Categoría
          <select name="categoryId">
            <option value="">Sin categoría</option>
            ${cats.map((cat) => `<option value="${escapeHtml(cat.id)}" ${cat.id === item.categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`).join('')}
          </select>
        </label>
        <label>Álbum (obra)
          <select name="projectSlug">
            <option value="">Sin álbum</option>
            ${albums.map((album) => `<option value="${escapeHtml(album.slug)}" ${album.slug === item.projectSlug ? 'selected' : ''}>${escapeHtml(album.name)}</option>`).join('')}
          </select>
        </label>
        <div class="hm-cms-two">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input name="featured" type="checkbox" ${item.featured ? 'checked' : ''} />
            Destacada
          </label>
          <label>Estado
            <select name="status">
              <option value="published" ${item.status === 'published' ? 'selected' : ''}>Publicada</option>
              <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Borrador</option>
            </select>
          </label>
        </div>
        <div class="hm-cms-actions">
          <button type="submit">${itemId ? 'Guardar cambios' : 'Agregar a galería'}</button>
          ${itemId ? `<button type="button" class="secondary destructive" data-action="gallery-delete-item" data-item-id="${escapeHtml(itemId)}" data-item-title="${escapeHtml(item.alt)}">Eliminar</button>` : ''}
          <button type="button" class="secondary" data-action="gallery-items">Cancelar</button>
        </div>
        <p class="hm-cms-muted" data-status></p>
      </form>
    `);

    // Load media picker
    try {
      await loadMediaPicker({ reset: true });
    } catch {
      /* silent */
    }
  }

  // ─── CRUD de colecciones ─────────────────────────────────────────────────

  const COLLECTION_KINDS = [
    { id: 'servicio', label: 'Servicios' },
    { id: 'proyecto', label: 'Proyectos' },
    { id: 'page', label: 'Páginas' },
  ];

  let activeCollectionKind = 'servicio';

  function setPanelTitle(title) {
    const titleEl = shell.querySelector('[data-panel-title]');
    if (titleEl) titleEl.textContent = title;
  }

  // M-1: la búsqueda va contra el servidor y el panel conserva lo escrito
  // entre recargas de la lista. Antes se pintaban las 40 entradas de golpe en
  // un panel de 420 px, sin buscador ni recuento, y con el límite de 100 del
  // servidor truncando en silencio cualquier colección más grande.
  let collectionQuery = '';
  let collectionSearchTimer;

  async function loadCollections(kind = activeCollectionKind, { mantenerFoco = false } = {}) {
    const opcionesPanel = { autofocus: !mantenerFoco };
    if (!(await ensureSession())) return;
    activeCollectionKind = kind;
    setPanelTitle('Colecciones');
    if (!mantenerFoco) openPanel('<p class="hm-cms-muted">Cargando...</p>');
    try {
      const params = new URLSearchParams({ kind, limit: '100' });
      if (collectionQuery) params.set('q', collectionQuery);
      const data = await api(`/api/cms/entries?${params}`);
      const entries = data.entries || [];
      const tabs = COLLECTION_KINDS.map(
        (k) =>
          `<button type="button" class="hm-cms-tab${k.id === kind ? ' active' : ''}" data-action="tab-kind" data-kind="${escapeHtml(k.id)}">${escapeHtml(k.label)}</button>`
      ).join('');

      openPanel(
        `
        <div class="hm-cms-tabs">${tabs}</div>
        <label style="margin-bottom:8px">Buscar
          <input name="collectionSearch" type="search" data-collection-search
            placeholder="Título, slug o id" value="${escapeHtml(collectionQuery)}" />
        </label>
        <p class="hm-cms-muted" style="margin:0 0 8px">
          ${entries.length === data.total ? `${data.total} entrada${data.total === 1 ? '' : 's'}` : `Mostrando ${entries.length} de ${data.total}`}
          ${data.pages > 1 ? ' · acota la búsqueda para ver el resto' : ''}
        </p>
        <div class="hm-cms-actions" style="margin-bottom:12px">
          <button type="button" data-action="new-entry" data-kind="${escapeHtml(kind)}">+ Nueva entrada</button>
        </div>
        ${
          entries.length === 0
            ? collectionQuery
              ? `<p class="hm-cms-muted">Ninguna entrada de tipo «${escapeHtml(kind)}» coincide con «${escapeHtml(collectionQuery)}».</p>`
              : `<p class="hm-cms-muted">No hay entradas de tipo «${escapeHtml(kind)}».</p>`
            : `<div class="hm-cms-collection-list">
              ${entries
                .map(
                  (e) => `
                <div class="hm-cms-collection-item">
                  <div class="hm-cms-collection-info">
                    <span class="hm-cms-collection-title">${escapeHtml(e.title)}</span>
                    <span class="hm-cms-collection-meta">${escapeHtml(e.slug)} · <span class="hm-cms-badge ${escapeHtml(e.status)}">${escapeHtml({ draft: 'Borrador', pending_review: 'Pendiente de revisión', published: 'Publicado' }[e.status] || e.status)}</span></span>
                  </div>
                  <div class="hm-cms-collection-actions">
                    <button type="button" class="secondary" data-action="edit-entry" data-entry-id="${escapeHtml(e.id)}">Editar</button>
                    <button type="button" class="secondary destructive" data-action="delete-entry" data-entry-id="${escapeHtml(e.id)}" data-entry-title="${escapeHtml(e.title)}">Borrar</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
        }
      `,
        opcionesPanel
      );
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  /**
   * A-7/A-9: el vocabulario de enumeraciones y los efectos de «Borrador»
   * vienen del servidor (`/api/cms/schema`), que los lee del módulo
   * compartido con el schema de Astro. Se pide una vez por sesión.
   */
  let schemaCache = null;
  async function getSchema() {
    if (schemaCache) return schemaCache;
    try {
      schemaCache = await api('/api/cms/schema');
    } catch {
      schemaCache = { enumFields: {}, draftEffect: {} };
    }
    return schemaCache;
  }

  async function showEntryForm(entryId = null, kind = activeCollectionKind) {
    if (!(await ensureSession())) return;
    const schema = await getSchema();
    const enums = schema.enumFields?.[kind] || {};
    const draftGroup = kind === 'servicio' || kind === 'proyecto' ? 'collection' : 'page';
    const draft = schema.draftEffect?.[draftGroup] || {
      label: 'Borrador',
      warning: '',
    };
    let entry = null;
    if (entryId) {
      try {
        entry = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`);
      } catch (error) {
        openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        return;
      }
    }

    setPanelTitle(entry ? 'Editar entrada' : 'Nueva entrada');
    openPanel(`
      <form class="hm-cms-entry-form" data-entry-form data-entry-id="${escapeHtml(entryId || '')}" data-kind="${escapeHtml(kind)}">
        ${
          !entryId
            ? `<label>ID (ej: servicio.bombeo)
          <input name="id" value="" required pattern="[a-z0-9._-]+" title="Minúsculas, números, puntos, guiones" />
        </label>`
            : `<p class="hm-cms-muted">ID: <strong>${escapeHtml(entryId)}</strong></p>`
        }
        <label>Título
          <input name="title" value="${escapeHtml(entry?.title || '')}" required />
        </label>
        <label>Slug (URL)
          <input name="slug" value="${escapeHtml(entry?.slug || '')}" required />
        </label>
        <label>Estado
          <select name="status" data-initial-status="${escapeHtml(entry?.status || 'published')}">
            <option value="published" ${!entry || entry.status === 'published' ? 'selected' : ''}>Publicado</option>
            <option value="draft" ${entry?.status === 'draft' ? 'selected' : ''}>${escapeHtml(draft.label)}</option>
          </select>
        </label>
        <p class="hm-cms-muted" data-draft-warning hidden style="background:#fffbeb;border:1px solid #fde68a;border-radius:0px;padding:8px 10px">${escapeHtml(draft.warning)}</p>
        ${
          !entryId && (kind === 'servicio' || kind === 'proyecto')
            ? `
          <p class="hm-cms-muted" style="background:#fffbeb;border:1px solid #fde68a;border-radius:0px;padding:8px 10px">
            Se crearán campos obligatorios con valores de ejemplo (${kind === 'servicio' ? 'resumen, icono, orden' : 'alcance, categoría, orden'}). Edítalos luego haciendo clic en los elementos de la página antes de exportar.
          </p>`
            : ''
        }
        ${
          entry
            ? Object.entries(entry.fields || {})
                // A-8: `number` y `list` estaban excluidos, así que `orden` no
                // era editable en ninguna parte del CMS y no había forma de
                // reordenar servicios ni proyectos, que es justo por lo que la
                // home y /servicios ordenan sus tarjetas.
                .filter(([, f]) => ['text', 'textarea', 'number', 'list'].includes(f.type))
                .map(([key, f]) => {
                  const name = `field:${escapeHtml(key)}`;
                  // A-7: los campos de enumeración eran texto libre, y un
                  // valor mal escrito hacía que el export omitiera la entrada
                  // en silencio mientras el job se cerraba como correcto.
                  if (enums[key]) {
                    const actual = String(f.value ?? '');
                    const conocido = enums[key].some((o) => o.value === actual);
                    return `<label>${escapeHtml(key)}
                      <select name="${name}" data-field-type="text">
                        ${
                          !conocido && actual
                            ? `<option value="${escapeHtml(actual)}" selected>⚠ ${escapeHtml(actual)} (valor inválido)</option>`
                            : ''
                        }
                        ${enums[key]
                          .map(
                            (o) =>
                              `<option value="${escapeHtml(o.value)}"${o.value === actual ? ' selected' : ''}>${escapeHtml(o.label)}</option>`
                          )
                          .join('')}
                      </select>
                    </label>`;
                  }
                  if (f.type === 'list') {
                    return `<label>${escapeHtml(key)}</label>${listEditorMarkup(asList(f.value), name)}`;
                  }
                  const control =
                    f.type === 'textarea'
                      ? `<textarea name="${name}" data-field-type="textarea">${escapeHtml(String(f.value ?? ''))}</textarea>`
                      : f.type === 'number'
                        ? `<input name="${name}" type="number" step="any" data-field-type="number" value="${escapeHtml(String(f.value ?? ''))}" />`
                        : `<input name="${name}" data-field-type="text" value="${escapeHtml(String(f.value ?? ''))}" />`;
                  return `<label>${escapeHtml(key)}${control}</label>`;
                })
                .join('')
            : ''
        }
        <div class="hm-cms-actions">
          <button type="submit">${entry ? 'Guardar cambios' : 'Crear entrada'}</button>
          <button type="button" class="secondary" data-action="back-to-collections">← Volver</button>
          ${entry ? `<button type="button" class="secondary" data-action="revisions" data-entry-id="${escapeHtml(entryId)}">Revisiones</button>` : ''}
        </div>
        <p class="hm-cms-muted" data-status></p>
      </form>
    `);
  }

  async function saveEntryForm(form) {
    const entryId = form.dataset.entryId;
    const kind = form.dataset.kind;
    const status = form.querySelector('[data-status]');
    if (status) status.textContent = 'Guardando...';

    const title = form.elements.title.value.trim();
    const slug = form.elements.slug.value.trim();
    const entryStatus = form.elements.status.value;

    // A-9: despublicar tiene efectos opuestos según el tipo y ninguno es
    // reversible con un clic, así que se confirma con el efecto a la vista.
    const estadoPrevio = form.elements.status.dataset?.initialStatus;
    if (entryStatus === 'draft' && estadoPrevio === 'published') {
      const aviso = form.querySelector('[data-draft-warning]')?.textContent?.trim();
      if (!window.confirm(`${aviso}\n\n¿Continuar?`)) {
        if (status) status.textContent = '';
        return;
      }
    }

    try {
      if (!entryId) {
        const id = form.elements.id?.value.trim();
        await api('/api/cms/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, kind, slug, title, status: entryStatus }),
        });
      } else {
        await api(`/api/cms/entries/${encodeURIComponent(entryId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, slug, status: entryStatus }),
        });

        // A-3: secuencial y SIN `expectedVersion`, a diferencia de saveEdit.
        // Cada PATCH incrementa la versión de la misma entrada, así que en
        // paralelo y con control de concurrencia estos guardados se
        // conflictuarían entre sí. En serie el orden es además determinista:
        // con Promise.all se generaban N revisiones en orden indeterminado.
        for (const [name, input] of Object.entries(form.elements)) {
          if (typeof name === 'string' && name.startsWith('field:')) {
            const key = name.slice(6);
            // A-8: el servidor valida que el valor case con el tipo declarado
            // del campo, así que un número no puede viajar como cadena.
            const fieldType = input.dataset?.fieldType;
            let value = input.value;
            if (fieldType === 'number') {
              value = input.value === '' ? null : Number(input.value);
            } else if (fieldType === 'list') {
              try {
                value = JSON.parse(input.value || '[]');
              } catch {
                value = [];
              }
            }
            await api(
              `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(key)}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
              }
            );
          }
        }
      }

      if (status) status.textContent = 'Guardado correctamente.';
      setTimeout(() => loadCollections(kind), 800);
    } catch (error) {
      if (status)
        status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
    }
  }

  // ─── Fin CRUD colecciones ────────────────────────────────────────────────

  document.addEventListener(
    'click',
    async (event) => {
      const target = event.target;
      const editable = target instanceof Element ? target.closest('[data-cms-entry]') : null;
      const action =
        target instanceof Element ? target.closest('[data-action]')?.dataset.action : null;

      if (action === 'close') closePanel();
      if (action === 'logout') {
        await api('/api/cms/logout', { method: 'POST' }).catch(() => {});
        window.localStorage.removeItem('hidromont:cms');
        window.location.reload();
      }
      if (action === 'export') {
        // B-1: sin try/catch, un fallo aquí (el cerrojo de PublishService, la
        // guarda anti-encogimiento de galería) moría como promesa rechazada
        // sin manejar: el panel no cambiaba y el editor creía haber exportado.
        const btn = target instanceof Element ? target.closest('button') : null;
        const status = panelBody.querySelector('[data-status]');
        setButtonLoading(btn, true, 'Exportando...');
        try {
          const result = await api('/api/cms/export', { method: 'POST' });
          const aviso = exportNoticeMarkup(result.exported);
          if (aviso) panelBody.insertAdjacentHTML('afterbegin', aviso);
          if (status)
            status.textContent =
              `Exportado a los archivos del sitio. Para que aparezca en hidromont.cl falta compilar y desplegar (npm run build + deploy). Job ${result.job?.id || ''}`.trim();
          setGlobalState('exported');
        } catch (error) {
          if (status)
            status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
          setGlobalState('error');
        } finally {
          setButtonLoading(btn, false);
        }
      }
      if (action === 'jobs') {
        loadPublishJobs();
      }
      if (action === 'collections') {
        loadCollections();
      }
      if (action === 'gallery') {
        loadGallery();
      }
      if (action === 'gallery-cats') {
        loadGalleryCategories();
      }
      if (action === 'gallery-items') {
        loadGalleryItemsList();
      }
      if (action === 'gallery-new-cat') {
        showGalleryCategoryForm();
      }
      if (action === 'gallery-edit-cat' && target instanceof Element) {
        const catId = target.closest('[data-cat-id]')?.dataset.catId;
        if (catId) showGalleryCategoryForm(catId);
      }
      if (action === 'gallery-delete-cat' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const btn = target.closest('[data-cat-id]');
        if (!btn) return;
        const catId = btn.dataset.catId;
        const name = btn.dataset.catName || catId;
        if (!window.confirm(`¿Eliminar la categoría "${name}"?`)) return;
        try {
          await api(`/api/cms/gallery/categories/${encodeURIComponent(catId)}`, {
            method: 'DELETE',
          });
          loadGalleryCategories();
        } catch (error) {
          // M-3: el servidor rechaza con 409 si la categoría tiene fotos, y
          // dice cuántas. Antes la confirmación no mencionaba ninguna
          // consecuencia y las fotos quedaban sin categoría en silencio.
          if (error.status === 409 && window.confirm(`${error.message}\n\n¿Borrarla igualmente?`)) {
            try {
              await api(`/api/cms/gallery/categories/${encodeURIComponent(catId)}?confirm=1`, {
                method: 'DELETE',
              });
              loadGalleryCategories();
              return;
            } catch (segundo) {
              openPanel(`<p class="hm-cms-error">${escapeHtml(segundo.message)}</p>`);
              return;
            }
          }
          openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        }
        return;
      }
      if (action === 'gallery-albums') {
        loadGalleryAlbums();
      }
      if (action === 'gallery-new-album') {
        showGalleryAlbumForm();
      }
      if (action === 'gallery-edit-album' && target instanceof Element) {
        const albumSlug = target.closest('[data-album-slug]')?.dataset.albumSlug;
        if (albumSlug) showGalleryAlbumForm(albumSlug);
      }
      if (action === 'gallery-delete-album' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const btn = target.closest('[data-album-slug]');
        if (!btn) return;
        const albumSlug = btn.dataset.albumSlug;
        const name = btn.dataset.albumName || albumSlug;
        if (!window.confirm(`¿Eliminar el álbum "${name}"?`)) return;
        try {
          await api(`/api/cms/gallery/albums/${encodeURIComponent(albumSlug)}`, {
            method: 'DELETE',
          });
          loadGalleryAlbums();
        } catch (error) {
          openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        }
        return;
      }
      if (action === 'gallery-new-item') {
        showGalleryItemForm();
      }
      if (action === 'gallery-edit-item' && target instanceof Element) {
        const itemId = target.closest('[data-item-id]')?.dataset.itemId;
        if (itemId) showGalleryItemForm(itemId);
      }
      if (action === 'gallery-delete-item' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const btn = target.closest('[data-item-id]');
        if (!btn) return;
        const itemId = btn.dataset.itemId;
        const title = btn.dataset.itemTitle || itemId;
        if (!window.confirm(`¿Eliminar "${title}" de la galería?`)) return;
        try {
          await api(`/api/cms/gallery/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
          loadGalleryItemsList();
        } catch (error) {
          openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        }
        return;
      }
      if (action === 'gallery-select-media' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const mediaId = target.closest('[data-media-id]')?.dataset.mediaId;
        const asset = state.mediaItems.find((item) => item.id === mediaId);
        if (asset) {
          const form = panelBody.querySelector('[data-gallery-item-form]');
          if (form) {
            const mediaIdInput = form.querySelector('[name="mediaId"]');
            const titleInput = form.querySelector('[name="title"]');
            const altInput = form.querySelector('[name="alt"]');
            const preview = form.querySelector('[data-gallery-media-preview]');
            if (mediaIdInput) mediaIdInput.value = asset.id;
            if (titleInput && !titleInput.value)
              titleInput.value = asset.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
            if (altInput && !altInput.value) altInput.value = asset.alt || '';
            if (preview) {
              preview.src = asset.path;
              preview.style.display = 'block';
            }
            renderMediaPicker();
          }
        }
        return;
      }
      if (action === 'tab-kind' && target instanceof Element) {
        const kind = target.closest('[data-kind]')?.dataset.kind;
        if (kind) {
          collectionQuery = '';
          loadCollections(kind);
        }
      }
      if (action === 'new-entry' && target instanceof Element) {
        const kind = target.closest('[data-kind]')?.dataset.kind || activeCollectionKind;
        showEntryForm(null, kind);
      }
      if (action === 'edit-entry' && target instanceof Element) {
        const entryId = target.closest('[data-entry-id]')?.dataset.entryId;
        if (entryId) showEntryForm(entryId);
      }
      if (action === 'delete-entry' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const btn = target.closest('[data-entry-id]');
        if (!btn) return;
        const entryId = btn.dataset.entryId;
        const title = btn.dataset.entryTitle || entryId;
        if (!entryId) return;
        const confirmed = window.confirm(
          `¿Eliminar la entrada "${title}"?\nEsta acción no se puede deshacer.`
        );
        if (!confirmed) return;
        try {
          await api(`/api/cms/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
          loadCollections(activeCollectionKind);
        } catch (error) {
          openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        }
        return;
      }
      if (action === 'back-to-collections') {
        loadCollections(activeCollectionKind);
      }
      if (action === 'add-list-item' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const editor = target.closest('[data-list-editor]');
        const container = editor?.querySelector('[data-list-items]');
        if (!container || !editor) return;
        const idx = container.querySelectorAll('[data-list-item]').length;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center';
        row.innerHTML = `
        <input type="text" data-list-item="${idx}" value="" style="flex:1;border:1px solid #cbd5e1;border-radius:0px;padding:8px 10px;font:inherit" />
        <button type="button" data-action="remove-list-item" data-index="${idx}" style="border:0;background:#fee2e2;color:#991b1b;border-radius:0px;padding:6px 10px;cursor:pointer;font-weight:700">×</button>
      `;
        container.appendChild(row);
        row.querySelector('input')?.focus();
        syncListValue(editor);
        return;
      }
      if (action === 'remove-list-item' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const editor = target.closest('[data-list-editor]');
        const row = target.closest('div');
        if (row && editor) {
          row.remove();
          // Re-index remaining items
          const container = editor.querySelector('[data-list-items]');
          if (container) {
            container.querySelectorAll('[data-list-item]').forEach((input, i) => {
              input.setAttribute('data-list-item', String(i));
              const btn = input.nextElementSibling;
              if (btn) btn.setAttribute('data-index', String(i));
            });
          }
          syncListValue(editor);
        }
        return;
      }
      if (action === 'revisions' && target instanceof Element) {
        const entryId = target.closest('[data-entry-id]')?.dataset.entryId;
        if (entryId) loadRevisions(entryId);
      }
      if (action === 'back-to-editor') {
        if (state.selected && state.entry) {
          selectElement(state.selected).catch((error) => loginView(error.message));
        } else {
          closePanel();
        }
      }
      if (action === 'restore-revision' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const btn = target.closest('[data-action="restore-revision"]');
        if (!btn) return;
        const entryId = btn.dataset.entryId;
        const revisionId = btn.dataset.revisionId;
        const version = btn.dataset.revisionVersion;
        if (!entryId || !revisionId) return;

        const confirmed = window.confirm(
          `¿Restaurar la entrada "${entryId}" a la versión ${version}?\nEsta acción sobreescribirá los campos actuales en la base de datos.`
        );
        if (!confirmed) return;

        setButtonLoading(btn, true, 'Restaurando...');
        try {
          await api(
            `/api/cms/revisions/${encodeURIComponent(entryId)}/restore/${encodeURIComponent(revisionId)}`,
            {
              method: 'POST',
            }
          );
          // Reload revisions view to reflect the new current version
          await loadRevisions(entryId);
        } catch (error) {
          openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
        } finally {
          setButtonLoading(btn, false);
        }
        return;
      }
      if (action === 'publish') {
        if (!(await ensureSession())) return;
        const btn = target instanceof Element ? target.closest('button') : null;
        setButtonLoading(btn, true, 'Exportando...');
        openPanel(
          '<p class="hm-cms-muted"><span class="hm-cms-spinner"></span> Exportando archivos y compilando el sitio. Puede tardar varios minutos.</p>'
        );
        try {
          const result = await api('/api/cms/publish', { method: 'POST' });
          renderPublishJobs(result.job ? [result.job] : []);
          // A-6: decir desde cuándo es el sitio que se está sirviendo, para
          // que «falta desplegar» deje de ser una afirmación sin fecha.
          if (result.siteBuiltAt) {
            panelBody.insertAdjacentHTML(
              'afterbegin',
              `<p class="hm-cms-muted">Sitio servido: compilado el ${escapeHtml(formatDate(result.siteBuiltAt))}.</p>`
            );
          }
          const aviso = exportNoticeMarkup(result.exported);
          if (aviso) panelBody.insertAdjacentHTML('afterbegin', aviso);
          const jobStatus = result.job?.status;
          const conOmisiones =
            (result.exported?.skipped || []).length > 0 ||
            (result.exported?.revertedToFallback || []).length > 0;
          setGlobalState(
            jobStatus !== 'succeeded' ? 'error' : conOmisiones ? 'warning' : 'exported'
          );
        } catch (error) {
          openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
          setGlobalState('error');
        } finally {
          setButtonLoading(btn, false);
        }
      }
      // A-9: la afordancia correcta para «quiero que este rótulo desaparezca».
      // Vaciar el campo sí lo borra del sitio (getCmsText distingue clave
      // ausente de clave vacía); poner la entrada en Borrador, en cambio,
      // revierte TODOS sus campos al texto del código. Sin este botón, el
      // desplegable de estado era el único camino visible y se usaba mal.
      // Excluido en campos de imagen: ahí una cadena vacía es un <img src="">
      // roto, y por eso getCmsText cae al fallback para ese tipo.
      if (action === 'clear-field') {
        event.preventDefault();
        const form = panelBody.querySelector('[data-edit]');
        if (!form) return;
        if (!window.confirm('¿Vaciar este texto? Dejará de aparecer en el sitio.')) return;
        const campo = form.elements.value;
        if (campo) {
          campo.value = '';
          setFormDirty(true);
        }
        return;
      }
      if (action === 'gallery-load-more') {
        event.preventDefault();
        galleryFilter.limite += GALLERY_PAGE_SIZE;
        await loadGalleryItemsList({ recargar: false });
        return;
      }
      if (action === 'load-more-media') {
        event.preventDefault();
        mediaPicker.page += 1;
        await loadMediaPicker({ reset: false });
        return;
      }
      // A-3 · resolución de un conflicto de edición
      if (action === 'show-server-value' && target instanceof Element) {
        event.preventDefault();
        const btn = target.closest('[data-entry-id]');
        const box = panelBody.querySelector('[data-server-value]');
        if (!btn || !box) return;
        setButtonLoading(btn, true, 'Cargando...');
        try {
          const remote = await api(`/api/cms/entries/${encodeURIComponent(btn.dataset.entryId)}`);
          const remoteValue = remote.fields?.[btn.dataset.field]?.value ?? '';
          box.innerHTML = `
            <span class="hm-cms-muted" style="display:block;margin-top:8px">Valor actual en el servidor (v${escapeHtml(remote.version)}):</span>
            <pre class="hm-cms-log">${escapeHtml(typeof remoteValue === 'string' ? remoteValue : JSON.stringify(remoteValue, null, 2))}</pre>
          `;
        } catch (error) {
          box.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
        } finally {
          setButtonLoading(btn, false);
        }
        return;
      }
      if (action === 'force-save' && target instanceof Element) {
        event.preventDefault();
        const form = panelBody.querySelector('[data-edit]');
        if (!form || !state.entry) return;
        const btn = target.closest('button');
        setButtonLoading(btn, true, 'Guardando...');
        try {
          // Refrescar la versión y reintentar: el editor ya vio con qué está
          // chocando y decidió imponer su valor.
          state.entry = await api(`/api/cms/entries/${encodeURIComponent(state.entry.id)}`);
          await saveEdit(form);
        } catch (error) {
          const status = form.querySelector('[data-status]');
          if (status)
            status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
        } finally {
          setButtonLoading(btn, false);
        }
        return;
      }
      if (action === 'select-media' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const mediaId = target.closest('[data-media-id]')?.dataset.mediaId;
        const asset = state.mediaItems.find((item) => item.id === mediaId);
        if (asset) applyMediaSelection(asset);
        return;
      }

      if (editable && !panel.contains(editable)) {
        event.preventDefault();
        event.stopPropagation();
        selectElement(editable).catch((error) => loginView(error.message));
      }
    },
    true
  );

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.matches('[data-login]')) {
      event.preventDefault();
      const emailEscrito = form.elements.email.value;
      // M-2: sin esto, un doble clic gastaba dos de los diez intentos que
      // permite el rate-limit y no había ninguna señal de que estaba enviando.
      const botonEntrar = form.querySelector('button[type="submit"]');
      setButtonLoading(botonEntrar, true, 'Entrando...');
      try {
        const result = await api('/api/cms/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.elements.email.value,
            password: form.elements.password.value,
          }),
        });
        state.csrfToken = result.csrfToken;
        // C-3: sin esto la barra se queda sin botones tras entrar. El estado
        // autenticado solo lo fijaba ensureSession(), que corre al cargar la
        // página y en cada acción — pero las acciones son justo los botones
        // que siguen ocultos. El operador veía el panel cerrarse y una barra
        // vacía, y la única salida era recargar.
        // Se reusa ensureSession() en vez de llamar a setAuthenticatedUI(true)
        // a secas para confirmar que la cookie vuelve de verdad: el modo de
        // fallo clásico aquí es emitirla para 127.0.0.1 y pedirla a localhost.
        if (await ensureSession()) closePanel();
      } catch (error) {
        setButtonLoading(botonEntrar, false);
        const espera = error.retryAfter
          ? ` Vuelva a intentarlo en ${error.retryAfter} segundo${error.retryAfter === 1 ? '' : 's'}.`
          : '';
        loginView(`${error.message}${espera}`, emailEscrito);
      }
    }

    if (form.matches('[data-edit]')) {
      event.preventDefault();
      saveEdit(form).catch((error) => {
        const status = form.querySelector('[data-status]');
        if (status)
          status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      });
    }

    if (form.matches('[data-entry-form]')) {
      event.preventDefault();
      saveEntryForm(form).catch((error) => {
        const status = form.querySelector('[data-status]');
        if (status)
          status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      });
    }

    if (form.matches('[data-gallery-cat-form]')) {
      event.preventDefault();
      const status = form.querySelector('[data-status]');
      const catId = form.dataset.catId;
      try {
        if (status) status.textContent = 'Guardando...';
        const body = {
          name: form.elements.name.value,
          slug: form.elements.slug.value || undefined,
        };
        if (catId) {
          await api(`/api/cms/gallery/categories/${encodeURIComponent(catId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        } else {
          await api('/api/cms/gallery/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }
        loadGalleryCategories();
      } catch (error) {
        if (status)
          status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      }
    }

    if (form.matches('[data-gallery-album-form]')) {
      event.preventDefault();
      const status = form.querySelector('[data-status]');
      const albumSlug = form.dataset.albumSlug;
      try {
        if (status) status.textContent = 'Guardando...';
        if (albumSlug) {
          // El slug es inmutable: solo viaja el nombre.
          await api(`/api/cms/gallery/albums/${encodeURIComponent(albumSlug)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.elements.name.value }),
          });
        } else {
          await api('/api/cms/gallery/albums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.elements.name.value,
              slug: form.elements.slug.value || undefined,
            }),
          });
        }
        loadGalleryAlbums();
      } catch (error) {
        if (status)
          status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      }
    }

    if (form.matches('[data-gallery-item-form]')) {
      event.preventDefault();
      const status = form.querySelector('[data-status]');
      const itemId = form.dataset.itemId;
      try {
        if (status) status.textContent = 'Guardando...';

        // Upload file if selected
        const fileInput = form.elements.file;
        const file = fileInput?.files?.[0];
        let currentMediaId = form.elements.mediaId.value;

        if (file && !currentMediaId) {
          if (status) status.textContent = 'Subiendo imagen...';
          const payload = new FormData();
          payload.append('file', file);
          const uploaded = await fetch(`${apiBase}/api/cms/media`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': state.csrfToken },
            body: payload,
          }).then(async (response) => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al subir imagen');
            return data;
          });
          currentMediaId = uploaded.id;
          form.elements.mediaId.value = uploaded.id;
          if (!form.elements.alt.value) {
            // El alt del media si lo trae; si no, el nombre del archivo, que al
            // menos es mejor que dejar la foto sin texto alternativo.
            form.elements.alt.value =
              uploaded.alt || uploaded.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
          }
        }

        if (!currentMediaId) throw new Error('Selecciona o sube una imagen primero');
        const body = {
          mediaId: currentMediaId,
          alt: form.elements.alt.value,
          categoryId: form.elements.categoryId.value || null,
          projectSlug: form.elements.projectSlug.value || null,
          featured: form.elements.featured.checked,
          status: form.elements.status.value,
        };
        if (itemId) {
          await api(`/api/cms/gallery/items/${encodeURIComponent(itemId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        } else {
          await api('/api/cms/gallery/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        }
        loadGalleryItemsList();
      } catch (error) {
        if (status)
          status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      }
    }
  });

  // A-9: el aviso del efecto de «Borrador» aparece en cuanto se elige, no
  // después de exportar y descubrir que la página desapareció.
  document.addEventListener('change', async (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.matches('[data-gallery-filter-album]')) {
      galleryFilter.album = target.value;
      galleryFilter.limite = GALLERY_PAGE_SIZE;
      await loadGalleryItemsList({ recargar: false });
      return;
    }
    if (target instanceof HTMLSelectElement && target.matches('[data-gallery-filter-cat]')) {
      galleryFilter.categoria = target.value;
      galleryFilter.limite = GALLERY_PAGE_SIZE;
      await loadGalleryItemsList({ recargar: false });
      return;
    }
    if (!(target instanceof HTMLSelectElement) || target.name !== 'status') return;
    const warning = target.form?.querySelector('[data-draft-warning]');
    if (warning) warning.hidden = target.value !== 'draft';
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;

    if (target instanceof HTMLInputElement && target.matches('[data-media-search]')) {
      searchMediaPicker(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.matches('[data-gallery-filter-q]')) {
      galleryFilter.q = target.value;
      galleryFilter.limite = GALLERY_PAGE_SIZE;
      clearTimeout(galleryFilterTimer);
      galleryFilterTimer = setTimeout(async () => {
        await loadGalleryItemsList({ recargar: false });
        const nuevo = panelBody.querySelector('[data-gallery-filter-q]');
        if (nuevo) {
          nuevo.focus();
          nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
        }
      }, 250);
      return;
    }

    if (target instanceof HTMLInputElement && target.matches('[data-collection-search]')) {
      collectionQuery = target.value.trim();
      clearTimeout(collectionSearchTimer);
      collectionSearchTimer = setTimeout(async () => {
        await loadCollections(activeCollectionKind, { mantenerFoco: true });
        // Repintar el panel destruye el input, así que se devuelve el foco
        // y el cursor al final de lo escrito.
        const nuevo = panelBody.querySelector('[data-collection-search]');
        if (nuevo) {
          nuevo.focus();
          nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
        }
      }, 250);
      return;
    }

    if (target instanceof HTMLInputElement && target.matches('[data-gallery-media-search]')) {
      searchMediaPicker(target.value);
      return;
    }
  });

  // Handle file upload preview in gallery item form
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('[data-gallery-upload]')) return;
    const file = target.files?.[0];
    if (!file) return;
    const form = target.closest('[data-gallery-item-form]');
    if (!form) return;
    // Clear mediaId so upload happens on submit
    const mediaIdInput = form.querySelector('[name="mediaId"]');
    if (mediaIdInput) mediaIdInput.value = '';
    // Preview
    const preview = form.querySelector('[data-gallery-media-preview]');
    if (preview) {
      const reader = new FileReader();
      reader.onload = () => {
        preview.src = String(reader.result);
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;

    if (
      target.form &&
      (target.form.matches('[data-edit]') ||
        target.form.matches('[data-entry-form]') ||
        target.form.matches('[data-gallery-item-form]'))
    ) {
      setFormDirty(true);
    }

    if (target.name === 'value' && target.form?.matches('[data-edit]')) {
      const preview = panelBody.querySelector('[data-image-preview]');
      if (preview) preview.setAttribute('src', target.value);
    }
    if (target.name === 'alt' && target.form?.matches('[data-edit]')) {
      const preview = panelBody.querySelector('[data-image-preview]');
      if (preview) preview.setAttribute('alt', target.value);
    }

    // Sync list items to hidden input on every keystroke
    if (target instanceof HTMLInputElement && target.hasAttribute('data-list-item')) {
      syncListValue(target);
    }

    // Sync link fields to hidden input
    if ((target.name === 'link-label' || target.name === 'link-href') && target.form) {
      syncLinkValue(target.form);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // El sheet móvil registra su propio Escape en mobile-menu.ts; si está
    // abierto es suyo, no del panel.
    if (shell.querySelector('.hm-cms-mobile-sheet.open')) return;
    closePanel();
  });

  ensureSession();
})();
