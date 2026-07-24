// M4: configuración ESLint mínima y sensata para el proyecto.
// - Astro: plugin + parser para .astro (frontend + scripts inline).
// - TypeScript: type-aware solo donde aporta valor (off por defecto para velocidad).
// - Reglas de seguridad/estilo alineadas con el resto del código existente.
module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:astro/recommended',
  ],
  // Los archivos .astro usan su propio parser via overrides.
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
      rules: {
        // En .astro, el frontmatter TS y el template se mezclan; estas reglas
        // producen falsos positivos comunes.
        '@typescript-eslint/no-unused-vars': 'off',
        // no-undef choca con los tipos globales de TS (HTMLElementTagNameMap, etc.)
        // que TS resuelve pero ESLint sin type-info no ve.
        'no-undef': 'off',
      },
    },
    {
      // JS plano del overlay: el parser es esprima (no TS), y las funciones
      // declaradas dentro de bloques son un patron intencional del IIFE.
      files: ['src/scripts/**/*.js'],
      rules: {
        'no-inner-declarations': 'off',
        'no-undef': 'off',
      },
    },
    {
      files: ['**/*.test.ts', '**/test/**/*.ts', 'e2e/**/*.ts'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '.astro/',
    'test-results/',
    'playwright-report/',
    'public/',
    'cms/data/',
    '*.cjs',
    'src/env.d.ts',
  ],
  rules: {
    // Estilo alineado al código existente.
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    // No forzar imports de tipo separados: `import()` in-line es una feature valida
    // de TS y el codigo existente la usa legitimamente en tests/e2e.
    '@typescript-eslint/consistent-type-imports': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    // Permitir declaraciones de función dentro de bloques (patrón legado en
    // scripts inline de Astro; convertir a const cambiaria el hoisting).
    'no-inner-declarations': 'off',
  },
};
