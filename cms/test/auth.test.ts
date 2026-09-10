import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './setup';

describe('Auth API', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /api/cms/health', () => {
    it('returns ok without authentication', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/cms/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    });
  });

  describe('GET /api/cms/session — unauthenticated', () => {
    it('returns authenticated: false', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/cms/session' });
      expect(res.statusCode).toBe(200);
      expect(res.json().authenticated).toBe(false);
    });
  });

  describe('POST /api/cms/login', () => {
    it('returns 200 with csrfToken on valid credentials', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ctx.adminEmail, password: ctx.adminPassword }),
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ csrfToken: string; ok: boolean }>();
      expect(body.ok).toBe(true);
      expect(typeof body.csrfToken).toBe('string');
      expect(body.csrfToken.length).toBeGreaterThan(10);
      // Session cookie is set
      expect(res.headers['set-cookie']).toBeTruthy();
    });

    it('returns 401 on wrong password', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ctx.adminEmail, password: 'wrong-password' }),
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 401 on unknown email', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'anypass' }),
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 400 on missing fields', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: ctx.adminEmail }),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/cms/session — authenticated', () => {
    it('returns authenticated: true with user info after login', async () => {
      const { csrfToken, cookieHeader } = await ctx.login();
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/cms/session',
        headers: { cookie: cookieHeader },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{
        authenticated: boolean;
        user: { email: string };
        csrfToken: string;
      }>();
      expect(body.authenticated).toBe(true);
      expect(body.user.email).toBe(ctx.adminEmail);
      expect(body.csrfToken).toBe(csrfToken);
    });
  });

  describe('CSRF protection', () => {
    it('returns 403 on mutation without X-CSRF-Token', async () => {
      const { cookieHeader } = await ctx.login();
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/entries',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
          // No X-CSRF-Token
        },
        body: JSON.stringify({ id: 'test.x', kind: 'page', slug: '/x', title: 'X' }),
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 on mutation with wrong CSRF token', async () => {
      const { cookieHeader } = await ctx.login();
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/entries',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
          'x-csrf-token': 'wrong-token',
        },
        body: JSON.stringify({ id: 'test.y', kind: 'page', slug: '/y', title: 'Y' }),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Auth required', () => {
    it('GET /api/cms/entries returns 401 without session', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/cms/entries' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/cms/logout', () => {
    it('clears session after logout', async () => {
      const { csrfToken, cookieHeader } = await ctx.login();

      const logoutRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/cms/logout',
        headers: { cookie: cookieHeader, 'x-csrf-token': csrfToken },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Session should be invalid now
      const sessionRes = await ctx.app.inject({
        method: 'GET',
        url: '/api/cms/session',
        headers: { cookie: cookieHeader },
      });
      expect(sessionRes.json().authenticated).toBe(false);
    });
  });
});

// M-6: hasta ahora la contraseña solo se podía cambiar por línea de comandos
// (`npm run cms:reset-password`), lo que en producción significa depender de un
// desarrollador. Estos tests usan su propia app porque cambiar la contraseña
// invalida `ctx.adminPassword` para el resto del archivo.
describe('POST /api/cms/password — M-6', () => {
  let pw: TestApp;

  beforeEach(async () => {
    pw = await createTestApp();
  });

  afterEach(async () => {
    await pw.app.close();
    pw.cleanup();
  });

  const cambiar = (
    ctx: TestApp,
    body: Record<string, unknown>,
    creds: { cookieHeader: string; csrfToken?: string }
  ) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/cms/password',
      headers: {
        'content-type': 'application/json',
        cookie: creds.cookieHeader,
        ...(creds.csrfToken ? { 'x-csrf-token': creds.csrfToken } : {}),
      },
      body: JSON.stringify(body),
    });

  it('rechaza sin sesión', async () => {
    const res = await pw.app.inject({
      method: 'POST',
      url: '/api/cms/password',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actual: pw.adminPassword, nueva: 'contrasena-nueva-larga' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('rechaza sin token CSRF', async () => {
    const { cookieHeader } = await pw.login();
    const res = await cambiar(
      pw,
      { actual: pw.adminPassword, nueva: 'contrasena-nueva-larga' },
      { cookieHeader }
    );
    expect(res.statusCode).toBe(403);
  });

  it('rechaza la contraseña actual equivocada con un motivo legible', async () => {
    const creds = await pw.login();
    const res = await cambiar(
      pw,
      { actual: 'no-es-la-mia', nueva: 'contrasena-nueva-larga' },
      creds
    );
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/contraseña actual/i);

    // Y la contraseña no cambió.
    const login = await pw.app.inject({
      method: 'POST',
      url: '/api/cms/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: pw.adminEmail, password: pw.adminPassword }),
    });
    expect(login.statusCode).toBe(200);
  });

  it('exige al menos 12 caracteres en la nueva', async () => {
    const creds = await pw.login();
    const res = await cambiar(pw, { actual: pw.adminPassword, nueva: 'corta123' }, creds);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/12/);
  });

  it('rechaza reutilizar la misma contraseña', async () => {
    const creds = await pw.login();
    const res = await cambiar(pw, { actual: pw.adminPassword, nueva: pw.adminPassword }, creds);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/distinta/i);
  });

  it('cambia la contraseña, invalida la anterior y mantiene viva la sesión que la cambió', async () => {
    const creds = await pw.login();
    // Una segunda sesión, la que debe quedar revocada.
    const otra = await pw.login();

    const nueva = 'contrasena-nueva-larga-2026';
    const res = await cambiar(pw, { actual: pw.adminPassword, nueva }, creds);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ ok: boolean; sessionsRevoked: number; csrfToken: string }>();
    expect(body.ok).toBe(true);
    expect(body.sessionsRevoked).toBe(1);
    // El CSRF viaja de vuelta: la sesión se recreó y el token viejo ya no sirve.
    expect(typeof body.csrfToken).toBe('string');
    expect(body.csrfToken).not.toBe(creds.csrfToken);

    // La contraseña anterior ya no entra.
    const vieja = await pw.app.inject({
      method: 'POST',
      url: '/api/cms/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: pw.adminEmail, password: pw.adminPassword }),
    });
    expect(vieja.statusCode).toBe(401);

    // La nueva sí.
    const login = await pw.app.inject({
      method: 'POST',
      url: '/api/cms/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: pw.adminEmail, password: nueva }),
    });
    expect(login.statusCode).toBe(200);

    // La otra sesión quedó fuera; la que hizo el cambio sigue dentro.
    const expulsada = await pw.app.inject({
      method: 'GET',
      url: '/api/cms/session',
      headers: { cookie: otra.cookieHeader },
    });
    expect(expulsada.json().authenticated).toBe(false);

    const sigue = await pw.app.inject({
      method: 'GET',
      url: '/api/cms/session',
      headers: { cookie: creds.cookieHeader },
    });
    expect(sigue.json().authenticated).toBe(true);
    expect(sigue.json().csrfToken).toBe(body.csrfToken);
  });
});
