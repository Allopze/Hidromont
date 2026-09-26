// @ts-check
/**
 * Zona para subir una imagen: clic o arrastrar y soltar.
 *
 * Sustituye al `<input type="file">` sin estilo, que el navegador rotulaba en
 * su propio idioma («Choose File · No file chosen») y que no decía qué formatos
 * admite. El input sigue existiendo —con su `name` y sus `data-*`, que es lo que
 * leen los formularios— pero oculto a la vista: el rótulo es la superficie.
 */

import { escapeHtml } from './html';
import { icon } from './icons';
import { state } from './context';

let secuencia = 0;

/** Megas enteros para el texto de ayuda. */
const mb = (/** @type {number} */ bytes) => Math.round(bytes / 1024 / 1024);

/**
 * Qué acepta cada zona según lo que se sube, y cómo se le dice a quien edita.
 * P3-04 (auditoría 2026-09): el tope iba escrito a mano («hasta 8 MB») y podía
 * desmentir al servidor; ahora sale de `state.limites`, que publica el CMS.
 * @type {Record<'imagen'|'video'|'icono', { maxBytes: () => number, accept: string, ayuda: () => string, arrastra: string }>}
 */
const TIPOS = {
  imagen: {
    maxBytes: () => state.limites.fotoBytes,
    accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
    ayuda: () => `JPG, PNG, WebP o SVG · hasta ${mb(state.limites.fotoBytes)} MB`,
    arrastra: 'o arrástrala aquí',
  },
  video: {
    maxBytes: () => state.limites.videoBytes,
    accept: 'video/mp4,video/webm',
    ayuda: () =>
      `MP4 o WebM · hasta ${mb(state.limites.videoBytes)} MB · sin sonido, se reproduce en bucle`,
    arrastra: 'o arrástralo aquí',
  },
  icono: {
    maxBytes: () => state.limites.fotoBytes,
    accept: 'image/svg+xml,image/png,image/webp',
    ayuda: () => 'SVG o PNG de un solo color, con fondo transparente',
    arrastra: 'o arrástralo aquí',
  },
};

/**
 * @param {{ name?: string, atributos?: string, texto?: string, tipo?: 'imagen'|'video'|'icono' }} [opciones]
 *   `atributos` se añade tal cual al input, para los `data-*` de cada formulario.
 */
export function dropzoneMarkup({
  name = 'file',
  atributos = '',
  texto = 'Subir una imagen',
  tipo = 'imagen',
} = {}) {
  const id = `hm-cms-drop-${++secuencia}`;
  const t = TIPOS[tipo] ?? TIPOS.imagen;
  return `
    <div class="hm-cms-drop" data-dropzone>
      <input id="${id}" class="hm-cms-drop-input" name="${escapeHtml(name)}" type="file"
        accept="${t.accept}" ${atributos} />
      <label for="${id}" class="hm-cms-drop-label">
        ${icon('upload', { size: 20 })}
        <span><strong>${escapeHtml(texto)}</strong> ${t.arrastra}</span>
        <span class="hm-cms-hint">${t.ayuda()}</span>
      </label>
      <p class="hm-cms-drop-file" data-drop-file hidden></p>
    </div>`;
}

/**
 * Muestra qué archivo quedó elegido. Lo llama el `change` delegado.
 * @param {HTMLInputElement} input
 */
export function mostrarArchivoElegido(input) {
  const zona = input.closest('[data-dropzone]');
  const rotulo = zona?.querySelector('[data-drop-file]');
  if (!(rotulo instanceof HTMLElement)) return;
  const archivo = input.files?.[0];
  rotulo.hidden = !archivo;
  rotulo.innerHTML = archivo
    ? `${icon('image')}<span><strong>${escapeHtml(archivo.name)}</strong> · se subirá al guardar</span>`
    : '';
  zona?.classList.toggle('has-file', Boolean(archivo));
}

/**
 * Arrastrar y soltar, delegado en `document` como el resto de eventos.
 * Se registra una vez desde `registerEvents`.
 */
export function registrarArrastre() {
  /** @param {Event} event */
  const zonaDe = (event) =>
    event.target instanceof Element ? event.target.closest('[data-dropzone]') : null;

  document.addEventListener('dragover', (event) => {
    const zona = zonaDe(event);
    if (!zona) return;
    event.preventDefault();
    zona.classList.add('is-over');
  });
  document.addEventListener('dragleave', (event) => {
    const zona = zonaDe(event);
    const destino = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (zona && !zona.contains(destino)) zona.classList.remove('is-over');
  });
  document.addEventListener('drop', (event) => {
    const zona = zonaDe(event);
    if (!zona) return;
    event.preventDefault();
    zona.classList.remove('is-over');
    const input = zona.querySelector('input[type="file"]');
    const archivos = event.dataTransfer?.files;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input || !archivos?.length) return;
    input.files = archivos;
    // Los formularios escuchan `change` para la vista previa y el estado sucio.
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * P2-19 (auditoría 2026-09): un archivo que no era una foto (un texto
 * renombrado a .jpg) rompía la vista previa, se anunciaba en verde como si
 * estuviera bien y al guardar solo decía «Error al procesar la solicitud»; uno
 * demasiado grande se subía entero antes de rechazarse. Se comprueba al
 * elegirlo o soltarlo: tipo, tamaño y, para fotos, que el navegador la abra.
 * Si no vale, se dice en palabras y el archivo no queda elegido.
 */
/** @param {HTMLInputElement} input */
export async function validarArchivo(input) {
  const archivo = input.files?.[0];
  if (!archivo) return true;
  const accept = input.getAttribute('accept') || '';
  const tipo = accept.includes('video/') ? 'video' : 'imagen';
  const t = TIPOS[tipo];
  let problema = '';
  const aceptados = accept.split(',').map((a) => a.trim());
  if (archivo.type && !aceptados.includes(archivo.type)) {
    problema =
      tipo === 'video'
        ? 'Este archivo no es un video MP4 o WebM.'
        : 'Este archivo no es una foto. Usa una foto JPG, PNG, WebP o un SVG.';
  } else if (archivo.size > t.maxBytes()) {
    problema = `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${mb(t.maxBytes())} MB.`;
  } else if (tipo === 'imagen' && archivo.type !== 'image/svg+xml') {
    const url = URL.createObjectURL(archivo);
    const abre = await new Promise((resolver) => {
      const img = new Image();
      img.onload = () => resolver(img.naturalWidth > 0);
      img.onerror = () => resolver(false);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    if (!abre)
      problema = 'Este archivo no es una foto que se pueda abrir. Usa una foto JPG, PNG o WebP.';
  }
  const zona = input.closest('[data-dropzone]');
  const rotulo = zona?.querySelector('[data-drop-file]');
  zona?.classList.toggle('has-error', Boolean(problema));
  if (!problema) return true;
  input.value = '';
  zona?.classList.remove('has-file');
  if (rotulo instanceof HTMLElement) {
    rotulo.hidden = false;
    rotulo.innerHTML = `${icon('alert')}<span role="alert">${escapeHtml(problema)}</span>`;
  }
  return false;
}
