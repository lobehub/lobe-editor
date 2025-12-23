import path from 'node:path';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

import { name } from './package.json';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      [name]: path.resolve(__dirname, './src'),
    },
  },
  test: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      [name]: path.resolve(__dirname, './src'),
    },
    coverage: {
      branches: 70,
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/**/__tests__/**',
        'src/editor-kernel/inode/**',
        'src/editor-kernel/react/**',
        'src/editor-kernel/kernel.ts',
        'src/plugins/**',
        'src/react/**',
        'src/types/**',
        'src/**/demos/**',
        'src/index.ts',
        'src/utils/**',
      ],
      functions: 80,
      include: ['src/common/**/*.ts', 'src/editor-kernel/**/*.ts'],
      lines: 80,
      reporter: ['text', 'json-summary', 'lcov'],
      statements: 80,
    },
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: ['@lobehub/ui'],
      },
    },
  },
});
