import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
  UNDO_COMMAND,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import { registerHistoryMemoryLimit } from '../history-memory';

function setup(options: { maxRetainedNodes: number; minUndoSteps: number }) {
  const editor = createEditor({
    nodes: [HeadingNode, QuoteNode],
    onError: (error) => {
      throw error;
    },
  });
  const historyState = createEmptyHistoryState();
  registerRichText(editor);
  registerHistory(editor, historyState, 0);
  registerHistoryMemoryLimit(editor, historyState, options);
  return { editor, historyState };
}

const appendLines = (editor: LexicalEditor, count: number) => {
  for (let index = 0; index < count; index++) {
    editor.update(
      () => {
        $getRoot().append($createParagraphNode().append($createTextNode(`Line ${index}`)));
      },
      { discrete: true },
    );
  }
};

const readText = (editor: LexicalEditor) =>
  editor.getEditorState().read(() => $getRoot().getTextContent());

describe('registerHistoryMemoryLimit', () => {
  it('keeps every step while the stack fits the budget', () => {
    const { editor, historyState } = setup({ maxRetainedNodes: 1_000_000, minUndoSteps: 5 });
    appendLines(editor, 40);

    expect(historyState.undoStack).toHaveLength(39);
  });

  it('drops the oldest steps once the stack would retain too many nodes', async () => {
    // 60 lines -> ~121 nodes, so a 1,000 node budget keeps 8 steps.
    const { editor, historyState } = setup({ maxRetainedNodes: 1000, minUndoSteps: 5 });
    appendLines(editor, 60);

    expect(historyState.undoStack).toHaveLength(8);

    const before = readText(editor);
    editor.dispatchCommand(UNDO_COMMAND, undefined);
    await Promise.resolve();
    expect(readText(editor)).not.toBe(before);
    expect(readText(editor)).toContain('Line 58');
    expect(readText(editor)).not.toContain('Line 59');
  });

  it('always keeps the minimum undo depth', () => {
    const { editor, historyState } = setup({ maxRetainedNodes: 10, minUndoSteps: 5 });
    appendLines(editor, 30);

    expect(historyState.undoStack).toHaveLength(5);
  });
});
