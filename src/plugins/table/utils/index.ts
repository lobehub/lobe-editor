import { $isTableCellNode, $isTableSelection, TableDOMCell, TableSelection } from '@lexical/table';
import { TableDOMTable } from '@lexical/table/LexicalTableObserver';
import { addClassNamesToElement, removeClassNamesFromElement } from '@lexical/utils';
import {
  $getNearestNodeFromDOMNode,
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
} from 'lexical';

import { assert } from '@/editor-kernel/utils';

export interface TableSelectionIndexes {
  selectedColumns: number[];
  selectedRows: number[];
}

const EMPTY_TABLE_SELECTION_INDEXES: TableSelectionIndexes = {
  selectedColumns: [],
  selectedRows: [],
};

const range = (from: number, to: number) => {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
};

export function getSelectedTableColumnIndexes(
  selection: BaseSelection | null,
  tableKey: string,
  rowCount: number,
): number[] {
  if (!$isTableSelection(selection) || selection.tableKey !== tableKey) {
    return [];
  }

  const shape = selection.getShape();
  return shape.fromY === 0 && shape.toY === rowCount - 1 ? range(shape.fromX, shape.toX) : [];
}

export function getSelectedTableRowIndexes(
  selection: BaseSelection | null,
  tableKey: string,
  columnCount: number,
): number[] {
  if (!$isTableSelection(selection) || selection.tableKey !== tableKey) {
    return [];
  }

  const shape = selection.getShape();
  return shape.fromX === 0 && shape.toX === columnCount - 1 ? range(shape.fromY, shape.toY) : [];
}

export function isTableFullySelected(
  selection: BaseSelection | null,
  tableKey: string,
  columnCount: number,
  rowCount: number,
): boolean {
  if (!$isTableSelection(selection) || selection.tableKey !== tableKey) {
    return false;
  }

  const shape = selection.getShape();
  return (
    shape.fromX === 0 &&
    shape.toX === columnCount - 1 &&
    shape.fromY === 0 &&
    shape.toY === rowCount - 1
  );
}

export function getTableSelectionIndexes(
  selection: BaseSelection | null,
  tableKey: string,
  columnCount: number,
  rowCount: number,
): TableSelectionIndexes {
  if (!$isTableSelection(selection) || selection.tableKey !== tableKey) {
    return EMPTY_TABLE_SELECTION_INDEXES;
  }

  return {
    selectedColumns: getSelectedTableColumnIndexes(selection, tableKey, rowCount),
    selectedRows: getSelectedTableRowIndexes(selection, tableKey, columnCount),
  };
}

export function $forEachTableCell(
  grid: TableDOMTable,
  cb: (
    cell: TableDOMCell,
    lexicalNode: LexicalNode,
    cords: {
      x: number;
      y: number;
    },
  ) => void,
) {
  const { domRows } = grid;

  for (const [y, row] of domRows.entries()) {
    if (!row) {
      continue;
    }

    for (const [x, cell] of row.entries()) {
      if (!cell) {
        continue;
      }
      const lexicalNode = $getNearestNodeFromDOMNode(cell.elem);

      if (lexicalNode !== null) {
        cb(cell, lexicalNode, {
          x,
          y,
        });
      }
    }
  }
}

function $addHighlightToDOM(editor: LexicalEditor, cell: TableDOMCell): void {
  const element = cell.elem;
  const editorThemeClasses = editor._config.theme;
  const node = $getNearestNodeFromDOMNode(element);
  assert($isTableCellNode(node), 'Expected to find LexicalNode from Table Cell DOMNode');
  addClassNamesToElement(element, editorThemeClasses.tableCellSelected);
}

function $removeHighlightFromDOM(editor: LexicalEditor, cell: TableDOMCell): void {
  const element = cell.elem;
  const node = $getNearestNodeFromDOMNode(element);
  assert($isTableCellNode(node), 'Expected to find LexicalNode from Table Cell DOMNode');
  const editorThemeClasses = editor._config.theme;
  removeClassNamesFromElement(element, editorThemeClasses.tableCellSelected);
}

export function $updateDOMForSelection(
  editor: LexicalEditor,
  table: TableDOMTable,
  selection: TableSelection | RangeSelection | null,
) {
  const selectedCellNodes = new Set(selection ? selection.getNodes() : []);
  $forEachTableCell(table, (cell, lexicalNode) => {
    const elem = cell.elem;

    if (selectedCellNodes.has(lexicalNode)) {
      cell.highlighted = true;
      $addHighlightToDOM(editor, cell);
    } else {
      cell.highlighted = false;
      $removeHighlightFromDOM(editor, cell);
      if (!elem.getAttribute('style')) {
        elem.removeAttribute('style');
      }
    }
  });
}
