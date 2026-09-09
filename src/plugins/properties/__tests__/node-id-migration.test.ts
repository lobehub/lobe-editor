// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { $createCodeNode, CodeNode as LexicalCodeNode } from '@lexical/code-core';
import {
  $createTableNodeWithDimensions,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { type Provider, type ProviderAwareness, type UserState, createBinding } from '@lexical/yjs';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { DEFAULT_HEADLESS_EDITOR_PLUGINS, HeadlessEditor } from '@/headless';
import { $getLogicalChildren } from '@/plugins/common/node/logical-children';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $nodesOfType,
  createEditor,
  ParagraphNode,
  type LexicalNode,
} from 'lexical';
import { $createHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { CursorNode } from '@/plugins/common/node/cursor';
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

  it('uses the same deterministic paths for wrapped and unwrapped multi-payload content', async () => {
    const migrate = async (wrapped: boolean) => {
      const editor = new HeadlessEditor({ plugins: LEGACY_PLUGINS });
      editors.push(editor);
      const lexical = editor.kernel.getLexicalEditor()!;

      lexical.update(() => {
        const first = $createParagraphNode().append($createTextNode('first'));
        const second = $createParagraphNode().append($createTextNode('second'));
        const trailing = $createParagraphNode().append($createTextNode('trailing'));
        $getRoot()
          .clear()
          .append(
            wrapped ? $createHoleNode([first, second]) : first,
            ...(wrapped ? [trailing] : [second, trailing]),
          );
      });
      await flush();

      lexical.update(() => {
        $ensureNodeIdsInTree($getRoot(), { pathPrefix: [7, 11] });
      });
      await flush();

      return lexical.getEditorState().read(() => {
        const paragraphs = new Map<string, string | undefined>();
        const visit = (node: LexicalNode): void => {
          if (node.getType() === 'paragraph')
            paragraphs.set(node.getTextContent(), $getNodeId(node));
          if ($isElementNode(node)) {
            node.getChildren().forEach(visit);
          }
        };
        visit($getRoot());
        const hole = $getRoot().getFirstChild();
        return {
          ids: [...paragraphs.entries()],
          logicalHoleChildren: hole
            ? $getLogicalChildren(hole).map((node) => node.getTextContent())
            : [],
        };
      });
    };

    const wrapped = await migrate(true);
    const unwrapped = await migrate(false);

    expect(wrapped.logicalHoleChildren).toEqual(['first', 'second']);
    expect(wrapped.ids).toEqual(unwrapped.ids);
    expect(wrapped.ids.every(([, nodeId]) => Boolean(nodeId))).toBe(true);
    expect(new Set(wrapped.ids.map(([, nodeId]) => nodeId)).size).toBe(3);
  });

  it('converges code and table IDs when Hole wrapping happens before or after migration', () => {
    const migrate = (wrapBeforeMigration: boolean) => {
      const lexical = createEditor({
        nodes: [LexicalCodeNode, TableNode, TableRowNode, TableCellNode, HoleNode, CursorNode],
      });

      let code!: LexicalCodeNode;
      let table!: TableNode;
      lexical.update(
        () => {
          code = $createCodeNode('javascript').append($createTextNode('const ready = true;'));
          table = $createTableNodeWithDimensions(1, 1, false);
          const row = table.getFirstChildOrThrow() as TableRowNode;
          const cell = row.getFirstChildOrThrow() as TableCellNode;
          (cell.getFirstChildOrThrow() as ParagraphNode).append($createTextNode('cell'));
          $getRoot().append(code, table);
          if (wrapBeforeMigration) {
            $getRoot()
              .clear()
              .append($createHoleNode([code]), $createHoleNode([table]));
          }
          $ensureNodeIdsInTree($getRoot());
        },
        { discrete: true },
      );

      if (!wrapBeforeMigration) {
        lexical.update(
          () => {
            $getRoot()
              .clear()
              .append($createHoleNode([code]), $createHoleNode([table]));
          },
          { discrete: true },
        );
      }

      const readIds = () =>
        lexical
          .getEditorState()
          .read(() => [
            ...$nodesOfType(LexicalCodeNode).map((node) => $getNodeId(node)),
            ...$nodesOfType(TableNode).map((node) => $getNodeId(node)),
            ...$nodesOfType(TableCellNode).map((node) => $getNodeId(node)),
            ...$nodesOfType(ParagraphNode).map((node) => $getNodeId(node)),
          ]);
      const ids = readIds();
      lexical.update(
        () => {
          $ensureNodeIdsInTree($getRoot());
        },
        { discrete: true },
      );
      expect(ids).toHaveLength(4);
      expect(ids.every((id): id is string => Boolean(id))).toBe(true);
      expect(readIds()).toEqual(ids);
      return ids;
    };

    expect(migrate(true)).toEqual(migrate(false));
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

  it('keeps an existing block ID when a new block is inserted at its old path', async () => {
    const editor = new HeadlessEditor();
    editors.push(editor);
    editor.hydrateMarkdown('Original block');
    await flush();

    const lexical = editor.kernel.getLexicalEditor()!;
    lexical.update(() => {
      const original = $getRoot().getFirstChildOrThrow();
      original.insertBefore($createParagraphNode().append($createTextNode('Inserted block')));
    });
    await flush();

    const firstInsertedId = lexical
      .getEditorState()
      .read(() => $getNodeId($getRoot().getFirstChildOrThrow()));
    const originalId = lexical
      .getEditorState()
      .read(() => $getNodeId($getRoot().getLastChildOrThrow()));

    lexical.update(() => {
      const firstInserted = $getRoot().getFirstChildOrThrow();
      firstInserted.insertBefore($createParagraphNode().append($createTextNode('Inserted again')));
    });
    await flush();

    const ids = lexical.getEditorState().read(() =>
      $getRoot()
        .getChildren()
        .map((node) => $getNodeId(node)),
    );
    expect(ids).toHaveLength(3);
    expect(ids[1]).toBe(firstInsertedId);
    expect(ids[2]).toBe(originalId);
    expect(ids.every((id): id is string => Boolean(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
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
