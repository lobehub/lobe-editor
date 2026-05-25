import type { TableNode } from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MIN_COLUMN_WIDTH } from '../TableResize/style';

export interface DragTarget {
  index: number;
  insertAfter: boolean;
}

const CONTROL_SIZE = 14;
const ROW_BORDER_HEIGHT = 0.5;

export const sum = (values: number[]) => {
  return values.reduce((total, value) => total + value, 0);
};

const getTableElement = (element: HTMLElement | null) => {
  if (element instanceof HTMLTableElement) {
    return element;
  }

  return (element?.querySelector('table.editor_table, table') as HTMLTableElement | null) || null;
};

const readNodeColWidths = (editor: LexicalEditor, node: TableNode) => {
  return editor.getEditorState().read(() => {
    const latestNode = node.getLatest();
    const columnCount = latestNode.getColumnCount();
    const colWidths = latestNode.getColWidths();

    return Array.from(
      { length: columnCount },
      (_, index) => colWidths?.[index] || MIN_COLUMN_WIDTH,
    );
  });
};

const normalizeRowControllerHeight = (height: number, isLastRow = false) => {
  return Math.max(CONTROL_SIZE, Math.round(height) - (isLastRow ? 0 : ROW_BORDER_HEIGHT));
};

const getControlledRowHeights = (rowHeights: number[], tableHeight: number) => {
  if (rowHeights.length === 0 || tableHeight <= 0) {
    return rowHeights;
  }

  const lastRowIndex = rowHeights.length - 1;
  const previousRowsHeight = sum(rowHeights.slice(0, lastRowIndex));
  const lastRowHeight = Math.max(CONTROL_SIZE, tableHeight - previousRowsHeight);

  return rowHeights.map((height, index) => (index === lastRowIndex ? lastRowHeight : height));
};

export const useTableColumnMetrics = (editor: LexicalEditor, node: TableNode) => {
  const [colWidths, setColWidths] = useState(() => readNodeColWidths(editor, node));
  const [tableHeight, setTableHeight] = useState(0);

  const refreshColumnMetrics = useCallback(() => {
    const nodeColWidths = readNodeColWidths(editor, node);
    const tableElement = getTableElement(editor.getElementByKey(node.getKey()));

    setColWidths((currentWidths) => {
      if (
        currentWidths.length === nodeColWidths.length &&
        currentWidths.every((width, index) => width === nodeColWidths[index])
      ) {
        return currentWidths;
      }

      return nodeColWidths;
    });

    if (tableElement) {
      setTableHeight(tableElement.getBoundingClientRect().height);
    }
  }, [editor, node]);

  useEffect(() => {
    const tableElement = getTableElement(editor.getElementByKey(node.getKey()));

    let frame: number | null = null;

    const scheduleMeasure = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;
        refreshColumnMetrics();
      });
    };

    scheduleMeasure();

    if (!tableElement) {
      const unregisterUpdate = editor.registerUpdateListener(scheduleMeasure);

      return () => {
        if (frame !== null) {
          cancelAnimationFrame(frame);
        }
        unregisterUpdate();
      };
    }

    const resizeObserver = new ResizeObserver(refreshColumnMetrics);
    resizeObserver.observe(tableElement);

    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(tableElement, {
      childList: true,
      subtree: true,
    });

    const unregisterUpdate = editor.registerUpdateListener(scheduleMeasure);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      unregisterUpdate();
    };
  }, [editor, node, refreshColumnMetrics]);

  return { colWidths, refreshColumnMetrics, tableHeight };
};

export const useTableRowMetrics = (editor: LexicalEditor, node: TableNode) => {
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [tableWidth, setTableWidth] = useState(0);

  useEffect(() => {
    const tableElement = editor.getElementByKey(node.getKey());
    const table = tableElement?.querySelector('table.editor_table, table') ?? tableElement;

    if (!(tableElement instanceof HTMLElement)) {
      return;
    }

    let frame: number | null = null;

    const measure = () => {
      const rows = tableElement.querySelectorAll('tr');

      if (rows.length === 0) {
        return;
      }

      const tableRect = table instanceof HTMLElement ? table.getBoundingClientRect() : null;
      const measuredHeights = Array.from(rows, (row, index) => {
        return normalizeRowControllerHeight(
          row.getBoundingClientRect().height,
          index + 1 === rows.length,
        );
      });
      const nextHeights = getControlledRowHeights(measuredHeights, tableRect?.height || 0);

      setRowHeights((currentHeights) => {
        if (
          currentHeights.length === nextHeights.length &&
          currentHeights.every((height, index) => height === nextHeights[index])
        ) {
          return currentHeights;
        }

        return nextHeights;
      });
      setTableWidth(tableRect?.width || 0);
    };

    const scheduleMeasure = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    scheduleMeasure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(tableElement);

    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(tableElement, {
      childList: true,
      subtree: true,
    });

    const unregisterUpdate = editor.registerUpdateListener(scheduleMeasure);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      unregisterUpdate();
    };
  }, [editor, node]);

  return { rowHeights, tableWidth };
};

interface TableAxisDragOptions {
  getDropTarget: (event: DragEvent) => DragTarget | null;
  onMove: (target: DragTarget, selectedIndexes: number[]) => void;
}

export const useTableAxisDrag = ({ getDropTarget, onMove }: TableAxisDragOptions) => {
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const [isDragging, setDragging] = useState(false);
  const selectedIndexesRef = useRef<number[] | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const clearDragState = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    selectedIndexesRef.current = null;
    dragTargetRef.current = null;
    setDragging(false);
    setDragTarget(null);
  }, []);

  const updateDragTarget = useCallback(
    (event: DragEvent) => {
      const target = getDropTarget(event);
      dragTargetRef.current = target;
      setDragTarget(target);
    },
    [getDropTarget],
  );

  const finishDrag = useCallback(() => {
    const selectedIndexes = selectedIndexesRef.current;
    const target = dragTargetRef.current;

    if (selectedIndexes && target) {
      onMove(target, selectedIndexes);
    }

    clearDragState();
  }, [clearDragState, onMove]);

  const startDrag = useCallback(
    (event: DragEvent, selectedIndexes: number[]) => {
      selectedIndexesRef.current = selectedIndexes;
      setDragging(true);
      updateDragTarget(event);

      const body = document.body;
      const handleDragOver = (dragEvent: DragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = 'move';
        }
        updateDragTarget(dragEvent);
      };
      const handleDragEnd = (dragEvent: DragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        finishDrag();
      };

      cleanupRef.current?.();
      cleanupRef.current = () => {
        body.removeEventListener('dragover', handleDragOver);
        body.removeEventListener('drop', handleDragEnd);
        body.removeEventListener('dragend', handleDragEnd);
      };
      body.addEventListener('dragover', handleDragOver);
      body.addEventListener('drop', handleDragEnd);
      body.addEventListener('dragend', handleDragEnd);
    },
    [finishDrag, updateDragTarget],
  );

  useEffect(() => {
    return clearDragState;
  }, [clearDragState]);

  return {
    clearDragState,
    dragTarget,
    finishDrag,
    isDragging,
    startDrag,
  };
};
