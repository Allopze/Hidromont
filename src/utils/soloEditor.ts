/**
 * Atributos de algo que solo debe ver quien edita: las casillas «+ Agregar
 * imagen» de una galería incompleta, o la sección de galería vacía.
 *
 * `cmsEditingEnabled` no basta para decidirlo. En el VPS el sitio público y el
 * editor son el mismo build, compilado con PUBLIC_ENABLE_CMS=1 —el editor es
 * un overlay sobre el propio sitio—, así que lo que se pintaba «si el CMS está
 * activo» lo veían también los visitantes: en sep-2026 /servicios/compuertas
 * enseñaba tres casillas vacías en hidromontchile.cl.
 *
 * Se pinta oculto (`hidden`) y el overlay lo muestra al montarse (shell.js).
 */
export function soloEditor(soloParaQuienEdita: boolean): Record<string, string | boolean> {
  return soloParaQuienEdita ? { hidden: true, 'data-cms-solo-editor': '' } : {};
}
