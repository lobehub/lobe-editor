import type { TableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';

const DISTRIBUTE_MIN_COLUMN_WIDTH = 75;

const getTableElement = (editor: LexicalEditor, tableKey: string) => {
  const tableElement = editor.getElementByKey(tableKey);

  return tableElement instanceof HTMLTableElement
    ? tableElement
    : tableElement?.querySelector<HTMLTableElement>('table.editor_table, table');
};

const getScrollContainerWidth = (tableElement: HTMLTableElement) => {
  const scrollWrapper = tableElement.closest<HTMLElement>('.lobe-editor-table-scroll-wrapper');
  const container = scrollWrapper ?? tableElement.parentElement;

  if (!container) {
    return 0;
  }

  return container.clientWidth || container.getBoundingClientRect().width;
};

const getHorizontalBorderWidth = (tableElement: HTMLTableElement) => {
  const firstRow = tableElement.rows[0];
  if (!firstRow) {
    return 0;
  }

  const cells = Array.from(firstRow.cells);
  if (cells.length === 0) {
    return 0;
  }

  return cells.reduce((total, cell, index) => {
    const style = getComputedStyle(cell);
    const borderInlineStartWidth =
      index === 0 ? Number.parseFloat(style.borderInlineStartWidth) || 0 : 0;
    const borderInlineEndWidth = Number.parseFloat(style.borderInlineEndWidth) || 0;

    return total + borderInlineStartWidth + borderInlineEndWidth;
  }, 0);
};

export const getDistributedTableColumnWidths = (editor: LexicalEditor, tableNode: TableNode) => {
  const columnCount = tableNode.getColumnCount();
  if (columnCount === 0) {
    return null;
  }

  const tableElement = getTableElement(editor, tableNode.getKey());
  if (!tableElement) {
    return null;
  }

  const minTableWidth = DISTRIBUTE_MIN_COLUMN_WIDTH * columnCount;
  const targetTableWidth = Math.max(
    getScrollContainerWidth(tableElement) - getHorizontalBorderWidth(tableElement),
    minTableWidth,
  );
  const columnWidth = Math.floor(targetTableWidth / columnCount);
  const colWidths = Array.from({ length: columnCount }, () => columnWidth);
  colWidths[columnCount - 1] = targetTableWidth - columnWidth * (columnCount - 1);

  return colWidths;
};
