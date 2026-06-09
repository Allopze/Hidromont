import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['cms/test/**/*.test.ts'],
    environment: 'node',
    globals: false,

    coverage: {
      provider: 'v8',
      include: ['cms/**/*.ts'],
      exclude: ['cms/test/**', 'cms/scripts/**', 'cms/data/**'],
    },
  },
});
