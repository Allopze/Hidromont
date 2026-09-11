/**
 * Los guardas de arranque de `cms/server.ts` deciden si el CMS se niega a
 * levantarse en una configuración insegura. Se prueban lanzando el proceso de
 * verdad porque terminan en `process.exit(1)`: importar el módulo mataría a
 * vitest.
 *
 * El caso que motiva el archivo: bajo Passenger —el modo «Node.js App» de
 * cPanel— `CMS_HOST` y `CMS_PORT` no se usan, porque Passenger engancha el
 * primer `http.Server` que llama a `listen()` y lo pone en un socket suyo. Así
 * que `CMS_HOST` se quedaba en `127.0.0.1`, el servidor se creía local y el
 * guarda de la contraseña por defecto no se aplicaba... en el único escenario
 * donde de verdad importaba, con el CMS publicado en el dominio.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const CONTRASENA_POR_DEFECTO = 'Hidromont-Admin-ChangeMe';

/**
 * Cada caso usa su propia base en un temporal. Antes apuntaban a la de
 * desarrollo, así que el resultado dependía de qué cuentas tuviera: el guarda
 * que rechaza una contraseña por defecto *almacenada* hizo fallar el caso
 * feliz en cuanto se añadió, porque la base real tiene una.
 */
const temporales: string[] = [];
function baseTemporal(conCuentaPorDefecto = false): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-guards-'));
  temporales.push(dir);
  const ruta = path.join(dir, 'cms.sqlite');
  const db = new Database(ruta);
  migrate(db);
  if (conCuentaPorDefecto) {
    const ahora = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      nanoid(),
      'admin@hidromont.local',
      // Coste 4: aquí solo importa que el hash valide, no que sea lento.
      bcrypt.hashSync(CONTRASENA_POR_DEFECTO, 4),
      ahora,
      ahora
    );
  }
  db.close();
  return ruta;
}

afterEach(() => {
  for (const dir of temporales.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Arranca el servidor con un entorno controlado y devuelve cómo terminó.
 *
 * El puerto se manda a uno libre para que un arranque con éxito no choque con
 * un CMS de desarrollo abierto. Los guardas corren en el nivel superior del
 * módulo, antes de cualquier trabajo asíncrono, así que un proceso que sigue
 * vivo pasado el plazo ya los superó: medido, el servidor imprime su primer
 * «listening» a los 458 ms, de modo que 2,5 s son de sobra.
 */
function arrancar(entorno: Record<string, string>, plazoMs = 2_500) {
  const res = spawnSync(process.execPath, ['server.mjs'], {
    cwd: RAIZ,
    encoding: 'utf8',
    timeout: plazoMs,
    env: {
      ...process.env,
      CMS_PORT: '8917',
      CMS_DATABASE_PATH: baseTemporal(),
      NODE_ENV: '',
      CMS_HOST: '127.0.0.1',
      CMS_COOKIE_SECURE: '',
      CMS_ALLOW_INSECURE_COOKIE: '',
      _PASSENGER_NODE_CONTROL_SERVER: '',
      ...entorno,
    },
  });
  return {
    code: res.status,
    // Los guardas escriben en stderr; el log de fastify va a stdout.
    salida: `${res.stderr ?? ''}${res.stdout ?? ''}`,
    // spawnSync marca el timeout con signal SIGTERM: el proceso seguía vivo.
    siguioVivo: res.signal !== null,
  };
}

describe('guardas de arranque del servidor', () => {
  it('se niega a arrancar en producción con la contraseña por defecto', () => {
    // Este guarda no depende de detectar Passenger ni de adivinar la
    // exposición: la contraseña por defecto está en el repositorio, así que en
    // producción no hay configuración que la haga aceptable.
    const r = arrancar({
      NODE_ENV: 'production',
      CMS_ADMIN_PASSWORD: CONTRASENA_POR_DEFECTO,
      CMS_COOKIE_SECURE: '1',
    });
    expect(r.code).toBe(1);
    expect(r.salida).toMatch(/NODE_ENV=production con la contraseña de administrador por defecto/);
  });

  it('bajo Passenger no se cree local, aunque CMS_HOST sea 127.0.0.1', () => {
    const r = arrancar({
      _PASSENGER_NODE_CONTROL_SERVER: '1',
      CMS_HOST: '127.0.0.1',
      CMS_ADMIN_PASSWORD: CONTRASENA_POR_DEFECTO,
      CMS_COOKIE_SECURE: '1',
    });
    expect(r.code).toBe(1);
    expect(r.salida).toMatch(/Detectado Passenger/);
    expect(r.salida).toMatch(/expuesto a la red con la contraseña por defecto/);
  });

  it('bajo Passenger exige cookie segura, que en loopback se toleraba', () => {
    const r = arrancar({
      _PASSENGER_NODE_CONTROL_SERVER: '1',
      CMS_HOST: '127.0.0.1',
      CMS_ADMIN_PASSWORD: 'una-contrasena-larga-y-propia',
      CMS_COOKIE_SECURE: '0',
    });
    expect(r.code).toBe(1);
    expect(r.salida).toMatch(/CMS_COOKIE_SECURE=0/);
  });

  it('se niega a arrancar si una cuenta de la base tiene la contraseña por defecto', () => {
    // El guarda de más arriba mira el .env, y eso dejaba fuera el caso que de
    // verdad ocurrió: una base traída de desarrollo con `admin@hidromont.local`
    // intacto. El .env puede estar impecable y aun así haber una credencial
    // pública dentro de la base.
    const r = arrancar({
      NODE_ENV: 'production',
      CMS_ADMIN_PASSWORD: 'una-contrasena-larga-y-propia',
      CMS_COOKIE_SECURE: '1',
      CMS_DATABASE_PATH: baseTemporal(true),
    });
    expect(r.code).toBe(1);
    expect(r.salida).toMatch(/cuenta\(s\) con la contraseña por defecto en la base/);
    expect(r.salida).toMatch(/admin@hidromont\.local/);
  });

  it('arranca en producción con contraseña propia y cookie segura', () => {
    const r = arrancar({
      NODE_ENV: 'production',
      CMS_ADMIN_PASSWORD: 'una-contrasena-larga-y-propia',
      CMS_COOKIE_SECURE: '1',
    });
    // Sigue vivo hasta que lo corta el timeout: ningún guarda lo rechazó.
    expect(r.siguioVivo).toBe(true);
    expect(r.salida).not.toMatch(/\[CMS\] ERROR/);
  }, 15_000);

  it('sigue arrancando en local con la contraseña por defecto, pero avisando', () => {
    // Un clon nuevo tiene que poder hacer `npm run cms` antes de correr
    // cms:reset-password, así que aquí el aviso no puede convertirse en error.
    const r = arrancar({ CMS_ADMIN_PASSWORD: CONTRASENA_POR_DEFECTO });
    expect(r.siguioVivo).toBe(true);
    expect(r.salida).toMatch(/ADVERTENCIA: el CMS arrancó con la contraseña de administrador/);
  }, 15_000);
});
