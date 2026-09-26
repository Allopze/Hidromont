import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['cms/test/**/*.test.ts', 'src/test/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Las pruebas que publican de verdad (export con derivados de imagen) tardan
    // unos 5 s; con toda la batería en paralelo superaban el límite de 5 s por
    // defecto y fallaban sin que nada estuviera roto.
    testTimeout: 20_000,

    // Los tests de uploads escriben a config.cms.uploadDir. Apuntarlo a un
    // directorio temporal evita que ensucien public/uploads/cms con artefactos
    // de prueba (passwd-*.jpg, photo-*.png) que terminarían en producción (OPS-001).
    env: {
      CMS_UPLOAD_DIR: path.join(os.tmpdir(), 'hidromont-cms-test-uploads'),
    },

    coverage: {
      provider: 'v8',
      include: ['cms/**/*.ts'],
      exclude: ['cms/test/**', 'cms/scripts/**', 'cms/data/**'],
    },
  },
});
