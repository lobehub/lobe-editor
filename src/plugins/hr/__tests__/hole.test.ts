import { $nodesOfType, KEY_BACKSPACE_COMMAND, type LexicalEditor } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { INSERT_HORIZONTAL_RULE_COMMAND } from '../command';
import { HorizontalRuleNode } from '../node/HorizontalRuleNode';
import { HRPlugin } from '../plugin';

const selectAfterBoundary = async (lexical: LexicalEditor): Promise<void> => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getAfterCursor();
      if (!cursor) throw new Error('HR Hole boundary missing');
      cursor.selectStart();
    },
    { discrete: true },
  );
  await moment();
};

describe('HorizontalRuleNode Hole integration', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('wraps Markdown HR nodes and keeps Markdown/JSON projections transparent', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, HRPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', 'before\n\n---\n\nafter');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(1);
      expect(holes[0]?.getContentChildren()[0]).toBeInstanceOf(HorizontalRuleNode);
    });
    expect(editor.getDocument('markdown')).toContain('---');
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('"type":"hole"');
  });

  it('inserts an HR beside a Hole boundary and deletes the whole shell', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, HRPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '---');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    await selectAfterBoundary(lexical);
    expect(lexical.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(2);
    });

    await selectAfterBoundary(lexical);
    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Backspace' });
    expect(lexical.dispatchCommand(KEY_BACKSPACE_COMMAND, event)).toBe(true);
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(1);
    });
  });
});
