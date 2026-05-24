import {
  $computeTableMapSkipCellCheck,
  $createTableNodeWithDimensions,
  $createTableSelection,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableNode,
  $isTableSelection,
  InsertTableCommandPayloadHeaders,
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
  ElementNode,
  LexicalEditor,
  createCommand,
} from 'lexical';

export const INSERT_TABLE_COMMAND = createCommand<{
  columns: string;
  includeHeaders?: InsertTableCommandPayloadHeaders;
  rows: string;
}>();

export const SELECT_TABLE_COMMAND = createCommand<{
  anchorIndex?: number;
  columnIndex?: number;
  extend?: boolean;
  rowIndex?: number;
  table: string;
}>();

export const INSERT_TABLE_COLUMN_COMMAND = createCommand<{
  columnIndex: number;
  insertAfter?: boolean;
  table: string;
}>();

export const INSERT_TABLE_ROW_COMMAND = createCommand<{
  insertAfter?: boolean;
  rowIndex: number;
  table: string;
}>();

const $selectFirstDescendant = (node: ElementNode) => {
  const firstDescendant = node.getFirstDescendant();
  if ($isTextNode(firstDescendant)) {
    firstDescendant.select();
  } else {
    node.selectStart();
  }
};

const getRangeFromSelection = (
  selection: ReturnType<typeof $getSelection>,
  table: string,
  targetIndex: number,
  direction: 'column' | 'row',
  crossAxisLength: number,
  anchorIndex?: number,
) => {
  if (anchorIndex !== undefined) {
    return {
      from: Math.min(anchorIndex, targetIndex),
      to: Math.max(anchorIndex, targetIndex),
    };
  }

  if (!$isTableSelection(selection) || selection.tableKey !== table) {
    return {
      from: 0,
      to: targetIndex,
    };
  }

  const shape = selection.getShape();
  const hasSelectedWholeAxis =
    direction === 'row'
      ? shape.fromX === 0 && shape.toX === crossAxisLength - 1
      : shape.fromY === 0 && shape.toY === crossAxisLength - 1;

  if (!hasSelectedWholeAxis) {
    return {
      from: 0,
      to: targetIndex,
    };
  }

  const from = direction === 'row' ? shape.fromY : shape.fromX;
  const to = direction === 'row' ? shape.toY : shape.toX;

  return {
    from: Math.min(from, targetIndex),
    to: Math.max(to, targetIndex),
  };
};

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
      INSERT_TABLE_COLUMN_COMMAND,
      ({ table, columnIndex, insertAfter = true }) => {
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode)) {
          return false;
        }

        const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
        const firstCell = tableMap.find((row) => row[columnIndex])?.[columnIndex]?.cell;
        const lastCell = [...tableMap].reverse().find((row) => row[columnIndex])?.[
          columnIndex
        ]?.cell;
        if (!firstCell || !lastCell) {
          return false;
        }

        const tableSelection = $createTableSelection();
        tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
        $setSelection(tableSelection);
        $insertTableColumnAtSelection(insertAfter);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      INSERT_TABLE_ROW_COMMAND,
      ({ table, rowIndex, insertAfter = true }) => {
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode)) {
          return false;
        }

        const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
        const row = tableMap[rowIndex];
        const firstCell = row?.[0]?.cell;
        const lastCell = row?.[row.length - 1]?.cell;
        if (!firstCell || !lastCell) {
          return false;
        }

        const tableSelection = $createTableSelection();
        tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
        $setSelection(tableSelection);
        const insertedRow = $insertTableRowAtSelection(insertAfter);
        if (insertedRow) {
          $selectFirstDescendant(insertedRow);
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_TABLE_COMMAND,
      ({ table, anchorIndex, columnIndex, extend, rowIndex }) => {
        const prevSelection = $getSelection();
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode)) {
          return false;
        }

        const tableSelection = $isTableSelection(prevSelection)
          ? prevSelection
          : $createTableSelection();

        const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);

        if (rowIndex !== undefined) {
          const { from, to } = extend
            ? getRangeFromSelection(
                prevSelection,
                table,
                rowIndex,
                'row',
                tableNode.getColumnCount(),
                anchorIndex,
              )
            : { from: rowIndex, to: rowIndex };
          const firstRow = tableMap[from];
          const lastRow = tableMap[to];
          const firstCell = firstRow?.[0]?.cell;
          const lastCell = lastRow?.[lastRow.length - 1]?.cell;
          if (!firstCell || !lastCell) return false;

          tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
          $setSelection(tableSelection);
          return true;
        }

        if (columnIndex !== undefined) {
          const { from, to } = extend
            ? getRangeFromSelection(
                prevSelection,
                table,
                columnIndex,
                'column',
                tableMap.length,
                anchorIndex,
              )
            : { from: columnIndex, to: columnIndex };
          const firstCell = tableMap.find((row) => row[from])?.[from]?.cell;
          const lastCell = [...tableMap].reverse().find((row) => row[to])?.[to]?.cell;
          if (!firstCell || !lastCell) return false;

          tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
          $setSelection(tableSelection);
          return true;
        }

        const firstRow = tableMap[0];
        const lastRow = tableMap.at(-1);
        const firstCell = firstRow?.[0]?.cell;
        const lastCell = lastRow?.[lastRow.length - 1]?.cell;
        if (!firstCell || !lastCell) return false;

        tableSelection.set(table, firstCell.getKey(), lastCell.getKey());
        $setSelection(tableSelection);

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
