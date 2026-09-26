// @ts-check
/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

/** @param {unknown} value @returns {unknown[]} */
export function asList(value) {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value ? [value] : [];
}

// JS-8: several callers pass API fields straight through (item.id, item.alt,
// cat.name, etc.) without knowing whether the API actually returned a
// string — a null/number field made this throw and abort the whole panel
// render with no visible error. Coerce first so it never does.
/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    /** @type {Record<string, string>} */
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[char];
  });
}

/** @param {string | number | Date | null | undefined} value */
export function formatDate(value) {
  if (!value) return '';
  try {
    // P2-26: «25-09-26, 8:03 p. m.» no dejaba claro el día ni el año; «25 sept
    // 2026, 20:03» no se presta a confusión.
    return new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
