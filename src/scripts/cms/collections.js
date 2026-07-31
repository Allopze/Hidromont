export function initCollectionsModule({
  api,
  openPanel,
  setPanelTitle,
  escapeHtml,
  formatDate,
  ensureSession,
  COLLECTION_KINDS,
}) {
  let activeCollectionKind = 'servicio';

  function renderPublishJobs(items) {
    if (!items.length) {
      openPanel('<p class="hm-cms-muted">Aún no hay publicaciones registradas.</p>');
      return;
    }

    openPanel(`
      <section class="hm-cms-job-list">
        <p class="hm-cms-muted">Historial de exportaciones y validaciones.</p>
        <p class="hm-cms-muted" style="background:#eff8ff;border:1px solid #bae6fd;border-radius:0px;padding:8px 10px">
          ℹ️ Exportar y validar escribe los archivos del sitio y corre <code>astro check</code>. Para que los cambios aparezcan en <strong>hidromont.cl</strong> falta compilar y desplegar (<code>npm run build</code> + deploy del hosting).
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
            <pre class="hm-cms-log">${escapeHtml((job.logs || []).slice(-8).join('\n'))}</pre>
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

  async function loadCollections(kind = activeCollectionKind) {
    if (!(await ensureSession())) return;
    activeCollectionKind = kind;
    setPanelTitle('Colecciones');
    openPanel('<p class="hm-cms-muted">Cargando...</p>');
    try {
      const data = await api(`/api/cms/entries?kind=${encodeURIComponent(kind)}`);
      const entries = data.entries || [];
      const tabs = COLLECTION_KINDS.map(
        (k) =>
          `<button type="button" class="hm-cms-tab${k.id === kind ? ' active' : ''}" data-action="tab-kind" data-kind="${escapeHtml(k.id)}">${escapeHtml(k.label)}</button>`
      ).join('');

      openPanel(`
        <div class="hm-cms-tabs">${tabs}</div>
        <div class="hm-cms-actions" style="margin-bottom:12px">
          <button type="button" data-action="new-entry" data-kind="${escapeHtml(kind)}">+ Nueva entrada</button>
        </div>
        ${
          entries.length === 0
            ? `<p class="hm-cms-muted">No hay entradas de tipo «${escapeHtml(kind)}».</p>`
            : `<div class="hm-cms-collection-list">
              ${entries
                .map(
                  (e) => `
                <div class="hm-cms-collection-item">
                  <div class="hm-cms-collection-info">
                    <span class="hm-cms-collection-title">${escapeHtml(e.title)}</span>
                    <span class="hm-cms-collection-meta">${escapeHtml(e.slug)} · <span class="hm-cms-badge ${escapeHtml(e.status)}">${escapeHtml(e.status)}</span></span>
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
      `);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
    }
  }

  return {
    renderPublishJobs,
    loadRevisions,
    loadPublishJobs,
    loadCollections,
    getActiveKind: () => activeCollectionKind,
  };
}
