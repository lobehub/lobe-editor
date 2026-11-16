import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $nodesOfType,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown';

import { CodeblockPlugin } from '../plugin';

const CODE_MARKDOWN = ['before', '', '```ts', 'const answer = 42;', '```', '', 'after'].join('\n');

const selectHoleBoundary = async (
  lexical: LexicalEditor,
  side: 'before' | 'after',
): Promise<void> => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
      if (!hole || !cursor) throw new Error('Code Hole boundary missing');
      if (side === 'before') cursor.selectEnd();
      else cursor.selectStart();
    },
    { discrete: true },
  );
  await moment();
};

const dispatchArrow = async (
  lexical: LexicalEditor,
  direction: 'left' | 'right',
): Promise<void> => {
  const event = new KeyboardEvent('keydown', {
    cancelable: true,
    key: direction === 'left' ? 'ArrowLeft' : 'ArrowRight',
  });
  const lexicalCommand = direction === 'left' ? KEY_ARROW_LEFT_COMMAND : KEY_ARROW_RIGHT_COMMAND;
  expect(lexical.dispatchCommand(lexicalCommand, event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  await moment();
};

describe('CodeNode Hole arrow entry', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('uses the same target-owned entry contract as table payloads', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, CodeblockPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', CODE_MARKDOWN);
    await moment();

    const lexical = editor.getLexicalEditor()!;
    const code = lexical.getEditorState().read(() => {
      const hole = $nodesOfType(HoleNode)[0];
      const payload = hole?.getContentChildren()[0];
      if (!payload) throw new Error('Code Hole payload missing');
      return {
        first: $isElementNode(payload) ? payload.getFirstDescendant() : null,
        last: $isElementNode(payload) ? payload.getLastDescendant() : null,
      };
    });

    await selectHoleBoundary(lexical, 'before');
    await dispatchArrow(lexical, 'right');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(code.first?.getKey());
      expect(selection.anchor.offset).toBe(0);
    });

    await selectHoleBoundary(lexical, 'after');
    await dispatchArrow(lexical, 'left');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.key).toBe(code.last?.getKey());
      expect(selection.anchor.offset).toBe(code.last?.getTextContentSize());
    });
  });
});
