import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
      const body = res.json<{ authenticated: boolean; user: { email: string }; csrfToken: string }>();
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
