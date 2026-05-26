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

import { createDefaultTableColWidths } from '../../utils';
import type { TableResizeMode } from '../type';
import { MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT, styles } from './style';
import { getCellColumnIndex, getCellNodeHeight } from './utils';

interface TableResizeProps {
  editor: LexicalEditor;
  eventEmitter: EventEmitter;
  resizeMode: TableResizeMode;
}

type PointerPosition = {
  x: number;
  y: number;
};

type PointerDraggingDirection = 'right' | 'bottom';
type ResizeStartState = PointerPosition &
  (
    | {
        columnIndex: number;
        direction: 'right';
        size: number;
      }
    | {
        direction: 'bottom';
        rowIndex: number;
        size: number;
      }
  );

const isHeightChanging = (direction: PointerDraggingDirection) => {
  if (direction === 'bottom') {
    return true;
  }
  return false;
};

const syncTableWidthDOM = (
  editor: LexicalEditor,
  tableKey: NodeKey,
  colWidths: readonly number[],
) => {
  const tableElement = editor.getElementByKey(tableKey);
  const table =
    tableElement instanceof HTMLTableElement
      ? tableElement
      : tableElement?.querySelector('table.editor_table, table');

  if (!(table instanceof HTMLTableElement)) {
    return;
  }

  table.style.width = `${colWidths.reduce((total, width) => total + width, 0)}px`;
};

export const TableCellResize = memo<TableResizeProps>(({ editor, eventEmitter, resizeMode }) => {
  const targetRef = useRef<HTMLElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line no-undef
  const tableRectRef = useRef<ClientRect | null>(null);
  const [hasTable, setHasTable] = useState(false);

  const resizeStartStateRef = useRef<ResizeStartState | null>(null);
  const [pointerCurrentPos, updatePointerCurrentPos] = useState<PointerPosition | null>(null);

  const [activeCell, updateActiveCell] = useState<TableDOMCell | null>(null);
  const [draggingDirection, updateDraggingDirection] = useState<PointerDraggingDirection | null>(
    null,
  );

  const resetState = useCallback(() => {
    updateActiveCell(null);
    targetRef.current = null;
    updateDraggingDirection(null);
    updatePointerCurrentPos(null);
    resizeStartStateRef.current = null;
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
        const colWidths = tableNode.getColWidths();
        const numColumns = tableNode.getColumnCount();
        if (colWidths && colWidths.length === numColumns) {
          return tableNode;
        }

        tableNode.setColWidths(createDefaultTableColWidths(numColumns));
        return tableNode;
      }),
    );
  }, [editor]);

  const getResizeStartState = useCallback(
    (direction: PointerDraggingDirection, startPos: PointerPosition) => {
      if (!activeCell) {
        throw new Error('TableCellResizer: Expected active cell.');
      }

      let resizeState: ResizeStartState | null = null;
      editor.getEditorState().read(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error('TableCellResizer: Table cell node not found.');
          }

          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

          if (!isHeightChanging(direction)) {
            const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
            const columnIndex = getCellColumnIndex(tableCellNode, tableMap);
            if (columnIndex === undefined) {
              throw new Error('TableCellResizer: Table column not found.');
            }

            const width = tableNode.getColWidths()?.[columnIndex] ?? MIN_COLUMN_WIDTH;
            resizeState = {
              ...startPos,
              columnIndex,
              direction: 'right',
              size: width,
            };
            return;
          }

          const baseRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);
          const tableRows = tableNode.getChildren();
          const isFullRowMerge = tableCellNode.getColSpan() === tableNode.getColumnCount();
          const rowIndex = isFullRowMerge
            ? baseRowIndex
            : baseRowIndex + tableCellNode.getRowSpan() - 1;

          if (rowIndex >= tableRows.length || rowIndex < 0) {
            throw new Error('Expected table cell to be inside of table row.');
          }

          const tableRow = tableRows[rowIndex];

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

          resizeState = {
            ...startPos,
            direction: 'bottom',
            rowIndex,
            size: height,
          };
        },
        { editor },
      );

      return resizeState;
    },
    [activeCell, editor],
  );

  const updateRowHeight = useCallback(
    (rowIndex: number, nextHeight: number) => {
      if (!activeCell) {
        throw new Error('TableCellResizer: Expected active cell.');
      }

      let didUpdate = false;
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error('TableCellResizer: Table cell node not found.');
          }

          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const tableRows = tableNode.getChildren();
          if (rowIndex >= tableRows.length || rowIndex < 0) {
            throw new Error('Expected table cell to be inside of table row.');
          }

          const tableRow = tableRows[rowIndex];

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

          const newHeight = Math.max(nextHeight, MIN_ROW_HEIGHT);
          tableRow.setHeight(newHeight);
          didUpdate = true;
          eventEmitter.emit('table:resize', {
            heightChange: newHeight - height,
            newHeight,
          });
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
      return didUpdate;
    },
    [activeCell, editor, eventEmitter],
  );

  const updateColumnWidth = useCallback(
    (columnIndex: number, nextWidth: number) => {
      if (!activeCell) {
        throw new Error('TableCellResizer: Expected active cell.');
      }
      let didUpdate = false;
      editor.update(
        () => {
          const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem);
          if (!$isTableCellNode(tableCellNode)) {
            throw new Error('TableCellResizer: Table cell node not found.');
          }

          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const colWidths = tableNode.getColWidths();
          if (!colWidths) {
            return;
          }
          const width = colWidths[columnIndex];
          if (width === undefined) {
            return;
          }
          const newColWidths = [...colWidths];
          const newWidth = Math.max(nextWidth, MIN_COLUMN_WIDTH);
          newColWidths[columnIndex] = newWidth;
          tableNode.setColWidths(newColWidths);
          const tableKey = tableNode.getKey();
          didUpdate = true;
          requestAnimationFrame(() => {
            syncTableWidthDOM(editor, tableKey, newColWidths);
            eventEmitter.emit('table:resize', {
              newColWidths,
            });
          });
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
      return didUpdate;
    },
    [activeCell, editor, eventEmitter],
  );

  const commitResizeChange = useCallback(
    (currentPos: PointerPosition, startState: ResizeStartState, target: Element) => {
      const zoom = calculateZoomLevel(target);

      if (startState.direction === 'bottom') {
        const heightChange = (currentPos.y - startState.y) / zoom;
        if (heightChange === 0) {
          return false;
        }
        return updateRowHeight(startState.rowIndex, startState.size + heightChange);
      }

      const widthChange = (currentPos.x - startState.x) / zoom;
      if (widthChange === 0) {
        return false;
      }
      return updateColumnWidth(startState.columnIndex, startState.size + widthChange);
    },
    [updateColumnWidth, updateRowHeight],
  );

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
        const currentPos = {
          x: event.clientX,
          y: event.clientY,
        };
        updatePointerCurrentPos(currentPos);

        if (resizeMode === 'realtime' && activeCell && resizeStartStateRef.current) {
          commitResizeChange(currentPos, resizeStartStateRef.current, activeCell.elem);
        }
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
  }, [activeCell, commitResizeChange, draggingDirection, editor, hasTable, resetState, resizeMode]);

  const pointerUpHandler = useCallback(() => {
    const handler = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!activeCell) {
        throw new Error('TableCellResizer: Expected active cell.');
      }

      if (resizeStartStateRef.current) {
        if (resizeMode === 'deferred') {
          if (activeCell === null) {
            return;
          }
          commitResizeChange(
            {
              x: event.clientX,
              y: event.clientY,
            },
            resizeStartStateRef.current,
            activeCell.elem,
          );
        }

        resetState();
        if (typeof document !== 'undefined') {
          document.removeEventListener('pointerup', handler);
        }
      }
    };
    return handler;
  }, [activeCell, commitResizeChange, resetState, resizeMode]);

  const toggleResize = useCallback(
    (direction: PointerDraggingDirection): PointerEventHandler<HTMLDivElement> =>
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!activeCell) {
          throw new Error('TableCellResizer: Expected active cell.');
        }

        const startPos = {
          x: event.clientX,
          y: event.clientY,
        };
        const resizeStartState = getResizeStartState(direction, startPos);
        if (!resizeStartState) {
          return;
        }

        resizeStartStateRef.current = resizeStartState;
        updatePointerCurrentPos(startPos);
        updateDraggingDirection(direction);

        if (typeof document !== 'undefined') {
          document.addEventListener('pointerup', pointerUpHandler());
        }
      },
    [activeCell, getResizeStartState, pointerUpHandler],
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

export default memo<TableResizeProps>(({ editor, eventEmitter, resizeMode }) => {
  // Don't render portal on server side
  if (typeof document === 'undefined') {
    return null;
  }

  // Mount to .ant-app if exists, otherwise document.body
  const container = (document.querySelector('.ant-app') as HTMLElement) || document.body;

  return createPortal(
    <TableCellResize editor={editor} eventEmitter={eventEmitter} resizeMode={resizeMode} />,
    container,
  );
});
