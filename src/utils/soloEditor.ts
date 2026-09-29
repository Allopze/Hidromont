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

/** ¿Este build lleva el editor? (el perfil `dist-editor/` o `astro dev`). */
const CMS_EN_ESTE_BUILD = import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_CMS === '1';

/**
 * Un atributo que solo usa el overlay (`data-cms-fondo`, `data-cms-tarjeta-enlace`…).
 *
 * B-05 (auditoría 2026-09-28): se pintaban también en el build público, 47
 * atributos en 21 páginas, y el build-gate no los veía. No revelaban nada, pero
 * `dist/` debe salir sin marcas del CMS. En el perfil público no se emiten.
 */
export function marcaDelEditor(
  nombre: `data-cms-${string}`,
  valor: string | boolean = true
): Record<string, string | boolean> {
  return CMS_EN_ESTE_BUILD ? { [nombre]: valor } : {};
}
