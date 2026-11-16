import type { TableCellNode, TableNode } from '@lexical/table';
import {
  $computeTableMap,
  $computeTableMapSkipCellCheck,
  $deleteTableColumnAtSelection,
  $getNodeTriplet,
  $insertTableColumnAtSelection,
  $isTableNode,
  $isTableRowNode,
  $isTableSelection,
} from '@lexical/table';
import { $getSelection, $getState, $isRangeSelection, $setState, createState } from 'lexical';

export type TableColumnAlign = 'center' | 'left' | 'right' | null;

const COLUMN_ALIGNS = new Set(['center', 'left', 'right']);

export function normalizeTableColumnAlign(value: unknown): TableColumnAlign {
  if (typeof value !== 'string') return null;
  const align = value.trim().toLowerCase();
  return COLUMN_ALIGNS.has(align) ? (align as TableColumnAlign) : null;
}

export function normalizeTableColumnAligns(value: unknown): TableColumnAlign[] {
  if (!Array.isArray(value)) return [];
  const aligns = value.map(normalizeTableColumnAlign);
  while (aligns.length > 0 && aligns.at(-1) === null) {
    aligns.pop();
  }
  return aligns;
}

const isSameAligns = (a: TableColumnAlign[], b: TableColumnAlign[]) =>
  a.length === b.length && a.every((align, index) => align === b[index]);

export const tableColumnAlignsState = createState('colAligns', {
  isEqual: isSameAligns,
  parse: normalizeTableColumnAligns,
});

export function $getTableColumnAligns(table: TableNode): TableColumnAlign[] {
  return $getState(table, tableColumnAlignsState);
}

export function $setTableColumnAligns(table: TableNode, aligns: TableColumnAlign[]): void {
  $setState(table, tableColumnAlignsState, normalizeTableColumnAligns(aligns));
}

export function $setTableColumnAlign(
  table: TableNode,
  columnIndexes: number[],
  align: TableColumnAlign,
): void {
  const next = [...$getTableColumnAligns(table)];
  for (const index of columnIndexes) {
    while (next.length <= index) next.push(null);
    next[index] = align;
  }
  $setTableColumnAligns(table, next);
}

export function $insertTableColumnAligns(table: TableNode, index: number, count = 1): void {
  const aligns = $getTableColumnAligns(table);
  if (index >= aligns.length) return;
  const next = [...aligns];
  next.splice(index, 0, ...Array.from({ length: count }, () => null));
  $setTableColumnAligns(table, next);
}

export function $removeTableColumnAligns(table: TableNode, from: number, to: number): void {
  const aligns = $getTableColumnAligns(table);
  if (from >= aligns.length) return;
  const next = [...aligns];
  next.splice(from, to - from + 1);
  $setTableColumnAligns(table, next);
}

export function $moveTableColumnAligns(
  table: TableNode,
  from: number,
  to: number,
  target: number,
): void {
  const aligns = $getTableColumnAligns(table);
  if (aligns.length === 0) return;
  const columnCount = Math.max(table.getColumnCount(), aligns.length);
  const filled = Array.from({ length: columnCount }, (_, index) => aligns[index] ?? null);
  const moved = filled.slice(from, to + 1);
  const next = [...filled.slice(0, from), ...filled.slice(to + 1)];
  next.splice(target, 0, ...moved);
  $setTableColumnAligns(table, next);
}

function $getSelectionColumnRange() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return null;
  const anchor = selection.anchor.getNode();
  const focus = selection.focus.getNode();
  const [anchorCell] = $getNodeTriplet(anchor);
  const [focusCell, , table] = $getNodeTriplet(focus);
  const [, anchorMap, focusMap] = $computeTableMap(table, anchorCell, focusCell);
  return {
    end: Math.max(
      anchorMap.startColumn + anchorCell.getColSpan() - 1,
      focusMap.startColumn + focusCell.getColSpan() - 1,
    ),
    start: Math.min(anchorMap.startColumn, focusMap.startColumn),
    table,
  };
}

export function $insertTableColumnAtSelectionWithAlign(insertAfter = true) {
  const range = $getSelectionColumnRange();
  const inserted = $insertTableColumnAtSelection(insertAfter);
  if (range && range.table.isAttached()) {
    $insertTableColumnAligns(range.table, insertAfter ? range.end + 1 : range.start);
  }
  return inserted;
}

export function $deleteTableColumnAtSelectionWithAlign(): void {
  const range = $getSelectionColumnRange();
  $deleteTableColumnAtSelection();
  if (range && range.table.isAttached()) {
    $removeTableColumnAligns(range.table, range.start, range.end);
  }
}

export function $getTableCellColumnAlign(cell: TableCellNode): TableColumnAlign {
  const row = cell.getParent();
  const table = row?.getParent();
  if (!$isTableRowNode(row) || !$isTableNode(table)) return null;
  const aligns = $getTableColumnAligns(table);
  if (aligns.length === 0) return null;
  const [, cellMap] = $computeTableMapSkipCellCheck(table, cell, cell);
  return aligns[cellMap?.startColumn ?? -1] ?? null;
}

export function parseTableColumnAlignsAttribute(value: string | null): TableColumnAlign[] {
  return value ? normalizeTableColumnAligns(value.split(',')) : [];
}

export function stringifyTableColumnAligns(aligns: TableColumnAlign[]): string {
  return aligns.map((align) => align ?? '').join(',');
}

const MARKDOWN_DELIMITERS: Record<'center' | 'left' | 'none' | 'right', string> = {
  center: ':-:',
  left: ':--',
  none: '---',
  right: '--:',
};

export function getTableMarkdownDelimiterRow(
  columnCount: number,
  aligns: TableColumnAlign[],
): string {
  const cells = Array.from(
    { length: columnCount },
    (_, index) => `|${MARKDOWN_DELIMITERS[aligns[index] ?? 'none']}`,
  );
  return `${cells.join('')}|`;
}

export function $getTableMarkdownDelimiterRow(table: TableNode): string {
  const columnCount = table.getColWidths()?.length || table.getColumnCount();
  return getTableMarkdownDelimiterRow(columnCount, $getTableColumnAligns(table));
}
