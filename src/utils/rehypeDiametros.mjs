/**
 * P3-09 (auditoría 2026-09): la ficha técnica de C.H. Doiras decía «DN 2.700»
 * y su texto «DN 2700»; el de Turbinas, «DN 1600». Las fichas, las tarjetas y
 * la tabla ya pasaban por `formatDiameters`; el cuerpo en Markdown no.
 *
 * Este plugin de rehype aplica esa misma función a los textos del cuerpo,
 * fuera de `code` y `pre`.
 */
import { formatDiameters } from './format.ts';

export function recorrer(nodo) {
  if (!nodo || !Array.isArray(nodo.children)) return;
  for (const hijo of nodo.children) {
    if (hijo.type === 'text') hijo.value = formatDiameters(hijo.value);
    else if (hijo.type === 'element' && (hijo.tagName === 'code' || hijo.tagName === 'pre'))
      continue;
    else recorrer(hijo);
  }
}

export default function rehypeDiametros() {
  return (arbol) => recorrer(arbol);
}
