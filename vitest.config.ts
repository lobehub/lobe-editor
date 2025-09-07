import path from 'node:path';
import { defineConfig } from 'vitest/config';

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
  },
});
