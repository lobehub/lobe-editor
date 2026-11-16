import { $isTableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical';

import {
  $getTableColumnAligns,
  $setTableColumnAlign,
  type TableColumnAlign,
} from '../node/column-align';

export const SET_TABLE_COLUMN_ALIGN_COMMAND = createCommand<{
  align: TableColumnAlign;
  columnIndexes: number[];
  table: string;
  toggle?: boolean;
}>('SET_TABLE_COLUMN_ALIGN_COMMAND');

export function registerTableAlignCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    SET_TABLE_COLUMN_ALIGN_COMMAND,
    ({ align, columnIndexes, table, toggle }) => {
      const tableNode = $getNodeByKey(table);
      if (!$isTableNode(tableNode) || columnIndexes.length === 0) {
        return false;
      }

      const aligns = $getTableColumnAligns(tableNode);
      const isActive = columnIndexes.every((index) => (aligns[index] ?? null) === align);
      $setTableColumnAlign(tableNode, columnIndexes, toggle && isActive ? null : align);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );
}
