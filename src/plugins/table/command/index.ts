import {
  $createTableNodeWithDimensions,
  $createTableSelection,
  $findTableNode,
  $isTableNode,
  $isTableSelection,
  InsertTableCommandPayloadHeaders,
  TableCellNode,
  TableRowNode,
} from '@lexical/table';
import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $getPreviousSelection,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

export const INSERT_TABLE_COMMAND = createCommand<{
  columns: string;
  includeHeaders?: InsertTableCommandPayloadHeaders;
  rows: string;
}>();

export const SELECT_TABLE_COMMAND = createCommand<{
  columnIndex?: number;
  rowIndex?: number;
  table: string;
}>();

export function registerTableCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_TABLE_COMMAND,
      ({ rows, columns, includeHeaders }) => {
        const selection = $getSelection() || $getPreviousSelection();
        if (!selection || !$isRangeSelection(selection)) {
          return false;
        }

        // Prevent nested tables by checking if we're already inside a table
        if ($findTableNode(selection.anchor.getNode())) {
          return false;
        }

        const anchorNode = selection.anchor.getNode();

        const tableNode = $createTableNodeWithDimensions(
          Number(rows),
          Number(columns),
          includeHeaders,
        );

        if ($isElementNode(anchorNode) && anchorNode.isEmpty()) {
          anchorNode.replace(tableNode);
        } else {
          $insertNodeToNearestRoot(tableNode);
        }

        const firstDescendant = tableNode.getFirstDescendant();
        if ($isTextNode(firstDescendant)) {
          firstDescendant.select();
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_TABLE_COMMAND,
      ({ table, columnIndex, rowIndex }) => {
        editor.update(() => {
          const prevSelection = $getSelection();
          const tableNode = $getNodeByKey(table);
          if (!tableNode || !$isTableNode(tableNode)) {
            return;
          }

          const tableSelection = $isTableSelection(prevSelection)
            ? prevSelection
            : $createTableSelection();

          if (rowIndex !== undefined) {
            const firstRow = tableNode.getChildren()[rowIndex] as TableRowNode;
            if (!firstRow) return;
            const firstCell = firstRow.getFirstChild() as TableCellNode;
            const lastCell = firstRow.getLastChild() as TableCellNode;
            if (!firstCell || !lastCell) return;

            tableSelection.set(table, firstCell.getKey(), lastCell.getKey());

            $setSelection(tableSelection);
          } else if (columnIndex !== undefined) {
            const firstRow = tableNode.getFirstChild() as TableRowNode;
            const lastRow = tableNode.getLastChild() as TableRowNode;
            if (!firstRow || !lastRow) return;

            const firstCell = firstRow.getChildren()[columnIndex] as TableCellNode;
            const lastCell = lastRow.getChildren()[columnIndex] as TableCellNode;
            if (!firstCell || !lastCell) return;

            tableSelection.set(table, firstCell.getKey(), lastCell.getKey());

            $setSelection(tableSelection);
          } else {
            const firstRow = tableNode.getFirstChild() as TableRowNode;
            const lastRow = tableNode.getLastChild() as TableRowNode;
            if (!firstRow || !lastRow) return;

            const firstCell = firstRow.getFirstChild() as TableCellNode;
            const lastCell = lastRow.getLastChild() as TableCellNode;
            if (!firstCell || !lastCell) return;

            tableSelection.set(table, firstCell.getKey(), lastCell.getKey());

            $setSelection(tableSelection);
          }
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
