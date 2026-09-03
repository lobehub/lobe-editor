import type { Provider } from '@lexical/yjs';
import { $createRangeSelection, $getRoot, $nodesOfType, $setSelection } from 'lexical';
import { applyUpdate, Doc } from 'yjs';
import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';
import { MarkdownPlugin } from '@/plugins/markdown';

import { INSERT_ARTIFACT_COMMAND } from '../command';
import { ArtifactNode } from '../node/ArtifactNode';
import { ArtifactPlugin } from '../plugin';
import { HoleNode } from '@/plugins/common/node/hole';
import { YjsPlugin } from '@/plugins/yjs/plugin';

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

describe('Artifact Hole + Yjs', () => {
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
