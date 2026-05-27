import { $isTableCellNode, $isTableSelection, TableDOMCell, TableSelection } from '@lexical/table';
import { TableDOMTable } from '@lexical/table/LexicalTableObserver';
import { addClassNamesToElement, removeClassNamesFromElement } from '@lexical/utils';
import {
  $getNearestNodeFromDOMNode,
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  NodeKey,
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

export const DEFAULT_TABLE_WIDTH = 750;

export interface TableSelectionOutlineRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function createDefaultTableColWidths(columnCount: number, tableWidth = DEFAULT_TABLE_WIDTH) {
  const safeColumnCount = Math.max(1, columnCount);
  const columnWidth = Math.floor(tableWidth / safeColumnCount);
  const colWidths = Array.from({ length: safeColumnCount }, () => columnWidth);
  colWidths[safeColumnCount - 1] = tableWidth - columnWidth * (safeColumnCount - 1);

  return colWidths;
}

export function syncTableWidthDOM(
  editor: LexicalEditor,
  tableKey: NodeKey,
  colWidths: readonly number[],
) {
  const tableElement = editor.getElementByKey(tableKey);
  const table =
    tableElement instanceof HTMLTableElement
      ? tableElement
      : tableElement?.querySelector('table.editor_table, table');

  if (!(table instanceof HTMLTableElement)) {
    return;
  }

  table.style.width = `${colWidths.reduce((total, width) => total + width, 0)}px`;
}

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

function getTableSelectionOutlineRect(
  selectedCells: HTMLElement[],
  table: TableDOMTable,
  selection: TableSelection,
): TableSelectionOutlineRect | null {
  const outlineElements = [...selectedCells];
  if (outlineElements.length === 0) {
    return null;
  }

  const shape = selection.getShape();
  const firstCell = outlineElements[0];
  const tableElement = firstCell.closest('table.editor_table, table');
  const scrollWrapper = tableElement?.closest('.lobe-editor-table-scroll-wrapper');
  const tableRoot = scrollWrapper?.parentElement ?? tableElement?.parentElement;
  const isColumnSelection = shape.fromY === 0 && shape.toY === table.rows - 1;
  const isRowSelection = shape.fromX === 0 && shape.toX === table.columns - 1;
  const selectedRowControllers: HTMLElement[] = [];

  if (isColumnSelection && isRowSelection) {
    return null;
  }

  if (isColumnSelection) {
    const columnControllers = scrollWrapper?.querySelectorAll<HTMLElement>(
      '.table-controller-col .col',
    );

    for (let index = shape.fromX; index <= shape.toX; index++) {
      const element = columnControllers?.[index];
      if (element) {
        outlineElements.push(element);
      }
    }
  }

  if (isRowSelection) {
    const rowControllers = tableRoot?.querySelectorAll<HTMLElement>('.table-controller-row .row');

    for (let index = shape.fromY; index <= shape.toY; index++) {
      const element = rowControllers?.[index];
      if (element) {
        selectedRowControllers.push(element);
        outlineElements.push(element);
      }
    }
  }

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const element of outlineElements) {
    if (!element.isConnected) {
      continue;
    }

    const rect = element.getBoundingClientRect();
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (isRowSelection && scrollWrapper) {
    const scrollWrapperRect = scrollWrapper.getBoundingClientRect();
    const tableRect = tableElement?.getBoundingClientRect();
    const rowControllerLeft = selectedRowControllers.reduce(
      (currentLeft, element) => Math.min(currentLeft, element.getBoundingClientRect().left),
      Number.POSITIVE_INFINITY,
    );

    left =
      rowControllerLeft === Number.POSITIVE_INFINITY ? scrollWrapperRect.left : rowControllerLeft;
    right = Math.min(tableRect?.right ?? scrollWrapperRect.right, scrollWrapperRect.right);
  }

  if (
    left === Number.POSITIVE_INFINITY ||
    top === Number.POSITIVE_INFINITY ||
    right === Number.NEGATIVE_INFINITY ||
    bottom === Number.NEGATIVE_INFINITY
  ) {
    return null;
  }

  return {
    height: bottom - top,
    left,
    top,
    width: right - left,
  };
}

export function $updateDOMForSelection(
  editor: LexicalEditor,
  table: TableDOMTable,
  selection: TableSelection | RangeSelection | null,
): TableSelectionOutlineRect | null {
  const selectedCellNodes = new Set(selection ? selection.getNodes() : []);
  const selectedCells = new Set<HTMLElement>();

  $forEachTableCell(table, (cell, lexicalNode) => {
    const elem = cell.elem;

    if (selectedCellNodes.has(lexicalNode)) {
      cell.highlighted = true;
      selectedCells.add(elem);
      $addHighlightToDOM(editor, cell);
    } else {
      cell.highlighted = false;
      $removeHighlightFromDOM(editor, cell);
      if (!elem.getAttribute('style')) {
        elem.removeAttribute('style');
      }
    }
  });

  return $isTableSelection(selection)
    ? getTableSelectionOutlineRect([...selectedCells], table, selection)
    : null;
}
