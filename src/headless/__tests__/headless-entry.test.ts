// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  $getRoot,
  $isElementNode,
  type LexicalNode,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import {
  createHeadlessEditor,
  $ensureNodeIdsInTree,
  $getNodeId,
  IBlockRewriteAdapterService,
} from '@lobehub/editor/headless';
import type { BlockRewriteAdapterService } from '@lobehub/editor/headless';

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const builtHeadlessEntry = fileURLToPath(new URL('../../../es/headless.js', import.meta.url));

const findNodeByType = (node: LexicalNode, type: string): LexicalNode | undefined => {
  if (node.getType() === type) return node;
  if (!$isElementNode(node)) return undefined;
  for (const child of node.getChildren()) {
    const match = findNodeByType(child, type);
    if (match) return match;
  }
};

describe('headless package entry', () => {
  // Cold Vitest transforms can be slow while the full suite starts in parallel;
  // this smoke test checks Node compatibility, not import latency.
  it('loads in a Node process without initializing the React runtime', async () => {
    const entry = await import('@lobehub/editor/headless');

    expect(entry.createHeadlessEditor).toBeTypeOf('function');
    expect(entry.CollaborativeAgentEditor).toBeTypeOf('function');
  }, 15_000);

  it('exposes the registered artifact rewrite adapter through the public headless API', async () => {
    const editor = createHeadlessEditor();
    try {
      const source = '<h1>Public API</h1>';
      editor.hydrateEditorData(
        {
          root: {
            children: [{ html: source, title: 'Public API', type: 'artifact', version: 1 }],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        } as unknown as SerializedEditorState<SerializedLexicalNode>,
        { keepId: true },
      );
      await editor.applyLiteXML([]);

      const service: BlockRewriteAdapterService | null = editor.kernel.requireService(
        IBlockRewriteAdapterService,
      );
      expect(service).not.toBeNull();
      expect(service?.getAdapterByKey('artifact')).toMatchObject({
        key: 'artifact',
        outputSchema: 'source',
      });
      expect(editor.export().editorData.root.children.map((node) => node.type)).toContain(
        'artifact',
      );

      const lexical = editor.kernel.getLexicalEditor();
      if (!lexical) throw new Error('Expected a headless Lexical editor.');
      lexical.update(() => $ensureNodeIdsInTree($getRoot()), { discrete: true });
      const details = lexical.getEditorState().read(
        () => {
          const node = findNodeByType($getRoot(), 'artifact');
          if (!node || !service) return null;
          const adapter = service.getAdapterByKey('artifact');
          return {
            context: service.getAdapter(node)?.readContext(node) ?? null,
            nodeId: $getNodeId(node),
            supports: adapter?.supports(node),
          };
        },
        { editor: lexical },
      );
      const context = details?.context;

      expect(details).toMatchObject({ nodeId: expect.any(String), supports: true });
      expect(context).toMatchObject({
        adapterKey: 'artifact',
        nodeType: 'artifact',
        source,
        title: 'Public API',
      });
      expect(context?.nodeId).toMatch(/^[0-9a-z][0-9a-z-]+$/);
    } finally {
      editor.destroy();
    }
  });

  it.runIf(existsSync(builtHeadlessEntry))(
    'loads the built package entry without React or UI dependencies',
    () => {
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          "await import('@lobehub/editor/headless'); console.log('headless package ok')",
        ],
        { cwd: packageRoot, encoding: 'utf8' },
      );
      expect(output).toContain('headless package ok');

      const builtSource = readFileSync(builtHeadlessEntry, 'utf8');
      expect(builtSource).not.toMatch(/@lobehub\/ui|createContext|useContext|react\/jsx|react-dom/);
    },
  );
});
