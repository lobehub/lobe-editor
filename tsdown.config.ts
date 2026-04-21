import { defineConfig } from 'tsdown';

const commonConfig = {
  deps: {
    onlyBundle: false,
  },
  dts: true,
  format: 'esm',
  outDir: 'es',
} as const;

export default defineConfig([
  {
    ...commonConfig,
    clean: true,
    entry: {
      headless: 'src/headless/index.ts',
    },
    outExtensions: () => ({ dts: '.d.ts', js: '.js' }),
    platform: 'node',
  },
  {
    ...commonConfig,
    clean: false,
    entry: {
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      renderer: 'src/renderer/index.ts',
    },
    platform: 'browser',
  },
]);
