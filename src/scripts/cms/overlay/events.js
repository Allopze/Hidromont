/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { apiBase, state } from './context';
import { escapeHtml } from './html';
import { isFormDirty, panel, panelBody, setFormDirty, setGlobalState, shell } from './shell';
import { editando, previsualizarImagen, previsualizarTexto } from './edicion';
import { applyDraft, clearDraft, scheduleDraftSave } from './drafts';
import { api, ejecutarUnaVez, setButtonLoading } from './api';
import { deshacer, ofrecerDeshacer } from './undo';
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
import { ESTADOS_DE_CAMPO, saveEdit, selectElement, setEditStatus, syncLinkValue } from './fields';
import {
  agregarElemento,
  moverElemento,
  quitarElemento,
  repintarLista,
  syncListValue,
} from './list-editor';
import { confirmar, hayConfirmacionAbierta } from './confirm';
import { mostrarArchivoElegido, registrarArrastre } from './dropzone';
import { abrirPublicacion, exportNoticeMarkup, loadPublishJobs, publicar } from './publish';
import { ADMIN_AUDIT_PAGE, adminState, loadAdmin, loadRevisions, renderAdmin } from './admin';
import {
  GALLERY_PAGE_SIZE,
  galleryFilter,
  filterGalleryAlbums,
  filterGalleryCategories,
  loadGallery,
  loadGalleryAlbums,
  loadGalleryCategories,
  loadGalleryItemsList,
  resetGalleryAlbumSearch,
  resetGalleryCategorySearch,
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

function menuBarra() {
  return shell.querySelector('#hm-cms-bar-menu');
}

function menuBarraAbierto() {
  return menuBarra()?.hidden === false;
}

/** Abre, cierra o alterna el menú «Más» de la barra. */
function alternarMenuBarra(abrir = !menuBarraAbierto()) {
  const menu = menuBarra();
  const boton = shell.querySelector('[data-action="bar-menu"]');
  if (!menu || !boton) return;
  menu.hidden = !abrir;
  boton.setAttribute('aria-expanded', String(abrir));
  if (abrir) menu.querySelector('button:not([hidden])')?.focus();
}

/**
 * Un formulario que se autoguarda acaba de cambiar: estado sucio (el punto de
 * la barra y el aviso al cerrar), copia local y, en el editor de un campo, el
 * rótulo junto a «Guardar».
 */
function markDirty(form) {
  if (!form?.matches?.('[data-edit], [data-entry-form], [data-gallery-item-form]')) return;
  setFormDirty(true);
  scheduleDraftSave(form);
  if (form.matches('[data-edit]')) setEditStatus(form, 'dirty', ESTADOS_DE_CAMPO.sucio);
}
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
      // Un enlace con un solo campo dentro (un botón, una entrada del menú) se
      // resalta entero como editable: pulsar su relleno, fuera del texto,
      // navegaba a otra página en vez de abrir el editor.
      const editable =
        target instanceof Element
          ? (target.closest('[data-cms-entry]') ??
            target.closest('[data-cms-editable-host]')?.querySelector('[data-cms-entry]') ??
            null)
          : null;
      const action =
        target instanceof Element ? target.closest('[data-action]')?.dataset.action : null;

      // Menú «Más» de la barra: se abre con su botón y se cierra al elegir
      // una opción o al pulsar en cualquier otro sitio.
      if (action === 'bar-menu') {
        event.preventDefault();
        alternarMenuBarra();
        return;
      }
      if (
        menuBarraAbierto() &&
        !(target instanceof Element && target.closest('.hm-cms-bar-more [data-action="bar-menu"]'))
      ) {
        alternarMenuBarra(false);
      }
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
      if (action === 'undo') {
        event.preventDefault();
        await deshacer();
        return;
      }
      if (action === 'close') closePanel();
      if (action === 'logout') {
        await api('/api/cms/logout', { method: 'POST' }).catch(() => {});
        window.localStorage.removeItem('hidromont:cms');
        window.location.reload();
      }
      if (action === 'toggle-edit-guides') {
        event.preventDefault();
        const visible = !document.body.classList.contains('hm-cms-guides-visible');
        document.body.classList.toggle('hm-cms-guides-visible', visible);
        shell.querySelectorAll('[data-action="toggle-edit-guides"]').forEach((button) => {
          button.setAttribute('aria-pressed', String(visible));
        });
        return;
      }
      if (action === 'export') {
        // B-1: sin try/catch, un fallo aquí (el cerrojo de PublishService, la
        // guarda anti-encogimiento de galería) moría como promesa rechazada
        // sin manejar: el panel no cambiaba y el editor creía haber exportado.
        const btn = target instanceof Element ? target.closest('button') : null;
        const status =
          btn?.closest('section, form')?.querySelector('[data-status]') ||
          panelBody.querySelector('[data-status]');
        setButtonLoading(btn, true, 'Preparando…');
        try {
          const result = await api('/api/cms/export', { method: 'POST' });
          const aviso = exportNoticeMarkup(result.exported);
          if (aviso) panelBody.insertAdjacentHTML('afterbegin', aviso);
          const conOmisiones =
            (result.exported?.skipped || []).length > 0 ||
            (result.exported?.revertedToFallback || []).length > 0;
          if (status && !conOmisiones)
            status.textContent =
              'Archivos preparados. El sitio todavía no muestra estos cambios: para eso, usa «Publicar cambios».';
          if (status && conOmisiones)
            status.textContent =
              'Archivos preparados con omisiones. Revisa los avisos antes de publicar.';
          setGlobalState(conOmisiones ? 'exported-warning' : 'exported');
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
        if (form) {
          applyDraft(form);
          setEditStatus(form, 'dirty', 'Recuperaste lo que habías escrito. Falta guardarlo.');
        }
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
      if (action === 'edit-page-entry' && target instanceof Element) {
        const boton = target.closest('[data-page-entry]');
        if (boton?.dataset.entryId) showEntryForm(boton.dataset.entryId, boton.dataset.kind);
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
        try {
          const r = await api(`/api/cms/gallery/categories/${encodeURIComponent(catId)}`, {
            method: 'DELETE',
          });
          setGlobalState('unsaved');
          // El aviso sale DESPUÉS del repintado. Antes aparecía mientras la
          // lista aún se estaba recargando: quien tabulaba hasta él perdía el
          // foco cuando el panel se repintaba debajo.
          await loadGalleryCategories();
          ofrecerDeshacer(r.undo, () => loadGalleryCategories());
        } catch (error) {
          // M-3: el servidor rechaza con 409 si la categoría tiene fotos, y
          // dice cuántas. Antes la confirmación no mencionaba ninguna
          // consecuencia y las fotos quedaban sin categoría en silencio.
          if (
            error.status === 409 &&
            (await confirmar({
              titulo: '¿Eliminar la categoría de todos modos?',
              mensaje: error.message,
              aceptar: 'Eliminar igualmente',
              peligro: true,
            }))
          ) {
            try {
              const forzado = await api(
                `/api/cms/gallery/categories/${encodeURIComponent(catId)}?confirm=1`,
                { method: 'DELETE' }
              );
              setGlobalState('unsaved');
              await loadGalleryCategories();
              ofrecerDeshacer(forzado.undo, () => loadGalleryCategories());
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
        // Solo se borran álbumes vacíos (lo valida el servidor), así que el
        // riesgo era ya mínimo; con deshacer, la confirmación sobra.
        try {
          const r = await api(`/api/cms/gallery/albums/${encodeURIComponent(albumSlug)}`, {
            method: 'DELETE',
          });
          setGlobalState('unsaved');
          await loadGalleryAlbums();
          ofrecerDeshacer(r.undo, () => loadGalleryAlbums());
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
        // Sin confirmación: el deshacer devuelve la foto entera —posición,
        // categoría, álbum, destacado— así que preguntar antes solo añadía un
        // paso a la operación correcta para protegerse de la equivocada.
        try {
          const r = await api(`/api/cms/gallery/items/${encodeURIComponent(itemId)}`, {
            method: 'DELETE',
          });
          setGlobalState('unsaved');
          await loadGalleryItemsList();
          ofrecerDeshacer(r.undo, () => loadGalleryItemsList());
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
              (preview.closest('[data-gallery-preview-box]') || preview).hidden = false;
            }
            renderMediaPicker();
            markDirty(form);
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
        // Se mantiene la confirmación porque aquí el deshacer NO es íntegro: el
        // historial de revisiones se pierde con la entrada y no vuelve. El
        // texto anterior decía «no se puede deshacer», que ya es falso.
        const confirmed = await confirmar({
          titulo: `¿Eliminar «${title}»?`,
          mensaje:
            'Podrás deshacerlo durante unos segundos, pero su historial de revisiones no se recupera.',
          aceptar: 'Eliminar',
          peligro: true,
        });
        if (!confirmed) return;
        try {
          const r = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`, {
            method: 'DELETE',
          });
          setGlobalState('unsaved');
          await loadCollections(activeCollectionKind);
          ofrecerDeshacer(r.undo, () => loadCollections(activeCollectionKind));
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
        agregarElemento(target.closest('[data-list-editor]'));
        markDirty(target.closest('form'));
        return;
      }
      if (action === 'move-list-item' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const boton = target.closest('[data-action="move-list-item"]');
        if (boton && moverElemento(boton)) markDirty(boton.closest('form'));
        return;
      }
      if (action === 'remove-list-item' && target instanceof Element) {
        event.preventDefault();
        event.stopPropagation();
        const boton = target.closest('[data-action="remove-list-item"]');
        const form = boton?.closest('form');
        if (boton) quitarElemento(boton);
        markDirty(form);
        return;
      }
      if (action === 'revisions' && target instanceof Element) {
        const origen = target.closest('[data-entry-id]');
        const entryId = origen?.dataset.entryId;
        if (entryId) loadRevisions(entryId, origen.dataset.entryTitle || '');
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

        const confirmed = await confirmar({
          titulo: `¿Volver a la versión ${version}?`,
          mensaje:
            'Los textos actuales se reemplazarán por los de esa versión. La versión actual queda en el historial por si quieres recuperarla.',
          aceptar: 'Restaurar',
        });
        if (!confirmed) return;

        setButtonLoading(btn, true, 'Restaurando...');
        try {
          await api(
            `/api/cms/revisions/${encodeURIComponent(entryId)}/restore/${encodeURIComponent(revisionId)}`,
            {
              method: 'POST',
            }
          );
          setGlobalState('unsaved');
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
        // Primero el resumen de lo que va a salir; se publica al confirmar.
        abrirPublicacion();
      }
      if (action === 'encuadre-centrar') {
        event.preventDefault();
        state.encuadre?.centrar();
        return;
      }
      if (action === 'confirm-publish') {
        event.preventDefault();
        publicar();
        return;
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
        const vaciar = await confirmar({
          titulo: '¿Vaciar este texto?',
          mensaje:
            'Dejará de aparecer en el sitio. No se aplica hasta que pulses «Guardar», y luego podrás recuperarlo desde «Revisiones».',
          aceptar: 'Vaciar',
          peligro: true,
        });
        if (!vaciar) return;
        const campo = form.elements.value;
        if (campo) {
          campo.value = '';
          campo.focus();
          setFormDirty(true);
          setEditStatus(form, 'dirty', ESTADOS_DE_CAMPO.sucio);
          previsualizarTexto('');
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
            <span class="hm-cms-hint hm-cms-block">Lo que está guardado ahora:</span>
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
        if (asset) {
          applyMediaSelection(asset);
          // Elegir otra foto es un cambio sin guardar, como escribir: sin esto
          // el panel decía «Todo guardado» y cerrar no avisaba.
          markDirty(panelBody.querySelector('form[data-edit]'));
        }
        return;
      }

      if (editable && !panel.contains(editable)) {
        event.preventDefault();
        event.stopPropagation();
        // El mismo elemento que ya se está editando: no se recarga (se
        // perdería lo escrito), solo se vuelve al campo.
        if (editando(editable) && panel.classList.contains('open')) {
          panelBody.querySelector('form[data-edit] [name="value"]:not([type="hidden"])')?.focus();
          return;
        }
        // Con la página visible detrás del panel se puede pulsar otro campo
        // en cualquier momento: si hay algo sin guardar, se pregunta antes.
        if (
          isFormDirty &&
          !(await confirmar({
            titulo: 'Tienes cambios sin guardar',
            mensaje:
              'Si pasas a otro elemento, quedará una copia local que podrás recuperar al volver a este.',
            aceptar: 'Cambiar de elemento',
            cancelar: 'Seguir editando',
          }))
        ) {
          return;
        }
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
            setEditStatus(
              form,
              'error',
              `<span class="hm-cms-error" role="alert">No se pudo guardar: ${escapeHtml(error.message)}</span>`,
              { html: true }
            );
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
            setGlobalState('unsaved');
            resetGalleryCategorySearch();
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
            setGlobalState('unsaved');
            resetGalleryAlbumSearch();
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
              setGlobalState('unsaved');
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
            setGlobalState('unsaved');
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

    if (target instanceof HTMLInputElement && target.matches('[data-gallery-category-search]')) {
      filterGalleryCategories(target.value);
      return;
    }

    if (target instanceof HTMLInputElement && target.matches('[data-gallery-album-search]')) {
      filterGalleryAlbums(target.value);
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

  registrarArrastre();

  // Elegir un archivo en el editor de un campo de imagen: se muestra qué foto
  // quedó elegida y se ve en la vista previa antes de guardar.
  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'file') return;
    mostrarArchivoElegido(target);
    const form = target.form;
    const file = target.files?.[0];
    if (!file || !form?.matches('[data-edit]')) return;
    markDirty(form);
    const local = URL.createObjectURL(file);
    const preview = form.querySelector('[data-image-preview]');
    if (preview) preview.src = local;
    previsualizarImagen(local);
    // Una foto nueva todavía no está en la biblioteca, pero se puede encuadrar:
    // el encuadre se le aplica en cuanto se sube, al guardar.
    state.encuadre?.habilitar(true);
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
        (preview.closest('[data-gallery-preview-box]') || preview).hidden = false;
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
      markDirty(target.form);
      if (target.matches('[data-richtext-input]')) {
        refrescarPrevisualizacion(target.closest('[data-richtext]'));
      }
    }

    if (target.name === 'value' && target.form?.matches('[data-edit]')) {
      const tipo = state.selected?.dataset.cmsType || 'text';
      if (tipo === 'image') schedulePreviewUpdate(target.value);
      // El texto se ve en la página mientras se escribe. El Markdown no: en
      // crudo no es una vista previa, es ruido.
      else if (tipo === 'text' || tipo === 'textarea') previsualizarTexto(target.value);
    }
    // Título de la ficha: el nombre en la lista sigue al campo que usa el sitio.
    if (target.matches('[data-sync-title]') && target.form?.elements.title) {
      const titulo = target.form.elements.title;
      titulo.value = target.value.trim() || titulo.dataset.anterior || '';
    }
    if (target.name === 'alt' && target.form?.matches('[data-edit]')) {
      const preview = panelBody.querySelector('[data-image-preview]');
      if (preview) preview.setAttribute('alt', target.value);
    }

    // Los controles de un editor de lista se vuelcan en su hidden a cada tecla.
    if (target.matches('[data-list-item], [data-group-key]')) {
      syncListValue(target);
    }
    // Y al revés: si algo escribe el hidden desde fuera (recuperar un borrador),
    // la lista se repinta desde él. Sin esto la copia entraba en el hidden pero
    // la pantalla seguía mostrando lo anterior, y la siguiente tecla la pisaba.
    if (target instanceof HTMLInputElement && target.matches('[data-field-type="list"]')) {
      repintarLista(target.closest('[data-list-editor]'));
    }

    // Sync link fields to hidden input
    if ((target.name === 'link-label' || target.name === 'link-href') && target.form) {
      syncLinkValue(target.form);
    }
  });

  // Ctrl+B/I/K dentro del editor de texto con formato. Solo consume la
  // pulsación si había un editor enfocado; si no, sigue siendo del navegador.
  // Cmd/Ctrl+S guarda el formulario abierto, como en cualquier editor. Se
  // consume siempre que el panel está abierto: el «Guardar página» del
  // navegador no tiene sentido aquí y descargaba el HTML.
  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 's') {
      return;
    }
    if (!panel.classList.contains('open') || hayConfirmacionAbierta()) return;
    event.preventDefault();
    const form = panelBody.querySelector(
      'form[data-edit], form[data-entry-form], form[data-gallery-item-form], form[data-gallery-cat-form], form[data-gallery-album-form]'
    );
    form?.requestSubmit();
  });

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
    // abierto es suyo, no del panel. Lo mismo una confirmación en pantalla.
    if (shell.querySelector('.hm-cms-mobile-sheet.open')) return;
    if (hayConfirmacionAbierta()) return;
    if (menuBarraAbierto()) {
      alternarMenuBarra(false);
      shell.querySelector('[data-action="bar-menu"]')?.focus();
      return;
    }
    closePanel();
  });
}
