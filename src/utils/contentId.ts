/**
 * CMS-IMG-1 fix: Astro's glob content loader (src/content.config.ts uses
 * `loader: glob({ pattern: '**\/*.md', ... })`) returns a `.md`-suffixed
 * `entry.id` for the `proyectos` and `servicios` collections in this project
 * (e.g. `ch-los-condores.md` instead of `ch-los-condores`). Every lookup that
 * treats `.id` as a clean slug — project-images.ts, project-galleries.ts,
 * service-images.ts, service-galleries.ts, and the buildableProjectSlugs
 * comparison against gallery.json's projectSlug — silently misses, which is
 * why every "destacado" project page and every service page was rendering
 * with no hero image and no gallery despite both being configured. Strip the
 * suffix once, at every place `.id` is treated as a slug, instead of at the
 * loader level (avoids an `astro.config`/loader change rippling into the
 * markdown route path Astro itself already generates from the same id).
 */
export function entrySlug(id: string): string {
  return id.replace(/\.mdx?$/, '');
}
