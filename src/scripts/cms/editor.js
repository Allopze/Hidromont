import { escapeHtml } from './ui.js';

export function fieldEditor(element, entry, field) {
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
    const items = Array.isArray(current)
      ? current
      : typeof current === 'string' && current
        ? [current]
        : [];
    return `
      <div data-list-editor>
        <p class="hm-cms-muted" style="margin:0 0 8px">Items de la lista:</p>
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
        <input name="value" type="hidden" value="${escapeHtml(JSON.stringify(items))}" />
      </div>
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

export function syncListValue(form) {
  const items = Array.from(form.querySelectorAll('[data-list-item]')).map((input) => input.value);
  const hidden = form.querySelector('[name="value"]');
  if (hidden) hidden.value = JSON.stringify(items);
}

export function syncLinkValue(form) {
  const label = form.querySelector('[name="link-label"]')?.value || '';
  const href = form.querySelector('[name="link-href"]')?.value || '';
  const hidden = form.querySelector('[name="value"]');
  if (hidden) hidden.value = JSON.stringify({ label, href });
}

export function updateEditableText(element, newValue) {
  const children = Array.from(element.childNodes);
  const elementChildren = children.filter((node) => node.nodeType === Node.ELEMENT_NODE);

  if (elementChildren.length === 0) {
    element.textContent = newValue;
    return;
  }

  const textNodes = children.filter(
    (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim().length > 0
  );
  if (textNodes.length > 0) {
    textNodes[0].nodeValue = newValue;
  } else {
    element.insertBefore(document.createTextNode(newValue), elementChildren[0]);
  }
}
