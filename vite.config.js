import { defineConfig } from 'vite';

export default defineConfig({
  root: './playground',
  build: {
    outDir: '../dist',
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
