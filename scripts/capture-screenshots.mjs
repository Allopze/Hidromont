/**
 * Script para capturar screenshots de página completa (Desktop 1920x1080 y Mobile 390x844)
 * tanto de la página pública como de la interfaz del CMS.
 *
 * Ejecución: npm run screenshots  (o node scripts/capture-screenshots.mjs)
 */
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import {
  classifyMedia,
  collectRoutesFromHtmlPaths,
  findPublicCmsMarkers,
  resolveCapturePorts,
  validateScreenshotInventory,
} from './capture-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CAPTURE_DIR = path.join(ROOT, '.capture');
const PUBLIC_DIST_DIR = path.join(CAPTURE_DIR, 'public');
const CMS_DIST_DIR = path.join(CAPTURE_DIR, 'cms');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');

const { publicPort: PUBLIC_PORT, cmsPort: CMS_PORT } = resolveCapturePorts(process.env);
const PUBLIC_BASE_URL = `http://127.0.0.1:${PUBLIC_PORT}`;
const CMS_BASE_URL = `http://127.0.0.1:${CMS_PORT}`;
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || 'Hidromont-Admin-ChangeMe';

// Con --no-clean se conservan las capturas previas (útil para comparar a mano).
const CLEAN_OUTPUT = !process.argv.includes('--no-clean');
// Ruta que no existe: sirve para capturar el 404 real del servidor.
const NOT_FOUND_URL = `${PUBLIC_BASE_URL}/__ruta-inexistente-para-captura-404`;

// Directorios de salida
const DIRS = {
  desktopPublic: path.join(SCREENSHOTS_DIR, 'desktop', 'public'),
  desktopCms: path.join(SCREENSHOTS_DIR, 'desktop', 'cms'),
  mobilePublic: path.join(SCREENSHOTS_DIR, 'mobile', 'public'),
  mobileCms: path.join(SCREENSHOTS_DIR, 'mobile', 'cms'),
};

function ensureDirectories() {
  Object.values(DIRS).forEach((dir) => {
    // Limpiamos antes de capturar. Sin esto quedan PNG de corridas anteriores
    // con nombres que el script ya no genera (los *.md.png del esquema viejo
    // sobrevivieron meses) y se mezclan con las capturas vigentes.
    if (CLEAN_OUTPUT && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  });
}

function getHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function getPngFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) getPngFiles(filePath, fileList);
    else if (file.endsWith('.png')) fileList.push(filePath);
  }
  return fileList;
}

/**
 * Astro compila cada página como `<ruta>/index.html`. Un .html suelto dentro de
 * dist/ viene de public/ y NO es una ruta servible sin extensión: pedirla
 * devuelve el 404 del sitio. Así entraba `/fotos/curacion-preview` (un HTML
 * viejo que quedó en public/) y se guardaba el 404 como si fuera una página.
 */
function collectRoutes(distDir) {
  return collectRoutesFromHtmlPaths(
    getHtmlFiles(distDir).map((file) => path.relative(distDir, file))
  );
}

// Inicia una instancia del servidor CMS apuntando a un build estático concreto.
function startCmsServer({ port, staticDir, cmsEnabled }) {
  console.log(`📡 Iniciando servidor en puerto ${port} para ${path.relative(ROOT, staticDir)}...`);
  const serverProcess = spawn(process.execPath, ['--import', 'tsx', 'cms/server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PUBLIC_ENABLE_CMS: cmsEnabled ? '1' : '0',
      CMS_PORT: String(port),
      CMS_HOST: '127.0.0.1',
      CMS_STATIC_DIR: staticDir,
    },
    stdio: 'pipe',
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('ERROR')) {
      console.error('  [CMS Server Error]:', msg);
    }
  });

  return serverProcess;
}

// Espera a que el servidor del CMS responda
async function waitForServer(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/cms/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) return true;
      }
    } catch {
      // Servidor aún no listo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El servidor CMS no respondió a tiempo en ${baseUrl}/api/cms/health`);
}

/**
 * Deja la página completamente pintada antes de capturar.
 *
 * En una captura fullPage queremos el estado final, no el perezoso, así que
 * primero forzamos `loading="eager"` en todo. Esto arregla dos defectos que se
 * veían en las capturas:
 *  - el mapa del footer (un <iframe loading="lazy"> a Google Maps) salía como
 *    caja vacía en todas las páginas largas, porque solo se esperaba a <img>;
 *  - en /galeria (201 fotos) el tope fijo de 3 s cortaba la espera y algún
 *    tile quedaba en blanco.
 */
async function settlePage(page, { mediaTimeoutMs = 20000 } = {}) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]')) {
      el.loading = 'eager';
    }
  });

  // Recorremos la página para disparar cualquier carga atada al scroll y
  // recalculamos la altura en cada paso porque el contenido crece al cargar.
  await page.evaluate(async () => {
    const step = Math.max(200, Math.round(window.innerHeight * 0.8));
    let position = 0;
    for (let guard = 0; guard < 5000; guard += 1) {
      const height = document.documentElement.scrollHeight;
      if (position >= height) break;
      window.scrollTo(0, position);
      position += step;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  await page.evaluate(async (timeoutMs) => {
    const images = Array.from(document.querySelectorAll('img[src], img[srcset]'));
    const decodeAll = Promise.allSettled(
      images.map(async (img) => {
        if (!img.complete) {
          await new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
        }
        if (img.naturalWidth > 0 && typeof img.decode === 'function') {
          await img.decode();
        }
      })
    );
    await Promise.race([decodeAll, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  }, mediaTimeoutMs);

  // networkidle aquí (y no en el goto) es lo que cubre el iframe del mapa:
  // recién arranca su tráfico cuando el footer entra en viewport.
  await page.waitForLoadState('networkidle', { timeout: mediaTimeoutMs }).catch(() => {
    console.warn('   ⚠️  La red no llegó a quedar ociosa; se captura igual.');
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  const media = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img[src], img[srcset]')).map((img) => ({
      src: img.currentSrc || img.src || '(sin src)',
      complete: img.complete,
      naturalWidth: img.naturalWidth,
    }))
  );
  const diagnosis = classifyMedia(media);
  if (diagnosis.broken.length > 0 || diagnosis.pending.length > 0) {
    throw new Error(
      `Medios incompletos: ${diagnosis.broken.length} rotos, ` +
        `${diagnosis.pending.length} pendientes. ` +
        [...diagnosis.broken, ...diagnosis.pending].slice(0, 5).join(', ')
    );
  }

  return diagnosis;
}

/**
 * Captura una URL y devuelve `true` si salió bien. Registra el fallo en
 * `failures` (antes los errores solo se imprimían y el script terminaba en 0,
 * así que en CI una corrida con todas las páginas rotas pasaba como exitosa).
 */
async function capturePage(
  context,
  { url, outFile, label, fullPage = true, expectStatus, assertPublic = false },
  failures
) {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response ? response.status() : 0;
    const statusOk = expectStatus ? status === expectStatus : status > 0 && status < 400;
    if (!statusOk) {
      failures.push(`${label} · ${url} respondió HTTP ${status}`);
      console.error(`   ❌ ${label} -> HTTP ${status}`);
      return false;
    }
    if (assertPublic) {
      const markers = findPublicCmsMarkers(await page.content());
      if (markers.length > 0) {
        throw new Error(`Build público contiene marcadores CMS: ${markers.join(', ')}`);
      }
    }
    await settlePage(page);
    await page.screenshot({ path: outFile, fullPage });
    console.log(`   ${label} -> ${path.relative(ROOT, outFile)}`);
    return true;
  } catch (err) {
    failures.push(`${label} · ${url} -> ${err.message}`);
    console.error(`   ❌ ${label}:`, err.message);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log(
    '🚀 Iniciando script de captura de screenshots (Desktop 1920x1080 & Mobile 390x844)...'
  );

  ensureDirectories();

  // 1. Validación única y builds aislados. Nunca se captura una página pública
  // desde el build que contiene el editor.
  console.log('🔎 Validando proyecto con astro check...');
  try {
    execSync('npm run check', { cwd: ROOT, stdio: 'inherit' });
    fs.rmSync(CAPTURE_DIR, { recursive: true, force: true });
    console.log('📦 Compilando build público (PUBLIC_ENABLE_CMS=0)...');
    execSync('npx astro build --outDir .capture/public', {
      cwd: ROOT,
      env: { ...process.env, PUBLIC_ENABLE_CMS: '0' },
      stdio: 'inherit',
    });
    console.log('📦 Compilando build CMS (PUBLIC_ENABLE_CMS=1)...');
    execSync('npx astro build --outDir .capture/cms', {
      cwd: ROOT,
      env: {
        ...process.env,
        PUBLIC_ENABLE_CMS: '1',
        PUBLIC_CMS_API_BASE: CMS_BASE_URL,
      },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('❌ Error durante la compilación:', error.message);
    process.exit(1);
  }

  // 2. Obtener rutas públicas
  const { routes, skipped } = collectRoutes(PUBLIC_DIST_DIR);
  if (routes.length === 0) {
    console.error('❌ No se encontraron rutas (<ruta>/index.html) en dist/.');
    process.exit(1);
  }

  // Fallos acumulados: deciden el código de salida al final.
  const failures = [];

  console.log(`📌 Encontradas ${routes.length} rutas públicas:`, routes);
  if (skipped.length > 0) {
    console.warn(
      `⚠️  ${skipped.length} .html sueltos en dist/ no son rutas servibles y se omiten ` +
        `(vienen de public/): ${skipped.join(', ')}`
    );
  }

  // 3. Servir ambos artefactos en procesos separados.
  const publicServerProcess = startCmsServer({
    port: PUBLIC_PORT,
    staticDir: PUBLIC_DIST_DIR,
    cmsEnabled: false,
  });
  const cmsServerProcess = startCmsServer({
    port: CMS_PORT,
    staticDir: CMS_DIST_DIR,
    cmsEnabled: true,
  });

  try {
    await Promise.all([waitForServer(PUBLIC_BASE_URL), waitForServer(CMS_BASE_URL)]);
    console.log('📡 Builds público y CMS listos.');

    // 4. Lanzar Playwright
    console.log('🌐 Iniciando navegador Chromium...');
    const browser = await chromium.launch({ headless: true });

    // Configuración de contextos
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce',
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });

    // ----------------------------------------------------
    // A. CAPTURAS DE PÁGINAS PÚBLICAS
    // ----------------------------------------------------
    console.log('\n📸 === CAPTURANDO PÁGINAS PÚBLICAS ===');
    const targets = routes.map((route) => {
      const slug = route.replace(/^\//, '').replace(/\//g, '-');
      return {
        url: `${PUBLIC_BASE_URL}${route}`,
        filename: slug === '' ? 'index' : slug,
        label: route,
      };
    });

    // El 404 se pide contra una URL inexistente para capturar lo que realmente
    // sirve el servidor, en vez de abrir dist/404.html como si fuera una página.
    targets.push({ url: NOT_FOUND_URL, filename: '404', label: '/404', expectStatus: 404 });

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      console.log(`[${i + 1}/${targets.length}] Ruta pública: ${target.label}`);

      await capturePage(
        desktopContext,
        {
          url: target.url,
          outFile: path.join(DIRS.desktopPublic, `${target.filename}.png`),
          label: '🖥️  Desktop',
          expectStatus: target.expectStatus,
          assertPublic: true,
        },
        failures
      );

      await capturePage(
        mobileContext,
        {
          url: target.url,
          outFile: path.join(DIRS.mobilePublic, `${target.filename}.png`),
          label: '📱 Mobile ',
          expectStatus: target.expectStatus,
          assertPublic: true,
        },
        failures
      );
    }

    // ----------------------------------------------------
    // B. CAPTURAS DEL CMS
    // ----------------------------------------------------
    console.log('\n📸 === CAPTURANDO INTERFAZ DEL CMS ===');

    // 1. Captura de pantalla de Login del CMS (sin sesión)
    {
      console.log('🔐 Capturando pantalla de Login del CMS (sin autenticar)...');
      const pageD = await desktopContext.newPage();
      const pageM = await mobileContext.newPage();

      try {
        // Abrir portada con ?cms=1 y localStorage
        for (const p of [pageD, pageM]) {
          await p.goto(`${CMS_BASE_URL}/?cms=1`, { waitUntil: 'domcontentloaded' });
          await p.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
          await p.reload({ waitUntil: 'domcontentloaded' });
          // Abrir modal de login si hay editable
          const editable = p.locator('[data-cms-entry]').first();
          if ((await editable.count()) > 0) {
            await editable.click({ force: true });
            await p.waitForTimeout(500);
          }
        }

        await pageD.screenshot({
          path: path.join(DIRS.desktopCms, '01-cms-login.png'),
          fullPage: false,
        });
        await pageM.screenshot({
          path: path.join(DIRS.mobileCms, '01-cms-login.png'),
          fullPage: false,
        });
        console.log('   ✅ 01-cms-login.png capturado (Desktop & Mobile).');
      } catch (err) {
        failures.push(`CMS 01-cms-login -> ${err.message}`);
        console.error('   ❌ Error en captura de login CMS:', err.message);
      } finally {
        await pageD.close();
        await pageM.close();
      }
    }

    // Login via API para obtener cookie de sesión en los contextos
    console.log('🔑 Realizando autenticación vía API en CMS...');
    const loginPage = await desktopContext.newPage();
    const loginRes = await loginPage.request.post(`${CMS_BASE_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!loginRes.ok()) {
      failures.push('Autenticación CMS vía API falló');
      console.error('❌ Falló la autenticación en el CMS vía API:', await loginRes.text());
    } else {
      console.log('✅ Autenticación exitosa.');
    }
    await loginPage.close();

    // Copiar cookies al contexto mobile
    const cookies = await desktopContext.cookies();
    await mobileContext.addCookies(cookies);

    // 2. Toolbar/Barra del CMS en la página principal
    {
      console.log('🛠️ Capturando Toolbar del CMS (autenticado)...');
      const pageD = await desktopContext.newPage();
      const pageM = await mobileContext.newPage();

      try {
        await pageD.goto(`${CMS_BASE_URL}/?cms=1`, { waitUntil: 'domcontentloaded' });
        await pageD.waitForSelector('.hm-cms-bar', { timeout: 5000 });

        await pageM.goto(`${CMS_BASE_URL}/?cms=1`, { waitUntil: 'domcontentloaded' });
        const mobileLauncher = pageM.getByRole('button', { name: 'Abrir menú CMS' });
        await mobileLauncher.waitFor({ state: 'visible', timeout: 5000 });
        await mobileLauncher.click();
        await pageM.getByRole('dialog', { name: 'Acciones del CMS' }).waitFor({ state: 'visible' });
        await Promise.all([pageD.waitForTimeout(500), pageM.waitForTimeout(500)]);

        await pageD.screenshot({
          path: path.join(DIRS.desktopCms, '02-cms-toolbar-home.png'),
          fullPage: false,
        });
        await pageM.screenshot({
          path: path.join(DIRS.mobileCms, '02-cms-toolbar-home.png'),
          fullPage: false,
        });
        console.log('   ✅ 02-cms-toolbar-home.png capturado.');
      } catch (err) {
        failures.push(`CMS 02-cms-toolbar-home -> ${err.message}`);
        console.error('   ❌ Error capturando toolbar CMS:', err.message);
      } finally {
        await pageD.close();
        await pageM.close();
      }
    }

    // 3. Panel de Colecciones / Contenidos del CMS
    {
      console.log('📁 Capturando Panel de Colecciones del CMS...');
      const pageD = await desktopContext.newPage();
      const pageM = await mobileContext.newPage();

      try {
        await pageD.goto(`${CMS_BASE_URL}/?cms=1`, { waitUntil: 'domcontentloaded' });
        await pageD.locator('.hm-cms-bar [data-action="collections"]').click();
        await pageD.waitForSelector('.hm-cms-panel.open', { timeout: 5000 });

        await pageM.goto(`${CMS_BASE_URL}/?cms=1`, { waitUntil: 'domcontentloaded' });
        await pageM.getByRole('button', { name: 'Abrir menú CMS' }).click();
        await pageM
          .getByRole('dialog', { name: 'Acciones del CMS' })
          .getByRole('button', { name: 'Colecciones' })
          .click();
        await pageM.waitForSelector('.hm-cms-panel.open', { timeout: 5000 });
        await Promise.all([pageD.waitForTimeout(600), pageM.waitForTimeout(600)]);

        await pageD.screenshot({
          path: path.join(DIRS.desktopCms, '03-cms-collections-panel.png'),
          fullPage: false,
        });
        await pageM.screenshot({
          path: path.join(DIRS.mobileCms, '03-cms-collections-panel.png'),
          fullPage: false,
        });
        console.log('   ✅ 03-cms-collections-panel.png capturado.');
      } catch (err) {
        failures.push(`CMS 03-cms-collections-panel -> ${err.message}`);
        console.error('   ❌ Error capturando panel colecciones CMS:', err.message);
      } finally {
        await pageD.close();
        await pageM.close();
      }
    }

    // 4. Modo de Edición / Elementos editables del CMS
    {
      console.log('✏️ Capturando vista de edición con elementos editables del CMS...');
      const pageD = await desktopContext.newPage();
      const pageM = await mobileContext.newPage();

      try {
        for (const p of [pageD, pageM]) {
          await p.goto(`${CMS_BASE_URL}/servicios/tuberias-forzadas?cms=1`, {
            waitUntil: 'domcontentloaded',
          });
          await settlePage(p);
        }

        await pageD.screenshot({
          path: path.join(DIRS.desktopCms, '04-cms-editable-page.png'),
          fullPage: false,
        });
        await pageM.screenshot({
          path: path.join(DIRS.mobileCms, '04-cms-editable-page.png'),
          fullPage: false,
        });
        console.log('   ✅ 04-cms-editable-page.png capturado.');
      } catch (err) {
        failures.push(`CMS 04-cms-editable-page -> ${err.message}`);
        console.error('   ❌ Error capturando vista editable del CMS:', err.message);
      } finally {
        await pageD.close();
        await pageM.close();
      }
    }

    // Cierre del navegador
    await browser.close();

    if (failures.length === 0) {
      try {
        const inventory = validateScreenshotInventory(
          getPngFiles(SCREENSHOTS_DIR).map((file) => path.relative(SCREENSHOTS_DIR, file))
        );
        console.log(
          `✅ Inventario: ${inventory.total} PNG ` +
            `(${inventory.desktop} desktop, ${inventory.mobile} mobile).`
        );
      } catch (error) {
        failures.push(error.message);
      }
    }

    if (failures.length > 0) {
      console.error(`\n❌ Terminó con ${failures.length} captura(s) fallida(s):`);
      failures.forEach((f) => console.error(`   · ${f}`));
      // Sin esto una corrida en la que fallan todas las páginas salía con 0 y CI
      // la daba por buena.
      process.exitCode = 1;
    } else {
      console.log('\n🎉 ¡Proceso completado exitosamente!');
    }

    console.log('📁 Capturas organizadas en:');
    console.log('   - Desktop Público: screenshots/desktop/public/');
    console.log('   - Mobile Público:  screenshots/mobile/public/');
    console.log('   - Desktop CMS:     screenshots/desktop/cms/');
    console.log('   - Mobile CMS:      screenshots/mobile/cms/');
  } finally {
    publicServerProcess.kill('SIGTERM');
    cmsServerProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('❌ Error crítico en el proceso de capturas:', err);
  process.exit(1);
});
