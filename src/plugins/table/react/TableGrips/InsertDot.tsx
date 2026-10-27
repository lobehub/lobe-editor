import type { TableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { PlusIcon } from 'lucide-react';
import { type FC, type RefObject, useEffect, useState } from 'react';

import { INSERT_TABLE_COLUMN_COMMAND, INSERT_TABLE_ROW_COMMAND } from '../../command';
import { findInsertBoundary, getSpans, getTableElement, type InsertBoundary } from './geometry';
import { styles } from './style';

const EDGE_OUTSIDE = 14;
const EDGE_INSIDE = 4;

interface InsertTarget extends InsertBoundary {
  axis: 'column' | 'row';
  origin: DOMRect;
  table: DOMRect;
}

interface InsertDotProps {
  editor: LexicalEditor;
  label: (axis: 'column' | 'row') => string;
  layerRef: RefObject<HTMLDivElement | null>;
  node: TableNode;
}

const isCorner = ({ index, insertAfter }: InsertBoundary) => index === 0 && !insertAfter;

function locate(table: HTMLTableElement, x: number, y: number) {
  const rect = table.getBoundingClientRect();
  const nearLeft = x >= rect.left - EDGE_OUTSIDE && x <= rect.left + EDGE_INSIDE;
  const nearTop = y >= rect.top - EDGE_OUTSIDE && y <= rect.top + EDGE_INSIDE;
  if (nearLeft && y >= rect.top - EDGE_OUTSIDE && y <= rect.bottom + EDGE_OUTSIDE) {
    const boundary = findInsertBoundary(getSpans(table, 'row'), y);
    if (boundary && !isCorner(boundary)) return { ...boundary, axis: 'row' as const, table: rect };
  }
  if (nearTop && x >= rect.left - EDGE_OUTSIDE && x <= rect.right + EDGE_OUTSIDE) {
    const boundary = findInsertBoundary(getSpans(table, 'column'), x);
    if (boundary && !isCorner(boundary))
      return { ...boundary, axis: 'column' as const, table: rect };
  }
  return null;
}

const InsertDot: FC<InsertDotProps> = ({ editor, label, layerRef, node }) => {
  const [target, setTarget] = useState<InsertTarget | null>(null);
  const tableKey = node.getKey();

  useEffect(() => {
    const element = editor.getElementByKey(tableKey);
    if (!element) return;
    const handleMove = (event: PointerEvent) => {
      const table = getTableElement(editor, node);
      const layer = layerRef.current;
      if (!table || !layer) return;
      if (layer.contains(event.target as Node)) return;
      const next = locate(table, event.clientX, event.clientY);
      setTarget(next ? { ...next, origin: layer.getBoundingClientRect() } : null);
    };
    const handleLeave = (event: PointerEvent) => {
      if (layerRef.current?.contains(event.relatedTarget as Node)) return;
      setTarget(null);
    };
    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerleave', handleLeave);
    return () => {
      element.removeEventListener('pointermove', handleMove);
      element.removeEventListener('pointerleave', handleLeave);
    };
  }, [editor, layerRef, node, tableKey]);

  if (!target) return null;

  const { axis, index, insertAfter, origin, position, table } = target;
  const isRow = axis === 'row';
  const insert = () => {
    if (isRow) {
      editor.dispatchCommand(INSERT_TABLE_ROW_COMMAND, {
        insertAfter,
        rowIndex: index,
        table: tableKey,
      });
    } else {
      editor.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
        columnIndex: index,
        insertAfter,
        table: tableKey,
      });
    }
    setTarget(null);
  };

  const along = position - (isRow ? origin.top : origin.left);

  return (
    <>
      <div
        className={styles.insertLine}
        style={
          isRow
            ? { height: 2, left: table.left - origin.left, top: along - 1, width: table.width }
            : { height: table.height, left: along - 1, top: table.top - origin.top, width: 2 }
        }
      />
      <button
        aria-label={label(axis)}
        className={styles.insertDot}
        onClick={insert}
        onMouseDown={(event) => event.preventDefault()}
        onPointerLeave={() => setTarget(null)}
        style={
          isRow
            ? { left: table.left - origin.left - 8, top: along - 8 }
            : { left: along - 8, top: table.top - origin.top - 8 }
        }
        type="button"
      >
        <PlusIcon size={10} strokeWidth={3} />
      </button>
    </>
  );
};

export default InsertDot;
