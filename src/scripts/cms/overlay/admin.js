/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { escapeHtml, formatBytes, formatDate } from './html';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';

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
};

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
  renderAdmin();
}

export function renderAdmin({ autofocus } = {}) {
  setPanelTitle('Administración');
  const { events, backups, auditShown, notice } = adminState;
  const visibles = events.slice(0, auditShown);
  const restantes = events.length - visibles.length;

  openPanel(
    `
    <section class="hm-cms-admin">
      ${notice ? `<p class="hm-cms-ok" data-admin-notice>${escapeHtml(notice)}</p>` : ''}

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
                  <span>${escapeHtml(AUDIT_LABELS[e.action] || e.action)}${
                    e.entityId ? ` <span class="hm-cms-muted">${escapeHtml(e.entityId)}</span>` : ''
                  }</span>
                  <span class="hm-cms-muted">${escapeHtml(formatDate(e.createdAt))}${e.ip ? ` · ${escapeHtml(e.ip)}` : ''}</span>
                </li>`
              )
              .join('')}</ul>
            ${
              restantes > 0
                ? `<button type="button" class="secondary" data-action="admin-more-audit">Ver ${Math.min(restantes, ADMIN_AUDIT_PAGE)} más (${restantes} restantes)</button>`
                : ''
            }`
          : '<p class="hm-cms-muted">Sin actividad registrada.</p>'
      }
      <h3>Respaldos de la base de datos</h3>
      ${
        adminState.backupError
          ? `<p class="hm-cms-error">${escapeHtml(adminState.backupError)}</p>`
          : ''
      }
      <p class="hm-cms-muted">Copia del contenido y la galería. Se guarda en el servidor, junto a la base; descárgala fuera del servidor si es un respaldo que quieres conservar.</p>
      <span class="hm-cms-actions">
        <button type="button" class="secondary" data-action="create-backup">Crear respaldo ahora</button>
      </span>
      ${
        backups.length
          ? `<ul class="hm-cms-admin-list" tabindex="0">${backups
              .map(
                (b) => `<li>
                  <span>${escapeHtml(b.file)}</span>
                  <span class="hm-cms-muted">${escapeHtml(formatDate(b.createdAt))} · ${escapeHtml(formatBytes(b.size))}</span>
                </li>`
              )
              .join('')}</ul>`
          : '<p class="hm-cms-muted">Todavía no hay respaldos.</p>'
      }

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
        <p class="hm-cms-muted">Mínimo 12 caracteres. Al cambiarla se cierran las demás sesiones abiertas; esta se mantiene.</p>
        <span class="hm-cms-actions">
          <button type="submit">Cambiar contraseña</button>
        </span>
        <p class="hm-cms-muted" data-status></p>
      </form>

    </section>
  `,
    { autofocus: autofocus !== false }
  );
}

export async function loadRevisions(entryId) {
  if (!(await ensureSession())) return;
  setPanelTitle('Revisiones');
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
