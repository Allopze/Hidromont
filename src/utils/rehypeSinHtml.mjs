/**
 * P2-02 (auditoría 2026-09): el cuerpo de servicios y proyectos (Markdown que
 * edita el CMS) admitía HTML crudo que Astro publicaba tal cual. Un
 * `<script>` pegado en el cuerpo se ejecutaba en el sitio público, porque la
 * CSP calcula sus hashes leyendo el HTML final, contenido incluido.
 *
 * Este plugin de rehype quita del Markdown todo el HTML crudo (los nodos `raw`)
 * y, en lo que queda —que sale solo de la sintaxis Markdown—, los atributos
 * `on*` y los enlaces `javascript:`/`data:`/`vbscript:`. Ningún cuerpo del sitio
 * usa HTML, y el editor del CMS solo produce Markdown.
 */
const ESQUEMA_PELIGROSO = /^\s*(javascript|data|vbscript):/i;

function limpiar(nodo) {
  if (!nodo || !Array.isArray(nodo.children)) return;
  nodo.children = nodo.children.filter((hijo) => hijo.type !== 'raw');
  for (const hijo of nodo.children) {
    if (hijo.type === 'element' && hijo.properties) {
      for (const clave of Object.keys(hijo.properties)) {
        if (/^on/i.test(clave)) delete hijo.properties[clave];
      }
      for (const clave of ['href', 'src', 'xlinkHref', 'formAction', 'action']) {
        const valor = hijo.properties[clave];
        if (typeof valor === 'string' && ESQUEMA_PELIGROSO.test(valor)) {
          delete hijo.properties[clave];
        }
      }
    }
    limpiar(hijo);
  }
}

export default function rehypeSinHtml() {
  return (arbol) => limpiar(arbol);
}
