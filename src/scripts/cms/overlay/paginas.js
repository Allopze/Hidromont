// @ts-check
/**
 * P1-07 (auditoría 2026-09): en modo edición no había forma de cambiar de
 * página. El menú, las tarjetas y los botones son editables, así que pulsarlos
 * abre el editor en vez de navegar (a propósito: su relleno también se edita),
 * y la única salida era escribir la dirección a mano.
 *
 * «Ir a otra página» lista las páginas que enlazan la cabecera y el pie de la
 * propia página —las mismas que ve el visitante, sin mantener otra lista—
 * como enlaces normales, que el panel no intercepta.
 */
import { escapeHtml } from './html';
import { openPanel, setPanelTitle } from './panel';

/** Páginas internas enlazadas en la cabecera y el pie, sin repetir. */
export function paginasDelSitio(doc = document) {
  const vistas = new Map();
  for (const a of doc.querySelectorAll('header a[href], footer a[href]')) {
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const ruta = href.split('#')[0].replace(/\/+$/, '') || '/';
    if (vistas.has(ruta)) continue;
    const rotulo = (a.textContent || a.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rotulo) continue;
    vistas.set(ruta, rotulo);
  }
  return [...vistas].map(([ruta, rotulo]) => ({ ruta, rotulo }));
}

export function mostrarPaginas() {
  const actual = window.location.pathname.replace(/\/+$/, '') || '/';
  const filas = paginasDelSitio()
    .map(
      ({ ruta, rotulo }) => `
        <li>
          <a class="hm-cms-page-link" href="${escapeHtml(ruta)}"${ruta === actual ? ' aria-current="page"' : ''}>
            <span>${escapeHtml(rotulo)}</span>
            <span class="hm-cms-muted">${ruta === actual ? 'Estás aquí' : escapeHtml(ruta)}</span>
          </a>
        </li>`
    )
    .join('');
  setPanelTitle('Ir a otra página');
  openPanel(`
    <div class="hm-cms-view hm-cms-stack">
      <p class="hm-cms-muted">Abre la página que quieras editar. Lo que no hayas guardado se queda como borrador en este equipo.</p>
      <ul class="hm-cms-page-list">${filas}</ul>
    </div>
  `);
}
