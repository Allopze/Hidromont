/**
 * La CSP no debe romper el sitio que protege.
 *
 * Se encontró en auditoría que la política declarada no traía `connect-src`,
 * así que todo `fetch` caía en `default-src 'self'` y el envío del formulario
 * de contacto quedaba bloqueado: el visitante rellenaba, pulsaba enviar y
 * recibía «Ocurrió un error al enviar el formulario». Es el único canal de
 * contacto del sitio, y el fallo era invisible salvo intentando enviar.
 *
 * `form-action` no cubría el caso: gobierna el submit nativo del formulario,
 * no la petición que hace el JavaScript.
 *
 * Estas pruebas van contra el servidor Node (el que sirve el sitio en
 * producción), no contra el dev server de Astro, porque el dev server no
 * aplica ninguna cabecera de seguridad.
 */
import { test, expect } from '@playwright/test';

const SITE = process.env.CMS_URL ?? 'http://localhost:8787';

/** Mensajes que el navegador emite al bloquear algo por CSP. */
function watchCspViolations(page: import('@playwright/test').Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (connect|load|execute)/i.test(text)) {
      violations.push(text);
    }
  });
  return violations;
}

test.describe('CSP del sitio servido por Node', () => {
  test('la home declara una política y no bloquea nada suyo', async ({ page }) => {
    const violations = watchCspViolations(page);
    const response = await page.goto(`${SITE}/`);

    const csp = response?.headers()['content-security-policy'];
    expect(csp, 'el HTML público debe llevar CSP').toBeTruthy();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('connect-src');

    await page.waitForTimeout(1000);
    expect(violations).toEqual([]);

    // El detector de JS es un script inline: si la CSP no lo cubre, se
    // bloquea en silencio y el sitio pierde sus animaciones de entrada.
    expect(await page.evaluate(() => document.documentElement.classList.contains('js'))).toBe(true);
  });

  test('el formulario de contacto puede enviarse', async ({ page }) => {
    const violations = watchCspViolations(page);
    // No se envía nada real: se intercepta la llamada al servicio externo.
    await page.route('**/formsubmit.co/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' })
    );

    await page.goto(`${SITE}/contacto`);
    await page.fill('#nombre', 'Prueba automatizada');
    await page.fill('#email', 'prueba@ejemplo.cl');
    await page.fill('#mensaje', 'Mensaje de prueba del conjunto e2e.');
    await page.click('#contacto-submit');

    await expect(page.locator('#contacto-success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#contacto-error')).toBeHidden();
    expect(violations).toEqual([]);
  });

  test('las redirecciones de _redirects siguen vivas fuera de Cloudflare', async ({ request }) => {
    // `public/_redirects` es una convención de Cloudflare Pages: al servir
    // desde Node no hace nada por sí sola y las URLs antiguas darían 404.
    const response = await request.get(`${SITE}/proyectos/ch-dorias`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toContain('/proyectos/ch-doiras');
  });

  test('los assets con hash se sirven como inmutables', async ({ request }) => {
    const home = await (await request.get(`${SITE}/`)).text();
    const asset = home.match(/\/_assets\/[^"']+\.(?:css|js)/)?.[0];
    expect(asset, 'la home debe referenciar algún asset con hash').toBeTruthy();

    const response = await request.get(`${SITE}${asset}`);
    expect(response.headers()['cache-control']).toContain('immutable');
  });
});
