import {
  $computeTableMapSkipCellCheck,
  $deleteTableRowAtSelection,
  $isTableRowNode,
  TableNode,
} from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';
import {
  type DragEvent as ReactDragEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { INSERT_TABLE_ROW_COMMAND, MOVE_TABLE_ROW_COMMAND, SELECT_TABLE_COMMAND } from '../command';
import { styles } from './TableController/style';
import { createTableDragImage } from './TableController/utils';
import TableDeleteButton from './TableDeleteButton';
import TableInsertButton from './TableInsertButton';
import { useTableControllerSelection } from './hooks';

interface TableRowControllerProps {
  editor: LexicalEditor;
  node: TableNode;
}

const CONTROL_SIZE = 14;
const INSERT_BUTTON_HIDE_DELAY = 160;
const TABLE_DELETE_PREVIEW_CLASS = 'lobe-editor-table-delete-preview';
const ROW_BORDER_HEIGHT = 0.5;
const DOTS = Array.from({ length: 6 }, (_, index) => index);

interface DragState {
  selectedIndexes: number[];
}

const sum = (values: number[]) => {
  return values.reduce((total, value) => total + value, 0);
};

const normalizeRowControllerHeight = (height: number, isLastRow = false) => {
  return Math.max(CONTROL_SIZE, Math.round(height) - (isLastRow ? 0 : ROW_BORDER_HEIGHT));
};

const readTableControllerState = (editor: LexicalEditor, node: TableNode) => {
  return editor.getEditorState().read(() => {
    const latestNode = node.getLatest();
    const rows = latestNode.getChildren();
    const rowHeights = rows.map((row, index) => {
      if (!$isTableRowNode(row)) {
        return CONTROL_SIZE;
      }

      return normalizeRowControllerHeight(
        row.getHeight() || CONTROL_SIZE,
        index + 1 === rows.length,
      );
    });

    return {
      rowHeights,
    };
  });
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

const TableRowController = memo<TableRowControllerProps>(({ editor, node }) => {
  const { rowHeights: initialRowHeights } = useMemo(
    () => readTableControllerState(editor, node),
    [editor, node],
  );
  const [rowHeights, setRowHeights] = useState(initialRowHeights);
  const [tableWidth, setTableWidth] = useState(0);
  const { isTableFocused, isTableSelected, selectedRows } = useTableControllerSelection(
    editor,
    node,
  );
  const anchorRowIndexRef = useRef<number | null>(null);
  const deletePreviewElementsRef = useRef<HTMLElement[]>([]);
  const insertButtonHoveredRef = useRef(false);
  const insertButtonHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowLeftRef = useRef<HTMLDivElement | null>(null);
  const showDeleteButton = selectedRows.length > 0 && !isTableSelected;
  const selectedRowStart = selectedRows[0] ?? 0;
  const selectedRowEnd = selectedRows.at(-1) ?? selectedRowStart;
  const selectedRowTop = sum(rowHeights.slice(0, selectedRowStart));
  const selectedRowHeight = sum(rowHeights.slice(selectedRowStart, selectedRowEnd + 1));
  const [insertTarget, setInsertTarget] = useState<{
    index: number;
    insertAfter: boolean;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<{
    index: number;
    insertAfter: boolean;
  } | null>(null);
  const [isDragging, setDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const dragTargetRef = useRef<typeof dragTarget>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const pendingDragRowsRef = useRef<number[] | null>(null);
  const [isControllerHovered, setControllerHovered] = useState(false);
  const [isInsertButtonHovered, setInsertButtonHovered] = useState(false);
  const insertRowOffset = insertTarget
    ? sum(rowHeights.slice(0, insertTarget.index)) +
      (insertTarget.insertAfter ? rowHeights[insertTarget.index] || 0 : 0)
    : 0;
  const dragRowOffset = dragTarget
    ? sum(rowHeights.slice(0, dragTarget.index)) +
      (dragTarget.insertAfter ? rowHeights[dragTarget.index] || 0 : 0)
    : 0;
  const showInsertButton = !isDragging && (Boolean(insertTarget) || isInsertButtonHovered);

  const clearInsertButtonHideTimer = () => {
    if (insertButtonHideTimerRef.current) {
      clearTimeout(insertButtonHideTimerRef.current);
      insertButtonHideTimerRef.current = null;
    }
  };

  const clearDeletePreview = useCallback(() => {
    deletePreviewElementsRef.current.forEach((element) => {
      element.classList.remove(TABLE_DELETE_PREVIEW_CLASS);
    });
    deletePreviewElementsRef.current = [];
  }, []);

  const showDeletePreview = useCallback(() => {
    clearDeletePreview();

    if (!showDeleteButton) {
      return;
    }

    editor.getEditorState().read(() => {
      const tableNode = node.getLatest();
      const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
      const previewCellKeys = new Set<string>();

      for (const rowIndex of selectedRows) {
        const row = tableMap[rowIndex];
        if (!row) {
          continue;
        }

        for (const mapCell of row) {
          if (mapCell?.cell) {
            previewCellKeys.add(mapCell.cell.getKey());
          }
        }
      }

      for (const cellKey of previewCellKeys) {
        const element = editor.getElementByKey(cellKey);
        if (element instanceof HTMLElement) {
          element.classList.add(TABLE_DELETE_PREVIEW_CLASS);
          deletePreviewElementsRef.current.push(element);
        }
      }
    });
  }, [clearDeletePreview, editor, node, selectedRows, showDeleteButton]);

  const scheduleHideInsertButton = () => {
    clearInsertButtonHideTimer();
    insertButtonHideTimerRef.current = setTimeout(() => {
      if (!insertButtonHoveredRef.current) {
        setInsertTarget(null);
        setInsertButtonHovered(false);
      }
    }, INSERT_BUTTON_HIDE_DELAY);
  };

  const getRowDropTarget = useCallback((clientY: number) => {
    const controller = rowLeftRef.current;
    if (!controller) {
      return null;
    }

    const rows = Array.from(controller.querySelectorAll<HTMLElement>('.row'));
    if (rows.length === 0) {
      return null;
    }

    for (const [index, row] of rows.entries()) {
      const rect = row.getBoundingClientRect();
      if (clientY <= rect.top + rect.height / 2) {
        return {
          index,
          insertAfter: false,
        };
      }
    }

    return {
      index: rows.length - 1,
      insertAfter: true,
    };
  }, []);

  const clearDragState = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    dragStateRef.current = null;
    dragTargetRef.current = null;
    pendingDragRowsRef.current = null;
    setDragging(false);
    setDragTarget(null);
  }, []);

  const updateRowDragTarget = useCallback(
    (clientY: number) => {
      const target = getRowDropTarget(clientY);
      dragTargetRef.current = target;
      setDragTarget(target);
    },
    [getRowDropTarget],
  );

  const finishRowDrag = useCallback(() => {
    const dragState = dragStateRef.current;
    const target = dragTargetRef.current;

    if (dragState && target) {
      editor.dispatchCommand(MOVE_TABLE_ROW_COMMAND, {
        insertAfter: target.insertAfter,
        rowIndex: target.index,
        selectedRows: dragState.selectedIndexes,
        table: node.getKey(),
      });
    }

    clearDragState();
  }, [clearDragState, editor, node]);

  const startRowDrag = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, selectedIndexes: number[]) => {
      dragStateRef.current = {
        selectedIndexes,
      };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
      event.dataTransfer.setData('text/plain', '');
      const dragImage = createTableDragImage(`拖拽 ${selectedIndexes.length} 行`);
      event.dataTransfer.setDragImage(
        dragImage,
        dragImage.offsetWidth / 2,
        dragImage.offsetHeight / 2,
      );
      setDragging(true);
      setInsertTarget(null);
      updateRowDragTarget(event.clientY);

      const body = document.body;
      const handleDragOver = (dragEvent: globalThis.DragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = 'move';
        }
        updateRowDragTarget(dragEvent.clientY);
      };
      const handleDragEnd = (dragEvent: globalThis.DragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        finishRowDrag();
      };

      dragCleanupRef.current?.();
      dragCleanupRef.current = () => {
        body.removeEventListener('dragover', handleDragOver);
        body.removeEventListener('drop', handleDragEnd);
        body.removeEventListener('dragend', handleDragEnd);
      };
      body.addEventListener('dragover', handleDragOver);
      body.addEventListener('drop', handleDragEnd);
      body.addEventListener('dragend', handleDragEnd);
    },
    [finishRowDrag, updateRowDragTarget],
  );

  useEffect(() => {
    if (selectedRows.length > 0) {
      anchorRowIndexRef.current = selectedRows[0];
    }
  }, [selectedRows]);

  useEffect(() => {
    return () => {
      clearInsertButtonHideTimer();
      clearDeletePreview();
      clearDragState();
    };
  }, [clearDeletePreview, clearDragState]);

  useEffect(() => {
    setRowHeights((currentHeights) => {
      const currentTotalHeight = sum(currentHeights);
      return getControlledRowHeights(initialRowHeights, currentTotalHeight);
    });
  }, [initialRowHeights]);

  useEffect(() => {
    const tableElement = editor.getElementByKey(node.getKey());
    const table = tableElement?.querySelector('table.editor_table, table') ?? tableElement;

    if (!(tableElement instanceof HTMLElement)) {
      return;
    }

    const readRowHeightsFromDOM = () => {
      const rows = tableElement.querySelectorAll('tr');

      if (rows.length === 0) {
        return;
      }

      const tableHeight = table instanceof HTMLElement ? table.getBoundingClientRect().height : 0;
      const measuredHeights = Array.from(rows, (row, index) => {
        return normalizeRowControllerHeight(
          row.getBoundingClientRect().height,
          index + 1 === rows.length,
        );
      });
      const nextHeights = getControlledRowHeights(measuredHeights, tableHeight);

      setRowHeights((currentHeights) => {
        if (
          currentHeights.length === nextHeights.length &&
          currentHeights.every((height, index) => height === nextHeights[index])
        ) {
          return currentHeights;
        }

        return nextHeights;
      });
      setTableWidth(table instanceof HTMLElement ? table.getBoundingClientRect().width : 0);
    };

    const raf = requestAnimationFrame(readRowHeightsFromDOM);
    const observer = new ResizeObserver(readRowHeightsFromDOM);
    observer.observe(tableElement);
    tableElement.querySelectorAll('tr').forEach((row) => {
      observer.observe(row);
    });

    const unregisterUpdate = editor.registerUpdateListener(() => {
      readRowHeightsFromDOM();
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      unregisterUpdate();
    };
  }, [editor, node]);

  const shouldShowController = isTableFocused || isControllerHovered;

  useEffect(() => {
    if (!shouldShowController) {
      clearInsertButtonHideTimer();
      clearDeletePreview();
      setInsertTarget(null);
      setInsertButtonHovered(false);
      clearDragState();
    }
  }, [clearDeletePreview, clearDragState, shouldShowController]);

  if (!shouldShowController) {
    return null;
  }

  return (
    <div
      className="table-controller-row"
      contentEditable={false}
      onMouseEnter={() => {
        setControllerHovered(true);
      }}
      onMouseLeave={() => {
        setControllerHovered(false);
        scheduleHideInsertButton();
      }}
    >
      <div className={cx('left', styles.rowLeft)} ref={rowLeftRef}>
        <TableDeleteButton
          ariaLabel="Delete selected rows"
          offset={selectedRowTop + selectedRowHeight / 2}
          onDelete={() => {
            clearDeletePreview();
            editor.update(() => {
              $deleteTableRowAtSelection();
            });
          }}
          onMouseEnter={showDeletePreview}
          onMouseLeave={clearDeletePreview}
          position="left"
          reference={rowLeftRef.current}
          visible={showDeleteButton}
        />
        <TableInsertButton
          ariaLabel="Insert row"
          offset={insertRowOffset}
          onInsert={() => {
            if (!insertTarget) {
              return;
            }

            editor.dispatchCommand(INSERT_TABLE_ROW_COMMAND, {
              insertAfter: insertTarget.insertAfter,
              rowIndex: insertTarget.index,
              table: node.getKey(),
            });
            setInsertTarget(null);
          }}
          onMouseEnter={() => {
            insertButtonHoveredRef.current = true;
            clearInsertButtonHideTimer();
            setInsertButtonHovered(true);
          }}
          onMouseLeave={() => {
            insertButtonHoveredRef.current = false;
            scheduleHideInsertButton();
          }}
          position="left"
          reference={rowLeftRef.current}
          visible={showInsertButton}
        />
        {rowHeights.map((height, index) => {
          const isLastRow = index + 1 === rowHeights.length;
          const isSelected = selectedRows.includes(index);
          const showSelectionDots = isSelected && !isTableSelected;

          return (
            <div
              className={cx(
                'row',
                styles.row,
                isLastRow && styles.rowLast,
                isSelected && styles.selected,
              )}
              draggable
              key={index}
              onClickCapture={(event) => {
                if (isSelected) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onDragEnd={finishRowDrag}
              onDragStart={(event) => {
                event.stopPropagation();
                startRowDrag(
                  event,
                  pendingDragRowsRef.current || (isSelected ? selectedRows : [index]),
                );
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
                if (isSelected) {
                  event.preventDefault();
                  pendingDragRowsRef.current = selectedRows;
                  return;
                }

                pendingDragRowsRef.current = [index];

                const anchorIndex = event.shiftKey
                  ? (selectedRows[0] ?? anchorRowIndexRef.current)
                  : index;

                editor.dispatchCommand(SELECT_TABLE_COMMAND, {
                  anchorIndex,
                  extend: event.shiftKey,
                  rowIndex: index,
                  table: node.getKey(),
                });

                if (!event.shiftKey) {
                  anchorRowIndexRef.current = index;
                }
              }}
              onMouseDownCapture={(event) => {
                if (isSelected) {
                  event.stopPropagation();
                  pendingDragRowsRef.current = selectedRows;
                }
              }}
              onMouseMove={(event) => {
                if (isDragging || isSelected) {
                  setInsertTarget(null);
                  return;
                }

                const rect = event.currentTarget.getBoundingClientRect();
                setInsertTarget({
                  index,
                  insertAfter: event.clientY - rect.top > rect.height / 2,
                });
              }}
              onMouseUpCapture={(event) => {
                if (isSelected) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onPointerDownCapture={(event) => {
                if (isSelected) {
                  event.stopPropagation();
                  pendingDragRowsRef.current = selectedRows;
                }
              }}
              style={{ height }}
            >
              <span
                className={cx(
                  styles.selectionDots,
                  styles.rowSelectionDots,
                  showSelectionDots && styles.selectionDotsVisible,
                )}
              >
                {DOTS.map((dot) => (
                  <span key={dot} />
                ))}
              </span>
            </div>
          );
        })}
        <span
          className={cx(
            styles.dragIndicator,
            styles.rowDragIndicator,
            Boolean(dragTarget) && isDragging && styles.dragIndicatorVisible,
          )}
          style={{ inlineSize: tableWidth, top: dragRowOffset }}
        />
      </div>
      <div
        className={cx(
          'corner',
          styles.corner,
          isTableSelected && styles.selected,
          isTableSelected && styles.selectedCorner,
        )}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          editor.dispatchCommand(SELECT_TABLE_COMMAND, {
            table: node.getKey(),
          });
        }}
      />
    </div>
  );
});

TableRowController.displayName = 'TableRowController';

export default TableRowController;
