import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const tsconfigPaths = (await import('vite-tsconfig-paths'));

  return {
    build: {
      lib: {
        entry: './src/index.ts',
        // 全局变量名称（用于 UMD 构建）
        fileName: (format) => `editor.${format}.js`,
        formats: ['es', 'umd', 'cjs'],
        // 入口文件
        name: 'Editor',
      },
      rollupOptions: {
        // 确保外部依赖不会被打包到最终的库中
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
        },
      },
    },
    plugins: [tsconfigPaths.default({
      root: './',
    })],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      port: 3000,
    },
  };
});
