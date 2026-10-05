import {
  $createTableNodeWithDimensions,
  $isTableSelection,
  type TableCellNode,
  type TableRowNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';

import { SELECT_TABLE_COMMAND } from '../command';
import { TablePlugin } from '../plugin';
import { styles as tableStyles } from '../react/style';

describe('table controller selection', () => {
  let editor: ReturnType<typeof Editor.createEditor> | undefined;
  let root: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    root?.remove();
    root = undefined;
    vi.unstubAllGlobals();
  });

  const createTableEditor = async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      [TablePlugin, { theme: tableStyles }],
    ]);
    root = document.createElement('div');
    root.contentEditable = 'true';
    document.body.append(root);
    const lexical = editor.setRootElement(root);

    let tableKey = '';
    lexical.update(() => {
      const table = $createTableNodeWithDimensions(2, 2, false);
      tableKey = table.getKey();
      table.getChildren().forEach((row) => {
        (row as TableRowNode).getChildren().forEach((cell) => {
          (cell as TableCellNode).append($createParagraphNode().append($createTextNode('cell')));
        });
      });
      $getRoot().append(table, $createParagraphNode().append($createTextNode('outside')));
    });
    await moment();
    root.focus();

    return { lexical, tableKey };
  };

  it.each([
    ['row', { rowIndex: 0 }, [0, 1]],
    ['column', { columnIndex: 0 }, [0, 2]],
    ['whole table', {}, [0, 1, 2, 3]],
  ] as const)(
    'highlights the selected %s on its first controller command',
    async (_, payload, expected) => {
      const { lexical, tableKey } = await createTableEditor();

      expect(
        lexical.dispatchCommand(SELECT_TABLE_COMMAND, {
          ...payload,
          table: tableKey,
        }),
      ).toBe(true);
      await moment();

      lexical.getEditorState().read(() => {
        expect($isTableSelection($getSelection())).toBe(true);
      });
      const cells = Array.from(root!.querySelectorAll<HTMLElement>('td, th'));
      expect(cells).toHaveLength(4);
      const selectedIndexes = cells.flatMap((cell, index) =>
        cell.classList.contains('editor_table_cell_selected') ? [index] : [],
      );
      expect(selectedIndexes).toEqual(expected);

      lexical.update(() => {
        const outside = $getRoot().getLastChild();
        if (!outside) throw new Error('Outside paragraph missing');
        outside.selectStart();
      });
      lexical.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
      await moment();
      expect(cells.some((cell) => cell.classList.contains('editor_table_cell_selected'))).toBe(
        false,
      );
    },
  );
});
