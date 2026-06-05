import { $computeTableMapSkipCellCheck, TableNode } from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';
import {
  type DragEvent as ReactDragEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';

import {
  INSERT_TABLE_COLUMN_COMMAND,
  MOVE_TABLE_COLUMN_COMMAND,
  SELECT_TABLE_COMMAND,
} from '../command';
import type { ITableControllerMenuService } from '../service';
import {
  type DragTarget,
  sum,
  useTableAxisDrag,
  useTableColumnMetrics,
} from './TableController/hooks';
import { styles } from './TableController/style';
import { createTableDragImage } from './TableController/utils';
import TableControllerMenu from './TableControllerMenu';
import TableInsertButton from './TableInsertButton';
import { MIN_COLUMN_WIDTH } from './TableResize/style';
import { useTableControllerSelection } from './hooks';

interface TableColControllerProps {
  editor: LexicalEditor;
  menuService: ITableControllerMenuService | null;
  node: TableNode;
  onColumnMetricsChange?: () => void;
  onInsertPreviewChange?: (side: 'left' | 'right' | null) => void;
}

const INSERT_BUTTON_HIDE_DELAY = 160;
const TABLE_DELETE_PREVIEW_CLASS = 'lobe-editor-table-delete-preview';
const DOTS = Array.from({ length: 6 }, (_, index) => index);

const TableColController = memo<TableColControllerProps>((props) => {
  const { editor, menuService, node, onColumnMetricsChange, onInsertPreviewChange } = props;
  const { colWidths, refreshColumnMetrics, tableHeight } = useTableColumnMetrics(editor, node);
  const { isTableFocused, isTableSelected, selectedColumns } = useTableControllerSelection(
    editor,
    node,
  );
  const anchorColumnIndexRef = useRef<number | null>(null);
  const colTopRef = useRef<HTMLDivElement | null>(null);
  const renderColWidths = Array.from(
    { length: colWidths.length },
    (_, index) => colWidths[index] || MIN_COLUMN_WIDTH,
  );
  const deletePreviewElementsRef = useRef<HTMLElement[]>([]);
  const insertButtonHoveredRef = useRef(false);
  const insertButtonHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMenu = selectedColumns.length > 0 && !isTableSelected;
  const [insertTarget, setInsertTarget] = useState<{
    index: number;
    insertAfter: boolean;
  } | null>(null);
  const [menuAnchorElement, setMenuAnchorElement] = useState<HTMLElement | null>(null);
  const [, setMenuVersion] = useState(0);
  const pendingDragColumnsRef = useRef<number[] | null>(null);
  const [isControllerHovered, setControllerHovered] = useState(false);
  const [isInsertButtonHovered, setInsertButtonHovered] = useState(false);

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

    if (!showMenu) {
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
  }, [clearDeletePreview, editor, node, selectedColumns, showMenu]);

  const closeMenu = useCallback(() => {
    setMenuAnchorElement(null);
    onInsertPreviewChange?.(null);
    clearDeletePreview();
  }, [clearDeletePreview, onInsertPreviewChange]);

  const menuContext = {
    axis: 'column' as const,
    editor,
    node,
    selectedIndexes: selectedColumns,
  };
  const menuItems =
    menuService?.getItems(menuContext).map((item) => {
      if (item.type === 'separator') {
        return {
          key: item.key,
          type: 'separator' as const,
        };
      }

      return {
        danger: item.danger,
        key: item.key,
        label: typeof item.label === 'function' ? item.label(menuContext) : item.label,
        onClick: () => {
          item.onClick(menuContext);
        },
        onMouseEnter:
          item.preview === 'delete'
            ? showDeletePreview
            : item.preview === 'insert-before'
              ? () => {
                  onInsertPreviewChange?.('left');
                }
              : item.preview === 'insert-after'
                ? () => {
                    onInsertPreviewChange?.('right');
                  }
                : undefined,
        onMouseLeave:
          item.preview === 'delete'
            ? clearDeletePreview
            : item.preview === 'insert-before' || item.preview === 'insert-after'
              ? () => {
                  onInsertPreviewChange?.(null);
                }
              : undefined,
      };
    }) ?? [];

  const scheduleHideInsertButton = () => {
    clearInsertButtonHideTimer();
    insertButtonHideTimerRef.current = setTimeout(() => {
      if (!insertButtonHoveredRef.current) {
        setInsertTarget(null);
        setInsertButtonHovered(false);
      }
    }, INSERT_BUTTON_HIDE_DELAY);
  };

  const getColumnDropTarget = useCallback((event: DragEvent): DragTarget | null => {
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
      if (event.clientX <= rect.left + rect.width / 2) {
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

  const moveColumns = useCallback(
    (target: DragTarget, selectedIndexes: number[]) => {
      editor.dispatchCommand(MOVE_TABLE_COLUMN_COMMAND, {
        columnIndex: target.index,
        insertAfter: target.insertAfter,
        selectedColumns: selectedIndexes,
        table: node.getKey(),
      });
    },
    [editor, node],
  );

  const {
    clearDragState,
    dragTarget,
    finishDrag: finishColumnDrag,
    isDragging,
    startDrag,
  } = useTableAxisDrag({
    getDropTarget: getColumnDropTarget,
    onMove: moveColumns,
  });

  const startColumnDrag = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, selectedIndexes: number[]) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
      event.dataTransfer.setData('text/plain', '');
      const dragImage = createTableDragImage(`拖拽 ${selectedIndexes.length} 列`);
      event.dataTransfer.setDragImage(
        dragImage,
        dragImage.offsetWidth / 2,
        dragImage.offsetHeight / 2,
      );
      setInsertTarget(null);
      closeMenu();
      startDrag(event.nativeEvent, selectedIndexes);
    },
    [closeMenu, startDrag],
  );

  const insertColumnOffset = insertTarget
    ? sum(renderColWidths.slice(0, insertTarget.index)) +
      (insertTarget.insertAfter ? renderColWidths[insertTarget.index] || 0 : 0)
    : 0;
  const dragColumnOffset = dragTarget
    ? sum(renderColWidths.slice(0, dragTarget.index)) +
      (dragTarget.insertAfter ? renderColWidths[dragTarget.index] || 0 : 0)
    : 0;
  const controllerWidth = sum(renderColWidths);
  const showInsertButton = !isDragging && (Boolean(insertTarget) || isInsertButtonHovered);

  useEffect(() => {
    if (selectedColumns.length > 0) {
      anchorColumnIndexRef.current = selectedColumns[0];
    }
  }, [selectedColumns]);

  useEffect(() => {
    onColumnMetricsChange?.();
  }, [colWidths, onColumnMetricsChange, tableHeight]);

  useEffect(() => {
    return menuService?.subscribe(() => {
      setMenuVersion((version) => version + 1);
    });
  }, [menuService]);

  useEffect(() => {
    return () => {
      clearInsertButtonHideTimer();
      clearDeletePreview();
      onInsertPreviewChange?.(null);
      setMenuAnchorElement(null);
      pendingDragColumnsRef.current = null;
      clearDragState();
    };
  }, [clearDeletePreview, clearDragState, onInsertPreviewChange]);

  const shouldShowController = isTableFocused || isControllerHovered;

  useEffect(() => {
    if (!shouldShowController) {
      clearInsertButtonHideTimer();
      clearDeletePreview();
      setInsertTarget(null);
      setInsertButtonHovered(false);
      onInsertPreviewChange?.(null);
      setMenuAnchorElement(null);
      pendingDragColumnsRef.current = null;
      clearDragState();
    }
  }, [clearDeletePreview, clearDragState, onInsertPreviewChange, shouldShowController]);

  useEffect(() => {
    if (!showMenu) {
      closeMenu();
    }
  }, [closeMenu, showMenu]);

  if (!shouldShowController) {
    return null;
  }

  return (
    <LexicalPortalContainer editor={editor} node={node}>
      <div
        className="table-controller-col"
        contentEditable={false}
        style={{ inlineSize: controllerWidth }}
      >
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
          style={{ inlineSize: controllerWidth }}
        >
          <TableControllerMenu
            anchorElement={menuAnchorElement}
            items={menuItems}
            onOpenChange={(open) => {
              if (!open) {
                closeMenu();
              }
            }}
            open={Boolean(menuAnchorElement) && showMenu && menuItems.length > 0}
            position="top"
          />
          {renderColWidths.map((width, index) => {
            const isLastCol = index + 1 === renderColWidths.length;
            const isSelected = selectedColumns.includes(index);
            const isSelectedController = isSelected && !isTableSelected;
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
                  if (isSelectedController) {
                    event.preventDefault();
                    event.stopPropagation();
                    clearInsertButtonHideTimer();
                    setInsertTarget(null);
                    setInsertButtonHovered(false);
                    setMenuAnchorElement(event.currentTarget);
                  }
                }}
                onDragEnd={() => {
                  pendingDragColumnsRef.current = null;
                  finishColumnDrag();
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  startColumnDrag(
                    event,
                    pendingDragColumnsRef.current ||
                      (isSelectedController ? selectedColumns : [index]),
                  );
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  if (isSelectedController) {
                    event.preventDefault();
                    pendingDragColumnsRef.current = selectedColumns;
                    return;
                  }

                  closeMenu();
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
                  if (isSelectedController) {
                    event.stopPropagation();
                    pendingDragColumnsRef.current = selectedColumns;
                  }
                }}
                onMouseMove={(event) => {
                  if (isDragging || isSelectedController) {
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
                  if (isSelectedController) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }}
                onPointerDownCapture={(event) => {
                  if (isSelectedController) {
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
              refreshColumnMetrics();
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
