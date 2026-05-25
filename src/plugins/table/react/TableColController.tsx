import {
  $computeTableMapSkipCellCheck,
  $deleteTableColumnAtSelection,
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

import { LexicalPortalContainer } from '@/editor-kernel/react';

import {
  INSERT_TABLE_COLUMN_COMMAND,
  MOVE_TABLE_COLUMN_COMMAND,
  SELECT_TABLE_COMMAND,
} from '../command';
import { styles } from './TableController/style';
import { createTableDragImage } from './TableController/utils';
import TableDeleteButton from './TableDeleteButton';
import TableInsertButton from './TableInsertButton';
import { MIN_COLUMN_WIDTH } from './TableResize/style';
import { useTableControllerSelection } from './hooks';

interface TableColControllerProps {
  editor: LexicalEditor;
  node: TableNode;
}

const INSERT_BUTTON_HIDE_DELAY = 160;
const TABLE_DELETE_PREVIEW_CLASS = 'lobe-editor-table-delete-preview';
const DOTS = Array.from({ length: 6 }, (_, index) => index);

interface DragState {
  selectedIndexes: number[];
}

const sum = (values: number[]) => {
  return values.reduce((total, value) => total + value, 0);
};

const getTableElement = (element: HTMLElement | null) => {
  if (element instanceof HTMLTableElement) {
    return element;
  }

  return (element?.querySelector('table.editor_table, table') as HTMLTableElement | null) || null;
};

const readTableControllerState = (editor: LexicalEditor, node: TableNode) => {
  return editor.getEditorState().read(() => {
    const latestNode = node.getLatest();
    const columnCount = latestNode.getColumnCount();
    const colWidths = latestNode.getColWidths();

    return {
      colWidths: Array.from(
        { length: columnCount },
        (_, index) => colWidths?.[index] || MIN_COLUMN_WIDTH,
      ),
    };
  });
};

const TableColController = memo<TableColControllerProps>(({ editor, node }) => {
  const { colWidths: initialColWidths } = useMemo(
    () => readTableControllerState(editor, node),
    [editor, node],
  );
  const [colWidths, setColWidths] = useState(initialColWidths);
  const [tableHeight, setTableHeight] = useState(0);
  const { isTableFocused, isTableSelected, selectedColumns } = useTableControllerSelection(
    editor,
    node,
  );
  const anchorColumnIndexRef = useRef<number | null>(null);
  const colTopRef = useRef<HTMLDivElement | null>(null);
  const deletePreviewElementsRef = useRef<HTMLElement[]>([]);
  const insertButtonHoveredRef = useRef(false);
  const insertButtonHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showDeleteButton = selectedColumns.length > 0 && !isTableSelected;
  const selectedColumnStart = selectedColumns[0] ?? 0;
  const selectedColumnEnd = selectedColumns.at(-1) ?? selectedColumnStart;
  const selectedColumnLeft = sum(colWidths.slice(0, selectedColumnStart));
  const selectedColumnWidth = sum(colWidths.slice(selectedColumnStart, selectedColumnEnd + 1));
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
  const pendingDragColumnsRef = useRef<number[] | null>(null);
  const [isControllerHovered, setControllerHovered] = useState(false);
  const [isInsertButtonHovered, setInsertButtonHovered] = useState(false);
  const insertColumnOffset = insertTarget
    ? sum(colWidths.slice(0, insertTarget.index)) +
      (insertTarget.insertAfter ? colWidths[insertTarget.index] || 0 : 0)
    : 0;
  const dragColumnOffset = dragTarget
    ? sum(colWidths.slice(0, dragTarget.index)) +
      (dragTarget.insertAfter ? colWidths[dragTarget.index] || 0 : 0)
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

      for (const row of tableMap) {
        for (const columnIndex of selectedColumns) {
          const cell = row[columnIndex]?.cell;
          if (cell) {
            previewCellKeys.add(cell.getKey());
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
  }, [clearDeletePreview, editor, node, selectedColumns, showDeleteButton]);

  const scheduleHideInsertButton = () => {
    clearInsertButtonHideTimer();
    insertButtonHideTimerRef.current = setTimeout(() => {
      if (!insertButtonHoveredRef.current) {
        setInsertTarget(null);
        setInsertButtonHovered(false);
      }
    }, INSERT_BUTTON_HIDE_DELAY);
  };

  const getColumnDropTarget = useCallback((clientX: number) => {
    const controller = colTopRef.current;
    if (!controller) {
      return null;
    }

    const columns = Array.from(controller.querySelectorAll<HTMLElement>('.col'));
    if (columns.length === 0) {
      return null;
    }

    for (const [index, column] of columns.entries()) {
      const rect = column.getBoundingClientRect();
      if (clientX <= rect.left + rect.width / 2) {
        return {
          index,
          insertAfter: false,
        };
      }
    }

    return {
      index: columns.length - 1,
      insertAfter: true,
    };
  }, []);

  const clearDragState = useCallback(() => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    dragStateRef.current = null;
    dragTargetRef.current = null;
    pendingDragColumnsRef.current = null;
    setDragging(false);
    setDragTarget(null);
  }, []);

  const updateColumnDragTarget = useCallback(
    (clientX: number) => {
      const target = getColumnDropTarget(clientX);
      dragTargetRef.current = target;
      setDragTarget(target);
    },
    [getColumnDropTarget],
  );

  const finishColumnDrag = useCallback(() => {
    const dragState = dragStateRef.current;
    const target = dragTargetRef.current;

    if (dragState && target) {
      editor.dispatchCommand(MOVE_TABLE_COLUMN_COMMAND, {
        columnIndex: target.index,
        insertAfter: target.insertAfter,
        selectedColumns: dragState.selectedIndexes,
        table: node.getKey(),
      });
    }

    clearDragState();
  }, [clearDragState, editor, node]);

  const startColumnDrag = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, selectedIndexes: number[]) => {
      dragStateRef.current = {
        selectedIndexes,
      };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
      event.dataTransfer.setData('text/plain', '');
      const dragImage = createTableDragImage(`拖拽 ${selectedIndexes.length} 列`);
      event.dataTransfer.setDragImage(
        dragImage,
        dragImage.offsetWidth / 2,
        dragImage.offsetHeight / 2,
      );
      setDragging(true);
      setInsertTarget(null);
      updateColumnDragTarget(event.clientX);

      const body = document.body;
      const handleDragOver = (dragEvent: globalThis.DragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        if (dragEvent.dataTransfer) {
          dragEvent.dataTransfer.dropEffect = 'move';
        }
        updateColumnDragTarget(dragEvent.clientX);
      };
      const handleDragEnd = (dragEvent: globalThis.DragEvent) => {
        dragEvent.preventDefault();
        dragEvent.stopPropagation();
        finishColumnDrag();
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
    [finishColumnDrag, updateColumnDragTarget],
  );

  useEffect(() => {
    if (selectedColumns.length > 0) {
      anchorColumnIndexRef.current = selectedColumns[0];
    }
  }, [selectedColumns]);

  useEffect(() => {
    setColWidths(initialColWidths);
  }, [initialColWidths]);

  useEffect(() => {
    const tableElement = getTableElement(editor.getElementByKey(node.getKey()));

    if (!tableElement) {
      return;
    }

    const readColWidthsFromDOM = () => {
      const latestColWidths = readTableControllerState(editor, node).colWidths;
      const lastColIndex = latestColWidths.length - 1;

      if (lastColIndex < 0) {
        return;
      }

      const tableRect = tableElement.getBoundingClientRect();
      const tableWidth = tableRect.width;
      const precedingWidth = sum(latestColWidths.slice(0, lastColIndex));
      const lastColWidth = Math.max(0, tableWidth - precedingWidth);
      const nextColWidths = latestColWidths.map((width, index) => {
        return index === lastColIndex ? lastColWidth : width;
      });

      setColWidths((currentWidths) => {
        if (
          currentWidths.length === nextColWidths.length &&
          currentWidths.every((width, index) => width === nextColWidths[index])
        ) {
          return currentWidths;
        }

        return nextColWidths;
      });
      setTableHeight(tableRect.height);
    };

    const raf = requestAnimationFrame(readColWidthsFromDOM);
    const observer = new ResizeObserver(readColWidthsFromDOM);
    observer.observe(tableElement);

    const unregisterUpdate = editor.registerUpdateListener(() => {
      readColWidthsFromDOM();
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      unregisterUpdate();
    };
  }, [editor, node]);

  useEffect(() => {
    return () => {
      clearInsertButtonHideTimer();
      clearDeletePreview();
      clearDragState();
    };
  }, [clearDeletePreview, clearDragState]);

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
    <LexicalPortalContainer editor={editor} node={node}>
      <div className="table-controller-col" contentEditable={false}>
        <div
          className={cx('top', styles.colTop)}
          onMouseEnter={() => {
            setControllerHovered(true);
          }}
          onMouseLeave={() => {
            setControllerHovered(false);
            scheduleHideInsertButton();
          }}
          ref={colTopRef}
        >
          <TableDeleteButton
            ariaLabel="Delete selected columns"
            offset={selectedColumnLeft + selectedColumnWidth / 2}
            onDelete={() => {
              clearDeletePreview();
              editor.update(() => {
                $deleteTableColumnAtSelection();
              });
            }}
            onMouseEnter={showDeletePreview}
            onMouseLeave={clearDeletePreview}
            position="top"
            reference={colTopRef.current}
            visible={showDeleteButton}
          />
          {colWidths.map((width, index) => {
            const isLastCol = index + 1 === colWidths.length;
            const isSelected = selectedColumns.includes(index);
            const showSelectionDots = isSelected && !isTableSelected;

            return (
              <div
                className={cx(
                  'col',
                  styles.col,
                  isLastCol && styles.colLast,
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
                onDragEnd={finishColumnDrag}
                onDragStart={(event) => {
                  event.stopPropagation();
                  startColumnDrag(
                    event,
                    pendingDragColumnsRef.current || (isSelected ? selectedColumns : [index]),
                  );
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  if (isSelected) {
                    event.preventDefault();
                    pendingDragColumnsRef.current = selectedColumns;
                    return;
                  }

                  pendingDragColumnsRef.current = [index];

                  const anchorIndex = event.shiftKey
                    ? (selectedColumns[0] ?? anchorColumnIndexRef.current)
                    : index;

                  editor.dispatchCommand(SELECT_TABLE_COMMAND, {
                    anchorIndex,
                    columnIndex: index,
                    extend: event.shiftKey,
                    table: node.getKey(),
                  });

                  if (!event.shiftKey) {
                    anchorColumnIndexRef.current = index;
                  }
                }}
                onMouseDownCapture={(event) => {
                  if (isSelected) {
                    event.stopPropagation();
                    pendingDragColumnsRef.current = selectedColumns;
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
                    insertAfter: event.clientX - rect.left > rect.width / 2,
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
                    pendingDragColumnsRef.current = selectedColumns;
                  }
                }}
                style={{
                  width,
                }}
              >
                <span
                  className={cx(
                    styles.selectionDots,
                    styles.colSelectionDots,
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
              styles.colDragIndicator,
              Boolean(dragTarget) && isDragging && styles.dragIndicatorVisible,
            )}
            style={{ blockSize: tableHeight, left: dragColumnOffset }}
          />
          <TableInsertButton
            ariaLabel="Insert column"
            offset={insertColumnOffset}
            onInsert={() => {
              if (!insertTarget) {
                return;
              }

              editor.dispatchCommand(INSERT_TABLE_COLUMN_COMMAND, {
                columnIndex: insertTarget.index,
                insertAfter: insertTarget.insertAfter,
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
            position="top"
            reference={colTopRef.current}
            visible={showInsertButton}
          />
        </div>
      </div>
    </LexicalPortalContainer>
  );
});

TableColController.displayName = 'TableColController';

export default TableColController;
