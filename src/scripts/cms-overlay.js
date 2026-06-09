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
      outline: 2px solid #2d9cdb;
      box-shadow: 0 0 0 5px rgba(45,156,219,0.16);
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
      background: #0f2433;
      color: white;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 8px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.24);
    }
    .hm-cms-bar button,
    .hm-cms-panel button {
      border: 0;
      border-radius: 6px;
      padding: 9px 12px;
      font-weight: 700;
      background: #2d9cdb;
      color: #fff;
      cursor: pointer;
    }
    .hm-cms-bar button.secondary,
    .hm-cms-panel button.secondary {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    .hm-cms-panel {
      pointer-events: auto;
      position: fixed;
      top: 0;
      right: 0;
      width: min(420px, 100vw);
      height: 100dvh;
      background: #f8fafc;
      color: #172331;
      border-left: 1px solid #cbd5e1;
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
      background: #0f2433;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .hm-cms-panel h2 {
      font-size: 16px;
      margin: 0;
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
      color: #334155;
    }
    .hm-cms-panel input,
    .hm-cms-panel textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      font: inherit;
      color: #172331;
      background: white;
    }
    .hm-cms-panel textarea {
      min-height: 150px;
      resize: vertical;
    }
    .hm-cms-error {
      color: #b42318;
      font-size: 13px;
    }
    .hm-cms-muted {
      color: #64748b;
      font-size: 12px;
      line-height: 1.5;
    }
    .hm-cms-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .hm-cms-job-list {
      display: grid;
      gap: 10px;
    }
    .hm-cms-job {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: white;
    }
    .hm-cms-job-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
      font-weight: 800;
      color: #172331;
    }
    .hm-cms-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 3px 8px;
      background: #e2e8f0;
      color: #334155;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .hm-cms-badge.succeeded {
      background: #dcfce7;
      color: #166534;
    }
    .hm-cms-badge.failed {
      background: #fee2e2;
      color: #991b1b;
    }
    .hm-cms-log {
      max-height: 150px;
      overflow: auto;
      margin: 0;
      padding: 8px;
      border-radius: 4px;
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
      border-radius: 6px;
      background: white;
    }
    .hm-cms-image-preview img {
      width: 100%;
      max-height: 180px;
      object-fit: contain;
      background: #e2e8f0;
      border-radius: 4px;
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
      border-radius: 6px;
      padding: 6px;
      background: white;
      color: #172331;
      text-align: left;
      cursor: pointer;
    }
    .hm-cms-media-item:hover,
    .hm-cms-media-item.selected {
      border-color: #2d9cdb;
      box-shadow: 0 0 0 3px rgba(45,156,219,0.16);
    }
    .hm-cms-media-item img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 4px;
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
      border-radius: 6px;
      background: white;
    }
    .hm-cms-revision-item.current {
      border-color: #2d9cdb;
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
  `;
  document.head.appendChild(style);

  const shell = document.createElement('div');
  shell.className = 'hm-cms-shell';
  shell.innerHTML = `
    <div class="hm-cms-bar">
      <strong>Hidromont CMS</strong>
      <button type="button" class="secondary" data-action="jobs">Historial</button>
      <button type="button" data-action="publish">Publicar</button>
      <button type="button" class="secondary" data-action="logout">Salir</button>
    </div>
    <aside class="hm-cms-panel" aria-label="Editor CMS">
      <header>
        <h2>Editor</h2>
        <button type="button" class="secondary" data-action="close">Cerrar</button>
      </header>
      <main data-panel-body></main>
    </aside>
  `;
  document.body.appendChild(shell);

  const panel = shell.querySelector('.hm-cms-panel');
  const panelBody = shell.querySelector('[data-panel-body]');

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
    if (!response.ok) throw new Error(data.error || 'Error CMS');
    return data;
  }

  function openPanel(html) {
    panelBody.innerHTML = html;
    panel.classList.add('open');
  }

  function closePanel() {
    panel.classList.remove('open');
    state.selected = null;
    state.entry = null;
  }

  function loginView(error = '') {
    openPanel(`
      <form data-login>
        <label>Email
          <input name="email" type="email" autocomplete="username" value="admin@hidromont.local" required />
        </label>
        <label>Password
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        ${error ? `<p class="hm-cms-error">${error}</p>` : ''}
        <button type="submit">Entrar</button>
        <p class="hm-cms-muted">Servidor CMS: ${apiBase}</p>
      </form>
    `);
  }

  async function ensureSession() {
    try {
      const session = await api('/api/cms/session');
      if (!session.authenticated) {
        loginView();
        return false;
      }
      state.csrfToken = session.csrfToken;
      return true;
    } catch (error) {
      loginView(error.message);
      return false;
    }
  }

  function fieldEditor(element, entry, field) {
    const cmsType = element.dataset.cmsType || 'text';
    const current = entry.fields[field]?.value ?? '';
    const altField = element.dataset.cmsAltField;
    const altValue = altField ? entry.fields[altField]?.value ?? element.getAttribute('alt') ?? '' : '';

    if (cmsType === 'image') {
      return `
        <div class="hm-cms-image-preview">
          <img src="${escapeHtml(String(current))}" alt="${escapeHtml(String(altValue))}" data-image-preview />
          <p class="hm-cms-muted" data-selected-media-label>Imagen actual</p>
        </div>
        <label>Ruta de imagen
          <input name="value" value="${escapeHtml(String(current))}" />
        </label>
        ${altField ? `<label>Texto alternativo
          <input name="alt" value="${escapeHtml(String(altValue))}" />
        </label>` : ''}
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
          <input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
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

    return `
      <label>Contenido
        <input name="value" value="${escapeHtml(String(current))}" />
      </label>
    `;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => {
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

  function renderMediaPicker(items, selectedPath = '') {
    const grid = panelBody.querySelector('[data-media-grid]');
    if (!grid) return;

    if (!items.length) {
      grid.innerHTML = '<p class="hm-cms-muted">No hay medios que coincidan.</p>';
      return;
    }

    grid.innerHTML = items.map((item) => `
      <button
        type="button"
        class="hm-cms-media-item ${item.path === selectedPath ? 'selected' : ''}"
        data-action="select-media"
        data-media-id="${escapeHtml(item.id)}"
      >
        <img src="${escapeHtml(item.path)}" alt="${escapeHtml(item.alt || item.name)}" loading="lazy" />
        <span class="hm-cms-media-name">${escapeHtml(item.name)}</span>
      </button>
    `).join('');
  }

  async function loadMediaPicker() {
    const form = panelBody.querySelector('[data-edit]');
    if (!form) return;
    try {
      const data = await api('/api/cms/media');
      state.mediaItems = data.items || [];
      renderMediaPicker(state.mediaItems, form.elements.value?.value || '');
    } catch (error) {
      const grid = panelBody.querySelector('[data-media-grid]');
      if (grid) grid.innerHTML = `<p class="hm-cms-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function filterMediaPicker(query) {
    const normalized = query.trim().toLowerCase();
    const form = panelBody.querySelector('[data-edit]');
    const selectedPath = form?.elements.value?.value || '';
    const items = !normalized
      ? state.mediaItems
      : state.mediaItems.filter((item) => {
          const haystack = `${item.name} ${item.path} ${item.alt || ''}`.toLowerCase();
          return haystack.includes(normalized);
        });
    renderMediaPicker(items, selectedPath);
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
    if (label) label.textContent = `${asset.name}${asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}`;

    renderMediaPicker(state.mediaItems, asset.path);
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

  function renderPublishJobs(items) {
    if (!items.length) {
      openPanel('<p class="hm-cms-muted">Aun no hay publicaciones registradas.</p>');
      return;
    }

    openPanel(`
      <section class="hm-cms-job-list">
        <p class="hm-cms-muted">Historial de exportaciones y publicaciones.</p>
        ${items.map((job) => `
          <article class="hm-cms-job">
            <div class="hm-cms-job-title">
              <span>${escapeHtml(job.action === 'export' ? 'Exportacion' : 'Publicacion')}</span>
              <span class="hm-cms-badge ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
            </div>
            <p class="hm-cms-muted">${escapeHtml(formatDate(job.createdAt))}${job.completedAt ? ` - ${escapeHtml(formatDate(job.completedAt))}` : ''}</p>
            <p class="hm-cms-muted">${escapeHtml(job.id)}</p>
            <pre class="hm-cms-log">${escapeHtml((job.logs || []).slice(-8).join('\n'))}</pre>
          </article>
        `).join('')}
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
            ${revisions.map((rev) => `
              <div class="hm-cms-revision-item${rev.version === currentVersion ? ' current' : ''}">
                <div class="hm-cms-revision-info">
                  <span class="hm-cms-revision-version">v${rev.version}${rev.version === currentVersion ? ' · actual' : ''}</span>
                  <span class="hm-cms-revision-date">${escapeHtml(formatDate(rev.createdAt))}</span>
                </div>
                ${rev.version !== currentVersion ? `
                  <button
                    type="button"
                    class="secondary"
                    style="font-size:12px;padding:6px 10px"
                    data-action="restore-revision"
                    data-entry-id="${escapeHtml(entryId)}"
                    data-revision-id="${escapeHtml(rev.id)}"
                    data-revision-version="${rev.version}"
                  >Restaurar</button>
                ` : '<span class="hm-cms-badge" style="font-size:10px">Versión actual</span>'}
              </div>
            `).join('')}
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

    const updated = await api(`/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(field)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });

    if (element.dataset.cmsType === 'image') {
      element.setAttribute('src', value);
      const altField = element.dataset.cmsAltField;
      if (altField && form.elements.alt) {
        const altValue = form.elements.alt.value;
        await api(`/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(altField)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: altValue }),
        });
        element.setAttribute('alt', altValue);
      }
    } else {
      element.textContent = updated.fields[field]?.value ?? value;
    }

    status.textContent = 'Guardado en SQLite. Usa Publicar para exportar archivos.';
  }

  document.addEventListener('click', async (event) => {
    const target = event.target;
    const editable = target instanceof Element ? target.closest('[data-cms-entry]') : null;
    const action = target instanceof Element ? target.closest('[data-action]')?.dataset.action : null;

    if (action === 'close') closePanel();
    if (action === 'logout') {
      await api('/api/cms/logout', { method: 'POST' }).catch(() => {});
      window.localStorage.removeItem('hidromont:cms');
      window.location.reload();
    }
    if (action === 'export') {
      const result = await api('/api/cms/export', { method: 'POST' });
      const status = panelBody.querySelector('[data-status]');
      if (status) status.textContent = `Exportado a archivos del sitio. Job ${result.job?.id || ''}`.trim();
    }
    if (action === 'jobs') {
      loadPublishJobs();
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

      btn.textContent = 'Restaurando...';
      btn.setAttribute('disabled', '');
      try {
        await api(`/api/cms/revisions/${encodeURIComponent(entryId)}/restore/${encodeURIComponent(revisionId)}`, {
          method: 'POST',
        });
        // Reload revisions view to reflect the new current version
        await loadRevisions(entryId);
      } catch (error) {
        openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
      }
      return;
    }
    if (action === 'publish') {
      if (!(await ensureSession())) return;
      openPanel('<p class="hm-cms-muted">Publicando y ejecutando validación...</p>');
      try {
        const result = await api('/api/cms/publish', { method: 'POST' });
        renderPublishJobs(result.job ? [result.job] : []);
      } catch (error) {
        openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
      }
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
  }, true);

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.matches('[data-login]')) {
      event.preventDefault();
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
        closePanel();
      } catch (error) {
        loginView(error.message);
      }
    }

    if (form.matches('[data-edit]')) {
      event.preventDefault();
      saveEdit(form).catch((error) => {
        const status = form.querySelector('[data-status]');
        if (status) status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      });
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.matches('[data-media-search]')) {
      filterMediaPicker(target.value);
      return;
    }

    if (target.name === 'value' && target.form?.matches('[data-edit]')) {
      const preview = panelBody.querySelector('[data-image-preview]');
      if (preview) preview.setAttribute('src', target.value);
    }
    if (target.name === 'alt' && target.form?.matches('[data-edit]')) {
      const preview = panelBody.querySelector('[data-image-preview]');
      if (preview) preview.setAttribute('alt', target.value);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  ensureSession();
})();
