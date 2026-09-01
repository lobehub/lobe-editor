// @vitest-environment node

import { type Provider, type ProviderAwareness, type UserState, createBinding } from '@lexical/yjs';
import { $getRoot, $nodesOfType } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { Doc, encodeStateAsUpdate } from 'yjs';

import { moment } from '@/editor-kernel';
import { exportYjsSnapshotProjection } from '@/headless';
import { HeadlessEditor } from '@/headless';
import { INSERT_ARTIFACT_COMMAND } from '@/plugins/artifact';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { $ensureNodeIdsInTree, $getNodeId, $setNodeProperties } from '@/plugins/properties';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';

class NoopAwareness implements ProviderAwareness {
  getLocalState(): UserState | null {
    return null;
  }

  getStates(): Map<number, UserState> {
    return new Map();
  }

  off(): void {}

  on(): void {}

  setLocalState(): void {}

  setLocalStateField(): void {}
}

const createProvider = (): Provider =>
  ({
    awareness: new NoopAwareness(),
    connect: () => undefined,
    disconnect: () => undefined,
    off: () => undefined,
    on: () => undefined,
  }) as Provider;

describe('exportYjsSnapshotProjection', () => {
  const editors: HeadlessEditor[] = [];
  const docs: Doc[] = [];

  afterEach(() => {
    while (editors.length > 0) editors.pop()?.destroy();
    while (docs.length > 0) docs.pop()?.destroy();
  });

  it('round-trips table, artifact, and durable properties without exposing room state', async () => {
    const seed = new HeadlessEditor();
    editors.push(seed);
    seed.hydrateMarkdown(
      'Intro text\n\n| Feature | Status |\n| --- | --- |\n| Table | Supported |',
    );
    const lexicalEditor = seed.kernel.getLexicalEditor();
    if (!lexicalEditor) throw new Error('Missing seed lexical editor.');
    lexicalEditor.update(
      () => {
        $getRoot().getFirstChild()?.selectEnd();
      },
      { discrete: true },
    );
    seed.kernel.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
      html: '<main><h1>Snapshot artifact</h1></main>',
      title: 'Snapshot artifact',
    });
    await moment();

    lexicalEditor.update(
      () => {
        $ensureNodeIdsInTree();
        const firstBlock = $getRoot().getFirstChild();
        if (firstBlock) {
          $setNodeProperties(firstBlock, {
            nodeId: $getNodeId(firstBlock),
            provenance: {
              generationId: 'generation-snapshot',
              model: 'test-model',
              provider: 'test-provider',
              source: 'ai',
            },
          });
        }
      },
      { discrete: true },
    );

    const provider = createProvider();
    const doc = new Doc();
    docs.push(doc);
    const docMap = new Map([['page-snapshot', doc]]);
    const binding = createBinding(lexicalEditor, provider, 'page-snapshot', doc, docMap);
    syncCurrentEditorStateToYjs(binding, provider);
    const update = encodeStateAsUpdate(doc);
    binding.root.destroy(binding);

    const projection = await exportYjsSnapshotProjection({
      roomId: 'page-snapshot',
      update,
    });

    expect(projection.markdown).toContain('Snapshot artifact');
    expect(projection.markdown).toContain('Feature');
    expect(projection.markdown).toContain('Supported');
    expect(JSON.stringify(projection.editorData)).toContain('"artifact"');
    expect(JSON.stringify(projection.editorData)).toContain('generation-snapshot');
    expect(JSON.stringify(projection.editorData)).toContain('test-provider');
    expect(projection).not.toHaveProperty('doc');
    expect(projection).not.toHaveProperty('provider');
    expect(projection).not.toHaveProperty('binding');

    const artifactCount = JSON.stringify(projection.editorData).match(/"type":"artifact"/g)?.length;
    expect(artifactCount).toBe(1);
    expect(projection.markdown).toContain('| Feature |');
  });

  it('rejects invalid room input before allocating a projection editor', async () => {
    await expect(
      exportYjsSnapshotProjection({ roomId: '', update: new Uint8Array() }),
    ).rejects.toThrow('requires a non-empty roomId');
    await expect(
      exportYjsSnapshotProjection({ roomId: 'page-snapshot', update: 'not-bytes' as never }),
    ).rejects.toThrow('requires a Uint8Array update');
  });
});
