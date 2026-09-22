/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { apiBase, state } from './context';
import { escapeHtml, formatDate } from './html';
import { panel, panelBody, setFormDirty, setGlobalState, shell } from './shell';
import { applyDraft, clearDraft, scheduleDraftSave } from './drafts';
import { api, ejecutarUnaVez, setButtonLoading } from './api';
import { closePanel, openPanel } from './panel';
import { ensureSession, loginView } from './auth';
import {
  applyMediaSelection,
  loadMediaPicker,
  mediaPicker,
  renderMediaPicker,
  schedulePreviewUpdate,
  searchMediaPicker,
} from './media';
import {
  alternarPrevisualizacion,
  aplicarFormato,
  manejarAtajo,
  navegarBarra,
  refrescarPrevisualizacion,
} from './richtext';
import { saveEdit, selectElement, syncLinkValue, syncListValue } from './fields';
import { exportNoticeMarkup, loadPublishJobs, renderPublishJobs } from './publish';
import { ADMIN_AUDIT_PAGE, adminState, loadAdmin, loadRevisions, renderAdmin } from './admin';
import {
  GALLERY_PAGE_SIZE,
  galleryFilter,
  loadGallery,
  loadGalleryAlbums,
  loadGalleryCategories,
  loadGalleryItemsList,
  scheduleGalleryFilter,
  showGalleryAlbumForm,
  showGalleryCategoryForm,
  showGalleryItemForm,
} from './gallery';
import {
  activeCollectionKind,
  loadCollections,
  resetCollectionQuery,
  saveEntryForm,
  scheduleCollectionSearch,
  showEntryForm,
} from './collections';

// ─── Fin CRUD colecciones ────────────────────────────────────────────────
/**
 * Registra la delegación de eventos del overlay.
 *
 * Son siete escuchadores sobre `document`, no uno por control: el panel se
 * repinta entero en cada vista y volver a enganchar manejadores tras cada
 * repintado es justo lo que hacía falta evitar.
 *
 * Se llama una sola vez, desde `mount()`.
 */
export function registerEvents() {
  document.addEventListener(
    'click',
    async (event) => {
      const target = event.target;
      const editable = target instanceof Element ? target.closest('[data-cms-entry]') : null;
      const action =
        target instanceof Element ? target.closest('[data-action]')?.dataset.action : null;

      if (action === 'rt-format' && target instanceof Element) {
        event.preventDefault();
        const boton = target.closest('[data-action="rt-format"]');
        if (boton) aplicarFormato(boton);
        return;
      }
      if (action === 'rt-preview' && target instanceof Element) {
        event.preventDefault();
        const boton = target.closest('[data-action="rt-preview"]');
        if (boton) alternarPrevisualizacion(boton);
        return;
      }
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
      if (action === 'admin') {
        loadAdmin();
      }
      if (action === 'restore-draft' && target instanceof Element) {
        const form = target.closest('form');
        if (form) applyDraft(form);
      }
      if (action === 'discard-draft' && target instanceof Element) {
        const form = target.closest('form');
        if (form) {
          clearDraft(form);
          form.querySelector('[data-draft-notice]')?.remove();
        }
      }
      if (action === 'admin-more-audit') {
        adminState.auditShown += ADMIN_AUDIT_PAGE;
        // Sin autofocus: el panel ya está abierto y devolver el foco al primer
        // campo del formulario de contraseña sacaría al operador de la lista
        // que acaba de expandir.
        renderAdmin({ autofocus: false });
      }
      if (action === 'create-backup' && target instanceof Element) {
        const btn = target.closest('[data-action="create-backup"]');
        setButtonLoading(btn, true, 'Respaldando...');
        try {
          const result = await api('/api/cms/backup', { method: 'POST' });
          const lista = await api('/api/cms/backup/list').catch(() => ({ backups: [] }));
          adminState.backups = lista.backups || [];
          adminState.backupError = '';
          adminState.notice = `Respaldo creado: ${(result.file || '').split('/').pop()}`;
          renderAdmin({ autofocus: false });
        } catch (error) {
          setButtonLoading(btn, false);
          adminState.backupError = error.message;
          renderAdmin({ autofocus: false });
        }
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
          resetCollectionQuery();
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
        <input type="text" data-list-item="${idx}" value="" aria-label="Elemento ${idx + 1} de la lista" style="flex:1;border:1px solid var(--hm-cms-line-soft);border-radius:0px;padding:8px 10px;font:inherit" />
        <button type="button" data-action="remove-list-item" data-index="${idx}" aria-label="Quitar el elemento ${idx + 1}" style="border:0;background:var(--hm-cms-danger-bg);color:var(--hm-cms-danger-ink);border-radius:0px;padding:6px 10px;cursor:pointer;font-weight:700">×</button>
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
      ejecutarUnaVez(
        form,
        () =>
          saveEdit(form).catch((error) => {
            const status = form.querySelector('[data-status]');
            if (status)
              status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
          }),
        { boton: form.querySelector('button[type="submit"]'), textoCarga: 'Guardando...' }
      );
    }

    if (form.matches('[data-entry-form]')) {
      event.preventDefault();
      ejecutarUnaVez(
        form,
        () =>
          saveEntryForm(form).catch((error) => {
            const status = form.querySelector('[data-status]');
            if (status)
              status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
          }),
        { boton: form.querySelector('button[type="submit"]'), textoCarga: 'Guardando...' }
      );
    }

    if (form.matches('[data-password-form]')) {
      event.preventDefault();
      const status = form.querySelector('[data-status]');
      const btn = form.querySelector('button[type="submit"]');
      const nueva = form.elements.nueva.value;
      if (nueva !== form.elements.repetir.value) {
        if (status)
          status.innerHTML =
            '<span class="hm-cms-error">Las dos contraseñas nuevas no coinciden.</span>';
        return;
      }
      setButtonLoading(btn, true, 'Cambiando...');
      try {
        const result = await api('/api/cms/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actual: form.elements.actual.value, nueva }),
        });
        // La sesión se recreó al cambiar la contraseña: sin refrescar el token,
        // la siguiente acción del panel fallaría con un 403 inexplicable.
        if (result.csrfToken) state.csrfToken = result.csrfToken;
        adminState.notice =
          result.sessionsRevoked > 0
            ? `Contraseña cambiada. Se cerraron ${result.sessionsRevoked} sesión${result.sessionsRevoked === 1 ? '' : 'es'} abierta${result.sessionsRevoked === 1 ? '' : 's'} en otros equipos.`
            : 'Contraseña cambiada.';
        renderAdmin({ autofocus: false });
      } catch (error) {
        setButtonLoading(btn, false);
        if (status)
          status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
      }
    }

    if (form.matches('[data-gallery-cat-form]')) {
      event.preventDefault();
      await ejecutarUnaVez(
        form,
        async () => {
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
        },
        { boton: form.querySelector('button[type="submit"]'), textoCarga: 'Guardando...' }
      );
    }

    if (form.matches('[data-gallery-album-form]')) {
      event.preventDefault();
      await ejecutarUnaVez(
        form,
        async () => {
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
        },
        { boton: form.querySelector('button[type="submit"]'), textoCarga: 'Guardando...' }
      );
    }

    if (form.matches('[data-gallery-item-form]')) {
      event.preventDefault();
      await ejecutarUnaVez(
        form,
        async () => {
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
            clearDraft(form);
            loadGalleryItemsList();
          } catch (error) {
            if (status)
              status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
          }
        },
        { boton: form.querySelector('button[type="submit"]'), textoCarga: 'Guardando...' }
      );
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
      scheduleGalleryFilter(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.matches('[data-collection-search]')) {
      scheduleCollectionSearch(target.value);
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
      scheduleDraftSave(target.form);
      if (target.matches('[data-richtext-input]')) {
        refrescarPrevisualizacion(target.closest('[data-richtext]'));
      }
    }

    if (target.name === 'value' && target.form?.matches('[data-edit]')) {
      schedulePreviewUpdate(target.value);
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

  // Ctrl+B/I/K dentro del editor de texto con formato. Solo consume la
  // pulsación si había un editor enfocado; si no, sigue siendo del navegador.
  document.addEventListener('keydown', (event) => {
    if (manejarAtajo(event)) {
      event.preventDefault();
      return;
    }
    // Flechas dentro de la barra de formato: mueven el foco entre botones en
    // vez de recorrerlos con el tabulador, que es lo que `role="toolbar"` promete.
    if (navegarBarra(event)) event.preventDefault();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // El sheet móvil registra su propio Escape en mobile-menu.ts; si está
    // abierto es suyo, no del panel.
    if (shell.querySelector('.hm-cms-mobile-sheet.open')) return;
    closePanel();
  });
}
