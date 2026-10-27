import { $getTableCellNodeRect, $isTableCellNode, type TableNode } from '@lexical/table';
import { $getNearestNodeFromDOMNode, type LexicalEditor } from 'lexical';

export interface TableHover {
  column: number;
  row: number;
}

export interface GripRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface TableGeometry {
  column: GripRect;
  row: GripRect;
  table: GripRect;
}

export const getTableElement = (editor: LexicalEditor, node: TableNode) => {
  const element = editor.getElementByKey(node.getKey());
  if (!element) return null;
  return element instanceof HTMLTableElement ? element : element.querySelector('table');
};

export function readHover(editor: LexicalEditor, target: EventTarget | null): TableHover | null {
  if (!(target instanceof Element)) return null;
  const cellElement = target.closest('td, th');
  if (!cellElement) return null;
  return editor.read(() => {
    const cell = $getNearestNodeFromDOMNode(cellElement);
    if (!$isTableCellNode(cell)) return null;
    const rect = $getTableCellNodeRect(cell);
    return rect ? { column: rect.columnIndex, row: rect.rowIndex } : null;
  });
}

const toLocal = (rect: DOMRect, origin: DOMRect): GripRect => ({
  height: rect.height,
  left: rect.left - origin.left,
  top: rect.top - origin.top,
  width: rect.width,
});

function findColumnCell(table: HTMLTableElement, column: number) {
  for (const row of table.rows) {
    let index = 0;
    for (const cell of row.cells) {
      if (index === column && cell.colSpan === 1) return cell;
      index += cell.colSpan;
    }
  }
  return null;
}

export function measure(
  table: HTMLTableElement,
  origin: DOMRect,
  hover: TableHover,
): TableGeometry | null {
  const row = table.rows[hover.row];
  const cell = findColumnCell(table, hover.column);
  if (!row || !cell) return null;
  const tableRect = table.getBoundingClientRect();
  return {
    column: toLocal(cell.getBoundingClientRect(), origin),
    row: toLocal(row.getBoundingClientRect(), origin),
    table: toLocal(tableRect, origin),
  };
}

export function indexAtPoint(
  table: HTMLTableElement,
  axis: 'column' | 'row',
  point: number,
): { index: number; insertAfter: boolean } | null {
  const rects =
    axis === 'row'
      ? [...table.rows].map((row) => row.getBoundingClientRect())
      : [...(table.rows[0]?.cells ?? [])].map((cell) => cell.getBoundingClientRect());
  if (rects.length === 0) return null;
  for (const [index, rect] of rects.entries()) {
    const start = axis === 'row' ? rect.top : rect.left;
    const size = axis === 'row' ? rect.height : rect.width;
    if (point < start + size) return { index, insertAfter: point > start + size / 2 };
  }
  return { index: rects.length - 1, insertAfter: true };
}

export interface Span {
  end: number;
  start: number;
}

export interface InsertBoundary {
  index: number;
  insertAfter: boolean;
  position: number;
}

const BOUNDARY_TOLERANCE = 6;

export function findInsertBoundary(spans: Span[], point: number): InsertBoundary | null {
  if (spans.length === 0) return null;
  const boundaries = [spans[0].start, ...spans.map((span) => span.end)];
  let best: number | null = null;
  for (const [index, position] of boundaries.entries()) {
    const distance = Math.abs(point - position);
    if (distance > BOUNDARY_TOLERANCE) continue;
    if (best === null || distance < Math.abs(point - boundaries[best])) best = index;
  }
  if (best === null) return null;
  const last = spans.length - 1;
  return best > last
    ? { index: last, insertAfter: true, position: boundaries[best] }
    : { index: best, insertAfter: false, position: boundaries[best] };
}

export function getSpans(table: HTMLTableElement, axis: 'column' | 'row'): Span[] {
  if (axis === 'row') {
    return [...table.rows].map((row) => {
      const rect = row.getBoundingClientRect();
      return { end: rect.bottom, start: rect.top };
    });
  }
  const columns: Span[] = [];
  for (const row of table.rows) {
    let index = 0;
    for (const cell of row.cells) {
      if (cell.colSpan === 1 && !columns[index]) {
        const rect = cell.getBoundingClientRect();
        columns[index] = { end: rect.right, start: rect.left };
      }
      index += cell.colSpan;
    }
  }
  return columns.filter(Boolean);
}
