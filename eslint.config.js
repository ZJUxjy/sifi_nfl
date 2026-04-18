// ESLint flat config (ESLint 9+).
//
// This is intentionally a minimal-but-useful baseline. Goals:
//   1. Make `npm run lint-js` actually runnable (previously the script
//      assumed a config file that did not exist).
//   2. Catch obvious mistakes in TS/TSX without becoming so noisy that
//      it gets disabled. We start with the recommended rule sets and
//      will tighten later as part of P1+ engineering hardening.
//   3. Reserve a slot for the architectural boundary rule
//      (no-restricted-imports) introduced in plan task 22 (UI/CLI must go
//      through @worker/api, not reach into @worker/core directly).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vitest/**',
      'public/**',
      'src/data/saves/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Don't fail the lint pipeline over half-implemented modules; warn
      // for visibility while P0/P1 work is in flight. These will be
      // promoted to 'error' once the baseline is cleaned up.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-empty-pattern': 'warn',
      'no-case-declarations': 'warn',
      // Architectural boundary: UI / CLI must talk to the worker layer
      // through @worker/api only, not reach into @worker/core internals.
      // Plan task 22 will switch the existing violations from warn to error.
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['@worker/core/*', '@worker/db/*'],
              message:
                'UI/CLI must depend on @worker/api only. Move new exports through the api layer instead of reaching into core/db.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    plugins: { react: reactPlugin },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Baseline UI uses literal quotes inside JSX text. Warn for now
      // and promote to 'error' once the existing strings are escaped.
      'react/no-unescaped-entities': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },
  // Worker / common / cli are TS but not React.
  {
    files: ['src/worker/**/*.ts', 'src/common/**/*.ts', 'src/cli/**/*.ts'],
    rules: {
      // Restate to drop the UI-only react rules above.
    },
  },
);
