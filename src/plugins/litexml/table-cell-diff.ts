import {
  $createTableCellNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  type TableCellNode,
  type TableNode,
} from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { $nodesOfType } from 'lexical';

import { $createDiffNode, DiffNode } from './node/DiffNode';
import {
  $createTableCellDiffNode,
  TableCellDiffNode,
  type TableCellDiffType,
} from './node/TableCellDiffNode';
import { $cloneNode } from './utils';

export type AnyTableCell = TableCellNode | TableCellDiffNode;

function copyCellStructure(source: AnyTableCell, target: AnyTableCell): void {
  target.setRowSpan(source.getRowSpan());
  target.setBackgroundColor(source.getBackgroundColor());
  target.setVerticalAlign(source.getVerticalAlign());
}

export function $createTableCellDiffFromCell(
  editor: LexicalEditor,
  cell: TableCellNode,
  diffType: TableCellDiffType,
  changeId?: string,
): TableCellDiffNode {
  const diffCell = $createTableCellDiffNode(
    diffType,
    changeId,
    cell.getHeaderStyles(),
    cell.getColSpan(),
    cell.getWidth(),
  );
  copyCellStructure(cell, diffCell);

  const diff = $createDiffNode(diffType);
  diff.append(...cell.getChildren().map((child) => $cloneNode(child, editor)));
  diffCell.append(diff);
  return diffCell;
}

export function $createPlainTableCellFromDiff(
  editor: LexicalEditor,
  cell: TableCellDiffNode,
): TableCellNode {
  const plainCell = $createTableCellNode(
    cell.getHeaderStyles(),
    cell.getColSpan(),
    cell.getWidth(),
  );
  copyCellStructure(cell, plainCell);

  const diff = cell.getFirstChild();
  if (diff instanceof DiffNode) {
    plainCell.append(...diff.getChildren().map((child) => $cloneNode(child, editor)));
  } else {
    plainCell.append(...cell.getChildren().map((child) => $cloneNode(child, editor)));
  }
  return plainCell;
}

export function $getTableForCell(cell: AnyTableCell): TableNode | null {
  const row = cell.getParent();
  if (!$isTableRowNode(row)) return null;
  const table = row.getParent();
  return $isTableNode(table) ? table : null;
}

export function $getTableCellColumnIndex(cell: AnyTableCell): number {
  const row = cell.getParent();
  if (!$isTableRowNode(row)) return -1;
  let index = 0;
  for (const sibling of row.getChildren()) {
    if (sibling === cell) return index;
    if ($isTableCellNode(sibling)) index += sibling.getColSpan();
  }
  return -1;
}

export function $getLogicalRowWidth(cell: AnyTableCell): number {
  const row = cell.getParent();
  if (!$isTableRowNode(row)) return 0;
  return row
    .getChildren()
    .reduce((total, child) => total + ($isTableCellNode(child) ? child.getColSpan() : 0), 0);
}

export function $getTableCellDiffGroup(cell: TableCellDiffNode): TableCellDiffNode[] {
  const changeId = cell.getChangeId();
  const table = $getTableForCell(cell);
  if (!changeId || !table) return [cell];
  return $nodesOfType(TableCellDiffNode).filter(
    (candidate) =>
      candidate.getChangeId() === changeId &&
      candidate.getDiffType() === cell.getDiffType() &&
      $getTableForCell(candidate) === table,
  );
}

export function $updateTableWidthsForCellInsertion(
  table: TableNode,
  rowWidthBefore: number,
  columnIndex: number,
  insertedSpan: number,
): void {
  const currentWidths = table.getColWidths() || Array.from({ length: rowWidthBefore }, () => 250);
  // The first row operation expands the table. Following row operations fill
  // the columns that already exist and must not expand colWidths repeatedly.
  if (rowWidthBefore < currentWidths.length) return;
  const fallback = currentWidths[Math.max(0, columnIndex - 1)] || 250;
  const next = [...currentWidths];
  next.splice(columnIndex, 0, ...Array.from({ length: insertedSpan }, () => fallback));
  table.setColWidths(next);
}

export function $removeTableWidthsForCompleteCellGroup(
  table: TableNode,
  group: TableCellDiffNode[],
  columnIndex: number,
  span: number,
): void {
  const rows = table.getChildren().filter($isTableRowNode);
  const rowKeys = new Set(group.map((cell) => cell.getParent()?.getKey()));
  if (rows.length !== rowKeys.size) return;
  const widths = table.getColWidths();
  if (!widths) return;
  const next = [...widths];
  next.splice(columnIndex, span);
  table.setColWidths(next);
}

export function $shrinkTableWidthsAfterCellRemoval(
  table: TableNode,
  columnIndex: number,
  span: number,
): void {
  const widths = table.getColWidths();
  if (!widths) return;
  const widestRow = table.getChildren().reduce((max, row) => {
    if (!$isTableRowNode(row)) return max;
    return Math.max(
      max,
      row
        .getChildren()
        .reduce((total, cell) => total + ($isTableCellNode(cell) ? cell.getColSpan() : 0), 0),
    );
  }, 0);
  if (widestRow > widths.length - span) return;
  const next = [...widths];
  next.splice(columnIndex, span);
  table.setColWidths(next);
}
