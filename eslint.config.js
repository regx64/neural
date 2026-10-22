import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // R3F mutates three.js objects inside useFrame by design.
      'react-hooks/immutability': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The engine must stay pure so it can run in the worker, on the main thread and in Node tests.
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react-dom',
            'three',
            '@react-three/*',
            'zustand',
            '@viz/*',
            '@ui/*',
            '@state/*',
          ],
        },
      ],
    },
  },
);
