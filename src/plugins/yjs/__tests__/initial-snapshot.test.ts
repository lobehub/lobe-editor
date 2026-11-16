import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import { $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { HoleNode } from '@/plugins/common/node/hole';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';
import { describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from '@/headless/default-plugins';
import { $setNodeProperties } from '@/plugins/properties/state';
import { syncCurrentEditorStateToYjs } from '../plugin/utils/sync';
import { YjsPlugin } from '../plugin';

class SnapshotProvider implements Provider {
  readonly awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map<number, UserState>(),
    off: (type, listener) => this.listeners.get(type)?.delete(listener as never),
    on: (type, listener) => {
      const callbacks = this.listeners.get(type) ?? new Set();
      callbacks.add(listener as never);
      this.listeners.set(type, callbacks);
    },
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };
  private readonly listeners = new Map<string, Set<(...args: never[]) => void>>();
  private readonly updateHandler = (update: Uint8Array, origin: unknown): void => {
    if (origin !== this) this.localUpdateCount += 1;
    void update;
  };
  localUpdateCount = 0;

  constructor(
    private readonly doc: Doc,
    private readonly snapshot: Uint8Array,
  ) {}

  connect(): void {
    this.doc.on('update', this.updateHandler);
    applyUpdate(this.doc, this.snapshot, this);
    queueMicrotask(() => {
      this.listeners
        .get('status')
        ?.forEach((listener) => listener({ status: 'connected' } as never));
      this.listeners.get('sync')?.forEach((listener) => listener(true as never));
    });
  }

  disconnect(): void {
    this.doc.off('update', this.updateHandler);
  }

  off(type: 'reload' | 'sync' | 'status' | 'update', listener: unknown): void {
    this.listeners.get(type)?.delete(listener as never);
  }

  on(type: 'reload' | 'sync' | 'status' | 'update', listener: unknown): void {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(listener as never);
    this.listeners.set(type, callbacks);
  }
}

const rootTypes = (kernel: ReturnType<typeof Editor.createEditor>): string[] => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => node.getType()),
  );
};

const expectCodeHoleAt = (kernel: ReturnType<typeof Editor.createEditor>, index: number): void => {
  const editor = kernel.getLexicalEditor()!;
  const isCodeHole = editor.getEditorState().read(() => {
    const node = $getRoot().getChildAtIndex(index);
    return (
      node instanceof HoleNode &&
      node.getContentChildren().some((child) => child instanceof CodeMirrorNode)
    );
  });
  expect(isCodeHole).toBe(true);
};

const countType = (kernel: ReturnType<typeof Editor.createEditor>, type: string): number => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() => {
    let count = 0;
    const visit = (node: LexicalNode): void => {
      if (node.getType() === type) count += 1;
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    visit($getRoot());
    return count;
  });
};

const createKernel = (doc: Doc, provider: SnapshotProvider) => {
  const kernel = Editor.createEditor();
  kernel.registerPlugins([
    ...DEFAULT_HEADLESS_EDITOR_PLUGINS,
    [
      YjsPlugin,
      {
        id: 'initial-snapshot',
        providerFactory: () => provider,
        shouldBootstrap: true,
        yjsDoc: doc,
      },
    ],
  ]);
  kernel.initHeadlessEditor();
  return kernel;
};

describe('Yjs initial room snapshot', () => {
  it('replaces host-hydrated JSON instead of merging a second Artifact/code tree', async () => {
    const source = Editor.createEditor();
    source.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
    source.initHeadlessEditor();
    source.setDocument('markdown', 'p1\n\np2\n\np3\n\np4\n\np5\n\np6');
    const sourceEditor = source.getLexicalEditor()!;
    sourceEditor.update(
      () => {
        const paragraphs = $getRoot()
          .getChildren()
          .filter((node) => node.getType() === 'paragraph');
        const artifact = $createArtifactNode('<main>old artifact</main>', 'Old artifact');
        const code = $createCodeMirrorNode('rust', 'fn quick_sort() {}');
        paragraphs[2].insertAfter(artifact);
        paragraphs[4].insertAfter(code);
        $setNodeProperties(artifact, {
          nodeId: 'snapshot-artifact',
          provenance: { generationId: 'old-generation', requestId: 'old-request', source: 'ai' },
        });
        $setNodeProperties(code, {
          nodeId: 'snapshot-code',
          provenance: {
            generationId: 'old-code-generation',
            requestId: 'old-code-request',
            source: 'ai',
          },
        });
      },
      { discrete: true },
    );
    await moment();

    const serverDoc = new Doc();
    const serverProvider = new SnapshotProvider(serverDoc, new Uint8Array());
    const serverBinding = createBinding(
      sourceEditor,
      serverProvider,
      'initial-snapshot',
      serverDoc,
      new Map([['initial-snapshot', serverDoc]]),
    );
    syncCurrentEditorStateToYjs(serverBinding, serverProvider);
    const snapshot = encodeStateAsUpdate(serverDoc);
    const sourceEditorData = sourceEditor.getEditorState().toJSON();
    serverBinding.root.destroy(serverBinding);
    source.destroy();

    const browserDoc = new Doc();
    const browserProvider = new SnapshotProvider(browserDoc, snapshot);
    const browser = createKernel(browserDoc, browserProvider);
    browser.setDocument('json', JSON.stringify(sourceEditorData));
    await moment();
    await moment();

    expect(rootTypes(browser)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
      'hole',
      'paragraph',
      'paragraph',
      'hole',
      'paragraph',
    ]);
    expectCodeHoleAt(browser, 6);
    expect(countType(browser, 'artifact')).toBe(1);
    expect(countType(browser, 'code')).toBe(1);
    expect(browserProvider.localUpdateCount).toBe(0);

    browser.destroy();
    browserDoc.destroy();
    serverDoc.destroy();
  });
});
