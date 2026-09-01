import { createBinding, type Provider, syncLexicalUpdateToYjs } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { Doc } from 'yjs';
import { describe, expect, it } from 'vitest';

import { Kernel } from '@/editor-kernel/kernel';
import { CommonPlugin } from '@/plugins/common';

import { registerYjsHistory } from './history';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const createProvider = (): Provider => ({
  awareness: {
    getLocalState: () => null,
    getStates: () => new Map(),
    off: () => undefined,
    on: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  },
  connect: () => undefined,
  disconnect: () => undefined,
  off: () => undefined,
  on: () => undefined,
});

const createEditor = () => {
  const kernel = new Kernel();
  kernel.registerPlugins([CommonPlugin]);
  kernel.initHeadlessEditor();
  return kernel;
};

describe('registerYjsHistory', () => {
  it('handles a Yjs stack item and restores it with undo/redo', async () => {
    const kernel = createEditor();
    const editor = kernel.getLexicalEditor()!;
    const provider = createProvider();
    const doc = new Doc();
    const binding = createBinding(editor, provider, 'history', doc, new Map());
    const unregisterHistory = registerYjsHistory(editor, binding);
    const unregisterSync = editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, editorState, normalizedNodes, prevEditorState, tags }) => {
        syncLexicalUpdateToYjs(
          binding,
          provider,
          prevEditorState,
          editorState,
          dirtyElements,
          dirtyLeaves,
          normalizedNodes,
          tags,
        );
      },
    );

    editor.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('shared'));
      $getRoot().append(paragraph);
    });
    await flush();

    expect(binding.root.getSharedType().toString()).toContain('shared');

    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expect(binding.root.getSharedType().toString()).not.toContain('shared');

    editor.dispatchCommand(REDO_COMMAND, undefined);
    await flush();
    expect(binding.root.getSharedType().toString()).toContain('shared');

    unregisterSync();
    unregisterHistory();
    kernel.destroy();
    doc.destroy();
  });

  it('falls through to Lexical history when the Yjs stack is empty', async () => {
    const kernel = createEditor();
    const editor = kernel.getLexicalEditor()!;
    const provider = createProvider();
    const doc = new Doc();
    const binding = createBinding(editor, provider, 'history-fallback', doc, new Map());
    const unregisterHistory = registerYjsHistory(editor, binding);

    editor.update(() => {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode('local'));
      $getRoot().append(paragraph);
    });
    await flush();
    editor.update(() => {
      $getRoot().getAllTextNodes()[0]?.setTextContent('local edited');
    });
    await flush();
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('local edited');
    expect(kernel.getHistoryState().undoStack.length).toBeGreaterThan(0);

    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('local');

    unregisterHistory();
    kernel.destroy();
    doc.destroy();
  });
});
