/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { escapeHtml, formatBytes, formatDate } from './html';
import { api } from './api';
import { apiBase } from './context';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { icon } from './icons';
import { fieldLabel } from '../../../data/field-labels';
import { nombreDeFicha } from '../../../data/entry-names';

/**
 * M-6: el registro guarda claves técnicas y estables (`entry.delete`,
 * `login.rate_limited`) porque son las que se consultan por SQL; el panel las
 * traduce porque quien las lee es el editor, no quien escribió el código.
 * Una clave sin traducir se muestra tal cual: es preferible a ocultar el
 * evento.
 */
const AUDIT_LABELS = {
  'login.success': 'Inicio de sesión',
  'login.failed': 'Intento de acceso fallido',
  'login.rate_limited': 'Acceso bloqueado por demasiados intentos',
  logout: 'Cierre de sesión',
  'password.change': 'Cambio de contraseña',
  'password.change_failed': 'Cambio de contraseña rechazado',
  'entry.create': 'Entrada creada',
  'entry.update_meta': 'Datos de entrada modificados',
  'entry.delete': 'Entrada eliminada',
  'field.update': 'Texto modificado',
  'revision.restore': 'Revisión restaurada',
  'media.upload': 'Imagen subida',
  'media.update': 'Imagen modificada',
  'media.delete': 'Imagen eliminada',
  'gallery.category.create': 'Categoría creada',
  'gallery.category.update': 'Categoría modificada',
  'gallery.category.delete': 'Categoría eliminada',
  'gallery.album.create': 'Álbum creado',
  'gallery.album.update': 'Álbum modificado',
  'gallery.album.delete': 'Álbum eliminado',
  'gallery.item.create': 'Imagen agregada a la galería',
  'gallery.item.update': 'Imagen de galería modificada',
  'gallery.item.delete': 'Imagen retirada de la galería',
  'content.export': 'Contenido exportado',
  'content.publish': 'Sitio publicado',
  'backup.create': 'Respaldo creado',
  'publish.jobs_reaped': 'Publicaciones colgadas descartadas',
  'session.revoke_others': 'Sesiones de otros equipos cerradas',
  'gallery.album.reorder': 'Orden de los álbumes cambiado',
  'gallery.category.reorder': 'Orden de las categorías cambiado',
  'gallery.item.reorder': 'Orden de las fotos de la galería cambiado',
  'content.field_retired': 'Campo sin uso retirado',
  'content.entry_retired': 'Ficha sin uso retirada',
  'undo.restore': 'Cambio deshecho',
};

/**
 * P2-22 (auditoría 2026-09): el registro mostraba ids de nanoid, claves como
 * «project-gallery.ch-besaya.images» y la IP «::1». Se muestra el nombre de la
 * ficha y el campo, y lo técnico queda en «Detalles técnicos».
 */
function queSeToco(e) {
  if (!e.entityId) return '';
  const clave = typeof e.data?.key === 'string' ? e.data.key : null;
  if (clave) return `${nombreDeFicha(e.entityId)} › ${fieldLabel(clave)}`;
  if (e.entityType === 'entry') return nombreDeFicha(e.entityId);
  if (e.action === 'content.field_retired') {
    const corte = e.entityId.lastIndexOf('.');
    return `${nombreDeFicha(e.entityId.slice(0, corte))} › ${fieldLabel(e.entityId.slice(corte + 1))}`;
  }
  return '';
}

/** Los eventos de acceso son los que interesan revisar por seguridad. */
const AUDIT_SECURITY = /^(login|password)\./;

export const ADMIN_AUDIT_PAGE = 25;

export let adminState = { events: [], backups: [], auditShown: ADMIN_AUDIT_PAGE, notice: '' };

/**
 * M-6: administración del CMS en un solo panel. Antes el registro de
 * actividad, los respaldos y el cambio de contraseña existían en el servidor
 * pero no tenían ninguna interfaz: la única forma de verlos era SQL o
 * `npm run cms:reset-password`, es decir, pedírselo a un desarrollador.
 */
export async function loadAdmin() {
  if (!(await ensureSession())) return;
  setPanelTitle('Administración');
  openPanel('<p class="hm-cms-muted">Cargando administración...</p>');
  // Se piden en paralelo y se toleran por separado: si los respaldos fallan
  // (permisos de escritura en el servidor, por ejemplo) el registro y el
  // cambio de contraseña siguen siendo utilizables.
  const [auditRes, backupRes] = await Promise.allSettled([
    api('/api/cms/audit'),
    api('/api/cms/backup/list'),
  ]);
  adminState = {
    events: auditRes.status === 'fulfilled' ? auditRes.value.events || [] : [],
    backups: backupRes.status === 'fulfilled' ? backupRes.value.backups || [] : [],
    auditShown: ADMIN_AUDIT_PAGE,
    notice: '',
    auditError: auditRes.status === 'rejected' ? auditRes.reason.message : '',
    backupError: backupRes.status === 'rejected' ? backupRes.reason.message : '',
  };
  renderAdmin({ autofocus: 'panel' });
}

/**
 * Junta los eventos seguidos iguales: veinte «Inicio de sesión» consecutivos
 * enterraban lo que de verdad se había hecho. Se conserva la fecha del más
 * reciente y cuántas veces pasó.
 */
function agruparSeguidos(eventos) {
  const grupos = [];
  for (const e of eventos) {
    const anterior = grupos[grupos.length - 1];
    if (anterior && anterior.action === e.action && anterior.entityId === e.entityId) {
      anterior.veces += 1;
    } else {
      grupos.push({ ...e, veces: 1 });
    }
  }
  return grupos;
}

export function renderAdmin({ autofocus } = {}) {
  setPanelTitle('Administración');
  const { backups, auditShown, notice } = adminState;
  const events = agruparSeguidos(adminState.events);
  const visibles = events.slice(0, auditShown);
  const restantes = events.length - visibles.length;

  openPanel(
    `
    <section class="hm-cms-admin">
      ${notice ? `<p class="hm-cms-notice is-ok" data-admin-notice>${icon('check')}<span>${escapeHtml(notice)}</span></p>` : ''}

      <div class="hm-cms-admin-section">
      <h3>Registro de actividad</h3>
      ${
        adminState.auditError
          ? `<p class="hm-cms-error">${escapeHtml(adminState.auditError)}</p>`
          : ''
      }
      ${
        visibles.length
          ? `<ul class="hm-cms-admin-list" tabindex="0">${visibles
              .map(
                (e) => `<li${AUDIT_SECURITY.test(e.action) ? ' data-security' : ''}>
                  <span>${escapeHtml(AUDIT_LABELS[e.action] || 'Otro cambio')}${
                    e.veces > 1 ? ` <span class="hm-cms-count-pill">×${e.veces}</span>` : ''
                  }${queSeToco(e) ? ` <span class="hm-cms-hint">${escapeHtml(queSeToco(e))}</span>` : ''}</span>
                  <span class="hm-cms-hint">${escapeHtml(formatDate(e.createdAt))}</span>
                  ${
                    e.entityId || e.ip || !AUDIT_LABELS[e.action]
                      ? `<details class="hm-cms-tecnico"><summary>Detalles técnicos</summary>
                    <span class="hm-cms-hint">${escapeHtml([e.action, e.entityId, e.ip && `IP ${e.ip}`].filter(Boolean).join(' · '))}</span>
                  </details>`
                      : ''
                  }
                </li>`
              )
              .join('')}</ul>
            ${
              restantes > 0
                ? `<button type="button" class="secondary small" data-action="admin-more-audit">Ver ${Math.min(restantes, ADMIN_AUDIT_PAGE)} más (quedan ${restantes})</button>`
                : ''
            }`
          : '<p class="hm-cms-empty">Sin actividad registrada.</p>'
      }
      </div>
      <div class="hm-cms-admin-section">
      <h3>Respaldos de la base de datos</h3>
      ${
        adminState.backupError
          ? `<p class="hm-cms-error">${escapeHtml(adminState.backupError)}</p>`
          : ''
      }
      <p class="hm-cms-hint">Una copia del contenido y la galería (sin las fotos, que viven aparte). Se guarda en el servidor, que conserva las 20 más recientes; descárgala si es un respaldo que quieres guardar fuera.</p>
      <span class="hm-cms-actions">
        <button type="button" class="secondary" data-action="create-backup">Crear respaldo ahora</button>
      </span>
      ${
        backups.length
          ? `<ul class="hm-cms-admin-list" tabindex="0">${backups
              .map(
                (b) => `<li>
                  <span>${escapeHtml(formatDate(b.createdAt))} · ${escapeHtml(formatBytes(b.size))}</span>
                  <a class="secondary small" href="${escapeHtml(`${apiBase}/api/cms/backup/descargar/${encodeURIComponent(b.file)}`)}" download="${escapeHtml(b.file)}">Descargar</a>
                </li>`
              )
              .join('')}</ul>`
          : '<p class="hm-cms-empty">Todavía no hay respaldos.</p>'
      }
      </div>

      <section class="hm-cms-admin-section">
      <h3>Herramientas avanzadas</h3>
      <p class="hm-cms-hint">«Exportar» escribe los archivos del sitio con lo guardado, sin publicarlo. Solo hace falta si alguien técnico te lo pide; para que los cambios se vean en el sitio, usa «Publicar cambios».</p>
      <span class="hm-cms-actions">
        <button type="button" class="secondary" data-action="export">Exportar archivos</button>
      </span>
      <p class="hm-cms-save-state" role="status" aria-live="polite" data-status></p>
      </section>

      <div class="hm-cms-admin-section">
      <h3>Cambiar contraseña</h3>
      <form data-password-form>
        <label>Contraseña actual
          <input type="password" name="actual" autocomplete="current-password" required />
        </label>
        <label>Contraseña nueva
          <input type="password" name="nueva" autocomplete="new-password" minlength="12" required />
        </label>
        <label>Repetir la nueva
          <input type="password" name="repetir" autocomplete="new-password" minlength="12" required />
        </label>
        <p class="hm-cms-hint">Mínimo 12 caracteres. Al cambiarla se cierran las demás sesiones abiertas; esta se mantiene.</p>
        <span class="hm-cms-actions">
          <button type="submit">Cambiar contraseña</button>
        </span>
        <p class="hm-cms-save-state" role="status" aria-live="polite" data-status></p>
      </form>
      </div>

      <div class="hm-cms-admin-section">
      <h3>Sesiones abiertas</h3>
      <p class="hm-cms-hint">Si entraste desde otro equipo o perdiste un móvil con la sesión abierta, ciérralas desde aquí. Esta se mantiene. Una sesión que no se usa en un día se cierra sola.</p>
      <span class="hm-cms-actions">
        <button type="button" class="secondary" data-action="cerrar-otras-sesiones">Cerrar las demás sesiones</button>
      </span>
      <p class="hm-cms-save-state" role="status" aria-live="polite" data-sesiones-estado></p>
      </div>

    </section>
  `,
    { autofocus: autofocus ?? true }
  );
}

/** Lo que se ve de un valor en la lista de versiones: texto corto o la foto. */
function vistaDelValor(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return '<span class="hm-cms-muted">(vacío)</span>';
  }
  if (typeof valor === 'string' && /^\/.*\.(png|jpe?g|webp|svg|avif)$/i.test(valor)) {
    return `<img class="hm-cms-revision-thumb" src="${escapeHtml(valor)}" alt="" loading="lazy" />`;
  }
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  const corto = texto.length > 240 ? `${texto.slice(0, 240)}…` : texto;
  return `<span class="hm-cms-revision-value">${escapeHtml(corto)}</span>`;
}

function nombreDeClave(key) {
  if (key === 'title') return 'Nombre';
  if (key === 'status') return 'Visibilidad';
  return fieldLabel(key);
}

/**
 * @param titulo El nombre legible de la entrada. Antes la vista decía
 *   «Revisiones de layout.header»: la clave interna, no lo que ve quien edita.
 * @param opciones.field P2-26 (auditoría 2026-09): abierta desde el editor de
 *   un campo, la vista muestra el valor de ese campo en cada versión y
 *   restaura solo ese campo. Antes era a ciegas —número y fecha— y
 *   «Restaurar» devolvía la ficha entera.
 * @param opciones.origen `'ficha'` si se abrió desde Colecciones: «Volver»
 *   regresa a la ficha en vez de cerrar el panel.
 */
export async function loadRevisions(entryId, titulo = '', opciones = {}) {
  if (!(await ensureSession())) return;
  const { field = '', fieldName = '', origen = '' } = opciones;
  revisionesAbiertas = { entryId, titulo, opciones };
  const nombre = titulo || entryId;
  const volver = `<button type="button" class="ghost small hm-cms-back" data-action="back-to-editor" data-origen="${escapeHtml(origen)}" data-entry-id="${escapeHtml(entryId)}">${icon('arrowLeft')}Volver</button>`;
  setPanelTitle('Revisiones');
  openPanel('<p class="hm-cms-muted">Cargando revisiones…</p>');
  try {
    const query = field ? `?field=${encodeURIComponent(field)}` : '';
    const data = await api(`/api/cms/revisions/${encodeURIComponent(entryId)}${query}`);
    let revisions = data.revisions || [];
    // Del campo solo interesan las versiones en que cambió: veinte copias
    // del mismo texto no ayudan a encontrar el que se busca.
    if (field) {
      revisions = revisions.filter(
        (rev, i) =>
          i === 0 ||
          JSON.stringify(rev.value ?? null) !== JSON.stringify(revisions[i - 1].value ?? null)
      );
    }

    if (revisions.length < 2) {
      openPanel(`
        ${volver}
        <p class="hm-cms-empty">${
          field
            ? `«${escapeHtml(fieldName || nombreDeClave(field))}» todavía no tiene versiones anteriores.`
            : `«${escapeHtml(nombre)}» todavía no tiene versiones anteriores.`
        }</p>
      `);
      return;
    }

    const actual = revisions[0];
    openPanel(`
      <div class="hm-cms-stack">
        ${volver}
        <div>
          <h3 class="hm-cms-section-title">${escapeHtml(field ? fieldName || nombreDeClave(field) : nombre)}</h3>
          <p class="hm-cms-hint">${
            field
              ? `Los valores que ha tenido este campo de «${escapeHtml(nombre)}». «Restaurar» cambia solo este campo; el resto queda como está.`
              : 'Cada vez que guardas se crea una versión. Debajo de cada una ves qué cambió. «Restaurar» devuelve la ficha entera a esa versión.'
          }</p>
        </div>
        <div class="hm-cms-revisions">
          ${revisions
            .map((rev) => {
              const esActual = rev === actual;
              const detalle = field
                ? vistaDelValor(rev.value)
                : rev.changed?.length
                  ? `<span class="hm-cms-hint">Cambió: ${escapeHtml(rev.changed.map(nombreDeClave).join(', '))}</span>`
                  : '';
              return `
            <div class="hm-cms-revision-item${esActual ? ' current' : ''}">
              <div class="hm-cms-revision-info">
                <span class="hm-cms-revision-date">${escapeHtml(formatDate(rev.createdAt))}</span>
                ${detalle}
              </div>
              ${
                esActual
                  ? '<span class="hm-cms-badge published">Actual</span>'
                  : `<button
                  type="button"
                  class="secondary small"
                  data-action="restore-revision"
                  data-entry-id="${escapeHtml(entryId)}"
                  data-revision-id="${escapeHtml(rev.id)}"
                  data-revision-date="${escapeHtml(formatDate(rev.createdAt))}"
                  data-field="${escapeHtml(field)}"
                >${field ? 'Restaurar este valor' : 'Restaurar'}</button>`
              }
            </div>
          `;
            })
            .join('')}
        </div>
      </div>
    `);
  } catch (error) {
    openPanel(`${volver}<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}

/** La vista de revisiones abierta, para repintarla tras restaurar. */
export let revisionesAbiertas = null;
