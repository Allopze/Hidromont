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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');

const PORT = 8787;
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || 'Hidromont-Admin-ChangeMe';

// Directorios de salida
const DIRS = {
  desktopPublic: path.join(SCREENSHOTS_DIR, 'desktop', 'public'),
  desktopCms: path.join(SCREENSHOTS_DIR, 'desktop', 'cms'),
  mobilePublic: path.join(SCREENSHOTS_DIR, 'mobile', 'public'),
  mobileCms: path.join(SCREENSHOTS_DIR, 'mobile', 'cms'),
};

function ensureDirectories() {
  Object.values(DIRS).forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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

// Inicia el servidor del CMS en background (que además sirve dist/ estático)
function startCmsServer() {
  console.log('📡 Iniciando servidor backend CMS + estático en puerto', PORT, '...');
  const serverProcess = spawn('npx', ['tsx', 'cms/server.ts'], {
    cwd: ROOT,
    env: { ...process.env, PUBLIC_ENABLE_CMS: '1', CMS_PORT: String(PORT), CMS_HOST: '127.0.0.1' },
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
async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/cms/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) return true;
      }
    } catch {
      // Servidor aún no listo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El servidor CMS no respondió a tiempo en ${BASE_URL}/api/cms/health`);
}

// Ayudante de scroll suave para cargar imágenes perezosas (lazy loading)
async function triggerLazyLoading(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let lastScrollTop = -1;
      const scrollContainer = document.documentElement || document.body;
      const distance = 200;
      const timer = setInterval(() => {
        const currentScrollTop = window.scrollY || scrollContainer.scrollTop;
        window.scrollBy(0, distance);
        if (currentScrollTop === lastScrollTop) {
          clearInterval(timer);
          resolve();
        }
        lastScrollTop = currentScrollTop;
      }, 40);
    });
  });

  // Esperar a que se completen las imágenes
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll('img'));
    const promises = images.map((img) => {
      if (img.complete) return;
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
    await Promise.race([Promise.all(promises), timeoutPromise]);
  });

  // Reset scroll al inicio
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
}

async function main() {
  console.log('🚀 Iniciando script de captura de screenshots (Desktop 1920x1080 & Mobile 390x844)...');

  ensureDirectories();

  // 1. Compilación del proyecto con CMS Overlay habilitado
  console.log('📦 Compilando proyecto web (PUBLIC_ENABLE_CMS=1 npm run build)...');
  try {
    execSync('npm run build', {
      cwd: ROOT,
      env: { ...process.env, PUBLIC_ENABLE_CMS: '1' },
      stdio: 'inherit',
    });
    console.log('✅ Compilación completada con éxito.');
  } catch (error) {
    console.error('❌ Error durante la compilación:', error.message);
    process.exit(1);
  }

  // 2. Obtener rutas públicas
  const htmlFiles = getHtmlFiles(DIST_DIR);
  if (htmlFiles.length === 0) {
    console.error('❌ No se encontraron HTMLs en dist/.');
    process.exit(1);
  }

  const routes = htmlFiles
    .map((file) => {
      const relative = path.relative(DIST_DIR, file);
      let route = '/' + relative.replace(/\\/g, '/');
      if (route.endsWith('/index.html')) route = route.slice(0, -11);
      else if (route.endsWith('.html')) route = route.slice(0, -5);
      return route === '' ? '/' : route;
    })
    .filter((r, i, arr) => arr.indexOf(r) === i)
    .sort();

  console.log(`📌 Encontradas ${routes.length} rutas públicas:`, routes);

  // 3. Arrancar servidor backend CMS + estático
  const serverProcess = startCmsServer();

  try {
    await waitForServer();
    console.log('📡 Servidor CMS listo y respondiendo.');

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
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const url = `${BASE_URL}${route}`;
      let filename = route.replace(/^\//, '').replace(/\//g, '-');
      if (filename === '') filename = 'index';

      console.log(`[${i + 1}/${routes.length}] Ruta pública: ${route}`);

      // Desktop
      const pageDesktop = await desktopContext.newPage();
      try {
        await pageDesktop.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        await triggerLazyLoading(pageDesktop);
        const desktopFile = path.join(DIRS.desktopPublic, `${filename}.png`);
        await pageDesktop.screenshot({ path: desktopFile, fullPage: true });
        console.log(`   🖥️  Desktop -> screenshots/desktop/public/${filename}.png`);
      } catch (err) {
        console.error(`   ❌ Error desktop en ${route}:`, err.message);
      } finally {
        await pageDesktop.close();
      }

      // Mobile
      const pageMobile = await mobileContext.newPage();
      try {
        await pageMobile.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        await triggerLazyLoading(pageMobile);
        const mobileFile = path.join(DIRS.mobilePublic, `${filename}.png`);
        await pageMobile.screenshot({ path: mobileFile, fullPage: true });
        console.log(`   📱 Mobile  -> screenshots/mobile/public/${filename}.png`);
      } catch (err) {
        console.error(`   ❌ Error mobile en ${route}:`, err.message);
      } finally {
        await pageMobile.close();
      }
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
          await p.goto(`${BASE_URL}/?cms=1`, { waitUntil: 'networkidle' });
          await p.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
          await p.reload({ waitUntil: 'networkidle' });
          // Abrir modal de login si hay editable
          const editable = p.locator('[data-cms-entry]').first();
          if ((await editable.count()) > 0) {
            await editable.click({ force: true });
            await p.waitForTimeout(500);
          }
        }

        await pageD.screenshot({ path: path.join(DIRS.desktopCms, '01-cms-login.png'), fullPage: false });
        await pageM.screenshot({ path: path.join(DIRS.mobileCms, '01-cms-login.png'), fullPage: false });
        console.log('   ✅ 01-cms-login.png capturado (Desktop & Mobile).');
      } catch (err) {
        console.error('   ❌ Error en captura de login CMS:', err.message);
      } finally {
        await pageD.close();
        await pageM.close();
      }
    }

    // Login via API para obtener cookie de sesión en los contextos
    console.log('🔑 Realizando autenticación vía API en CMS...');
    const loginPage = await desktopContext.newPage();
    const loginRes = await loginPage.request.post(`${BASE_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!loginRes.ok()) {
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
        for (const p of [pageD, pageM]) {
          await p.goto(`${BASE_URL}/?cms=1`, { waitUntil: 'networkidle' });
          await p.waitForSelector('.hm-cms-bar', { timeout: 5000 });
          await p.waitForTimeout(500);
        }

        await pageD.screenshot({ path: path.join(DIRS.desktopCms, '02-cms-toolbar-home.png'), fullPage: false });
        await pageM.screenshot({ path: path.join(DIRS.mobileCms, '02-cms-toolbar-home.png'), fullPage: false });
        console.log('   ✅ 02-cms-toolbar-home.png capturado.');
      } catch (err) {
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
        for (const p of [pageD, pageM]) {
          await p.goto(`${BASE_URL}/?cms=1`, { waitUntil: 'networkidle' });
          const collectionsBtn = p.locator('[data-action="collections"]');
          if ((await collectionsBtn.count()) > 0) {
            await collectionsBtn.click();
            await p.waitForSelector('.hm-cms-panel.open', { timeout: 5000 });
            await p.waitForTimeout(600);
          }
        }

        await pageD.screenshot({ path: path.join(DIRS.desktopCms, '03-cms-collections-panel.png'), fullPage: false });
        await pageM.screenshot({ path: path.join(DIRS.mobileCms, '03-cms-collections-panel.png'), fullPage: false });
        console.log('   ✅ 03-cms-collections-panel.png capturado.');
      } catch (err) {
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
          await p.goto(`${BASE_URL}/servicios/tuberias-forzadas?cms=1`, { waitUntil: 'networkidle' });
          await triggerLazyLoading(p);
        }

        await pageD.screenshot({ path: path.join(DIRS.desktopCms, '04-cms-editable-page.png'), fullPage: true });
        await pageM.screenshot({ path: path.join(DIRS.mobileCms, '04-cms-editable-page.png'), fullPage: true });
        console.log('   ✅ 04-cms-editable-page.png capturado.');
      } catch (err) {
        console.error('   ❌ Error capturando vista editable del CMS:', err.message);
      } finally {
        await pageD.close();
        await pageM.close();
      }
    }

    // Cierre del navegador
    await browser.close();
    console.log('\n🎉 ¡Proceso completado exitosamente!');
    console.log('📁 Capturas organizadas en:');
    console.log('   - Desktop Público: screenshots/desktop/public/');
    console.log('   - Mobile Público:  screenshots/mobile/public/');
    console.log('   - Desktop CMS:     screenshots/desktop/cms/');
    console.log('   - Mobile CMS:      screenshots/mobile/cms/');
  } finally {
    // Matar proceso del servidor
    serverProcess.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('❌ Error crítico en el proceso de capturas:', err);
  process.exit(1);
});
