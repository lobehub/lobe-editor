import { $getSelection, $isRangeSelection, type LexicalEditor, resetRandomKey } from 'lexical';
import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import {
  DiffAction,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_DIFFNODE_COMMAND,
  LITEXML_INSERT_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { IEditor } from '@/types';

describe('resolving diffs keeps the caret near the change', () => {
  let kernel: IEditor;
  let lexical: LexicalEditor;

  const idOf = (text: string) => {
    const xml = kernel.getDocument('litexml') as unknown as string;
    const match = new RegExp(`<p id="([^"]+)">\\s*<span[^>]*>${text}</span>`).exec(xml);
    if (!match) throw new Error(`no paragraph ${text}`);
    return match[1];
  };

  const insertPending = async (afterText: string, text: string) => {
    kernel.dispatchCommand(LITEXML_INSERT_COMMAND, {
      afterId: idOf(afterText),
      delay: true,
      litexml: `<p>${text}</p>`,
    });
    await moment();
  };

  const diffKeys = () =>
    lexical
      .getEditorState()
      .read(() =>
        [...lexical.getEditorState()._nodeMap.values()]
          .filter((node) => node.getType() === 'diff' && node.isAttached())
          .map((node) => node.getKey()),
      );

  const caretText = () =>
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      return selection.anchor.getNode().getTopLevelElement()?.getTextContent() ?? null;
    });

  beforeEach(async () => {
    resetRandomKey();
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, ListPlugin, LitexmlPlugin]);
    lexical = kernel.initNodeEditor()!;
    kernel.setDocument('markdown', 'First\n\nSecond\n\nLast\n');
    await moment();
  });

  it('puts the caret at the end of an accepted top-level insert, not the document end', async () => {
    await insertPending('First', 'Inserted');
    const [key] = diffKeys();

    kernel.dispatchCommand(LITEXML_DIFFNODE_COMMAND, { action: DiffAction.Accept, nodeKey: key });
    await moment();

    expect(kernel.getDocument('markdown')).toBe('First\n\nInserted\n\nSecond\n\nLast\n');
    expect(caretText()).toBe('Inserted');
  });

  it.each([DiffAction.Accept, DiffAction.Reject])(
    'leaves no selection after resolving every diff (action %s)',
    async (action) => {
      await insertPending('First', 'Inserted');
      await insertPending('Second', 'Another');
      expect(diffKeys()).toHaveLength(2);

      kernel.dispatchCommand(LITEXML_DIFFNODE_ALL_COMMAND, { action });
      await moment();

      expect(diffKeys()).toHaveLength(0);
      expect(lexical.getEditorState().read(() => $getSelection())).toBeNull();
    },
  );
});
