/**
 * El cuerpo de las fichas se compila con el procesador de `astro.config.mjs`,
 * y ese procesador debe quitar el HTML crudo (P2-02) y normalizar DN y Ø
 * (P3-09).
 *
 * Astro 7 dejó obsoleto `markdown.rehypePlugins` y los plugins pasaron a
 * `markdown.processor: unified({…})`. Si alguien vuelve a la forma antigua, o
 * una actualización cambia cómo se leen, el sitio seguiría compilando y
 * publicaría el `<script>` de una ficha sin ningún aviso. Esta prueba renderiza
 * con el procesador de la configuración real, no con una copia.
 */
import { describe, expect, it } from 'vitest';
import config from '../../astro.config.mjs';

async function renderizar(markdown: string): Promise<string> {
  const procesador = config.markdown?.processor as
    | {
        createRenderer(
          shared: Record<string, unknown>
        ): Promise<{ render(md: string): Promise<{ code: string }> }>;
      }
    | undefined;
  expect(procesador, 'astro.config.mjs debe declarar markdown.processor').toBeDefined();
  const renderer = await procesador!.createRenderer({});
  return (await renderer.render(markdown)).code;
}

describe('procesador Markdown del sitio', () => {
  it('no publica HTML crudo, manejadores ni enlaces javascript:', async () => {
    const html = await renderizar(
      'Texto **negrita** <script>alert(1)</script> <img src=x onerror=alert(2)> <iframe src="https://x.test"></iframe> [mal](javascript:alert(3))'
    );
    expect(html).toContain('<strong>negrita</strong>');
    expect(html).not.toMatch(/<script|onerror|<iframe|javascript:/i);
  });

  it('conserva los enlaces normales y normaliza los diámetros', async () => {
    const html = await renderizar('Ver [proyectos](/proyectos/) · DN 1200 y Ø1200 mm');
    expect(html).toContain('<a href="/proyectos/">proyectos</a>');
    expect(html).toContain('DN 1.200');
    expect(html).toContain('Ø 1.200');
  });
});
