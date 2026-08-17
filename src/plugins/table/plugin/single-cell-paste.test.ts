import { $getClipboardDataFromSelection, type LexicalClipboardData } from '@lexical/clipboard';
import {
  $createTableNodeWithDimensions,
  $createTableSelection,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $createTextNode,
  $getRoot,
  $isElementNode,
  $setSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  createEditor,
} from 'lexical';
import { describe, expect, it, vi } from 'vitest';

import {
  getSingleCellPlainText,
  handleSingleCellTablePaste,
  isSingleCellTableClipboard,
} from './single-cell-paste';

const createClipboardData = <T extends object>(data: T) => ({
  getData: (type: string) => (data as Record<string, string | undefined>)[type] || '',
});

const createLexicalClipboard = (cellCount: number) =>
  JSON.stringify({
    namespace: 'LobeEditor',
    nodes: [
      {
        children: [
          {
            children: Array.from({ length: cellCount }, (_, index) => ({
              children: [
                {
                  children: [{ text: `Cell ${index + 1}`, type: 'text' }],
                  type: 'paragraph',
                },
              ],
              type: 'tablecell',
            })),
            type: 'tablerow',
          },
        ],
        type: 'table',
      },
    ],
  });

describe('single-cell table paste', () => {
  it('recognizes the real clipboard payload produced by a one-cell TableSelection', () => {
    const editor = createEditor({ nodes: [TableCellNode, TableNode, TableRowNode] });
    let clipboard: LexicalClipboardData = { 'text/plain': '' };

    editor.update(
      () => {
        const table = $createTableNodeWithDimensions(1, 2, false);
        const row = table.getFirstChildOrThrow<TableRowNode>();
        const firstCell = row.getFirstChildOrThrow<TableCellNode>();
        const cellContent = firstCell.getFirstChildOrThrow();
        if (!$isElementNode(cellContent)) throw new Error('Expected cell content to be an element');

        cellContent.append($createTextNode('Cell 1'));
        $getRoot().append(table);

        const selection = $createTableSelection();
        selection.set(table.getKey(), firstCell.getKey(), firstCell.getKey());
        $setSelection(selection);
        clipboard = $getClipboardDataFromSelection();
      },
      { discrete: true },
    );

    expect(isSingleCellTableClipboard(createClipboardData(clipboard))).toBe(true);
  });

  it('recognizes an internal 1x1 table clipboard', () => {
    const clipboardData = createClipboardData({
      'application/x-lexical-editor': createLexicalClipboard(1),
    });

    expect(isSingleCellTableClipboard(clipboardData)).toBe(true);
  });

  it('keeps a multi-cell clipboard as a table', () => {
    const clipboardData = createClipboardData({
      'application/x-lexical-editor': createLexicalClipboard(2),
      'text/html': '<table><tbody><tr><td>One</td><td>Two</td></tr></tbody></table>',
    });

    expect(isSingleCellTableClipboard(clipboardData)).toBe(false);
  });

  it('recognizes an external HTML clipboard containing only one table cell', () => {
    const clipboardData = createClipboardData({
      'text/html': '<div><table><tbody><tr><td>One</td></tr></tbody></table></div>',
    });

    expect(isSingleCellTableClipboard(clipboardData)).toBe(true);
  });

  it('does not flatten a table accompanied by other content', () => {
    const clipboardData = createClipboardData({
      'text/html': '<p>Before</p><table><tbody><tr><td>One</td></tr></tbody></table>',
    });

    expect(isSingleCellTableClipboard(clipboardData)).toBe(false);
  });

  it('removes only the structural trailing newline from copied cell text', () => {
    const clipboardData = createClipboardData({ 'text/plain': 'First\nSecond\n' });

    expect(getSingleCellPlainText(clipboardData)).toBe('First\nSecond');
  });

  it('inserts a single copied cell as ordinary text', () => {
    const clipboardData = createClipboardData({
      'application/x-lexical-editor': createLexicalClipboard(1),
      'text/plain': 'Cell content\n',
    });
    const preventDefault = vi.fn();
    const dispatchCommand = vi.fn(() => true);
    const event = { clipboardData, preventDefault } as unknown as ClipboardEvent;

    expect(handleSingleCellTablePaste({ dispatchCommand } as never, event)).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(dispatchCommand).toHaveBeenCalledWith(CONTROLLED_TEXT_INSERTION_COMMAND, 'Cell content');
  });
});
