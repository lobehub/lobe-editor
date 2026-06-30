import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@lobehub\/editor\/(.+)$/,
        replacement: `${resolve(repoRoot, 'src')}/$1`,
      },
      {
        find: '@lobehub/editor/react',
        replacement: resolve(repoRoot, 'src/react/index.ts'),
      },
      {
        find: /^@lobehub\/editor$/,
        replacement: resolve(repoRoot, 'src/index.ts'),
      },
      {
        find: '@',
        replacement: resolve(repoRoot, 'src'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [repoRoot, __dirname],
    },
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8797',
    },
  },
});
