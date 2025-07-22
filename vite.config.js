import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const tsconfigPaths = (await import('vite-tsconfig-paths')).default;

  return {
    plugins: [tsconfigPaths({
      root: './',
    })],
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
  };
});
