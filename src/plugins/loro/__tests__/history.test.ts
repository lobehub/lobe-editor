// @vitest-environment node
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  createEditor,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
  type LexicalEditor,
  ParagraphNode,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { LoroDoc } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import { $setNodeProperties } from '@/plugins/properties';

import { LoroCanonicalDocument, LoroLexicalBinding, registerLoroHistory } from '../index';

const settle = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const waitReady = (binding: LoroLexicalBinding): Promise<void> => {
  if (binding.getReadiness() === 'ready') return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = binding.subscribeReadiness(() => {
      if (binding.getReadiness() !== 'ready') return;
      unsubscribe();
      resolve();
    });
  });
};

const waitForNextUpdate = (editor: LexicalEditor): Promise<void> =>
  new Promise((resolve) => {
    const unsubscribe = editor.registerUpdateListener(() => {
      unsubscribe();
      resolve();
    });
  });

const makeEditor = (): LexicalEditor =>
  createEditor({
    namespace: 'loro-history-test',
    nodes: [ParagraphNode],
    onError: (error) => {
      throw error;
    },
  });

const readRoot = (editor: LexicalEditor): { firstType?: string; text: string } =>
  editor.getEditorState().read(() => ({
    firstType: $getRoot().getFirstChild()?.getType(),
    text: $getRoot().getTextContent(),
  }));

const readRangeOffsets = (editor: LexicalEditor): { anchor: number; focus: number } | null =>
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    return $isRangeSelection(selection)
      ? { anchor: selection.anchor.offset, focus: selection.focus.offset }
      : null;
  });

const setRangeOffsets = (editor: LexicalEditor, anchor: number, focus: number): void => {
  editor.update(() => {
    const paragraph = $getRoot().getFirstChild();
    const text = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
    if (!$isTextNode(text)) return;
    const selection = $createRangeSelection();
    selection.setTextNodeRange(text, anchor, text, focus);
    $setSelection(selection);
  });
};

describe('Loro Lexical history adapter', () => {
  it('consumes empty undo and redo commands and reports empty CAN state', async () => {
    const editor = makeEditor();
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
      shouldBootstrap: false,
    });
    const canUndo: boolean[] = [];
    const canRedo: boolean[] = [];
    const removeCanUndo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (value) => {
        canUndo.push(value);
        return false;
      },
      0,
    );
    const removeCanRedo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (value) => {
        canRedo.push(value);
        return false;
      },
      0,
    );
    const unregister = registerLoroHistory(editor, binding);
    await settle();

    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    expect(canUndo.at(-1)).toBe(false);
    expect(canRedo.at(-1)).toBe(false);

    unregister();
    removeCanUndo();
    removeCanRedo();
    binding.dispose();
  });

  it('normalizes durable identity for an empty paragraph before Loro preflight', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('seed')));
    });
    const canonical = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({ doc: canonical, editor });
    await settle();
    binding.undoManager.clear();

    editor.update(() => {
      $getRoot().append($createParagraphNode());
    });
    await settle();

    expect(binding.getPhase()).toBe('ready');
    expect(canonical.getNodes()).toHaveLength(2);
    expect(canonical.getNodes().every((node) => Boolean(canonical.readNode(node).nodeId))).toBe(
      true,
    );
    binding.dispose();
  });

  it('keeps pre-snapshot editor hydration read-only while projecting an existing canonical doc', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('editor cache')));
    });
    const canonical = new LoroCanonicalDocument(new LoroDoc(), undefined, { initialize: false });
    const server = new LoroCanonicalDocument(new LoroDoc());
    server.commit(
      () => {
        server.createNode({
          flow: 'authoritative server',
          nodeId: 'authoritative-paragraph',
          role: 'element',
          type: 'paragraph',
        });
      },
      { origin: 'loro:server/snapshot' },
    );
    const binding = new LoroLexicalBinding({
      doc: canonical,
      editor,
      shouldBootstrap: false,
    });
    editor.update(() => {
      const paragraph = $getRoot().getFirstChild();
      if ($isElementNode(paragraph)) paragraph.append($createTextNode(' stale cache'));
    });
    await settle();

    expect(canonical.getNodes()).toHaveLength(0);
    binding.applyUpdate(server.exportSnapshot());
    await settle();
    expect(canonical.readNode(canonical.getNodes()[0]).flow?.toString()).toBe(
      'authoritative server',
    );
    expect(readRoot(editor).text).toBe('authoritative server');
    binding.dispose();
  });

  it('keeps the first-snapshot gate closed after an invalid authoritative update', async () => {
    const editor = makeEditor();
    const canonical = new LoroCanonicalDocument(new LoroDoc(), undefined, { initialize: false });
    const binding = new LoroLexicalBinding({ doc: canonical, editor, shouldBootstrap: false });
    const invalid = new LoroCanonicalDocument(new LoroDoc());
    invalid.commit(
      () => {
        invalid.createNode({
          nodeId: 'unsupported-node',
          role: 'element',
          type: 'unsupported',
        });
      },
      { origin: 'loro:invalid' },
    );

    expect(() => binding.applyUpdate(invalid.exportSnapshot())).toThrow(
      'No Loro capability registered',
    );
    expect(canonical.getNodes()).toHaveLength(0);
    expect(binding.getPhase()).toBe('initializing');
    expect(() => binding.runLocalTransaction('loro:test', () => undefined)).toThrow(
      'authoritative initial snapshot',
    );
    binding.dispose();
  });

  it('undoes and redoes separate create and typing commands through Lexical dispatch', async () => {
    const editor = makeEditor();
    const canonical = new LoroCanonicalDocument(new LoroDoc());
    canonical.commit(
      () => {
        canonical.createNode({
          flow: 'seed',
          nodeId: 'history-seed',
          role: 'element',
          type: 'paragraph',
        });
      },
      { origin: 'loro:seed' },
    );
    const initialProjection = waitForNextUpdate(editor);
    const binding = new LoroLexicalBinding({
      doc: canonical,
      editor,
      shouldBootstrap: false,
    });
    const unregister = registerLoroHistory(editor, binding);
    await initialProjection;
    await waitReady(binding);
    binding.undoManager.clear();

    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        $setNodeProperties(paragraph, { nodeId: 'history-paragraph' });
        $getRoot().append(paragraph);
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await settle();
    editor.update(() => {
      const paragraph = $getRoot().getLastChild();
      if ($isElementNode(paragraph)) paragraph.append($createTextNode('hello'));
    });
    await settle();

    const readParagraphTexts = (): string[] =>
      editor.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .map((node) => node.getTextContent()),
      );
    expect(readParagraphTexts()).toEqual(['seed', 'hello']);
    editor.setEditable(false);
    await settle();
    expect(binding.canUndo()).toBe(false);
    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed', 'hello']);
    editor.setEditable(true);
    await settle();
    expect(binding.canUndo()).toBe(true);
    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed', '']);

    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed', 'hello']);

    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed', '']);
    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed']);

    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed', '']);
    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readParagraphTexts()).toEqual(['seed', 'hello']);

    unregister();
    binding.dispose();
  });

  it('restores the local range selection while undoing a text update', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    const unregister = registerLoroHistory(editor, binding);
    await settle();
    binding.undoManager.clear();

    editor.update(() => {
      const paragraph = $getRoot().getFirstChild();
      const text = $isElementNode(paragraph) ? paragraph.getFirstChild() : null;
      if (!$isTextNode(text)) return;
      const selection = $createRangeSelection();
      selection.setTextNodeRange(text, 1, text, 4);
      $setSelection(selection);
    });
    await settle();

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.removeText();
    });
    await settle();

    const selectionBeforeUndo = editor.getEditorState().read(() => $getSelection());
    expect($isRangeSelection(selectionBeforeUndo)).toBe(true);
    if ($isRangeSelection(selectionBeforeUndo)) {
      expect(selectionBeforeUndo.anchor.offset).toBe(1);
      expect(selectionBeforeUndo.focus.offset).toBe(1);
    }
    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(editor).text).toBe('hello');
    const selection = editor.getEditorState().read(() => $getSelection());
    expect($isRangeSelection(selection)).toBe(true);
    if ($isRangeSelection(selection)) {
      expect(selection.anchor.offset).toBe(1);
      expect(selection.focus.offset).toBe(4);
    }

    unregister();
    binding.dispose();
  });

  it('keeps selection metadata per undo item across two undo and redo steps', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('abcdef')));
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    const unregister = registerLoroHistory(editor, binding);
    await settle();
    binding.undoManager.clear();

    setRangeOffsets(editor, 1, 2);
    await settle();
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.removeText();
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await settle();

    setRangeOffsets(editor, 2, 4);
    await settle();
    editor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.removeText();
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await settle();
    expect(readRoot(editor).text).toBe('acf');

    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(editor).text).toBe('acdef');
    expect(readRangeOffsets(editor)).toEqual({ anchor: 2, focus: 4 });

    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(editor).text).toBe('abcdef');
    expect(readRangeOffsets(editor)).toEqual({ anchor: 1, focus: 2 });

    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(editor).text).toBe('acdef');
    expect(readRangeOffsets(editor)).toEqual({ anchor: 1, focus: 1 });
    expect(editor.dispatchCommand(REDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(editor).text).toBe('acf');
    expect(readRangeOffsets(editor)).toEqual({ anchor: 2, focus: 2 });

    unregister();
    binding.dispose();
  });

  it('maps a local undo selection through a remote prefix edit with Loro cursors', async () => {
    const leftEditor = makeEditor();
    leftEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('hello')));
    });
    const leftDoc = new LoroCanonicalDocument(new LoroDoc());
    const leftBinding = new LoroLexicalBinding({ doc: leftDoc, editor: leftEditor });
    const unregisterLeft = registerLoroHistory(leftEditor, leftBinding);
    await settle();
    const snapshot = leftBinding.exportSnapshot();
    const baseVersion = leftDoc.doc.version();

    const rightEditor = makeEditor();
    const rightBinding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot)),
      editor: rightEditor,
      shouldBootstrap: false,
    });
    const unregisterRight = registerLoroHistory(rightEditor, rightBinding);
    await settle();
    leftBinding.undoManager.clear();
    rightBinding.undoManager.clear();

    setRangeOffsets(leftEditor, 2, 4);
    await settle();
    leftEditor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.removeText();
      },
      { tag: HISTORY_PUSH_TAG },
    );
    await settle();
    expect(readRoot(leftEditor).text).toBe('heo');

    setRangeOffsets(rightEditor, 0, 0);
    await settle();
    rightEditor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText('X');
    });
    await settle();
    leftBinding.applyUpdate(
      rightBinding.canonical.doc.export({ mode: 'update', from: baseVersion }),
    );
    await settle();
    expect(readRoot(leftEditor).text).toBe('Xheo');

    expect(leftEditor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(leftEditor).text).toBe('Xhello');
    expect(readRangeOffsets(leftEditor)).toEqual({ anchor: 3, focus: 5 });

    unregisterLeft();
    unregisterRight();
    leftBinding.dispose();
    rightBinding.dispose();
  });

  it('merges consecutive typing and explicit HISTORY_MERGE updates into one undo item', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('abc')));
    });
    const binding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor,
    });
    const unregister = registerLoroHistory(editor, binding);
    await settle();
    binding.undoManager.clear();

    setRangeOffsets(editor, 3, 3);
    await settle();
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText('1');
    });
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText('2');
    });
    await settle();
    expect(readRoot(editor).text).toBe('abc12');
    expect(editor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(editor).text).toBe('abc');

    unregister();
    binding.dispose();

    const mergeEditor = makeEditor();
    mergeEditor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('abc')));
    });
    const mergeBinding = new LoroLexicalBinding({
      doc: new LoroCanonicalDocument(new LoroDoc()),
      editor: mergeEditor,
    });
    const unregisterMerge = registerLoroHistory(mergeEditor, mergeBinding);
    await settle();
    mergeBinding.undoManager.clear();
    setRangeOffsets(mergeEditor, 3, 3);
    await settle();
    mergeEditor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText('x');
      },
      { tag: HISTORY_MERGE_TAG },
    );
    mergeEditor.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText('y');
      },
      { tag: HISTORY_MERGE_TAG },
    );
    await settle();
    expect(readRoot(mergeEditor).text).toBe('abcxy');
    expect(mergeEditor.dispatchCommand(UNDO_COMMAND, undefined)).toBe(true);
    await settle();
    expect(readRoot(mergeEditor).text).toBe('abc');

    unregisterMerge();
    mergeBinding.dispose();
  });

  it('keeps the selection legal when reconnect reapplies a base snapshot and local update', async () => {
    const editor = makeEditor();
    editor.update(() => {
      $getRoot().append($createParagraphNode().append($createTextNode('x'.repeat(75))));
    });
    const canonical = new LoroCanonicalDocument(new LoroDoc());
    const binding = new LoroLexicalBinding({ doc: canonical, editor });
    const unregister = registerLoroHistory(editor, binding);
    let invalidSelection = false;
    const unregisterSelectionGuard = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        for (const point of [selection.anchor, selection.focus]) {
          const node = point.getNode();
          if ($isTextNode(node) && point.offset > node.getTextContentSize()) {
            invalidSelection = true;
          }
        }
      });
    });
    await settle();
    binding.undoManager.clear();
    const baseSnapshot = binding.exportSnapshot();
    const baseVersion = canonical.doc.version();

    setRangeOffsets(editor, 75, 75);
    await settle();
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText(' RECONNECT-FINAL-OK');
    });
    await settle();
    const localUpdate = canonical.doc.export({ mode: 'update', from: baseVersion });

    const serverSnapshot = LoroDoc.fromSnapshot(baseSnapshot).export({ mode: 'snapshot' });
    binding.applyUpdate(serverSnapshot);
    await settle();
    binding.applyUpdate(localUpdate);
    await settle();

    expect(() => editor.dispatchCommand(UNDO_COMMAND, undefined)).not.toThrow();
    await settle();
    expect(readRangeOffsets(editor)).toEqual({ anchor: 75, focus: 75 });
    expect(invalidSelection).toBe(false);
    unregisterSelectionGuard();
    unregister();
    binding.dispose();
  });
});
