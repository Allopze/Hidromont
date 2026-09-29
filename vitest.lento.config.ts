import { defineConfig } from 'vitest/config';

/**
 * Pruebas lentas que compilan el sitio de verdad (`cms/test-lento/`). Van
 * aparte de `npm test` porque tardan uno o dos minutos: `npm run test:publicar`.
 */
export default defineConfig({
  test: {
    include: ['cms/test-lento/**/*.test.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 180_000,
  },
});
