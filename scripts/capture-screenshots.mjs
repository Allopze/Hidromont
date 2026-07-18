/**
 * Script para capturar screenshots de página completa de todas las rutas del sitio.
 * Ejecución: node scripts/capture-screenshots.mjs
 */
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');

const PORT = 43210;
const BASE_URL = `http://localhost:${PORT}`;

// Tipos MIME básicos para nuestro servidor HTTP temporal
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Función para obtener todos los archivos HTML recursivamente
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

// Inicia un servidor HTTP local para servir el directorio dist/
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // Decodifica la URL para manejar espacios y caracteres especiales
      const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(DIST_DIR, decodedUrl);

      // Si es un directorio, intenta servir index.html
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });

    server.listen(PORT, () => {
      console.log(`📡 Servidor temporal local corriendo en ${BASE_URL}`);
      resolve(server);
    });
  });
}

async function main() {
  console.log('🚀 Iniciando script de captura de screenshots...');

  // 1. Ejecutar npm run build para compilar el sitio con las últimas modificaciones
  console.log('📦 Ejecutando compilación del proyecto (npm run build)...');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    console.log('✅ Compilación completada con éxito.');
  } catch (error) {
    console.error('❌ Error durante la compilación del proyecto:', error.message);
    process.exit(1);
  }

  // 2. Escanear el directorio dist/ para encontrar todas las rutas
  console.log('🔍 Escaneando páginas en la carpeta dist/...');
  const htmlFiles = getHtmlFiles(DIST_DIR);
  if (htmlFiles.length === 0) {
    console.error('❌ No se encontraron páginas compiladas en dist/.');
    process.exit(1);
  }

  // Mapear archivos HTML a rutas relativas
  const routes = htmlFiles.map((file) => {
    const relative = path.relative(DIST_DIR, file);
    let route = '/' + relative.replace(/\\/g, '/');
    if (route.endsWith('/index.html')) {
      route = route.slice(0, -11);
    } else if (route.endsWith('.html')) {
      route = route.slice(0, -5);
    }
    return route === '' ? '/' : route;
  });

  // Eliminar duplicados si los hubiera
  const uniqueRoutes = [...new Set(routes)].sort();
  console.log(`📌 Encontradas ${uniqueRoutes.length} rutas para capturar:`);
  uniqueRoutes.forEach(r => console.log(`  - ${r}`));

  // Crear la carpeta screenshots si no existe
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    console.log(`📁 Carpeta creada: ${SCREENSHOTS_DIR}`);
  }

  // 3. Iniciar el servidor local
  const server = await startServer();

  // 4. Levantar Playwright
  console.log('🌐 Iniciando navegador Playwright (Chromium)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Calidad retina/alta densidad
    reducedMotion: 'reduce', // Simula prefers-reduced-motion: reduce para saltar animaciones y mostrar todo al instante
  });
  const page = await context.newPage();

  // 5. Procesar cada ruta
  for (let i = 0; i < uniqueRoutes.length; i++) {
    const route = uniqueRoutes[i];
    const url = `${BASE_URL}${route}`;
    
    // Generar nombre de archivo amigable
    let filename = route.replace(/^\//, '').replace(/\//g, '-');
    if (filename === '') {
      filename = 'index';
    }
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${filename}.png`);

    console.log(`📸 [${i + 1}/${uniqueRoutes.length}] Capturando ${route} -> ${filename}.png...`);

    try {
      // Navegar a la ruta
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Hacer scroll hasta el final para gatillar imágenes perezosas (lazy-loaded)
      // Usamos una detección de scroll más robusta basada en la posición actual
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let lastScrollTop = -1;
          const scrollContainer = document.documentElement || document.body;
          const distance = 150;
          const timer = setInterval(() => {
            const currentScrollTop = window.scrollY || scrollContainer.scrollTop;
            window.scrollBy(0, distance);
            
            // Si el scroll no cambia (llegamos al final real de la página)
            if (currentScrollTop === lastScrollTop) {
              clearInterval(timer);
              resolve();
            }
            lastScrollTop = currentScrollTop;
          }, 40);
        });
      });

      // Esperar a que se carguen todas las imágenes (incluyendo las lazy-loaded gatilladas) con un timeout de seguridad de 3s
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll('img'));
        const promises = images.map((img) => {
          if (img.complete) return;
          return new Promise((resolve) => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', resolve);
          });
        });
        
        // Promesa de timeout de seguridad de 3 segundos
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
        
        await Promise.race([
          Promise.all(promises),
          timeoutPromise
        ]);
      });

      // Esperar a que la red se calme después del scroll si se dispararon nuevas peticiones
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch (e) {
        // Ignorar si hay sockets o analytics manteniéndola ocupada
      }

      // Scroll de regreso al inicio antes de capturar
      await page.evaluate(() => window.scrollTo(0, 0));
      
      // Delay de asentamiento para transiciones de layouts y render final
      await page.waitForTimeout(1000);

      // Captura de página completa
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      console.log(`   ✅ Captura guardada con éxito.`);
    } catch (err) {
      console.error(`   ❌ Error capturando ruta ${route}:`, err.message);
    }
  }

  // 6. Limpieza y cierre
  console.log('🧹 Cerrando recursos...');
  await browser.close();
  server.close(() => {
    console.log('📡 Servidor temporal local detenido.');
    console.log(`🎉 ¡Proceso finalizado! Todas las capturas están guardadas en: ${SCREENSHOTS_DIR}`);
  });
}

main().catch((err) => {
  console.error('❌ Error crítico en el proceso principal:', err);
  process.exit(1);
});
