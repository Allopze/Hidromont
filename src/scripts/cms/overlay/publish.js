/**
 * Publicar: qué va a salir, el avance y el resultado.
 *
 * Antes «Publicar cambios» arrancaba la compilación al instante, sin decir qué
 * incluía, y al terminar enseñaba el registro técnico de la compilación. Ahora
 * es un proceso en tres pasos que se entiende sin saber qué es un build:
 *
 *   1. Resumen: qué fichas, páginas y fotos cambiaron desde la última
 *      publicación, y qué pasará al confirmar.
 *   2. Avance: un reloj y la indicación de no cerrar la pestaña. El panel no
 *      se puede cerrar mientras dura (`data-busy`).
 *   3. Resultado: «listo» o «no se pudo», en palabras; el registro queda en
 *      «Detalles técnicos».
 */

import { escapeHtml, formatDate } from './html';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { entornoDePublicacion } from './entorno';
import { icon } from './icons';
import { setGlobalState } from './shell';
import { duracion, haceCuanto, reloj } from './tiempo';
import { limpiarMarcasSinPublicar, refrescarPendientes } from './pendientes';

/**
 * A-7/A-9: lo que el export dejó fuera y lo que volvió al texto por
 * defecto. Antes esto solo salía por el stderr del servidor mientras el job
 * se cerraba como correcto, así que un proyecto podía dejar de publicarse
 * sin que el editor se enterara.
 */
export function exportNoticeMarkup(exported) {
  const omitidas = exported?.skipped || [];
  const revertidas = exported?.revertedToFallback || [];
  // P1-05 (auditoría 2026-09): imágenes o videos que la página pide y no
  // existen. Antes se publicaban rotos sin que nadie se enterara.
  const faltantes = exported?.missingFiles || [];
  // P3-08: fotos de la galería cuya imagen se borró.
  const sinImagen = Number(exported?.galeriaSinImagen) || 0;
  if (!omitidas.length && !revertidas.length && !faltantes.length && !sinImagen) return '';

  const lista = (titulo, filas) =>
    filas.length
      ? `<p><strong>${escapeHtml(titulo)}</strong></p>
         <ul class="hm-cms-notice-list">
           ${filas.join('')}
         </ul>`
      : '';

  return `
    <div class="hm-cms-notice is-warn" role="alert" aria-live="assertive">
      ${icon('alert')}
      <div>
      ${lista(
        'No se publicaron (corrige el campo y vuelve a publicar):',
        omitidas.map(
          (e) =>
            `<li>${escapeHtml(e.slug)} — ${escapeHtml(e.reason)}
               <button type="button" class="secondary small" data-action="edit-entry" data-entry-id="${escapeHtml(e.id)}">Editar</button>
             </li>`
        )
      )}
      ${lista(
        'En borrador: el sitio muestra el texto por defecto del código',
        revertidas.map((e) => `<li>${escapeHtml(e.title)}</li>`)
      )}
      ${lista(
        'Fotos o videos que ya no existen (se verán rotos: elige otros):',
        faltantes.map((f) => `<li>${escapeHtml(f)}</li>`)
      )}
      ${
        sinImagen
          ? `<p><strong>${sinImagen === 1 ? '1 foto de la galería se quedó' : `${sinImagen} fotos de la galería se quedaron`} sin imagen y no sale${sinImagen === 1 ? '' : 'n'} en el sitio.</strong> Búscala${sinImagen === 1 ? '' : 's'} en «Galería» para ponerle${sinImagen === 1 ? '' : 's'} otra imagen o quitarla${sinImagen === 1 ? '' : 's'}.</p>`
          : ''
      }
      </div>
    </div>
  `;
}

export function publishEnvironment() {
  return entornoDePublicacion(window.location.hostname);
}

/** Qué pasa al confirmar, según dónde está abierto el editor. */
function destinoDePublicacion() {
  const entorno = publishEnvironment();
  if (entorno === 'production') {
    return 'Se actualizará hidromontchile.cl. Suele tardar unos minutos.';
  }
  if (entorno === 'local') {
    return 'Se compilará el sitio en este equipo. Para que se vea en hidromontchile.cl, después hay que desplegarlo.';
  }
  return 'Se compilará el sitio en este entorno. Esto no actualiza hidromontchile.cl.';
}

function listaDePendientes(cambios) {
  return `
    <ul class="hm-cms-pending-list">
      ${cambios
        .map(
          (c) => `
        <li>
          <div class="hm-cms-pending-text">
            <strong>${escapeHtml(c.titulo)}</strong>
            ${c.detalle.length ? `<span>${escapeHtml(c.detalle.join(' · '))}</span>` : ''}
          </div>
          <span class="hm-cms-pending-when">${escapeHtml(haceCuanto(c.ultimo))}</span>
        </li>`
        )
        .join('')}
    </ul>`;
}

/** Paso 1: el resumen, antes de confirmar. */
export async function abrirPublicacion() {
  if (!(await ensureSession())) return;
  setPanelTitle('Publicar cambios');
  openPanel('<p class="hm-cms-muted">Revisando qué hay pendiente…</p>');

  let datos = null;
  try {
    datos = await api('/api/cms/publish/pending');
  } catch {
    datos = null;
  }
  const hay = Boolean(datos?.total);
  const resumen = !datos
    ? `<div class="hm-cms-notice is-warn">${icon('alert')}<p>No se pudo saber qué hay pendiente. Puedes publicar igualmente.</p></div>`
    : hay
      ? `<p>${datos.total === 1 ? 'Se publicará este cambio' : `Se publicarán estos ${datos.total} cambios`}${
          datos.desde
            ? `, guardados desde la última publicación (${escapeHtml(haceCuanto(datos.desde))})`
            : ''
        }:</p>
         ${listaDePendientes(datos.cambios)}`
      : `<p class="hm-cms-empty">No hay cambios nuevos desde la última publicación${
          datos.desde ? ` (${escapeHtml(haceCuanto(datos.desde))})` : ''
        }.</p>`;

  openPanel(`
    <div class="hm-cms-view hm-cms-stack" data-publish-summary>
      ${resumen}
      <div class="hm-cms-notice is-info">${icon('info')}<p>${escapeHtml(destinoDePublicacion())}</p></div>
      <div class="hm-cms-actions hm-cms-footer">
        <button type="button" class="${hay || !datos ? 'primary' : 'secondary'}" data-action="confirm-publish">${icon('send')}${
          hay || !datos ? 'Publicar ahora' : 'Publicar de todos modos'
        }</button>
        <button type="button" class="ghost" data-action="close">Cancelar</button>
      </div>
    </div>
  `);
}

let publicando = false;
/** ¿Hay una publicación en marcha? La barra no abre otras vistas mientras. */
export function estaPublicando() {
  return publicando;
}

function resultadoCorrecto(result, conOmisiones, tardo) {
  const entorno = publishEnvironment();
  const titulo =
    entorno === 'production'
      ? conOmisiones
        ? 'Publicado, con avisos'
        : 'Listo: el sitio está actualizado'
      : entorno === 'local'
        ? 'Compilado en este equipo'
        : 'Compilado en este entorno';
  const detalle =
    entorno === 'production'
      ? conOmisiones
        ? 'Parte del contenido no se publicó. Revisa los avisos de abajo.'
        : 'Los cambios ya se ven en hidromontchile.cl.'
      : entorno === 'local'
        ? 'Falta desplegarlo para que se vea en hidromontchile.cl.'
        : 'Esto no confirma una actualización de hidromontchile.cl.';
  return `
    <div class="hm-cms-result ${conOmisiones ? 'is-warn' : 'is-ok'}" role="status">
      ${icon(conOmisiones ? 'alert' : 'check', { size: 22 })}
      <div>
        <h3>${escapeHtml(titulo)}</h3>
        <p>${escapeHtml(detalle)}</p>
        <p class="hm-cms-hint">Terminó a las ${escapeHtml(
          new Intl.DateTimeFormat('es-CL', { timeStyle: 'short' }).format(new Date())
        )} · tardó ${escapeHtml(tardo)}${
          result.siteBuiltAt
            ? ` · sitio compilado el ${escapeHtml(formatDate(result.siteBuiltAt))}`
            : ''
        }</p>
      </div>
    </div>`;
}

function detallesTecnicos(job) {
  if (!job) return '';
  return `
    <details class="hm-cms-tech">
      <summary>Detalles técnicos</summary>
      <p>Identificador: <code>${escapeHtml(job.id)}</code></p>
      <pre class="hm-cms-log" tabindex="0" aria-label="Registro de la publicación">${escapeHtml((job.logs || []).slice(-12).join('\n'))}</pre>
    </details>`;
}

/** Pasos 2 y 3: publicar con avance visible y enseñar el resultado. */
export async function publicar() {
  if (publicando || !(await ensureSession())) return;
  publicando = true;
  const inicio = Date.now();

  setPanelTitle('Publicando…');
  openPanel(
    `
    <div class="hm-cms-progress" data-busy="true">
      <span class="hm-cms-spinner hm-cms-spinner-lg" aria-hidden="true"></span>
      <div role="status" aria-live="polite">
        <p><strong>Publicando los cambios…</strong></p>
        <p class="hm-cms-hint">Se preparan los archivos y se actualiza el sitio. Suele tardar unos minutos: no cierres esta pestaña.</p>
      </div>
      <p class="hm-cms-progress-clock" data-publish-clock aria-hidden="true">0:00</p>
    </div>
  `,
    { autofocus: 'panel' }
  );
  const marcador = () => document.querySelector('[data-publish-clock]');
  const tic = setInterval(() => {
    const el = marcador();
    if (el) el.textContent = reloj(Date.now() - inicio);
  }, 1000);

  let result = null;
  let error = null;
  try {
    result = await api('/api/cms/publish', { method: 'POST' });
  } catch (e) {
    error = e;
  } finally {
    clearInterval(tic);
    publicando = false;
  }

  const tardo = duracion(Date.now() - inicio);
  const job = result?.job;
  const bien = !error && job?.status === 'succeeded';
  if (bien) limpiarMarcasSinPublicar();
  const conOmisiones =
    (result?.exported?.skipped || []).length > 0 ||
    (result?.exported?.revertedToFallback || []).length > 0 ||
    (result?.exported?.missingFiles || []).length > 0;

  setPanelTitle(bien ? 'Publicación terminada' : 'No se pudo publicar');
  openPanel(`
    <div class="hm-cms-view hm-cms-stack" data-publish-result="${bien ? 'ok' : 'error'}">
      ${
        bien
          ? resultadoCorrecto(result, conOmisiones, tardo)
          : `<div class="hm-cms-result is-danger" role="alert">
              ${icon('alert', { size: 22 })}
              <div>
                <h3>No se pudo publicar</h3>
                <p>El sitio sigue mostrando la versión anterior y no se perdió nada de lo guardado. Puedes intentarlo otra vez; si vuelve a fallar, avisa a quien administra el CMS.</p>
                ${error ? `<p class="hm-cms-hint">${escapeHtml(error.message)}</p>` : ''}
                ${error?.job ? `<p class="hm-cms-muted">Identificador para soporte: <code>${escapeHtml(error.job)}</code></p>` : ''}
              </div>
            </div>`
      }
      ${exportNoticeMarkup(result?.exported)}
      ${detallesTecnicos(job)}
      <div class="hm-cms-actions hm-cms-footer">
        ${
          bien
            ? '<button type="button" class="primary" data-action="close">Cerrar</button>'
            : `<button type="button" class="primary" data-action="confirm-publish">Intentar de nuevo</button>
               <button type="button" class="ghost" data-action="close">Cerrar</button>`
        }
        <button type="button" class="ghost" data-action="jobs">${icon('history')}Ver historial</button>
      </div>
    </div>
  `);

  const entorno = publishEnvironment();
  setGlobalState(
    !bien
      ? 'error'
      : entorno === 'production'
        ? conOmisiones
          ? 'published-warning'
          : 'published'
        : entorno === 'local'
          ? conOmisiones
            ? 'local-warning'
            : 'local-built'
          : conOmisiones
            ? 'other-warning'
            : 'other-built'
  );
  // Tras un fallo no se recuenta: los pendientes son los mismos que antes y el
  // aviso de error tiene que seguir a la vista aunque se cierre el panel.
  if (bien) refrescarPendientes();
}

const ESTADOS_DE_TRABAJO = {
  queued: 'En cola',
  running: 'En curso',
  succeeded: 'Completada',
  failed: 'Falló',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
};

export function renderPublishJobs(items) {
  if (!items.length) {
    openPanel(
      '<section class="hm-cms-job-list"><p class="hm-cms-empty">Todavía no hay publicaciones.</p></section>'
    );
    return;
  }
  openPanel(`
    <section class="hm-cms-job-list">
      <div class="hm-cms-notice is-info">
        ${icon('info')}
        <p>${escapeHtml(destinoDePublicacion())} Aquí queda cada publicación, con su resultado.</p>
      </div>
      ${items
        .map((job) => {
          const tardo =
            job.completedAt && job.createdAt
              ? duracion(new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime())
              : '';
          return `
        <article class="hm-cms-job">
          <div class="hm-cms-job-title">
            <span>${escapeHtml(job.action === 'export' ? 'Preparación de archivos' : 'Publicación')}</span>
            <span class="hm-cms-badge ${escapeHtml(job.status)}">${escapeHtml(ESTADOS_DE_TRABAJO[job.status] || job.status)}</span>
          </div>
          <p class="hm-cms-hint" title="${escapeHtml(formatDate(job.createdAt))}">${escapeHtml(haceCuanto(job.createdAt))}${tardo ? ` · tardó ${escapeHtml(tardo)}` : ''}</p>
          ${detallesTecnicos(job)}
        </article>`;
        })
        .join('')}
    </section>
  `);
}

export async function loadPublishJobs() {
  if (!(await ensureSession())) return;
  setPanelTitle('Historial de publicaciones');
  openPanel('<p class="hm-cms-muted">Cargando historial…</p>');
  try {
    const data = await api('/api/cms/publish/jobs');
    renderPublishJobs(data.items || []);
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}
