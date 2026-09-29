/**
 * Publicación de verdad, de punta a punta (O-02, auditoría 2026-09-28).
 *
 * El resto de la batería publica con un comando simulado: el sandbox de los
 * e2e fija `CMS_PUBLISH_CHECK_COMMAND=false` y las pruebas de `cms/test/` no
 * compilan. Ninguna comprobaba que «Publicar» exporte, compile los dos perfiles,
 * los sustituya y que el servidor sirva el cambio a cada dominio. Esta sí.
 *
 * Trabaja sobre una copia de los archivos versionados en un directorio temporal
 * —publicar compila en la raíz de la instalación, y aquí no debe tocar el
 * `dist/` del repositorio— y arranca `server.mjs` allí, como en el VPS.
 *
 * Tarda uno o dos minutos: va aparte (`npm run test:publicar`) y la CI la
 * ejecuta en el job de e2e.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '../..');
const PUERTO = 18_000 + Math.floor(Math.random() * 2_000);
const BASE = `http://127.0.0.1:${PUERTO}`;
const EMAIL = 'publicar-real@test.local';
const CLAVE = 'Prueba-Publicar-Real-2026';
const MARCA = `Publicado de verdad ${Date.now()}`;

let raiz: string;
let servidor: ChildProcess | undefined;
let salida = '';

async function esperarSalud(ms: number): Promise<void> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    try {
      if ((await fetch(`${BASE}/api/cms/health`)).ok) return;
    } catch {
      // Todavía arrancando.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El servidor no arrancó:\n${salida.slice(-3000)}`);
}

/** Una petición con cabecera Host propia (fetch no deja cambiarla). */
async function conHost(host: string, ruta: string): Promise<{ status: number; body: string }> {
  const http = await import('node:http');
  return new Promise((resolver, rechazar) => {
    const req = http.request(
      { host: '127.0.0.1', port: PUERTO, path: ruta, headers: { host } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolver({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on('error', rechazar);
    req.end();
  });
}

beforeAll(async () => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-publicar-real-'));
  // Los archivos versionados, tal cual; node_modules enlazado.
  const archivos = execFileSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  for (const relativo of archivos) {
    const origen = path.join(REPO, relativo);
    if (!fs.existsSync(origen)) continue;
    const destino = path.join(raiz, relativo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origen, destino);
  }
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(raiz, 'node_modules'), 'dir');

  // Una base nueva no conoce las fotos del gallery.json versionado y la guarda
  // del export se negaría a publicar: como en el sandbox de los e2e, la copia
  // arranca con la galería vacía.
  const galeria = path.join(raiz, 'src', 'data', 'gallery.json');
  fs.writeFileSync(
    galeria,
    JSON.stringify({ ...JSON.parse(fs.readFileSync(galeria, 'utf8')), items: [] }, null, 2) + '\n'
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    CMS_HOST: '127.0.0.1',
    CMS_PORT: String(PUERTO),
    CMS_COOKIE_SECURE: '0',
    CMS_ADMIN_EMAIL: EMAIL,
    CMS_ADMIN_PASSWORD: CLAVE,
    CMS_DATABASE_PATH: path.join(raiz, 'cms', 'data', 'hidromont-cms.sqlite'),
    CMS_UPLOAD_DIR: path.join(raiz, 'uploads', 'cms'),
    CMS_CONTENT_ROOT_DIR: raiz,
    CMS_STATIC_DIR: 'dist',
    PUBLIC_ENABLE_CMS: '1',
    // Sin `astro check`: aquí se prueba la publicación, no los tipos.
    CMS_PUBLISH_CHECK_COMMAND: 'npm run build:log:ligero',
  };
  delete env.VITEST;
  delete env.VITEST_POOL_ID;
  delete env.VITEST_WORKER_ID;

  servidor = spawn(process.execPath, ['server.mjs'], { cwd: raiz, env });
  servidor.stdout?.on('data', (b) => (salida += b));
  servidor.stderr?.on('data', (b) => (salida += b));
  await esperarSalud(60_000);
}, 180_000);

afterAll(() => {
  servidor?.kill('SIGTERM');
  if (raiz) fs.rmSync(raiz, { recursive: true, force: true });
});

describe('Publicar de verdad', () => {
  it('editar → publicar → cada dominio sirve su perfil con el cambio', async () => {
    const login = await fetch(`${BASE}/api/cms/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: CLAVE }),
    });
    expect(login.status).toBe(200);
    const { csrfToken } = (await login.json()) as { csrfToken: string };
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const H = { cookie, 'x-csrf-token': csrfToken, 'content-type': 'application/json' };

    const entrada = (await (
      await fetch(`${BASE}/api/cms/entries/home.hero`, { headers: { cookie } })
    ).json()) as { version: number };
    const guardar = await fetch(`${BASE}/api/cms/entries/home.hero/fields/subtitle`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ value: MARCA, expectedVersion: entrada.version }),
    });
    expect(guardar.status).toBe(200);

    const publicar = await fetch(`${BASE}/api/cms/publish`, {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrfToken },
    });
    const resultado = (await publicar.json()) as { job?: { status: string }; error?: string };
    expect(publicar.status, JSON.stringify(resultado).slice(0, 2000)).toBe(200);
    expect(resultado.job?.status).toBe('succeeded');

    // Los dos perfiles se sustituyeron y llevan el cambio.
    const publico = fs.readFileSync(path.join(raiz, 'dist', 'index.html'), 'utf8');
    const editor = fs.readFileSync(path.join(raiz, 'dist-editor', 'index.html'), 'utf8');
    expect(publico).toContain(MARCA);
    expect(editor).toContain(MARCA);
    expect(publico).not.toMatch(/\sdata-cms-/);
    expect(editor).toContain('data-cms-entry');
    expect(fs.existsSync(path.join(raiz, 'dist.nuevo'))).toBe(false);
    expect(fs.existsSync(path.join(raiz, '.build.lock'))).toBe(false);

    // Y el servidor sirve a cada dominio el suyo, sin reiniciar.
    const enPublico = await conHost('hidromontchile.cl', '/');
    expect(enPublico.status).toBe(200);
    expect(enPublico.body).toContain(MARCA);
    expect(enPublico.body).not.toContain('data-cms-entry');
    expect((await conHost('hidromontchile.cl', '/api/cms/health')).status).toBe(404);

    const enEditor = await conHost('editor.hidromontchile.cl', '/');
    expect(enEditor.body).toContain(MARCA);
    expect(enEditor.body).toContain('data-cms-entry');
    expect((await conHost('editor.hidromontchile.cl', '/api/cms/health')).status).toBe(200);

    // Ya no queda nada pendiente de publicar.
    const pendientes = (await (
      await fetch(`${BASE}/api/cms/publish/pending`, { headers: { cookie } })
    ).json()) as { total: number };
    expect(pendientes.total).toBe(0);
  }, 600_000);
});
