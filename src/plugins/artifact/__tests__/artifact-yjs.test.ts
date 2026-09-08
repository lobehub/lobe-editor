import type { Provider } from '@lexical/yjs';
import { $createRangeSelection, $getRoot, $nodesOfType, $setSelection } from 'lexical';
import { describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate, XmlText } from 'yjs';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown';
import { YjsPlugin } from '@/plugins/yjs/plugin';

import { INSERT_ARTIFACT_COMMAND } from '../command';
import { ArtifactNode } from '../node/ArtifactNode';
import { ArtifactPlugin } from '../plugin';

type TestProvider = Provider & { emitSync: () => void };

const createProvider = (): TestProvider => {
  const listeners = new Map<string, Set<(value?: boolean) => void>>();
  const on = (type: string, listener: (value?: boolean) => void) => {
    const registered = listeners.get(type) ?? new Set();
    registered.add(listener);
    listeners.set(type, registered);
  };
  const off = (type: string, listener: (value?: boolean) => void) => {
    listeners.get(type)?.delete(listener);
  };

  return {
    awareness: {
      getLocalState: () => null,
      getStates: () => new Map(),
      off,
      on,
      setLocalState: () => undefined,
      setLocalStateField: () => undefined,
    },
    connect: () => undefined,
    disconnect: () => undefined,
    emitSync: () => listeners.get('sync')?.forEach((listener) => listener(true)),
    off,
    on,
  } as unknown as TestProvider;
};

const connectDocs = (
  left: Doc,
  leftProvider: TestProvider,
  right: Doc,
  rightProvider: TestProvider,
): void => {
  left.on('update', (update, origin) => {
    if (origin === rightProvider) return;
    applyUpdate(right, update, leftProvider);
  });
  right.on('update', (update, origin) => {
    if (origin === leftProvider) return;
    applyUpdate(left, update, rightProvider);
  });
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const createYjsEditor = (doc: Doc, provider: TestProvider): Kernel => {
  const kernel = new Kernel();
  kernel.registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    MarkdownPlugin,
    ArtifactPlugin,
    [
      YjsPlugin,
      {
        id: 'artifact-hole',
        providerFactory: () => provider,
        yjsDoc: doc,
      },
    ],
  ]);
  kernel.initHeadlessEditor();
  return kernel;
};

const getRootTypes = (kernel: Kernel): string[] =>
  kernel
    .getLexicalEditor()!
    .getEditorState()
    .read(() =>
      $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    );

type SharedNodeLike = {
  getAttribute?: (name: string) => unknown;
  toArray?: () => unknown[];
  toDelta?: () => Array<{ insert?: unknown }>;
};

const readYjsRootTypes = (doc: Doc): string[] =>
  doc
    .get('root', XmlText)
    .toDelta()
    .flatMap(({ insert }: { insert?: unknown }) => {
      if (!insert || typeof insert === 'string') return [];
      const type = (insert as SharedNodeLike).getAttribute?.('__type');
      return typeof type === 'string' ? [type] : [];
    });

const hasSharedType = (doc: Doc, type: string): boolean => {
  const visited = new Set<object>();
  let found = false;
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    const node = value as SharedNodeLike;
    if (node.getAttribute?.('__type') === type) {
      found = true;
      return;
    }
    node.toDelta?.().forEach(({ insert }: { insert?: unknown }) => visit(insert));
    node.toArray?.().forEach(visit);
  };

  doc
    .get('root', XmlText)
    .toDelta()
    .forEach(({ insert }: { insert?: unknown }) => visit(insert));
  return found;
};

const observeFirstSharedArtifact = (doc: Doc, action: () => void): string[][] => {
  const mirror = new Doc();
  applyUpdate(mirror, encodeStateAsUpdate(doc));
  const rootTypesWhenArtifactExists: string[][] = [];
  const onUpdate = (update: Uint8Array) => {
    applyUpdate(mirror, update);
    if (hasSharedType(mirror, ArtifactNode.getType())) {
      rootTypesWhenArtifactExists.push(readYjsRootTypes(mirror));
    }
  };

  doc.on('update', onUpdate);
  try {
    action();
  } finally {
    doc.off('update', onUpdate);
    mirror.destroy();
  }
  return rootTypesWhenArtifactExists;
};

describe('Artifact Hole + Yjs', () => {
  it('normalizes a JSON replacement before publishing into a populated shared room', async () => {
    const doc = new Doc();
    const provider = createProvider();
    const kernel = createYjsEditor(doc, provider);
    provider.emitSync();
    await flush();

    kernel.setDocument('markdown', 'Shared text');
    await flush();

    const firstReplacementRootTypes = observeFirstSharedArtifact(doc, () => {
      kernel.setDocument(
        'json',
        {
          root: {
            children: [
              {
                html: '<main>replacement</main>',
                title: 'Replacement',
                type: ArtifactNode.getType(),
                version: 1,
              },
            ],
            type: 'root',
            version: 1,
          },
        },
        { keepId: true },
      );
    });
    await flush();
    await flush();

    expect(getRootTypes(kernel)).toEqual(['hole']);
    expect(firstReplacementRootTypes.length).toBeGreaterThan(0);
    firstReplacementRootTypes.forEach((types) => {
      expect(types).toContain('hole');
      expect(types).not.toContain(ArtifactNode.getType());
    });

    kernel.destroy();
    doc.destroy();
  });

  it('syncs the Hole shape and boundary paragraph between peers', async () => {
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    connectDocs(docA, providerA, docB, providerB);

    const kernelA = createYjsEditor(docA, providerA);
    kernelA.setDocument('markdown', 'Shared text');
    providerA.emitSync();
    await flush();

    const kernelB = createYjsEditor(docB, providerB);
    providerB.emitSync();
    await flush();
    await flush();

    const editorA = kernelA.getLexicalEditor()!;
    editorA.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
      html: '<main>Shared artifact</main>',
      title: 'Shared',
    });
    await flush();
    await flush();

    expect(getRootTypes(kernelA)).toEqual(['paragraph', 'hole', 'paragraph']);
    expect(getRootTypes(kernelB)).toEqual(['paragraph', 'hole', 'paragraph']);

    editorA.update(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getAfterCursor();
      if (!hole || !cursor) throw new Error('Hole boundary cursor missing');
      cursor.setTextContent('\uFEFFremote paragraph');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      selection.focus.set(cursor.getKey(), cursor.getTextContentSize(), 'text');
      $setSelection(selection);
    });
    await flush();
    await flush();
    await flush();

    expect(getRootTypes(kernelA)).toEqual(['paragraph', 'hole', 'paragraph', 'paragraph']);
    expect(getRootTypes(kernelB)).toEqual(['paragraph', 'hole', 'paragraph', 'paragraph']);
    expect(
      kernelB
        .getLexicalEditor()!
        .getEditorState()
        .read(() => $getRoot().getChildren()[2]?.getTextContent()),
    ).toBe('remote paragraph');

    kernelA.destroy();
    kernelB.destroy();
    docA.destroy();
    docB.destroy();
  });

  it('removes an empty Hole on both peers when its Artifact child is deleted', async () => {
    const docA = new Doc();
    const docB = new Doc();
    const providerA = createProvider();
    const providerB = createProvider();
    connectDocs(docA, providerA, docB, providerB);
    const kernelA = createYjsEditor(docA, providerA);
    kernelA.setDocument('markdown', 'Shared text');
    providerA.emitSync();
    await flush();
    const kernelB = createYjsEditor(docB, providerB);
    providerB.emitSync();
    await flush();

    const editorA = kernelA.getLexicalEditor()!;
    editorA.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
      html: '<main>delete me</main>',
      title: 'Delete me',
    });
    await flush();
    await flush();
    editorA.update(() => {
      $nodesOfType(ArtifactNode)[0]?.remove();
    });
    await flush();
    await flush();
    await flush();

    for (const kernel of [kernelA, kernelB]) {
      kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() => {
          expect($nodesOfType(HoleNode)).toHaveLength(0);
          expect($nodesOfType(ArtifactNode)).toHaveLength(0);
          expect(
            $getRoot()
              .getChildren()
              .every((node) => node.getType() === 'paragraph'),
          ).toBe(true);
        });
    }

    kernelA.destroy();
    kernelB.destroy();
    docA.destroy();
    docB.destroy();
  });
});
