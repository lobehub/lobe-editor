import {
  $createTableNodeWithDimensions,
  $createTableSelection,
  type TableCellNode,
  type TableRowNode,
} from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $setSelection,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common/plugin';

import { getTableSelectionIndexes, isTableFullySelected } from '../utils';

const editors: Array<ReturnType<typeof Editor.createEditor>> = [];

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

describe('table selection shape', () => {
  it('ignores endpoint keys removed from the active editor state', async () => {
    const kernel = Editor.createEditor().registerPlugins([CommonPlugin]);
    editors.push(kernel);
    const editor = kernel.initHeadlessEditor()!;
    let tableKey = '';
    let anchorKey = '';
    let deletedKey = '';
    editor.update(() => {
      const table = $createTableNodeWithDimensions(2, 2, false);
      tableKey = table.getKey();
      table.getChildren().forEach((row, rowIndex) => {
        (row as TableRowNode).getChildren().forEach((cell, columnIndex) => {
          const key = (cell as TableCellNode).getKey();
          if (rowIndex === 1 && columnIndex === 1) deletedKey = key;
          if (rowIndex === 1 && columnIndex === 0) anchorKey = key;
          (cell as TableCellNode).append($createParagraphNode().append($createTextNode('cell')));
        });
      });
      $getRoot().append(table);
    });
    await moment();

    editor.update(() => {
      $getNodeByKey(deletedKey)?.remove();
      const selection = $createTableSelection();
      selection.set(tableKey, anchorKey, deletedKey);
      $setSelection(selection);
    });
    await moment();

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect(getTableSelectionIndexes(selection, tableKey, 2, 2)).toEqual({
        selectedColumns: [],
        selectedRows: [],
      });
      expect(isTableFullySelected(selection, tableKey, 2, 2)).toBe(false);
    });
  });
});
