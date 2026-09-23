import type { LexicalNode } from 'lexical';
import { $getRoot, $nodesOfType } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { CommonPlugin } from '@/plugins/common/plugin';
import { $isHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { BlockRewritePlugin } from '@/plugins/block/plugin/rewrite';
import { CodeblockPlugin } from '@/plugins/codeblock/plugin';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { LinkBlockCardNode } from '@/plugins/link/node/LinkBlockCardNode';
import { LinkPlugin } from '@/plugins/link/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import { resolveRewriteAdapterTarget } from './rewrite-adapter';
import { IBlockRewriteAdapterService } from './rewrite-adapter';

const adapter = (type: string, key = type) => ({
  apply: () => undefined,
  capabilities: { canEdit: true, canMove: true, canSelect: true },
  key,
  outputSchema: 'source' as const,
  readContext: (node: LexicalNode) => ({
    adapterKey: key,
    capabilities: { canEdit: true, canMove: true, canSelect: true },
    nodeId: `${type}-node`,
    nodeType: node.getType(),
    source: 'source',
    sourceHash: 'hash:source',
  }),
  supports: (node: LexicalNode) => node.getType() === type,
  validate: () => ({ ok: true as const, output: { kind: 'source', source: 'source' } }),
});

const fakeNode = (type: string, contentChildren: LexicalNode[] = []): LexicalNode =>
  ({
    getContentChildren: () => contentChildren,
    getType: () => type,
  }) as unknown as LexicalNode;

describe('resolveRewriteAdapterTarget', () => {
  it('resolves the unique adapter-owned child of an Artifact-like Hole', () => {
    const artifact = fakeNode('artifact');
    const hole = fakeNode('hole', [artifact]);
    const service = {
      getAdapter: (node: LexicalNode) =>
        node.getType() === 'artifact' ? adapter('artifact') : null,
      getAdapterByKey: () => null,
      registerAdapter: () => () => undefined,
    };

    const resolved = resolveRewriteAdapterTarget(hole, service);

    expect(resolved?.node).toBe(artifact);
    expect(resolved?.context).toMatchObject({ adapterKey: 'artifact', nodeId: 'artifact-node' });
  });

  it('uses a direct CodeMirror/code/LinkBlock adapter without searching descendants', () => {
    const nodes = ['codemirror', 'code', 'link-block-card'].map((type) => fakeNode(type));
    const service = {
      getAdapter: (node: LexicalNode) => {
        const type = node.getType();
        return ['codemirror', 'code', 'link-block-card'].includes(type) ? adapter(type) : null;
      },
      getAdapterByKey: () => null,
      registerAdapter: () => () => undefined,
    };

    for (const node of nodes) {
      expect(resolveRewriteAdapterTarget(node, service)?.node).toBe(node);
    }

    const unrelatedNested = fakeNode('artifact');
    const nonCardWrapper = fakeNode('wrapper', [unrelatedNested]);
    expect(resolveRewriteAdapterTarget(nonCardWrapper, service)).toBeNull();
  });

  it('does not guess when a Hole has multiple content children', () => {
    const first = fakeNode('artifact');
    const second = fakeNode('code');
    const hole = fakeNode('hole', [first, second]);
    const service = {
      getAdapter: (node: LexicalNode) =>
        node.getType() === 'artifact' || node.getType() === 'code' ? adapter(node.getType()) : null,
      getAdapterByKey: () => null,
      registerAdapter: () => () => undefined,
    };

    expect(resolveRewriteAdapterTarget(hole, service)).toBeNull();
  });

  it('resolves a real Artifact wrapped by the editor Hole contract', async () => {
    const editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      BlockRewritePlugin,
      MarkdownPlugin,
      ArtifactPlugin,
      PropertiesPlugin,
    ]);
    editor.initHeadlessEditor();
    editor.setDocument('json', {
      root: {
        children: [{ html: '<main>Artifact</main>', title: 'Artifact', type: 'artifact' }],
        type: 'root',
        version: 1,
      },
    });
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const resolved = lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      return hole
        ? resolveRewriteAdapterTarget(hole, editor.requireService(IBlockRewriteAdapterService))
        : null;
    });

    expect(resolved?.node).toBeInstanceOf(ArtifactNode);
    expect(resolved?.context).toMatchObject({
      adapterKey: 'artifact',
      nodeType: 'artifact',
      source: '<main>Artifact</main>',
    });
    editor.destroy();
  });

  it('resolves the real CodeMirror, ordinary code, and LinkBlock nodes directly', async () => {
    const cases = [
      {
        plugins: [CommonPlugin, BlockRewritePlugin, PropertiesPlugin, CodemirrorPlugin],
        value: {
          code: 'const value = 1;',
          codeTheme: '',
          language: 'javascript',
          options: { indentWithTabs: false, lineNumbers: false, tabSize: 2 },
          type: 'code',
          version: 1,
        },
        type: 'codemirror',
        outputSchema: 'source',
      },
      {
        plugins: [
          CommonPlugin,
          BlockRewritePlugin,
          PropertiesPlugin,
          MarkdownPlugin,
          CodeblockPlugin,
        ],
        value: {
          children: [{ text: 'const value = 1;', type: 'code-highlight', version: 1 }],
          direction: 'ltr',
          language: 'javascript',
          type: 'code',
          version: 1,
        },
        type: 'codeblock',
        outputSchema: 'source',
      },
      {
        plugins: [CommonPlugin, BlockRewritePlugin, PropertiesPlugin, MarkdownPlugin, LinkPlugin],
        value: {
          description: 'LobeHub',
          icon: '',
          openTarget: '_blank',
          title: 'LobeHub',
          type: 'link-block-card',
          url: 'https://lobehub.com',
          version: 1,
        },
        type: 'link-block-card',
        outputSchema: 'patch',
      },
    ] as const;

    for (const item of cases) {
      const editor = Editor.createEditor().registerPlugins([...item.plugins]);
      editor.initHeadlessEditor();
      editor.setDocument('json', {
        root: { children: [item.value], type: 'root', version: 1 },
      });
      await moment();

      const lexical = editor.getLexicalEditor()!;
      const resolved = lexical.getEditorState().read(() => {
        const node = $getRoot().getFirstChild();
        return resolveRewriteAdapterTarget(
          node,
          editor.requireService(IBlockRewriteAdapterService),
        );
      });

      expect(resolved?.context.adapterKey).toBe(item.type);
      expect(resolved?.adapter.outputSchema).toBe(item.outputSchema);
      editor.destroy();
    }
  });
});
