import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Cabeceras de seguridad para el sitio público servido por este proceso.
 *
 * Hasta ahora las ponía `public/_headers`, que es una convención exclusiva de
 * Cloudflare Pages: al servir desde Node en cPanel ese archivo no hace nada y
 * el sitio se quedaba sin CSP ni Permissions-Policy. `public/.htaccess` cubre
 * parte, pero solo si Apache sirve los archivos y tampoco trae CSP.
 *
 * Los hashes de los scripts inline se calculan leyendo el build, no se
 * escriben a mano. El motivo es concreto: los dos hashes declarados en
 * `_headers` no correspondían a ningún script del build actual, y como CSP
 * nivel 3 ignora `'unsafe-inline'` en cuanto hay un hash-source, los dos
 * scripts inline del sitio estaban bloqueados en producción sin que nada lo
 * delatara. Calcularlos aquí hace imposible esa deriva.
 */

/** Un `<script>` sin `src` cuyo tipo sí se ejecuta. */
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
/** `application/json` y `application/ld+json` nunca se ejecutan: no aplica script-src. */
const NON_EXECUTABLE_TYPE = /type=["']?application\/(ld\+)?json/i;

function listHtmlFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listHtmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

/** Hashes sha256 (en base64) de todos los scripts inline ejecutables del build. */
export function collectInlineScriptHashes(distDir: string): string[] {
  const hashes = new Set<string>();
  for (const file of listHtmlFiles(distDir)) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(INLINE_SCRIPT)) {
      if (NON_EXECUTABLE_TYPE.test(match[1] ?? '')) continue;
      hashes.add(crypto.createHash('sha256').update(match[2]).digest('base64'));
    }
  }
  return [...hashes].sort();
}

export function buildContentSecurityPolicy(hashes: string[]): string {
  const scriptSrc = ["'self'", ...hashes.map((h) => `'sha256-${h}'`)].join(' ');
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    // Astro emite estilos inline por componente; sin 'unsafe-inline' el sitio
    // se queda sin la mitad de su CSS. No hay hash estable que sirva aquí.
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    // Sin `connect-src` explícito, todo fetch cae en `default-src 'self'` y el
    // envío del formulario de contacto queda bloqueado: el visitante rellena,
    // pulsa enviar y recibe «Ocurrió un error». Reproducido en auditoría.
    // `form-action` no cubre esto: gobierna el submit nativo, no el fetch.
    "connect-src 'self' https://formsubmit.co https://api.web3forms.com",
    'frame-src https://maps.google.com https://www.google.com',
    "form-action 'self' https://formsubmit.co https://api.web3forms.com",
    'upgrade-insecure-requests',
  ].join('; ');
}

let cached: { distDir: string; csp: string } | undefined;

/**
 * CSP del sitio público. Se cachea porque recorrer el build en cada petición
 * sería absurdo; `refreshPublicSecurityHeaders()` la invalida tras publicar,
 * que es el único momento en que el HTML cambia.
 */
export function publicContentSecurityPolicy(distDir: string): string {
  if (cached?.distDir !== distDir) {
    cached = { distDir, csp: buildContentSecurityPolicy(collectInlineScriptHashes(distDir)) };
  }
  return cached.csp;
}

export function refreshPublicSecurityHeaders(): void {
  cached = undefined;
}
