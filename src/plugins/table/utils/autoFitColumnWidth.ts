import { $computeTableMapSkipCellCheck, TableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';

import { createDefaultTableColWidths } from '.';

const AUTO_FIT_MIN_COLUMN_WIDTH = 75;
const MEASURE_CONTAINER_CLASS = 'lobe-editor-table-auto-fit-measure';

const getTableElement = (editor: LexicalEditor, tableKey: string) => {
  const tableElement = editor.getElementByKey(tableKey);

  return tableElement instanceof HTMLTableElement
    ? tableElement
    : tableElement?.querySelector<HTMLTableElement>('table.editor_table, table');
};

const applyNoWrapMeasureStyle = (element: HTMLElement) => {
  element.style.whiteSpace = 'nowrap';
  element.style.wordBreak = 'normal';
  element.style.overflowWrap = 'normal';
  element.style.setProperty('text-wrap', 'nowrap');
};

const createMeasureContainer = (tableElement: HTMLTableElement) => {
  const container = document.createElement('div');
  container.className = MEASURE_CONTAINER_CLASS;
  container.style.insetBlockStart = '0';
  container.style.insetInlineStart = '-100000px';
  container.style.pointerEvents = 'none';
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.zIndex = '-1';

  (tableElement.parentElement ?? document.body).append(container);

  return container;
};

const measureCellNoWrapWidth = (cellElement: HTMLElement, measureContainer: HTMLElement) => {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const row = document.createElement('tr');
  const clone = cellElement.cloneNode(true) as HTMLElement;

  table.className = 'editor_table';
  table.style.borderCollapse = 'collapse';
  table.style.borderSpacing = '0';
  table.style.tableLayout = 'auto';
  table.style.width = 'max-content';

  delete clone.dataset.lexicalKey;
  clone.style.blockSize = 'auto';
  clone.style.display = 'table-cell';
  clone.style.inlineSize = 'max-content';
  clone.style.maxInlineSize = 'none';
  clone.style.minInlineSize = '0';
  clone.style.overflow = 'visible';
  clone.style.position = 'static';
  clone.style.width = 'max-content';

  applyNoWrapMeasureStyle(table);
  applyNoWrapMeasureStyle(clone);
  clone.querySelectorAll<HTMLElement>('*').forEach(applyNoWrapMeasureStyle);

  row.append(clone);
  tbody.append(row);
  table.append(tbody);
  measureContainer.append(table);

  const width = Math.ceil(
    Math.max(table.getBoundingClientRect().width, clone.getBoundingClientRect().width),
  );
  table.remove();

  return width;
};

export const getAutoFitTableColumnWidths = (
  editor: LexicalEditor,
  tableNode: TableNode,
  columnIndexes: readonly number[],
) => {
  const tableElement = getTableElement(editor, tableNode.getKey());
  if (!tableElement || columnIndexes.length === 0) {
    return null;
  }

  const columnCount = tableNode.getColumnCount();
  const targetColumnIndexes = [...new Set(columnIndexes)].filter(
    (index) => index >= 0 && index < columnCount,
  );

  if (targetColumnIndexes.length === 0) {
    return null;
  }

  const measureContainer = createMeasureContainer(tableElement);

  try {
    const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
    const nextColWidths = [
      ...(tableNode.getColWidths() || createDefaultTableColWidths(columnCount)),
    ];

    for (const columnIndex of targetColumnIndexes) {
      const measuredCellKeys = new Set<string>();
      let columnWidth = AUTO_FIT_MIN_COLUMN_WIDTH;

      for (const row of tableMap) {
        const mapCell = row[columnIndex];
        const cell = mapCell?.cell;
        if (!cell || cell.getColSpan() > 1 || measuredCellKeys.has(cell.getKey())) {
          continue;
        }

        const cellElement = editor.getElementByKey(cell.getKey());
        if (!(cellElement instanceof HTMLElement)) {
          continue;
        }

        measuredCellKeys.add(cell.getKey());
        columnWidth = Math.max(columnWidth, measureCellNoWrapWidth(cellElement, measureContainer));
      }

      nextColWidths[columnIndex] = columnWidth;
    }

    return nextColWidths;
  } finally {
    measureContainer.remove();
  }
};
