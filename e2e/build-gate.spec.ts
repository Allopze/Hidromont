/**
 * Build gate — el build producido debe ser coherente con su perfil y no
 * filtrar nada que no deba.
 *
 * Antes este archivo afirmaba una sola cosa: que `dist/` nunca contuviera el
 * editor del CMS. Eso valía cuando el sitio se desplegaba en Cloudflare Pages
 * y el CMS corría solo en local. Con el CMS y el sitio en el mismo proceso
 * Node (cPanel), el overlay TIENE que ir en el build: la barra del CMS *es*
 * el overlay, y sin él no hay interfaz de administración en el servidor.
 *
 * Así que la comprobación cambia de forma, no de intención. Se detecta el
 * perfil del build y se exige lo que corresponde a cada uno:
 *   - Perfil público (PUBLIC_ENABLE_CMS distinto de 1): el overlay no debe
 *     aparecer por ningún lado. Es la protección original, intacta.
 *   - Perfil con CMS: el overlay puede estar, pero debe seguir inerte sin
 *     sesión y no puede arrastrar credenciales ni rutas del servidor.
 * Y hay comprobaciones que aplican a los dos perfiles.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const DIST_DIR = process.env.BUILD_DIST ?? join(process.cwd(), 'dist');

function listHtmlFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listHtmlFiles(full, acc);
    } else if (entry.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

const htmlFiles = () => listHtmlFiles(DIST_DIR);
const readAll = () => htmlFiles().map((file) => ({ file, content: readFileSync(file, 'utf8') }));

/**
 * El editor dejó de ir incrustado en el HTML y pasó a ser un módulo que Astro
 * empaqueta, así que mirar solo las páginas ya no basta: el perfil público
 * llegó a emitir el fragmento del editor —sin que ninguna página lo enlazara,
 * pero descargable por URL— y este guarda seguía en verde.
 */
function listJsFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listJsFiles(full, acc);
    else if (entry.endsWith('.js')) acc.push(full);
  }
  return acc;
}

const readAllJs = () =>
  listJsFiles(DIST_DIR).map((file) => ({ file, content: readFileSync(file, 'utf8') }));

/** El build lleva el overlay si aparece su bootstrap. */
function cmsProfile(): boolean {
  return readAll().some(({ content }) => content.includes('__HIDROMONT_CMS__'));
}

test.describe('Build gate — cualquier perfil', () => {
  test('dist/ existe y contiene páginas HTML', () => {
    expect(htmlFiles().length, 'se esperaba al menos una página en dist/').toBeGreaterThan(0);
  });

  test('no hay credenciales ni rutas del servidor en el HTML', () => {
    // Vale para los dos perfiles: `define:vars` inyecta valores del entorno en
    // un script inline, así que una variable mal nombrada podría acabar aquí.
    const prohibido = [
      /CMS_ADMIN_PASSWORD/,
      /CMS_DATABASE_PATH/,
      /SENTRY_DSN\s*[:=]\s*['"]https/,
      // Rutas absolutas de la máquina de compilación.
      /\/Users\/[a-z]+\//i,
      /\/home\/[a-z0-9_-]+\/(?!.*hidromont\.cl)/i,
    ];
    const fugas: string[] = [];
    for (const { file, content } of readAll()) {
      for (const patron of prohibido) {
        if (patron.test(content)) fugas.push(`${file} — ${patron}`);
      }
    }
    expect(fugas).toEqual([]);
  });

  test('el contenido exportado llega al HTML compilado', () => {
    // Canario del circuito export → build. Si se rompe, el sitio se compila
    // pero deja de reflejar lo que el CMS escribió, que es justo el fallo
    // que nadie detectaba porque el build seguía siendo correcto.
    const cms = JSON.parse(readFileSync(join(process.cwd(), 'src/data/cms-content.json'), 'utf8'));
    const titulo = cms.entries?.['home.hero']?.fields?.title?.value;
    expect(typeof titulo, 'home.hero.title debe existir en el export').toBe('string');

    const index = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
    expect(index).toContain(String(titulo));
  });
});

test.describe('Build gate — perfil público (sin CMS)', () => {
  test.skip(() => cmsProfile(), 'el build lleva el overlay: se aplica el perfil con CMS');

  test('ningún atributo data-cms-entry', () => {
    const conMarcas = readAll()
      .filter(({ content }) => content.includes('data-cms-entry'))
      .map(({ file }) => file);
    expect(conMarcas).toEqual([]);
  });

  test('ningún marcador __HIDROMONT_CMS__', () => {
    const conMarcas = readAll()
      .filter(({ content }) => content.includes('__HIDROMONT_CMS__'))
      .map(({ file }) => file);
    expect(conMarcas).toEqual([]);
  });

  test('ninguna clase hm-cms-*', () => {
    const conMarcas = readAll()
      .filter(({ content }) => /hm-cms-/.test(content))
      .map(({ file }) => file);
    expect(conMarcas).toEqual([]);
  });

  test('el editor tampoco viaja en el JavaScript empaquetado', () => {
    // Un chunk huérfano sigue siendo descargable: revela la superficie de la
    // API de administración a quien mire `dist/_assets/`. La guarda de verdad
    // está en `overlay/index.ts`, que deja el `import()` inalcanzable para que
    // Rollup no emita el fragmento; esto comprueba que sigue funcionando.
    const conMarcas = readAllJs()
      .filter(({ content }) => /hm-cms-|__HIDROMONT_CMS__|data-richtext/.test(content))
      .map(({ file }) => file);
    expect(conMarcas).toEqual([]);
  });
});

test.describe('Build gate — perfil con CMS (sitio y editor en el mismo proceso)', () => {
  test.skip(() => !cmsProfile(), 'el build no lleva el overlay: se aplica el perfil público');

  test('el overlay sigue detrás de su interruptor', () => {
    // El overlay no debe activarse por el mero hecho de estar presente: en
    // producción exige el host `editor.*`; `?cms=1` solo vale en desarrollo.
    // Sin sesión, el host editor solo muestra el login.
    //
    // La comprobación cambia de sitio, no de intención: el interruptor ya no
    // está en el HTML —donde iba cuando el editor se incrustaba entero en cada
    // página— sino en el módulo que Astro empaqueta.
    const js = readAllJs().map(({ content }) => content);
    const conInterruptor = js.filter(
      (c) => c.includes('hidromont:cms') && c.includes('get("cms")')
    );
    expect(conInterruptor.length, 'ningún módulo comprueba ?cms=1').toBeGreaterThan(0);
  });

  test('el editor no se incrusta en el HTML de cada página', () => {
    // Lo que motivó separarlo: con el editor inline, las 27 páginas sumaban
    // 5,5 MB de HTML que todo visitante descargaba para no usarlo nunca.
    const index = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
    expect(index).not.toContain('hm-cms-rt-bar');
    expect(index.length, 'index.html volvió a llevar el editor dentro').toBeLessThan(150_000);
  });

  test('la CSP declarada cubre los scripts inline de este build', () => {
    // Con el overlay presente aparecen scripts inline nuevos. Si la CSP no
    // los cubre, un navegador CSP3 los bloquea en silencio y el CMS deja de
    // funcionar en producción sin ningún error visible.
    // Al servir desde Node los hashes se calculan solos; esto cubre el caso
    // de que el build se despliegue detrás de Cloudflare o Apache.
    const headers = join(DIST_DIR, '_headers');
    test.skip(!existsSync(headers), 'este despliegue no usa _headers');

    const declarados = [...readFileSync(headers, 'utf8').matchAll(/'sha256-([^']+)'/g)].map(
      (m) => m[1]
    );
    const index = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
    const inline = [...index.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter((m) => !/type=["']?application\/(ld\+)?json/i.test(m[1] ?? ''))
      .map((m) => m[2]);

    const sinCubrir = inline
      .map((c) => createHash('sha256').update(c).digest('base64'))
      .filter((h) => !declarados.includes(h));
    expect(sinCubrir).toEqual([]);
  });
});
