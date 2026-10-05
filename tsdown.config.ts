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
      'loro': 'src/plugins/loro/index.ts',
      'loro/headless': 'src/headless/loro.ts',
      'loro/react': 'src/plugins/loro/react/index.ts',
      // Share persistent NodeState configuration, the editor-scoped policy
      // registry, and the service token across bundled headless and unbundled
      // UI entries. Lexical treats duplicate StateConfig keys as an error.
      'plugins/common/node/node-id': 'src/plugins/common/node/node-id.ts',
      'plugins/common/node/node-identity-policy': 'src/plugins/common/node/node-identity-policy.ts',
      'plugins/common/service/i-node-identity-service':
        'src/plugins/common/service/i-node-identity-service.ts',
      // Emit the LiteXML command identities as their own chunk so the bundled
      // node build references them instead of inlining a second copy. Both this
      // entry and the unbundled browser build resolve to the same emitted
      // `es/plugins/litexml/command/symbols.js`, giving the commands a single
      // runtime identity (and a DOM-free import via `./litexml-commands`).
      'plugins/litexml/command/symbols': 'src/plugins/litexml/command/symbols.ts',
    },
    outExtensions: () => ({ dts: '.d.ts', js: '.js' }),
    platform: 'node',
    unbundle: true,
  },
  {
    ...commonConfig,
    clean: false,
    entry: {
      collaboration: 'src/common/collaboration/index.ts',
      codemirror: 'src/codemirror/index.ts',
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      renderer: 'src/renderer/index.ts',
    },
    platform: 'browser',
    unbundle: true,
  },
]);
