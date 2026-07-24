import { defineConfig } from '@lobehub/lint';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default defineConfig(
  {
    a11y: false,
    react: true,
    regexp: false,
    sortKeys: false,
  },
  {
    ignores: [
      '**/demos/**',
      '**/__tests__/**',
      '**/__test__/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/*.bench.{ts,tsx,js,jsx}',
      'coverage/**',
      'dist/**',
      'es/**',
      'src/editor-kernel/lexical/**',
    ],
  },
  {
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      '@typescript-eslint/method-signature-style': 'off',
      'no-console': 'off',
      'no-restricted-syntax': 'off',
      'no-useless-assignment': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      'unicorn/better-regex': 'off',
      'unicorn/no-anonymous-default-export': 'off',
      'unicorn/no-immediate-mutation': 'off',
      'unicorn/prefer-logical-operator-over-ternary': 'off',
    },
  },
);
