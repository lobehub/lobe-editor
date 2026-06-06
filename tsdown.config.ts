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
      'headless': 'src/headless/index.ts',
      // Emit the LiteXML command identities as their own chunk so the bundled
      // node build references them instead of inlining a second copy. Both this
      // entry and the unbundled browser build resolve to the same emitted
      // `es/plugins/litexml/command/symbols.js`, giving the commands a single
      // runtime identity (and a DOM-free import via `./litexml-commands`).
      'plugins/litexml/command/symbols': 'src/plugins/litexml/command/symbols.ts',
    },
    outExtensions: () => ({ dts: '.d.ts', js: '.js' }),
    platform: 'node',
  },
  {
    ...commonConfig,
    clean: false,
    entry: {
      codemirror: 'src/codemirror/index.ts',
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      renderer: 'src/renderer/index.ts',
    },
    platform: 'browser',
    unbundle: true,
  },
]);
