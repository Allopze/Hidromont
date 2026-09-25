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

let secuencia = 0;

/** Qué acepta cada zona según lo que se sube, y cómo se le dice a quien edita. */
const TIPOS = {
  imagen: {
    accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
    ayuda: 'JPG, PNG, WebP o SVG · hasta 8 MB',
    arrastra: 'o arrástrala aquí',
  },
  video: {
    accept: 'video/mp4,video/webm',
    ayuda: 'MP4 o WebM · hasta 60 MB · sin sonido, se reproduce en bucle',
    arrastra: 'o arrástralo aquí',
  },
  icono: {
    accept: 'image/svg+xml,image/png,image/webp',
    ayuda: 'SVG o PNG de un solo color, con fondo transparente',
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
        <span class="hm-cms-hint">${t.ayuda}</span>
      </label>
      <p class="hm-cms-drop-file" data-drop-file hidden></p>
    </div>`;
}

/** Muestra qué archivo quedó elegido. Lo llama el `change` delegado. */
export function mostrarArchivoElegido(input) {
  const zona = input.closest('[data-dropzone]');
  const rotulo = zona?.querySelector('[data-drop-file]');
  if (!rotulo) return;
  const archivo = input.files?.[0];
  rotulo.hidden = !archivo;
  rotulo.innerHTML = archivo
    ? `${icon('image')}<span><strong>${escapeHtml(archivo.name)}</strong> · se subirá al guardar</span>`
    : '';
  zona.classList.toggle('has-file', Boolean(archivo));
}

/**
 * Arrastrar y soltar, delegado en `document` como el resto de eventos.
 * Se registra una vez desde `registerEvents`.
 */
export function registrarArrastre() {
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
    if (zona && !zona.contains(event.relatedTarget)) zona.classList.remove('is-over');
  });
  document.addEventListener('drop', (event) => {
    const zona = zonaDe(event);
    if (!zona) return;
    event.preventDefault();
    zona.classList.remove('is-over');
    const input = zona.querySelector('input[type="file"]');
    const archivos = event.dataTransfer?.files;
    if (!input || !archivos?.length) return;
    input.files = archivos;
    // Los formularios escuchan `change` para la vista previa y el estado sucio.
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
