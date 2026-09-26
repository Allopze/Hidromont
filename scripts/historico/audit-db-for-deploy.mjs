#!/usr/bin/env node
/**
 * Revisa la base antes de empaquetarla y escribe en la salida estándar lo que
 * impide desplegarla. Si todo está bien, no escribe nada.
 *
 * Vive aparte de `pack-deploy.mjs` porque necesita bcrypt y el módulo nativo
 * de SQLite, y el empaquetador se ejecuta también cuando no hay base que
 * revisar. Lo llama como proceso hijo y se queda con lo que diga.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requerir = createRequire(import.meta.url);
const base = path.join(raiz, 'cms', 'data', 'hidromont-cms.sqlite');
if (!fs.existsSync(base)) process.exit(0);

const Database = requerir('better-sqlite3');
const bcrypt = requerir('bcryptjs');
const db = new Database(base, { readonly: true });

const problemas = [];
const usuarios = db.prepare('SELECT email, password_hash FROM users').all();
for (const u of usuarios) {
  if (bcrypt.compareSync('Hidromont-Admin-ChangeMe', u.password_hash)) {
    problemas.push(`la cuenta ${u.email} conserva la contraseña por defecto, que es pública`);
  }
}
const sesiones = db.prepare('SELECT COUNT(*) n FROM sessions').get().n;
if (sesiones > 0) problemas.push(`hay ${sesiones} sesión(es) abierta(s) que viajarían al servidor`);

if (problemas.length) {
  process.stdout.write(
    `La base no está lista para producción:\n${problemas.map((p) => `    - ${p}`).join('\n')}`
  );
}
