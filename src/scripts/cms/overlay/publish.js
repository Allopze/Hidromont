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
import { marcarPublicando, setGlobalState } from './shell';
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

/**
 * El avance: reloj, aviso de no cerrar y panel bloqueado. Devuelve la función
 * que detiene el reloj.
 */
function pintarAvance(titulo, texto, inicio) {
  setPanelTitle('Publicando…');
  openPanel(
    `
    <div class="hm-cms-progress" data-busy="true" data-publish-progress>
      <span class="hm-cms-spinner hm-cms-spinner-lg" aria-hidden="true"></span>
      <div role="status" aria-live="polite">
        <p><strong>${escapeHtml(titulo)}</strong></p>
        <p class="hm-cms-hint">${escapeHtml(texto)}</p>
      </div>
      <p class="hm-cms-progress-clock" data-publish-clock aria-hidden="true">${escapeHtml(reloj(Date.now() - inicio))}</p>
    </div>
  `,
    { autofocus: 'panel' }
  );
  const tic = setInterval(() => {
    const el = document.querySelector('[data-publish-clock]');
    if (el) el.textContent = reloj(Date.now() - inicio);
  }, 1000);
  return () => clearInterval(tic);
}

/** La publicación más reciente del historial, o null. */
async function ultimaPublicacion() {
  const { items = [] } = await api('/api/cms/publish/jobs');
  return items.find((j) => j.action === 'publish') || null;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
/** Cada cuánto se pregunta por el trabajo mientras se espera. */
const INTERVALO_DE_SONDEO = 3000;

/**
 * M-02 (auditoría 2026-09-28): el resultado real de una publicación cuya
 * respuesta no llegó. La compilación sigue en el servidor aunque la conexión se
 * corte, así que se consulta el historial hasta que no quede ninguna en curso.
 *
 * `previo` es el id de la última publicación antes de pulsar: si al terminar la
 * más reciente sigue siendo esa, la nuestra no llegó a empezar y se devuelve
 * null. Con `laEnCurso`, se espera a esa (la que ya estaba en marcha).
 */
async function esperarPublicacion({ previo = null, laEnCurso = null } = {}) {
  const limite = Date.now() + 20 * 60 * 1000;
  let fallosSeguidos = 0;
  while (Date.now() < limite) {
    await espera(INTERVALO_DE_SONDEO);
    let publicaciones;
    try {
      const { items = [] } = await api('/api/cms/publish/jobs');
      publicaciones = items.filter((j) => j.action === 'publish');
      fallosSeguidos = 0;
    } catch {
      // Sin conexión todavía: se sigue esperando, pero no para siempre.
      if (++fallosSeguidos >= 40) return null;
      continue;
    }
    if (laEnCurso) {
      const esa = publicaciones.find((j) => j.id === laEnCurso);
      if (!esa) return null;
      if (esa.status !== 'running') return esa;
      continue;
    }
    const ultima = publicaciones[0];
    if (!ultima || ultima.status === 'running') continue;
    return ultima.id === previo ? null : ultima;
  }
  return null;
}

/** «⚠» en el registro: lo que el export omitió o avisó (ver noticeLines). */
const conAvisosEnRegistro = (job) => (job?.logs || []).some((l) => l.startsWith('⚠'));

function mostrarResultado({ result, error, inicio, recuperado = false }) {
  const tardo = duracion(Date.now() - inicio);
  const job = result?.job;
  const bien = !error && job?.status === 'succeeded';
  if (bien) limpiarMarcasSinPublicar();
  const conOmisiones = result?.exported
    ? (result.exported.skipped || []).length > 0 ||
      (result.exported.revertedToFallback || []).length > 0 ||
      (result.exported.missingFiles || []).length > 0
    : conAvisosEnRegistro(job);

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
                ${error?.job || (!error && job) ? `<p class="hm-cms-muted">Identificador para soporte: <code>${escapeHtml(error?.job || job.id)}</code></p>` : ''}
              </div>
            </div>`
      }
      ${
        recuperado && bien && conOmisiones
          ? `<div class="hm-cms-notice is-warn">${icon('alert')}<p>Hubo avisos durante la publicación. Están en «Detalles técnicos».</p></div>`
          : ''
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

/** ¿La respuesta se perdió por el camino (y la publicación puede seguir)? */
const seCortoLaConexion = (e) => [0, 502, 503, 504].includes(Number(e?.status));
const otraEnCurso = (e) =>
  Number(e?.status) === 409 && /en curso|compilando/i.test(e?.message || '');

/** Pasos 2 y 3: publicar con avance visible y enseñar el resultado. */
export async function publicar() {
  if (publicando || !(await ensureSession())) return;
  publicando = true;
  marcarPublicando(true);
  const inicio = Date.now();
  let detener = pintarAvance(
    'Publicando los cambios…',
    'Se preparan los archivos y se actualiza el sitio. Suele tardar unos minutos: no cierres esta pestaña.',
    inicio
  );

  let result = null;
  let error = null;
  let recuperado = false;
  try {
    // Con qué publicación terminaba el historial antes de pulsar: sirve para
    // reconocer la nuestra si la respuesta no llega.
    const previo = await ultimaPublicacion()
      .then((j) => j?.id ?? null)
      .catch(() => undefined);
    try {
      result = await api('/api/cms/publish', { method: 'POST' });
    } catch (e) {
      error = e;
    }
    if (error && (seCortoLaConexion(error) || otraEnCurso(error)) && previo !== undefined) {
      const ajena = otraEnCurso(error);
      detener();
      detener = pintarAvance(
        ajena ? 'Ya había una publicación en marcha…' : 'Se perdió la conexión con el servidor',
        ajena
          ? 'Se espera a que termine para enseñarte el resultado. Después revisa si quedan cambios por publicar.'
          : 'La publicación sigue en el servidor. Comprobando si terminó… no cierres esta pestaña.',
        inicio
      );
      const ultima = ajena
        ? await ultimaPublicacion()
            .then((j) => (j?.status === 'running' ? esperarPublicacion({ laEnCurso: j.id }) : j))
            .catch(() => null)
        : await esperarPublicacion({ previo });
      if (ultima) {
        result = { job: ultima };
        error =
          ultima.status === 'succeeded'
            ? null
            : Object.assign(new Error('La compilación del sitio falló. Mira «Ver historial».'), {
                job: ultima.id,
              });
        recuperado = true;
      }
    }
  } finally {
    detener();
    publicando = false;
    marcarPublicando(false);
  }
  mostrarResultado({ result, error, inicio, recuperado });
}

/**
 * M-02: al abrir el editor con una publicación todavía en marcha (se recargó
 * la página o se cerró la pestaña mientras compilaba), se enseña su avance y,
 * al terminar, su resultado; antes el panel no sabía nada y «Publicar» daba 409.
 */
export async function retomarPublicacionEnCurso() {
  if (publicando) return;
  let ultima;
  try {
    ultima = await ultimaPublicacion();
  } catch {
    return;
  }
  if (ultima?.status !== 'running') return;
  publicando = true;
  marcarPublicando(true);
  const inicio = new Date(ultima.createdAt).getTime() || Date.now();
  const detener = pintarAvance(
    'Hay una publicación en marcha…',
    'Empezó antes de abrir esta página. Se enseñará el resultado al terminar: no cierres esta pestaña.',
    inicio
  );
  let terminada = null;
  try {
    terminada = await esperarPublicacion({ laEnCurso: ultima.id });
  } finally {
    detener();
    publicando = false;
    marcarPublicando(false);
  }
  if (!terminada) return;
  mostrarResultado({
    result: { job: terminada },
    error:
      terminada.status === 'succeeded'
        ? null
        : Object.assign(new Error('La compilación del sitio falló. Mira «Ver historial».'), {
            job: terminada.id,
          }),
    inicio,
    recuperado: true,
  });
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
