import {
  $copyNode,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getState,
  $isElementNode,
  $isTextNode,
  $setState,
  HISTORY_PUSH_TAG,
  type LexicalNode,
  REDO_COMMAND,
  resetRandomKey,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { $getNodeId, $setNodeId, nodePropertiesState } from '@/plugins/common/node/node-id';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

type SerializedRecord = {
  $?: { properties?: Record<string, unknown> };
  children?: SerializedRecord[];
  id?: number | string;
  text?: string;
  type?: string;
  [key: string]: unknown;
};

type LegacyEditorData = {
  keepId: boolean;
  root: SerializedRecord;
};

type LexicalIdentity = {
  key: string;
  nodeId: string | undefined;
};

const editors: IEditor[] = [];

function createEditor(): IEditor {
  const editor = Editor.createEditor();
  editor.registerPlugins([CommonPlugin, MarkdownPlugin, LitexmlPlugin]);
  editor.initNodeEditor();
  editors.push(editor);
  return editor;
}

function createLegacyEditorData(keepId: boolean): LegacyEditorData {
  const textNode = (
    text: string,
    id: string | number,
    state?: Record<string, unknown>,
  ): SerializedRecord => ({
    ...(state ? { $: { properties: state } } : {}),
    detail: 0,
    format: 0,
    id,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  });

  return {
    keepId,
    root: {
      children: [
        {
          children: [textNode('legacy text', 'opaque-text-id')],
          direction: 'ltr',
          format: '',
          id: 'opaque-paragraph-id',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
        {
          children: [
            textNode('state text', 43, {
              nodeId: 'state-text-id',
              metadata: { source: 'legacy-fixture', value: 'must survive' },
            }),
          ],
          direction: 'ltr',
          format: '',
          id: 42,
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
}

function serializedRoot(editor: IEditor): SerializedRecord {
  return (editor.getDocument('json') as unknown as { root: SerializedRecord }).root;
}

function findSerializedNode(
  node: SerializedRecord,
  predicate: (candidate: SerializedRecord) => boolean,
): SerializedRecord | undefined {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findSerializedNode(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function findSerializedText(root: SerializedRecord, text: string): SerializedRecord {
  const node = findSerializedNode(root, (candidate) => candidate.text === text);
  if (!node) throw new Error(`Could not find serialized text ${JSON.stringify(text)}`);
  return node;
}

function serializedNodeId(node: SerializedRecord): string | undefined {
  const nodeId = node.$?.properties?.nodeId;
  return typeof nodeId === 'string' ? nodeId : undefined;
}

function allSerializedNodes(root: SerializedRecord): SerializedRecord[] {
  return [root, ...(root.children ?? []).flatMap(allSerializedNodes)];
}

function allSerializedNodeIds(root: SerializedRecord): string[] {
  return allSerializedNodes(root)
    .map(serializedNodeId)
    .filter((nodeId): nodeId is string => Boolean(nodeId));
}

function findLexicalNode(
  node: LexicalNode,
  predicate: (candidate: LexicalNode) => boolean,
): LexicalNode | null {
  if (predicate(node)) return node;
  if (!$isElementNode(node)) return null;
  for (const child of node.getChildren()) {
    const found = findLexicalNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function lexicalTextIdentity(editor: IEditor, text: string): LexicalIdentity {
  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Expected the editor to be initialized.');

  return lexicalEditor.getEditorState().read(() => {
    const node = findLexicalNode(
      $getRoot(),
      (candidate) => $isTextNode(candidate) && candidate.getTextContent() === text,
    );
    if (!$isTextNode(node)) throw new Error(`Could not find text node ${JSON.stringify(text)}`);
    return { key: node.getKey(), nodeId: $getNodeId(node) };
  });
}

function lexicalParagraphIdentity(editor: IEditor, text: string): LexicalIdentity {
  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) throw new Error('Expected the editor to be initialized.');

  return lexicalEditor.getEditorState().read(() => {
    const node = findLexicalNode(
      $getRoot(),
      (candidate) => candidate.getType() === 'paragraph' && candidate.getTextContent() === text,
    );
    if (!node) throw new Error(`Could not find paragraph ${JSON.stringify(text)}`);
    return { key: node.getKey(), nodeId: $getNodeId(node) };
  });
}

function legacyEditorData(data: LegacyEditorData): Parameters<IEditor['setDocument']>[1] {
  return data as unknown as Parameters<IEditor['setDocument']>[1];
}

describe('CommonPlugin node identities', () => {
  beforeEach(() => {
    resetRandomKey();
  });

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  it('keeps the public node ID separate from the runtime Lexical key', () => {
    const editor = createEditor();
    editor.setDocument('markdown', 'Stable text');

    const identity = lexicalTextIdentity(editor, 'Stable text');
    const serializedText = findSerializedText(serializedRoot(editor), 'Stable text');

    expect(identity.nodeId).toBeTruthy();
    expect(identity.nodeId).not.toBe(identity.key);
    expect(serializedNodeId(serializedText)).toBe(identity.nodeId);
    expect(serializedText.id).toBe(identity.nodeId);
    expect(serializedText.id).not.toBe(identity.key);
  });

  it('preserves existing NodeState IDs and unrelated state when keepId is true', () => {
    const editor = createEditor();
    const input = createLegacyEditorData(false);
    const inputBefore = structuredClone(input);

    // Explicit options take precedence over the embedded keepId flag.
    editor.setDocument('json', legacyEditorData(input), { keepId: true });

    const root = serializedRoot(editor);
    const stateText = findSerializedText(root, 'state text');

    expect(serializedNodeId(stateText)).toBe('state-text-id');
    expect(stateText.$?.properties?.metadata).toEqual({
      source: 'legacy-fixture',
      value: 'must survive',
    });
    expect(editor.getDocument('litexml')).toContain('id="state-text-id"');
    expect(input).toEqual(inputBefore);
  });

  it('keeps live NodeState isolated from exported JSON mutations until explicit import', () => {
    const editor = createEditor();
    editor.setDocument('markdown', 'Snapshot target');
    const original = lexicalTextIdentity(editor, 'Snapshot target');
    const lexicalEditor = editor.getLexicalEditor()!;

    lexicalEditor.update(
      () => {
        const text = $getNodeByKey(original.key);
        if (!$isTextNode(text)) throw new Error('Expected the identity-bearing text node.');
        $setState(text, nodePropertiesState, (properties) => ({
          ...properties,
          metadata: { nested: { value: 'live metadata' } },
        }));
      },
      { discrete: true },
    );

    const exported = editor.getDocument('json') as unknown as { root: SerializedRecord };
    const exportedText = findSerializedText(exported.root, 'Snapshot target');
    const exportedProperties = exportedText.$?.properties;
    if (!exportedProperties) throw new Error('Expected serialized NodeState properties.');
    exportedProperties.nodeId = 'mutated-public-id';
    const exportedMetadata = exportedProperties.metadata;
    if (!exportedMetadata || typeof exportedMetadata !== 'object') {
      throw new Error('Expected nested serialized metadata.');
    }
    (exportedMetadata as { nested: { value: string } }).nested.value = 'mutated metadata';

    expect(lexicalTextIdentity(editor, 'Snapshot target').nodeId).toBe(original.nodeId);
    const liveProperties = lexicalEditor.getEditorState().read(() => {
      const text = findLexicalNode(
        $getRoot(),
        (candidate) => $isTextNode(candidate) && candidate.getTextContent() === 'Snapshot target',
      );
      if (!$isTextNode(text)) throw new Error('Could not find the live identity-bearing text.');
      return $getState(text, nodePropertiesState);
    });
    expect(liveProperties).toMatchObject({
      metadata: { nested: { value: 'live metadata' } },
      nodeId: original.nodeId,
    });

    const reexportedText = findSerializedText(serializedRoot(editor), 'Snapshot target');
    expect(serializedNodeId(reexportedText)).toBe(original.nodeId);
    expect(reexportedText.$?.properties?.metadata).toEqual({
      nested: { value: 'live metadata' },
    });

    editor.setDocument('json', exported, { keepId: true });
    expect(lexicalTextIdentity(editor, 'Snapshot target').nodeId).toBe('mutated-public-id');
    const importedProperties = editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const text = findLexicalNode(
          $getRoot(),
          (candidate) => $isTextNode(candidate) && candidate.getTextContent() === 'Snapshot target',
        );
        if (!$isTextNode(text))
          throw new Error('Could not find the imported identity-bearing text.');
        return $getState(text, nodePropertiesState);
      });
    expect(importedProperties.metadata).toEqual({ nested: { value: 'mutated metadata' } });
  });

  it('preserves opaque string and numeric IDs from legacy JSON.id when keepId is true', () => {
    const editor = createEditor();
    const input = createLegacyEditorData(false);
    const inputBefore = structuredClone(input);

    editor.setDocument('json', legacyEditorData(input), { keepId: true });

    const root = serializedRoot(editor);
    const legacyParagraph = root.children?.[0];
    const numericParagraph = root.children?.[1];
    const legacyText = findSerializedText(root, 'legacy text');

    expect(legacyParagraph && serializedNodeId(legacyParagraph)).toBe('opaque-paragraph-id');
    expect(serializedNodeId(legacyText)).toBe('opaque-text-id');
    expect(numericParagraph && serializedNodeId(numericParagraph)).toBe('42');
    expect(editor.getDocument('litexml')).toContain('id="opaque-paragraph-id"');
    expect(editor.getDocument('litexml')).toContain('id="42"');
    expect(input).toEqual(inputBefore);
  });

  it('lets explicit keepId false replace embedded IDs without mutating the input data', () => {
    const editor = createEditor();
    const input = createLegacyEditorData(true);
    const inputBefore = structuredClone(input);

    editor.setDocument('json', legacyEditorData(input), { keepId: false });

    const root = serializedRoot(editor);
    const ids = allSerializedNodeIds(root);
    const stateText = findSerializedText(root, 'state text');
    const legacyIds = new Set([
      'opaque-paragraph-id',
      'opaque-text-id',
      '42',
      '43',
      'state-text-id',
    ]);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((nodeId) => !legacyIds.has(nodeId))).toBe(true);
    expect(stateText.$?.properties?.metadata).toEqual({
      source: 'legacy-fixture',
      value: 'must survive',
    });
    expect(input).toEqual(inputBefore);
  });

  it('assigns unique IDs to new and split text nodes before the next export', () => {
    const editor = createEditor();
    editor.setDocument('markdown', 'abcd');
    const original = lexicalTextIdentity(editor, 'abcd');
    const lexicalEditor = editor.getLexicalEditor()!;

    lexicalEditor.update(
      () => {
        const originalNode = $getNodeByKey(original.key);
        if (!$isTextNode(originalNode)) throw new Error('Expected the original text node.');
        const [, splitNode] = originalNode.splitText(2);
        splitNode.setFormat('bold');

        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('fresh text'));
        $getRoot().append(paragraph);
      },
      { discrete: true },
    );

    // Export immediately after the update to prove the RootNode transform has run.
    const root = serializedRoot(editor);
    const firstSplit = findSerializedText(root, 'ab');
    const secondSplit = findSerializedText(root, 'cd');
    const freshText = findSerializedText(root, 'fresh text');
    const textIds = [
      serializedNodeId(firstSplit),
      serializedNodeId(secondSplit),
      serializedNodeId(freshText),
    ];

    expect(textIds.every((nodeId) => typeof nodeId === 'string' && nodeId.length > 0)).toBe(true);
    expect(new Set(textIds).size).toBe(textIds.length);
    expect(allSerializedNodeIds(root).length).toBe(new Set(allSerializedNodeIds(root)).size);
    expect(lexicalTextIdentity(editor, 'ab').nodeId).toBe(original.nodeId);
  });

  it('keeps the original ID when a programmatic copy is inserted before its source', () => {
    const editor = createEditor();
    editor.setDocument('markdown', 'Original block');
    const original = lexicalParagraphIdentity(editor, 'Original block');
    const lexicalEditor = editor.getLexicalEditor()!;

    lexicalEditor.update(() => {
      const originalNode = $getNodeByKey(original.key);
      if (!$isElementNode(originalNode)) throw new Error('Expected the original paragraph.');
      originalNode.insertBefore($copyNode(originalNode));
    });

    const root = serializedRoot(editor);
    const [copy, source] = root.children ?? [];

    expect(copy).toBeTruthy();
    expect(source).toBeTruthy();
    expect(serializedNodeId(source!)).toBe(original.nodeId);
    expect(serializedNodeId(copy!)).toBeTruthy();
    expect(serializedNodeId(copy!)).not.toBe(original.nodeId);
    expect(new Set(allSerializedNodeIds(root)).size).toBe(allSerializedNodeIds(root).length);
  });

  it('clears copied IDs on the clipboard command before inserting the pasted tree', () => {
    const editor = createEditor();
    editor.setDocument('markdown', 'Clipboard text');
    const originalParagraph = lexicalParagraphIdentity(editor, 'Clipboard text');
    const originalText = lexicalTextIdentity(editor, 'Clipboard text');
    const lexicalEditor = editor.getLexicalEditor()!;
    let idsBeforeInsertion: Array<string | undefined> = [];

    lexicalEditor.update(() => {
      const sourceParagraph = $getNodeByKey(originalParagraph.key);
      const sourceText = $getNodeByKey(originalText.key);
      if (!$isElementNode(sourceParagraph) || !$isTextNode(sourceText)) {
        throw new Error('Expected the clipboard source nodes.');
      }

      const copiedParagraph = $copyNode(sourceParagraph);
      const copiedText = $copyNode(sourceText);
      // Clipboard payloads can carry a serialized copy of the source IDs.
      if (originalParagraph.nodeId) $setNodeId(copiedParagraph, originalParagraph.nodeId);
      if (originalText.nodeId) $setNodeId(copiedText, originalText.nodeId);
      copiedParagraph.append(copiedText);

      lexicalEditor.dispatchCommand(SELECTION_INSERT_CLIPBOARD_NODES_COMMAND, {
        nodes: [copiedParagraph],
        selection: $createRangeSelection(),
      });
      idsBeforeInsertion = [$getNodeId(copiedParagraph), $getNodeId(copiedText)];
      sourceParagraph.insertBefore(copiedParagraph);
    });

    const root = serializedRoot(editor);
    const [copy, source] = root.children ?? [];
    const copiedText = copy?.children?.[0];
    const sourceText = source?.children?.[0];

    expect(idsBeforeInsertion).toEqual([undefined, undefined]);
    expect(serializedNodeId(source!)).toBe(originalParagraph.nodeId);
    expect(serializedNodeId(sourceText!)).toBe(originalText.nodeId);
    expect(serializedNodeId(copy!)).toBeTruthy();
    expect(serializedNodeId(copy!)).not.toBe(originalParagraph.nodeId);
    expect(serializedNodeId(copiedText!)).toBeTruthy();
    expect(serializedNodeId(copiedText!)).not.toBe(originalText.nodeId);
    expect(new Set(allSerializedNodeIds(root)).size).toBe(allSerializedNodeIds(root).length);
  });

  it('preserves the same node ID through undo and redo', async () => {
    const editor = createEditor();
    editor.setDocument('markdown', 'Before edit');
    const original = lexicalTextIdentity(editor, 'Before edit');
    const lexicalEditor = editor.getLexicalEditor()!;

    lexicalEditor.update(
      () => {
        const text = $getNodeByKey(original.key);
        if (!$isTextNode(text)) throw new Error('Expected the source text node.');
        text.setTextContent('History baseline');
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await moment();
    expect(lexicalTextIdentity(editor, 'History baseline').nodeId).toBe(original.nodeId);

    lexicalEditor.update(
      () => {
        const text = $getNodeByKey(original.key);
        if (!$isTextNode(text)) throw new Error('Expected the source text node.');
        text.setTextContent('After edit');
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await moment();
    expect(lexicalTextIdentity(editor, 'After edit').nodeId).toBe(original.nodeId);

    lexicalEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    expect(lexicalTextIdentity(editor, 'History baseline').nodeId).toBe(original.nodeId);

    lexicalEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    expect(lexicalTextIdentity(editor, 'After edit').nodeId).toBe(original.nodeId);
  });

  it('keeps editor-scoped IDs independent from reset Lexical keys across editors', () => {
    resetRandomKey();
    const firstEditor = createEditor();
    firstEditor.setDocument('markdown', 'Same content');
    const first = lexicalTextIdentity(firstEditor, 'Same content');

    resetRandomKey();
    const secondEditor = createEditor();
    secondEditor.setDocument('markdown', 'Same content');
    const second = lexicalTextIdentity(secondEditor, 'Same content');

    expect(second.key).toBe(first.key);
    expect(first.nodeId).toBeTruthy();
    expect(second.nodeId).toBeTruthy();
    expect(second.nodeId).not.toBe(first.nodeId);
  });
});
