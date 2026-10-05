import { $getSelection, $isRangeSelection, $nodesOfType } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';

import { MathBlockNode, MathInlineNode } from '../node';
import { SELECT_MATH_SIDE_COMMAND, UPDATE_MATH_COMMAND } from '../command';
import { MathPlugin } from '../plugin';

describe('MathBlockNode Hole integration', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('wraps block math while leaving inline math inside its paragraph', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, MathPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', 'before\n\n$$\nE=mc^2\n$$\n\nafter');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    lexical.getEditorState().read(() => {
      const holes = $nodesOfType(HoleNode);
      expect(holes).toHaveLength(1);
      expect(holes[0]?.getContentChildren()[0]).toBeInstanceOf(MathBlockNode);
      expect($nodesOfType(MathInlineNode)).toHaveLength(0);
    });
    expect(editor.getDocument('markdown')).toContain('$$\nE=mc^2\n$$');
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('"type":"hole"');

    editor.setDocument('markdown', 'Budget variable: $x$');
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(HoleNode)).toHaveLength(0);
      expect($nodesOfType(MathInlineNode)).toHaveLength(1);
      expect($nodesOfType(MathInlineNode)[0]?.isInline()).toBe(true);
    });
  });

  it('keeps block math side navigation on its Hole boundary', async () => {
    editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, MathPlugin]);
    editor.initHeadlessEditor();
    editor.setDocument('markdown', '$$\na\n$$\n\n$$\nb\n$$');
    await moment();

    const lexical = editor.getLexicalEditor()!;
    let firstKey = '';
    let firstAfterKey = '';
    lexical.getEditorState().read(() => {
      const first = $nodesOfType(MathBlockNode)[0];
      if (!first) throw new Error('First MathBlock missing');
      firstKey = first.getKey();
      const hole = first.getParent();
      if (!hole) throw new Error('First MathBlock Hole missing');
      firstAfterKey = hole.getLastChild()!.getKey();
    });

    expect(lexical.dispatchCommand(SELECT_MATH_SIDE_COMMAND, { key: firstKey, prev: false })).toBe(
      true,
    );
    await moment();
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) expect(selection.anchor.key).toBe(firstAfterKey);
    });

    lexical.dispatchCommand(UPDATE_MATH_COMMAND, { code: 'updated', key: firstKey });
    await moment();
    lexical.getEditorState().read(() => {
      expect($nodesOfType(MathBlockNode)[0]?.code).toBe('updated');
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) expect(selection.anchor.key).toBe(firstAfterKey);
    });
  });
});
