// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { type Provider, type ProviderAwareness, type UserState, createBinding } from '@lexical/yjs';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { DEFAULT_HEADLESS_EDITOR_PLUGINS, HeadlessEditor } from '@/headless';
import { $getRoot } from 'lexical';
import {
  hydrateLexicalFromYjsState,
  syncCurrentEditorStateToYjs,
} from '@/plugins/yjs/plugin/utils/sync';
import { PropertiesPlugin } from '../plugin';

import { $ensureNodeIdsInTree, $getNodeId } from '../utils';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

class SilentAwareness implements ProviderAwareness {
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
    awareness: new SilentAwareness(),
    connect: () => undefined,
    disconnect: () => undefined,
    off: () => undefined,
    on: () => undefined,
  }) as Provider;

const getPluginConstructor = (plugin: (typeof DEFAULT_HEADLESS_EDITOR_PLUGINS)[number]) =>
  Array.isArray(plugin) ? plugin[0] : plugin;

const LEGACY_PLUGINS = DEFAULT_HEADLESS_EDITOR_PLUGINS.filter(
  (plugin) => getPluginConstructor(plugin) !== PropertiesPlugin,
);

const legacyDocument = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'first',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'second',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

describe('durable node identity migration', () => {
  const editors: HeadlessEditor[] = [];

  afterEach(() => {
    while (editors.length > 0) editors.pop()?.destroy();
  });

  it('converges on deterministic IDs when legacy clients migrate concurrently', async () => {
    const first = new HeadlessEditor();
    const second = new HeadlessEditor();
    editors.push(first, second);
    first.hydrateEditorData(structuredClone(legacyDocument) as any);
    second.hydrateEditorData(structuredClone(legacyDocument) as any);
    await flush();

    const readIds = (editor: HeadlessEditor) =>
      editor.kernel
        .getLexicalEditor()!
        .getEditorState()
        .read(() =>
          $getRoot()
            .getChildren()
            .map((node) => $getNodeId(node)),
        );
    expect(readIds(first)).toEqual(readIds(second));
    expect(new Set(readIds(first)).size).toBe(2);
  });

  it('keeps the first duplicate and deterministically reassigns later duplicates', async () => {
    const editor = new HeadlessEditor();
    editors.push(editor);
    editor.hydrateEditorData(structuredClone(legacyDocument) as any);
    await flush();

    const duplicateDocument = structuredClone(legacyDocument) as any;
    duplicateDocument.root.children[0].$ = { properties: { nodeId: 'duplicate-id' } };
    duplicateDocument.root.children[1].$ = { properties: { nodeId: 'duplicate-id' } };
    editor.hydrateEditorData(duplicateDocument as any);
    await flush();
    const ids = editor.kernel
      .getLexicalEditor()!
      .getEditorState()
      .read(() =>
        $getRoot()
          .getChildren()
          .map((node) => $getNodeId(node)),
      );
    expect(ids[0]).toBe('duplicate-id');
    expect(ids[1]).toBeTruthy();
    expect(ids[1]).not.toBe(ids[0]);
  });

  it('converges when two Yjs clients migrate the same legacy update concurrently', async () => {
    const legacySource = new HeadlessEditor({ plugins: LEGACY_PLUGINS });
    editors.push(legacySource);
    legacySource.hydrateMarkdown('Legacy first\n\nLegacy second');
    await flush();

    const legacyDoc = new Doc();
    const legacyProvider = createProvider();
    const legacyEditor = legacySource.kernel.getLexicalEditor()!;
    const legacyBinding = createBinding(
      legacyEditor,
      legacyProvider,
      'legacy-room',
      legacyDoc,
      new Map([['legacy-room', legacyDoc]]),
    );
    syncCurrentEditorStateToYjs(legacyBinding, legacyProvider);
    const legacyUpdate = encodeStateAsUpdate(legacyDoc);
    legacyBinding.root.destroy(legacyBinding);

    const clients = [new HeadlessEditor(), new HeadlessEditor()];
    editors.push(...clients);
    const clientDocs = [new Doc(), new Doc()];
    const bindings = clients.map((client, index) => {
      applyUpdate(clientDocs[index], legacyUpdate);
      const provider = createProvider();
      const editor = client.kernel.getLexicalEditor()!;
      const binding = createBinding(
        editor,
        provider,
        'legacy-room',
        clientDocs[index],
        new Map([['legacy-room', clientDocs[index]]]),
      );
      hydrateLexicalFromYjsState(binding);
      return { binding, editor, provider };
    });
    await flush();

    for (const { editor } of bindings) {
      editor.update(() => {
        $ensureNodeIdsInTree();
      });
    }
    await flush();

    const readIds = (editor: (typeof bindings)[number]['editor']) =>
      editor.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .map((node) => $getNodeId(node)),
      );
    expect(readIds(bindings[0].editor)).toEqual(readIds(bindings[1].editor));
    expect(new Set(readIds(bindings[0].editor)).size).toBe(2);

    bindings.forEach(({ binding }) => binding.root.destroy(binding));
    clientDocs.forEach((doc) => doc.destroy());
    legacyDoc.destroy();
  });
});
