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
    environment: 'jsdom',
    globals: true,
    coverage: {
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/common/**/*.ts', 'src/editor-kernel/**/*.ts'],
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
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 70,
    },
  },
});
