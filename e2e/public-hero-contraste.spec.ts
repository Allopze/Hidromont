/**
 * P2-28 (auditoría 2026-09): en móvil, el antetítulo cian y parte del
 * subtítulo de la portada no llegaban a 4,5:1 sobre la foto.
 *
 * Se mide como en la auditoría: se oculta el texto, se fotografía la zona que
 * ocupa y se calcula, píxel a píxel, el contraste del color del texto contra
 * lo que queda detrás.
 */
import sharp from 'sharp';
import { test, expect, type Page } from '@playwright/test';

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (r: number, g: number, b: number) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

async function fraccionBajo45(page: Page, selector: string): Promise<number> {
  const el = page.locator(selector).first();
  const color = await el.evaluate((n) => getComputedStyle(n).color);
  const [r, g, b] = color.match(/\d+/g)!.map(Number);
  const lTexto = lum(r, g, b);
  const caja = (await el.boundingBox())!;
  await page.addStyleTag({ content: `${selector} { visibility: hidden !important; }` });
  const png = await page.screenshot({ clip: caja, animations: 'disabled' });
  await page.addStyleTag({ content: `${selector} { visibility: visible !important; }` });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let bajos = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const lFondo = lum(data[i], data[i + 1], data[i + 2]);
    const [claro, oscuro] = lTexto > lFondo ? [lTexto, lFondo] : [lFondo, lTexto];
    if ((claro + 0.05) / (oscuro + 0.05) < 4.5) bajos += 1;
  }
  return bajos / total;
}

for (const [ancho, alto] of [
  [390, 844],
  [1440, 900],
]) {
  test(`a ${ancho} px el texto de la portada llega a 4,5:1 sobre la foto`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('section h1').first().waitFor();
    await page.waitForLoadState('networkidle');
    const antetitulo = await fraccionBajo45(page, 'section [data-cms-field="eyebrow"]');
    const subtitulo = await fraccionBajo45(page, 'section [data-cms-field="subtitle"]');
    expect(antetitulo, 'antetítulo').toBeLessThan(0.01);
    expect(subtitulo, 'subtítulo').toBeLessThan(0.01);
  });
}
