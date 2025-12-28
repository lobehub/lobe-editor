import {
  $computeTableMapSkipCellCheck,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $isTableCellNode,
  $isTableRowNode,
  TableCellNode,
  TableDOMCell,
  TableNode,
  getDOMCellFromTarget,
  getTableElement,
} from '@lexical/table';
import { calculateZoomLevel, mergeRegister } from '@lexical/utils';
import { cssVar, cx } from 'antd-style';
import EventEmitter from 'eventemitter3';
import {
  $getNearestNodeFromDOMNode,
  LexicalEditor,
  NodeKey,
  SKIP_SCROLL_INTO_VIEW_TAG,
  isHTMLElement,
} from 'lexical';
import {
  type CSSProperties,
  type PointerEventHandler,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT, styles } from './style';
import { getCellColumnIndex, getCellNodeHeight } from './utils';

export interface ReactTableResizeHandleProps {
  editor: LexicalEditor;
  eventEmitter: EventEmitter;
}

type PointerPosition = {
  x: number;
  y: number;
};

type PointerDraggingDirection = 'right' | 'bottom';

export const TableCellResize = memo<ReactTableResizeHandleProps>(({ editor, eventEmitter }) => {
  const targetRef = useRef<HTMLElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line no-undef
  const tableRectRef = useRef<ClientRect | null>(null);
  const [hasTable, setHasTable] = useState(false);

  const pointerStartPosRef = useRef<PointerPosition | null>(null);
  const [pointerCurrentPos, updatePointerCurrentPos] = useState<PointerPosition | null>(null);

  const [activeCell, updateActiveCell] = useState<TableDOMCell | null>(null);
  const [draggingDirection, updateDraggingDirection] = useState<PointerDraggingDirection | null>(
    null,
  );

  const resetState = useCallback(() => {
    updateActiveCell(null);
    targetRef.current = null;
    updateDraggingDirection(null);
    pointerStartPosRef.current = null;
    tableRectRef.current = null;
  }, []);

  useEffect(() => {
    const tableKeys = new Set<NodeKey>();
    return mergeRegister(
      editor.registerMutationListener(TableNode, (nodeMutations) => {
        for (const [nodeKey, mutation] of nodeMutations) {
          if (mutation === 'destroyed') {
            tableKeys.delete(nodeKey);
          } else {
            tableKeys.add(nodeKey);
          }
        }
        setHasTable(tableKeys.size > 0);
      }),
      editor.registerNodeTransform(TableNode, (tableNode) => {
        if (tableNode.getColWidths()) {
          return tableNode;
        }

        const numColumns = tableNode.getColumnCount();
        const columnWidth = MIN_COLUMN_WIDTH;

        // eslint-disable-next-line unicorn/no-new-array
        tableNode.setColWidths(new Array(numColumns).fill(columnWidth));
        return tableNode;
      }),
    );
  }, [editor]);

  useEffect(() => {
    if (!hasTable) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      if (!isHTMLElement(target)) {
        return;
      }

      if (draggingDirection) {
        event.preventDefault();
        event.stopPropagation();
        updatePointerCurrentPos({
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      if (resizerRef.current && resizerRef.current.contains(target)) {
        return;
      }

      if (targetRef.current !== target) {
        targetRef.current = target;
        const cell = getDOMCellFromTarget(target);

        if (cell && activeCell !== cell) {
          editor.getEditorState().read(
            () => {
              const tableCellNode = $getNearestNodeFromDOMNode(cell.elem);
              if (!tableCellNode) {
                throw new Error('TableCellResizer: Table cell node not found.');
              }

              const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
              const tableElement = getTableElement(
                tableNode,
                editor.getElementByKey(tableNode.getKey()),
              );

              if (!tableElement) {
                throw new Error('TableCellResizer: Table element not found.');
              }

              targetRef.current = target as HTMLElement;
              tableRectRef.current = tableElement.getBoundingClientRect();
              updateActiveCell(cell);
            },
            { editor },
          );
        } else if (!cell) {
          resetState();
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const isTouchEvent = event.pointerType === 'touch';
      if (isTouchEvent) {
        onPointerMove(event);
      }
    };

    const resizerContainer = resizerRef.current;
    resizerContainer?.addEventListener('pointermove', onPointerMove, {
      capture: true,
    });

    const removeRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener('pointermove', onPointerMove);
      prevRootElement?.removeEventListener('pointerdown', onPointerDown);
      rootElement?.addEventListener('pointermove', onPointerMove);
      rootElement?.addEventListener('pointerdown', onPointerDown);
    });

    return () => {
      removeRootListener();
      resizerContainer?.removeEventListener('pointermove', onPointerMove);
    };
  }, [activeCell, draggingDirection, editor, resetState, hasTable]);

  const isHeightChanging = (direction: PointerDraggingDirection) => {
    if (direction === 'bottom') {
      return true;
    }
    return false;
  };

  const updateRowHeight = useCallback(
    (heightChange: number) => {
      if (!activeCell) {
        throw new Error('TableCellResizer: Expected active cell.');
      }

      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error('TableCellResizer: Table cell node not found.');
          }

          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const baseRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
          const tableRows = tableNode.getChildren();

          // Determine if this is a full row merge by checking colspan
          const isFullRowMerge = tableCellNode.getColSpan() === tableNode.getColumnCount();

          // For full row merges, apply to first row. For partial merges, apply to last row
          const tableRowIndex = isFullRowMerge
            ? baseRowIndex
            : baseRowIndex + tableCellNode.getRowSpan() - 1;

          if (tableRowIndex >= tableRows.length || tableRowIndex < 0) {
            throw new Error('Expected table cell to be inside of table row.');
          }

          const tableRow = tableRows[tableRowIndex];

          if (!$isTableRowNode(tableRow)) {
            throw new Error('Expected table row');
          }

          let height = tableRow.getHeight();
          if (height === undefined) {
            const rowCells = tableRow.getChildren<TableCellNode>();
            height = Math.min(
              ...rowCells.map(
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                (cell) => getCellNodeHeight(cell, editor) ?? Infinity,
              ),
            );
          }

          const newHeight = Math.max(height + heightChange, MIN_ROW_HEIGHT);
          tableRow.setHeight(newHeight);
          eventEmitter.emit('table:resize', {
            heightChange,
            newHeight,
          });
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
    },
    [activeCell, editor],
  );

  const updateColumnWidth = useCallback(
    (widthChange: number) => {
      if (!activeCell) {
        throw new Error('TableCellResizer: Expected active cell.');
      }
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error('TableCellResizer: Table cell node not found.');
          }

          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
          const columnIndex = getCellColumnIndex(tableCellNode, tableMap);
          if (columnIndex === undefined) {
            throw new Error('TableCellResizer: Table column not found.');
          }

          const colWidths = tableNode.getColWidths();
          if (!colWidths) {
            return;
          }
          const width = colWidths[columnIndex];
          if (width === undefined) {
            return;
          }
          const newColWidths = [...colWidths];
          const newWidth = Math.max(width + widthChange, MIN_COLUMN_WIDTH);
          newColWidths[columnIndex] = newWidth;
          tableNode.setColWidths(newColWidths);
          requestAnimationFrame(() => {
            eventEmitter.emit('table:resize', {
              newColWidths,
            });
          });
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
    },
    [activeCell, editor],
  );

  const pointerUpHandler = useCallback(
    (direction: PointerDraggingDirection) => {
      const handler = (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!activeCell) {
          throw new Error('TableCellResizer: Expected active cell.');
        }

        if (pointerStartPosRef.current) {
          const { x, y } = pointerStartPosRef.current;

          if (activeCell === null) {
            return;
          }
          const zoom = calculateZoomLevel(event.target as Element);

          if (isHeightChanging(direction)) {
            const heightChange = (event.clientY - y) / zoom;
            updateRowHeight(heightChange);
          } else {
            const widthChange = (event.clientX - x) / zoom;
            updateColumnWidth(widthChange);
          }

          resetState();
          if (typeof document !== 'undefined') {
            document.removeEventListener('pointerup', handler);
          }
        }
      };
      return handler;
    },
    [activeCell, resetState, updateColumnWidth, updateRowHeight],
  );

  const toggleResize = useCallback(
    (direction: PointerDraggingDirection): PointerEventHandler<HTMLDivElement> =>
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!activeCell) {
          throw new Error('TableCellResizer: Expected active cell.');
        }

        pointerStartPosRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        updatePointerCurrentPos(pointerStartPosRef.current);
        updateDraggingDirection(direction);

        if (typeof document !== 'undefined') {
          document.addEventListener('pointerup', pointerUpHandler(direction));
        }
      },
    [activeCell, pointerUpHandler],
  );

  const getResizers = useCallback(() => {
    if (activeCell) {
      const { height, width, top, left } = activeCell.elem.getBoundingClientRect();
      const zoom = calculateZoomLevel(activeCell.elem);
      const zoneWidth = 16; // Pixel width of the zone where you can drag the edge

      // Default to 0 for server side
      const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
      const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

      const styles: Record<string, CSSProperties> = {
        bottom: {
          backgroundColor: 'none',
          cursor: 'row-resize',
          height: `${zoneWidth}px`,
          left: `${scrollX + left}px`,
          top: `${scrollY + top + height - zoneWidth / 2}px`,
          width: `${width}px`,
        },
        right: {
          backgroundColor: 'none',
          cursor: 'col-resize',
          height: `${height}px`,
          left: `${scrollX + left + width - zoneWidth / 2}px`,
          top: `${scrollY + top}px`,
          width: `${zoneWidth}px`,
        },
      };

      const tableRect = tableRectRef.current;

      if (draggingDirection && pointerCurrentPos && tableRect) {
        if (isHeightChanging(draggingDirection)) {
          styles[draggingDirection].left = `${scrollX + tableRect.left}px`;
          styles[draggingDirection].top = `${scrollY + pointerCurrentPos.y / zoom}px`;
          styles[draggingDirection].height = '3px';
          styles[draggingDirection].width = `${tableRect.width}px`;
        } else {
          styles[draggingDirection].top = `${scrollY + tableRect.top}px`;
          styles[draggingDirection].left = `${scrollX + pointerCurrentPos.x / zoom}px`;
          styles[draggingDirection].width = '3px';
          styles[draggingDirection].height = `${tableRect.height}px`;
        }

        styles[draggingDirection].backgroundColor = cssVar.colorPrimary;
        styles[draggingDirection].mixBlendMode = 'unset';
      }

      return styles;
    }

    return {
      bottom: null,
      left: null,
      right: null,
      top: null,
    };
  }, [activeCell, draggingDirection, pointerCurrentPos]);

  const resizerStyles = getResizers();

  return (
    <div ref={resizerRef}>
      {activeCell && (
        <>
          <div
            className={cx(styles, 'TableCellResizer__resizer', 'TableCellResizer__ui')}
            onPointerDown={toggleResize('right')}
            style={resizerStyles.right || undefined}
          />
          <div
            className={cx(styles, 'TableCellResizer__resizer', 'TableCellResizer__ui')}
            onPointerDown={toggleResize('bottom')}
            style={resizerStyles.bottom || undefined}
          />
        </>
      )}
    </div>
  );
});

export default memo<ReactTableResizeHandleProps>(({ editor, eventEmitter }) => {
  // Don't render portal on server side
  if (typeof document === 'undefined') {
    return null;
  }

  // Mount to .ant-app if exists, otherwise document.body
  const container = (document.querySelector('.ant-app') as HTMLElement) || document.body;

  return createPortal(<TableCellResize editor={editor} eventEmitter={eventEmitter} />, container);
});
