import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  deps: {
    onlyBundle: false,
  },
  dts: true,
  entry: {
    headless: 'src/headless/index.ts',
    index: 'src/index.ts',
    react: 'src/react/index.ts',
    renderer: 'src/renderer/index.ts',
  },
  format: 'esm',
  outDir: 'es',
  platform: 'browser',
});
