import {
  $computeTableMapSkipCellCheck,
  $deleteTableRowAtSelection,
  $isTableRowNode,
  TableNode,
} from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { INSERT_TABLE_ROW_COMMAND, SELECT_TABLE_COMMAND } from '../command';
import { styles } from './TableController/style';
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
const LAST_ROW_BORDER_HEIGHT = 1;
const DOTS = Array.from({ length: 6 }, (_, index) => index);

const sum = (values: number[]) => {
  return values.reduce((total, value) => total + value, 0);
};

const normalizeRowControllerHeight = (height: number, isLastRow = false) => {
  return Math.max(
    CONTROL_SIZE,
    Math.round(height) + (isLastRow ? LAST_ROW_BORDER_HEIGHT : ROW_BORDER_HEIGHT),
  );
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

const TableRowController = memo<TableRowControllerProps>(({ editor, node }) => {
  const { rowHeights: initialRowHeights } = useMemo(
    () => readTableControllerState(editor, node),
    [editor, node],
  );
  const [rowHeights, setRowHeights] = useState(initialRowHeights);
  const { isTableSelected, selectedRows } = useTableControllerSelection(editor, node);
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
  const [isInsertButtonHovered, setInsertButtonHovered] = useState(false);
  const insertRowOffset = insertTarget
    ? sum(rowHeights.slice(0, insertTarget.index)) +
      (insertTarget.insertAfter ? rowHeights[insertTarget.index] || 0 : 0)
    : 0;
  const showInsertButton = Boolean(insertTarget) || isInsertButtonHovered;

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

  useEffect(() => {
    if (selectedRows.length > 0) {
      anchorRowIndexRef.current = selectedRows[0];
    }
  }, [selectedRows]);

  useEffect(() => {
    return () => {
      clearInsertButtonHideTimer();
      clearDeletePreview();
    };
  }, [clearDeletePreview]);

  useEffect(() => {
    setRowHeights(initialRowHeights);
  }, [initialRowHeights]);

  useEffect(() => {
    const tableElement = editor.getElementByKey(node.getKey());

    if (!(tableElement instanceof HTMLElement)) {
      return;
    }

    const readRowHeightsFromDOM = () => {
      const rows = tableElement.querySelectorAll('tr');

      if (rows.length === 0) {
        return;
      }

      const nextHeights = Array.from(rows, (row, index) => {
        return normalizeRowControllerHeight(
          row.getBoundingClientRect().height,
          index + 1 === rows.length,
        );
      });

      setRowHeights((currentHeights) => {
        if (
          currentHeights.length === nextHeights.length &&
          currentHeights.every((height, index) => height === nextHeights[index])
        ) {
          return currentHeights;
        }

        return nextHeights;
      });
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

  return (
    <div className="table-controller-row" contentEditable={false}>
      <div
        className={cx('left', styles.rowLeft)}
        onMouseLeave={() => {
          scheduleHideInsertButton();
        }}
        ref={rowLeftRef}
      >
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
              key={index}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
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
              onMouseMove={(event) => {
                if (isSelected) {
                  setInsertTarget(null);
                  return;
                }

                const rect = event.currentTarget.getBoundingClientRect();
                setInsertTarget({
                  index,
                  insertAfter: event.clientY - rect.top > rect.height / 2,
                });
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
      </div>
      <div
        className={cx('corner', styles.corner, isTableSelected && styles.selected)}
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
