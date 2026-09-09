// @vitest-environment node
import { $createParagraphNode, $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { $isCursorNode, CommonPlugin } from '@/plugins/common';
import { MentionPlugin } from '@/plugins/mention/plugin';

import { INSERT_MENTION_COMMAND } from '..';

const flushEditorUpdates = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('mention commands', () => {
  it('places the caret in the cursor node after an inserted mention', async () => {
    const editor = Editor.createEditor().registerPlugins([CommonPlugin, MentionPlugin]);
    editor.initNodeEditor();

    const lexicalEditor = editor.getLexicalEditor();
    if (!lexicalEditor) {
      throw new Error('Lexical editor not initialized');
    }

    lexicalEditor.update(
      () => {
        const paragraph = $createParagraphNode();
        $getRoot().clear().append(paragraph);
        paragraph.selectEnd();
      },
      { discrete: true },
    );

    editor.dispatchCommand(INSERT_MENTION_COMMAND, {
      label: 'Ada',
      metadata: { id: '42' },
    });
    await flushEditorUpdates();

    lexicalEditor.getEditorState().read(() => {
      const selection = $getSelection();

      expect($isRangeSelection(selection)).toBe(true);
      expect($isRangeSelection(selection) && $isCursorNode(selection.anchor.getNode())).toBe(true);
    });
  });
});
