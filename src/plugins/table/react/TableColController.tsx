import {
  $computeTableMapSkipCellCheck,
  $deleteTableColumnAtSelection,
  TableNode,
} from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LexicalPortalContainer } from '@/editor-kernel/react';

import { INSERT_TABLE_COLUMN_COMMAND, SELECT_TABLE_COMMAND } from '../command';
import { styles } from './TableController/style';
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
  const [isControllerHovered, setControllerHovered] = useState(false);
  const [isInsertButtonHovered, setInsertButtonHovered] = useState(false);
  const insertColumnOffset = insertTarget
    ? sum(colWidths.slice(0, insertTarget.index)) +
      (insertTarget.insertAfter ? colWidths[insertTarget.index] || 0 : 0)
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

      const tableWidth = tableElement.getBoundingClientRect().width;
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
    };
  }, [clearDeletePreview]);

  const shouldShowController = isTableFocused || isControllerHovered;

  useEffect(() => {
    if (!shouldShowController) {
      clearInsertButtonHideTimer();
      clearDeletePreview();
      setInsertTarget(null);
      setInsertButtonHovered(false);
    }
  }, [clearDeletePreview, shouldShowController]);

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
                key={index}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
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
                onMouseMove={(event) => {
                  if (isSelected) {
                    setInsertTarget(null);
                    return;
                  }

                  const rect = event.currentTarget.getBoundingClientRect();
                  setInsertTarget({
                    index,
                    insertAfter: event.clientX - rect.left > rect.width / 2,
                  });
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
