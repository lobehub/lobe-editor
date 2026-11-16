import { $isCodeNode, CodeNode } from '@lexical/code-core';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $nodesOfType,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin } from '../plugin';

const CODE_MARKDOWN = '```ts\nconst answer = 42;\n```';
const FAST_INPUT = 'Fast boundary check';

const setNativeCaret = (text: Text, offset: number, dispatchSelectionChange = true): void => {
  const selection = document.getSelection();
  if (!selection) throw new Error('Native selection unavailable');
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(text, offset);
  range.setEnd(text, offset);
  selection.addRange(range);
  if (dispatchSelectionChange) document.dispatchEvent(new Event('selectionchange'));
};

const readSelection = (lexical: LexicalEditor) =>
  lexical.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) throw new Error('Expected a range selection');
    return {
      key: selection.anchor.key,
      nodeType: selection.anchor.getNode().getType(),
      offset: selection.anchor.offset,
      parentType: selection.anchor.getNode().getParent()?.getType(),
    };
  });

describe('CodeNode Hole boundary input', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;
  let root: HTMLDivElement | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    root?.remove();
    root = undefined;
  });

  it('consumes right-at-end before an immediate native Enter and beforeinput', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, CodeblockPlugin]);
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexical = editor.setRootElement(root);
    editor.setDocument('markdown', CODE_MARKDOWN);
    await moment();
    await moment();

    const keys = lexical.getEditorState().read(() => {
      const code = $nodesOfType(CodeNode)[0];
      const hole = code?.getParent();
      if (!$isCodeNode(code) || !(hole instanceof HoleNode)) {
        throw new Error('Expected the CodeNode to be owned by a Hole');
      }
      const last = code.getLastDescendant();
      const afterCursor = hole.getAfterCursor();
      if (!last || !afterCursor) throw new Error('Code end or Hole after cursor missing');
      return { afterCursorKey: afterCursor.getKey(), lastKey: last.getKey() };
    });

    lexical.update(
      () => {
        // Resolve nodes in the active transaction so the end selection is the
        // same model point a native End key leaves before ArrowRight.
        const codeNode = $nodesOfType(CodeNode)[0];
        const lastNode = codeNode?.getLastDescendant();
        if (!lastNode) throw new Error('Code end node missing');
        lastNode.selectEnd();
      },
      { discrete: true },
    );
    await moment();

    const lastElement = lexical.getElementByKey(keys.lastKey);
    const lastText = lastElement?.firstChild;
    const afterCursorElement = lexical.getElementByKey(keys.afterCursorKey);
    const afterCursorText = afterCursorElement?.firstChild;
    if (!(lastText instanceof Text) || !(afterCursorText instanceof Text)) {
      throw new Error('Native CodeNode or Hole cursor text is missing');
    }
    expect(afterCursorText.data).toBe('\uFEFF');
    setNativeCaret(lastText, lastText.data.length);

    const right = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight',
    });
    root.dispatchEvent(right);
    if (!right.defaultPrevented) {
      // jsdom does not perform native arrow movement. Model the browser moving
      // into the FEFF cursor, deliberately without selectionchange: this is the
      // interval observed in the fast browser trace before the model catches up.
      setNativeCaret(afterCursorText, 0, false);
    }
    root.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowRight' }));

    const boundarySelection = readSelection(lexical);
    expect(right.defaultPrevented).toBe(true);
    expect(boundarySelection.nodeType).toBe('cursor');
    expect(boundarySelection.parentType).toBe('hole');
    expect(boundarySelection.key).toBe(keys.afterCursorKey);
    expect(boundarySelection.offset).toBe(0);
    expect(document.getSelection()?.anchorNode).toBe(afterCursorText);
    expect(document.getSelection()?.anchorOffset).toBe(0);

    // No wait or observation occurs between boundary navigation, Enter, and
    // native beforeinput, matching the fast user input sequence.
    const enter = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
    root.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);

    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: FAST_INPUT,
      inputType: 'insertText',
    });
    root.dispatchEvent(beforeInput);
    if (!beforeInput.defaultPrevented) {
      const native = document.getSelection();
      if (!(native?.anchorNode instanceof Text)) throw new Error('Native text caret missing');
      const text = native.anchorNode;
      const offset = native.anchorOffset;
      text.insertData(offset, FAST_INPUT);
      setNativeCaret(text, offset + FAST_INPUT.length, false);
      root.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: FAST_INPUT, inputType: 'insertText' }),
      );
    }

    await moment();
    await moment();

    lexical.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.map((node) => node.getType())).toEqual(['hole', 'paragraph']);
      expect(children[1]?.getTextContent()).toBe(FAST_INPUT);
      const code = $nodesOfType(CodeNode)[0];
      expect(code?.getTextContent()).toBe('const answer = 42;');
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        expect(selection.anchor.getNode().getParent()?.getType()).toBe('paragraph');
        expect(selection.anchor.offset).toBe(FAST_INPUT.length);
      }
    });
  });
});
