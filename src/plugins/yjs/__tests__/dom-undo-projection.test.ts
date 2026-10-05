import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $nodesOfType,
  $setSelection,
  $isTextNode,
  HISTORIC_TAG,
  HISTORY_PUSH_TAG,
  KEY_ENTER_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from '@/headless/default-plugins';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { $createArtifactNode, ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { HoleNode } from '@/plugins/common/node/hole';
import { ImagePlugin } from '@/plugins/image/plugin';
import { YjsPlugin } from '../plugin';
import { syncCurrentEditorStateToYjs } from '../plugin/utils/sync';
import { IYjsService } from '../service';

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

  constructor(
    private readonly doc: Doc,
    private readonly snapshot: Uint8Array,
  ) {}

  connect(): void {
    applyUpdate(this.doc, this.snapshot, this);
    queueMicrotask(() => {
      this.listeners
        .get('status')
        ?.forEach((listener) => listener({ status: 'connected' } as never));
      this.listeners.get('sync')?.forEach((listener) => listener(true as never));
    });
  }

  disconnect(): void {}

  off(type: 'reload' | 'status' | 'sync' | 'update', listener: unknown): void {
    this.listeners.get(type)?.delete(listener as never);
  }

  on(type: 'reload' | 'status' | 'sync' | 'update', listener: unknown): void {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(listener as never);
    this.listeners.set(type, callbacks);
  }
}

const rootTypes = (editor: ReturnType<typeof Editor.createEditor>): string[] =>
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() =>
      $getRoot()
        .getChildren()
        .map((node) => node.getType()),
    );

const isCodeHoleAt = (editor: ReturnType<typeof Editor.createEditor>, index: number): boolean =>
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const node = $getRoot().getChildAtIndex(index);
      return (
        node instanceof HoleNode &&
        node.getContentChildren().some((child) => child instanceof CodeMirrorNode)
      );
    });

const expectCodeHoleAt = (editor: ReturnType<typeof Editor.createEditor>, index: number): void => {
  expect(isCodeHoleAt(editor, index)).toBe(true);
};

const expectHolePayloadTypes = (
  editor: ReturnType<typeof Editor.createEditor>,
  index: number,
  types: string[],
): void => {
  editor
    .getLexicalEditor()!
    .getEditorState()
    .read(() => {
      const node = $getRoot().getChildAtIndex(index);
      expect(node).toBeInstanceOf(HoleNode);
      if (!(node instanceof HoleNode)) return;
      expect(node.getContentChildren().map((child) => child.getType())).toEqual(types);
    });
};

const DEFAULT_DOM_UNDO_PLUGINS = DEFAULT_HEADLESS_EDITOR_PLUGINS.filter((plugin) => {
  const constructor = Array.isArray(plugin) ? plugin[0] : plugin;
  return constructor !== ImagePlugin;
});

const createSnapshot = async (): Promise<Uint8Array> => {
  const source = Editor.createEditor();
  source.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
  source.initHeadlessEditor();
  source.setDocument('markdown', 'before\n\nafter');
  const sourceEditor = source.getLexicalEditor()!;
  sourceEditor.update(
    () => {
      const first = $getRoot().getFirstChild();
      if (!first) throw new Error('Seed paragraph missing.');
      first.insertAfter($createCodeMirrorNode('rust', 'fn stable() {}'));
    },
    { discrete: true },
  );

  await moment();

  const doc = new Doc();
  const provider = new SnapshotProvider(doc, new Uint8Array());
  const binding = createBinding(sourceEditor, provider, 'dom-undo-projection', doc, new Map());
  syncCurrentEditorStateToYjs(binding, provider);
  const snapshot = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  source.destroy();
  return snapshot;
};

const createArtifactSnapshot = async (): Promise<Uint8Array> => {
  const source = Editor.createEditor();
  source.registerPlugins([...DEFAULT_DOM_UNDO_PLUGINS]);
  source.initHeadlessEditor();
  source.setDocument('markdown', 'before\n\nafter');
  const sourceEditor = source.getLexicalEditor()!;
  sourceEditor.update(
    () => {
      const first = $getRoot().getFirstChild();
      if (!first) throw new Error('Seed paragraph missing.');
      const artifact = $createArtifactNode('<main>stable artifact</main>', 'Stable artifact');
      const code = $createCodeMirrorNode('rust', 'fn stable() {}');
      first.insertAfter(artifact);
      artifact.insertAfter(code);
    },
    { discrete: true },
  );
  await moment();

  const doc = new Doc();
  const provider = new SnapshotProvider(doc, new Uint8Array());
  const binding = createBinding(sourceEditor, provider, 'dom-undo-artifact', doc, new Map());
  syncCurrentEditorStateToYjs(binding, provider);
  const snapshot = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  source.destroy();
  return snapshot;
};

describe('DOM-backed Yjs Undo projection', () => {
  let kernel: ReturnType<typeof Editor.createEditor> | undefined;
  let host: HTMLDivElement | undefined;
  let doc: Doc | undefined;

  afterEach(() => {
    kernel?.destroy();
    host?.remove();
    doc?.destroy();
    kernel = undefined;
    host = undefined;
    doc = undefined;
  });

  it('does not write the stale pre-Undo root back over the live Code block', async () => {
    const snapshot = await createSnapshot();
    doc = new Doc();
    const provider = new SnapshotProvider(doc, snapshot);
    kernel = Editor.createEditor();
    // Mount the host first, then install collaboration. This matches Page's
    // late-ticket ordering: its content-change listener is registered before
    // Yjs, and it exports JSON before checking update tags.
    kernel.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
    host = document.createElement('div');
    host.contentEditable = 'true';
    document.body.append(host);
    const lexical = kernel.setRootElement(host);
    const unregisterExportListener = lexical.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        kernel?.getDocument('json');
      },
    );
    kernel.registerPlugins([
      [
        YjsPlugin,
        {
          id: 'dom-undo-projection',
          providerFactory: () => provider,
          shouldBootstrap: false,
          yjsDoc: doc,
        },
      ],
    ]);
    provider.connect();
    await moment();
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'paragraph']);
    expectCodeHoleAt(kernel, 1);

    lexical.update(
      () => {
        const code = $nodesOfType(CodeMirrorNode)[0];
        if (!code) throw new Error('Seed CodeMirror node missing.');
        const boundary = $createParagraphNode().append($createTextNode('local boundary'));
        code.insertBefore(boundary);
      },
      { discrete: true },
    );
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'paragraph']);
    expectHolePayloadTypes(kernel, 1, ['paragraph', 'code']);

    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'paragraph']);
    expectCodeHoleAt(kernel, 1);

    const state = kernel.requireService(IYjsService)?.getState();
    if (!state) throw new Error('Yjs state missing.');
    const rawTypes = (
      state.binding.root.getSharedType().toDelta() as Array<{ insert?: unknown }>
    ).map((delta) =>
      typeof delta.insert === 'string'
        ? 'text'
        : (delta.insert as { getAttribute?: (key: string) => unknown } | undefined)?.getAttribute?.(
            '__type',
          ),
    );
    expect(rawTypes).toContain('hole');
    expect(
      (state.binding.root._children as Array<{ getType: () => string }>).map((child) =>
        child.getType(),
      ),
    ).toEqual(['paragraph', 'hole', 'paragraph']);

    lexical.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'paragraph']);
    expectCodeHoleAt(kernel, 1);
    unregisterExportListener();
  });

  it('does not commit a pending DOM update while exporting JSON reentrantly', async () => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
    host = document.createElement('div');
    host.contentEditable = 'true';
    document.body.append(host);
    const lexical = kernel.setRootElement(host);
    lexical.update(
      () => {
        $getRoot().append($createParagraphNode().append($createTextNode('seed')));
      },
      { discrete: true },
    );
    await moment();

    const updates: string[][] = [];
    lexical.registerUpdateListener(({ tags }) => {
      updates.push([...tags]);
    });
    lexical.update(() => {
      const first = $getRoot().getFirstChild();
      if (!$isElementNode(first)) throw new Error('Seed paragraph missing.');
      const text = first.getFirstChild();
      if (!$isTextNode(text)) throw new Error('Seed text missing.');
      text.setTextContent('immediate');
    });
    const immediateJson = kernel.getDocument('json') as {
      root?: { children?: Array<{ children?: Array<{ text?: string }> }> };
    };
    expect(immediateJson.root?.children?.[0]?.children?.[0]?.text).toBe('immediate');
    lexical.update(
      () => {
        const first = $getRoot().getFirstChild();
        if (!$isElementNode(first)) throw new Error('Seed paragraph missing.');
        const text = first.getFirstChild();
        if (!$isTextNode(text)) throw new Error('Seed text missing.');
        text.setTextContent('changed');
        const pendingBefore = (lexical as unknown as { _pendingEditorState: unknown })
          ._pendingEditorState;
        const json = kernel?.getDocument('json') as { root?: { children?: unknown[] } } | undefined;
        expect(json?.root?.children).toHaveLength(1);
        expect((lexical as unknown as { _pendingEditorState: unknown })._pendingEditorState).toBe(
          pendingBefore,
        );
      },
      { tag: HISTORIC_TAG, discrete: true },
    );
    await moment();
    expect(updates).toEqual([[HISTORIC_TAG]]);
  });

  it('keeps the following Decorator block after Undo around an Artifact Hole', async () => {
    const snapshot = await createArtifactSnapshot();
    doc = new Doc();
    const provider = new SnapshotProvider(doc, snapshot);
    kernel = Editor.createEditor();
    kernel.on('error', (error) => {
      throw error;
    });
    kernel.registerPlugins([...DEFAULT_DOM_UNDO_PLUGINS]);
    host = document.createElement('div');
    host.contentEditable = 'true';
    document.body.append(host);
    const lexical = kernel.setRootElement(host);
    const updateTags: string[][] = [];
    const unregisterExportListener = lexical.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, tags }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        updateTags.push([...tags]);
        kernel?.getDocument('json');
      },
    );
    kernel.registerPlugins([
      [
        YjsPlugin,
        {
          id: 'dom-undo-artifact',
          providerFactory: () => provider,
          shouldBootstrap: false,
          yjsDoc: doc,
        },
      ],
    ]);
    provider.connect();
    await moment();
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    expectCodeHoleAt(kernel, 2);

    lexical.update(
      () => {
        const code = $nodesOfType(CodeMirrorNode)[0];
        if (!code) throw new Error('CodeMirror block missing.');
        code.setCode('LOCAL_CODE_SAFE');
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    await new Promise((resolve) => setTimeout(resolve, 650));

    lexical.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        const cursor = hole?.getAfterCursor();
        if (!hole || !cursor) throw new Error('Artifact Hole after cursor missing.');
        const selection = $createRangeSelection();
        selection.anchor.set(cursor.getKey(), 0, 'text');
        selection.focus.set(cursor.getKey(), 0, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );
    const enterEvent = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' });
    expect(lexical.dispatchCommand(KEY_ENTER_COMMAND, enterEvent)).toBe(true);
    expect(enterEvent.defaultPrevented).toBe(true);
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'paragraph', 'hole', 'paragraph']);
    expectCodeHoleAt(kernel, 3);

    await new Promise((resolve) => setTimeout(resolve, 650));
    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(rootTypes(kernel)).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    expectCodeHoleAt(kernel, 2);
    expect(updateTags).toContainEqual([HISTORIC_TAG]);
    expect(rootTypes(kernel)).not.toContain('artifact');
    const state = kernel.requireService(IYjsService)?.getState();
    if (!state) throw new Error('Yjs state missing.');
    const rawTypes = (
      state.binding.root.getSharedType().toDelta() as Array<{ insert?: unknown }>
    ).map((delta) =>
      typeof delta.insert === 'string'
        ? 'text'
        : (delta.insert as { getAttribute?: (key: string) => unknown } | undefined)?.getAttribute?.(
            '__type',
          ),
    );
    expect(rawTypes).toContain('hole');
    expect(
      (state.binding.root._children as Array<{ getType: () => string }>).map((child) =>
        child.getType(),
      ),
    ).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    expect(
      (
        kernel.getDocument('json') as unknown as {
          root: { children: Array<{ type: string }> };
        }
      ).root.children.map((child) => child.type),
    ).toEqual(['paragraph', 'artifact', 'code', 'paragraph']);

    lexical.update(
      () => {
        const artifact = $nodesOfType(ArtifactNode)[0];
        if (!artifact) throw new Error('Artifact node missing after Undo.');
        artifact.setTitle('Updated artifact metadata');
      },
      { discrete: true },
    );
    await moment();
    expect(JSON.stringify(kernel.getDocument('json'))).toContain('Updated artifact metadata');
    unregisterExportListener();
  });
});
