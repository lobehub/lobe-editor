import {
  $computeTableMapSkipCellCheck,
  $createTableNodeWithDimensions,
  $createTableSelection,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isSimpleTable,
  $isTableNode,
  $isTableRowNode,
  $isTableSelection,
  InsertTableCommandPayloadHeaders,
  TableNode,
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

import { createDefaultTableColWidths, syncTableWidthDOM } from '../utils';
import { getAutoFitTableColumnWidths } from '../utils/autoFitColumnWidth';

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

export const SYNC_TABLE_COLUMN_WIDTH_COMMAND = createCommand<{
  columnIndex: number;
  table: string;
}>();

export const AUTO_FIT_TABLE_COLUMN_WIDTH_COMMAND = createCommand<{
  columnIndexes: number[];
  table: string;
}>();

export const MOVE_TABLE_COLUMN_COMMAND = createCommand<{
  columnIndex: number;
  insertAfter?: boolean;
  selectedColumns: number[];
  table: string;
}>();

export const MOVE_TABLE_ROW_COMMAND = createCommand<{
  insertAfter?: boolean;
  rowIndex: number;
  selectedRows: number[];
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

const getMoveRange = (selectedIndexes: number[], targetIndex: number, insertAfter = false) => {
  if (selectedIndexes.length === 0) {
    return null;
  }

  const sortedIndexes = [...selectedIndexes].sort((a, b) => a - b);
  const from = sortedIndexes[0];
  const to = sortedIndexes.at(-1) ?? from;
  const count = to - from + 1;
  const insertionIndex = insertAfter ? targetIndex + 1 : targetIndex;

  if (insertionIndex >= from && insertionIndex <= to + 1) {
    return null;
  }

  return {
    count,
    from,
    target: insertionIndex > to ? insertionIndex - count : insertionIndex,
    to,
  };
};

const $selectTableRows = (tableNode: TableNode, from: number, to: number) => {
  const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
  const firstRow = tableMap[from];
  const lastRow = tableMap[to];
  const firstCell = firstRow?.[0]?.cell;
  const lastCell = lastRow?.[lastRow.length - 1]?.cell;

  if (!firstCell || !lastCell) {
    return false;
  }

  const tableSelection = $createTableSelection();
  tableSelection.set(tableNode.getKey(), firstCell.getKey(), lastCell.getKey());
  $setSelection(tableSelection);
  return true;
};

const $selectTableColumns = (tableNode: TableNode, from: number, to: number) => {
  const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
  const firstCell = tableMap.find((row) => row[from])?.[from]?.cell;
  const lastCell = [...tableMap].reverse().find((row) => row[to])?.[to]?.cell;

  if (!firstCell || !lastCell) {
    return false;
  }

  const tableSelection = $createTableSelection();
  tableSelection.set(tableNode.getKey(), firstCell.getKey(), lastCell.getKey());
  $setSelection(tableSelection);
  return true;
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
        const rowCount = Number(rows);
        const columnCount = Number(columns);

        const tableNode = $createTableNodeWithDimensions(rowCount, columnCount, includeHeaders);
        tableNode.setColWidths(createDefaultTableColWidths(columnCount));

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
      SYNC_TABLE_COLUMN_WIDTH_COMMAND,
      ({ table, columnIndex }) => {
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode)) {
          return false;
        }

        const columnCount = tableNode.getColumnCount();
        const colWidths = tableNode.getColWidths() || createDefaultTableColWidths(columnCount);
        const selectedWidth = colWidths[columnIndex];
        if (selectedWidth === undefined) {
          return false;
        }

        const nextColWidths = Array.from({ length: columnCount }, () => selectedWidth);
        tableNode.setColWidths(nextColWidths);

        requestAnimationFrame(() => {
          syncTableWidthDOM(editor, table, nextColWidths);
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      AUTO_FIT_TABLE_COLUMN_WIDTH_COMMAND,
      ({ table, columnIndexes }) => {
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode)) {
          return false;
        }

        const nextColWidths = getAutoFitTableColumnWidths(editor, tableNode, columnIndexes);
        if (!nextColWidths) {
          return false;
        }

        tableNode.setColWidths(nextColWidths);

        requestAnimationFrame(() => {
          syncTableWidthDOM(editor, table, nextColWidths);
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      MOVE_TABLE_COLUMN_COMMAND,
      ({ table, selectedColumns, columnIndex, insertAfter = false }) => {
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode) || !$isSimpleTable(tableNode)) {
          return false;
        }

        const moveRange = getMoveRange(selectedColumns, columnIndex, insertAfter);
        if (!moveRange) {
          return false;
        }

        const { count, from, target, to } = moveRange;
        const rows = tableNode.getChildren().filter($isTableRowNode);
        rows.forEach((row) => {
          const cells = row.getChildren();
          const movedCells = cells.slice(from, to + 1);
          const nextCells = [...cells.slice(0, from), ...cells.slice(to + 1)];
          nextCells.splice(target, 0, ...movedCells);
          row.splice(0, cells.length, nextCells);
        });

        const colWidths = tableNode.getColWidths();
        if (colWidths && colWidths.length === tableNode.getColumnCount()) {
          const movedWidths = colWidths.slice(from, to + 1);
          const nextWidths = [...colWidths.slice(0, from), ...colWidths.slice(to + 1)];
          nextWidths.splice(target, 0, ...movedWidths);
          tableNode.setColWidths(nextWidths);
        }

        $selectTableColumns(tableNode, target, target + count - 1);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      MOVE_TABLE_ROW_COMMAND,
      ({ table, selectedRows, rowIndex, insertAfter = false }) => {
        const tableNode = $getNodeByKey(table);
        if (!tableNode || !$isTableNode(tableNode) || !$isSimpleTable(tableNode)) {
          return false;
        }

        const moveRange = getMoveRange(selectedRows, rowIndex, insertAfter);
        if (!moveRange) {
          return false;
        }

        const { count, from, target, to } = moveRange;
        const rows = tableNode.getChildren();
        const movedRows = rows.slice(from, to + 1);
        const nextRows = [...rows.slice(0, from), ...rows.slice(to + 1)];
        nextRows.splice(target, 0, ...movedRows);
        tableNode.splice(0, rows.length, nextRows);

        $selectTableRows(tableNode, target, target + count - 1);
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
