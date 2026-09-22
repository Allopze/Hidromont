/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { escapeHtml, formatDate } from './html';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';

/**
 * A-7/A-9: lo que el export dejó fuera y lo que volvió al texto por
 * defecto. Antes esto solo salía por el stderr del servidor mientras el job
 * se cerraba como correcto, así que un proyecto podía dejar de publicarse
 * sin que el editor se enterara.
 */
export function exportNoticeMarkup(exported) {
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
    <div class="hm-cms-muted" role="alert" aria-live="assertive" style="background:var(--hm-cms-warn-bg);border:1px solid var(--hm-cms-warn-line);border-radius:0px;padding:10px 12px;margin-bottom:10px">
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

export function publishEnvironment() {
  const host = window.location.hostname.toLowerCase();
  if (host === 'hidromontchile.cl' || host === 'www.hidromontchile.cl') return 'production';
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) return 'local';
  return 'other';
}

export function renderPublishJobs(items) {
  if (!items.length) {
    openPanel('<p class="hm-cms-muted">Aun no hay publicaciones registradas.</p>');
    return;
  }
  const entorno = publishEnvironment();
  const avisoEntorno =
    entorno === 'production'
      ? 'Esta pantalla está en el dominio oficial; una publicación terminada sin avisos actualiza el sitio.'
      : entorno === 'local'
        ? 'Esta pantalla está en local; la compilación no actualiza el sitio público y hace falta desplegarla.'
        : 'Esta pantalla no está en el dominio oficial; el historial confirma solo el resultado de este entorno.';

  openPanel(`
    <section class="hm-cms-job-list">
      <p class="hm-cms-muted">Historial de preparación de archivos y publicaciones.</p>
      <p class="hm-cms-muted" style="background:var(--hm-cms-info-bg);border:1px solid var(--hm-cms-info-line);border-radius:0px;padding:8px 10px">
        ℹ️ «Exportar» solo prepara archivos. «Publicar cambios» también compila este sitio. ${avisoEntorno}
      </p>
      ${items
        .map(
          (job) => `
        <article class="hm-cms-job">
          <div class="hm-cms-job-title">
            <span>${escapeHtml(job.action === 'export' ? 'Preparación de archivos' : 'Publicación')}</span>
            <span class="hm-cms-badge ${escapeHtml(job.status)}">${escapeHtml({ queued: 'En cola', running: 'En curso', succeeded: 'Completada', failed: 'Fallida', cancelled: 'Cancelada', canceled: 'Cancelada' }[job.status] || job.status)}</span>
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

export async function loadPublishJobs() {
  if (!(await ensureSession())) return;
  setPanelTitle('Historial de publicaciones');
  openPanel('<p class="hm-cms-muted">Cargando historial...</p>');
  try {
    const data = await api('/api/cms/publish/jobs');
    renderPublishJobs(data.items || []);
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}
