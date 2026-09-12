import { $computeTableMapSkipCellCheck, type TableCellNode, type TableNode } from '@lexical/table';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $nodesOfType,
  $createParagraphNode,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { $isHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { MarkdownPlugin } from '@/plugins/markdown';

import { TablePlugin } from '../plugin';

const TABLE_MARKDOWN = `before

| first | second |
| --- | --- |
| third | last |

after`;

const dispatchArrow = async (
  lexical: LexicalEditor,
  direction: 'left' | 'right',
  shiftKey = false,
): Promise<void> => {
  const event = new KeyboardEvent('keydown', {
    cancelable: true,
    key: direction === 'left' ? 'ArrowLeft' : 'ArrowRight',
    shiftKey,
  });
  const command = direction === 'left' ? KEY_ARROW_LEFT_COMMAND : KEY_ARROW_RIGHT_COMMAND;
  expect(lexical.dispatchCommand(command, event)).toBe(true);
  expect(event.defaultPrevented).toBe(true);
  await moment();
};

const getTableHole = (lexical: LexicalEditor): { hole: HoleNode; table: TableNode } =>
  lexical.getEditorState().read(() => {
    const hole = $nodesOfType(HoleNode)[0];
    const table = hole?.getContentChildren()[0];
    if (!hole || !$isHoleNode(hole) || !table || table.getType() !== 'table') {
      throw new Error('Table Hole missing');
    }
    return { hole, table: table as TableNode };
  });

const selectHoleBoundary = async (
  lexical: LexicalEditor,
  side: 'before' | 'after',
): Promise<void> => {
  lexical.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = side === 'before' ? hole?.getBeforeCursor() : hole?.getAfterCursor();
      if (!hole || !cursor) throw new Error('Table Hole boundary missing');
      if (side === 'before') cursor.selectEnd();
      else cursor.selectStart();
    },
    { discrete: true },
  );
  await moment();
};

const createTableEditor = async (): Promise<{
  editor: ReturnType<typeof Editor.createEditor>;
  lexical: LexicalEditor;
}> => {
  const editor = Editor.createEditor().registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
  editor.initHeadlessEditor();
  editor.setDocument('markdown', TABLE_MARKDOWN);
  await moment();
  return { editor, lexical: editor.getLexicalEditor()! };
};

const getEdgeCell = (table: TableNode, side: 'before' | 'after'): TableCellNode => {
  const [tableMap] = $computeTableMapSkipCellCheck(table, null, null);
  const row =
    side === 'before'
      ? tableMap.find((candidate) => candidate.length > 0)
      : [...tableMap].reverse().find((candidate) => candidate.length > 0);
  const cell = side === 'before' ? row?.[0]?.cell : row?.at(-1)?.cell;
  if (!cell) throw new Error(`Missing ${side} edge cell`);
  return cell;
};

const isInsideCell = (node: LexicalNode, cell: TableCellNode): boolean => {
  let current: LexicalNode | null = node;
  while (current) {
    if (current.is(cell)) return true;
    current = current.getParent();
  }
  return false;
};

describe('Table Hole arrow entry', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('enters the first cell at start and the last cell at end', async () => {
    ({ editor } = await createTableEditor());
    const lexical = editor.getLexicalEditor()!;
    const { table } = getTableHole(lexical);

    const { firstCellKey, firstTextKey, lastCellKey, lastTextKey } = lexical
      .getEditorState()
      .read(() => {
        const firstCell = getEdgeCell(table, 'before');
        const lastCell = getEdgeCell(table, 'after');
        return {
          firstCellKey: firstCell.getKey(),
          firstTextKey: firstCell.getFirstDescendant()?.getKey(),
          lastCellKey: lastCell.getKey(),
          lastTextKey: lastCell.getLastDescendant()?.getKey(),
        };
      });

    await selectHoleBoundary(lexical, 'before');
    await dispatchArrow(lexical, 'right');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(firstTextKey || firstCellKey);
      expect(selection.anchor.offset).toBe(0);
      expect(selection.anchor.getNode().getTextContent()).toBe('first');
    });

    await selectHoleBoundary(lexical, 'after');
    await dispatchArrow(lexical, 'left');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.key).toBe(lastTextKey || lastCellKey);
      const node = selection.anchor.getNode();
      expect(selection.anchor.offset).toBe($isTextNode(node) ? node.getTextContentSize() : 0);
      expect(node.getTextContent()).toBe('last');
    });
  });

  it('uses the cell element edges for empty first and last cells', async () => {
    ({ editor } = await createTableEditor());
    const lexical = editor.getLexicalEditor()!;
    lexical.update(
      () => {
        const { table } = getTableHole(lexical);
        getEdgeCell(table, 'before').clear().append($createParagraphNode());
        getEdgeCell(table, 'after').clear().append($createParagraphNode());
      },
      { discrete: true },
    );
    await moment();

    await selectHoleBoundary(lexical, 'before');
    await dispatchArrow(lexical, 'right');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      const { table } = getTableHole(lexical);
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(isInsideCell(selection.anchor.getNode(), getEdgeCell(table, 'before'))).toBe(true);
      expect(selection.anchor.offset).toBe(0);
      expect(selection.anchor.type).toBe('element');
    });

    await selectHoleBoundary(lexical, 'after');
    await dispatchArrow(lexical, 'left');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      const { table } = getTableHole(lexical);
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(isInsideCell(selection.anchor.getNode(), getEdgeCell(table, 'after'))).toBe(true);
      expect(selection.anchor.offset).toBe(0);
      expect(selection.anchor.type).toBe('element');
    });
  });

  it('keeps opposite-direction exit and Shift expansion on Hole boundaries', async () => {
    ({ editor } = await createTableEditor());
    const lexical = editor.getLexicalEditor()!;

    await selectHoleBoundary(lexical, 'before');
    await dispatchArrow(lexical, 'left');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('before');
      expect(selection.anchor.offset).toBe('before'.length);
    });

    await selectHoleBoundary(lexical, 'after');
    await dispatchArrow(lexical, 'right');
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.anchor.getNode().getTextContent()).toBe('after');
      expect(selection.anchor.offset).toBe(0);
    });

    await selectHoleBoundary(lexical, 'before');
    await dispatchArrow(lexical, 'right', true);
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      const { hole } = getTableHole(lexical);
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(false);
      expect(selection.anchor.key).toBe(hole.getBeforeCursor()?.getKey());
      expect(selection.focus.key).toBe(hole.getAfterCursor()?.getKey());
    });

    await selectHoleBoundary(lexical, 'after');
    await dispatchArrow(lexical, 'left', true);
    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      const { hole } = getTableHole(lexical);
      if (!$isRangeSelection(selection)) throw new Error('Range selection missing');
      expect(selection.isCollapsed()).toBe(false);
      expect(selection.anchor.key).toBe(hole.getAfterCursor()?.getKey());
      expect(selection.focus.key).toBe(hole.getBeforeCursor()?.getKey());
    });
  });
});
