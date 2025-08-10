import { offset, size, useFloating } from '@floating-ui/react';
import {
  $isTableRowNode,
  $isTableSelection,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import EventEmitter from 'eventemitter3';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';

import { SELECT_TABLE_COMMAND } from '../command';
import { useStyles } from './table-operator.style';

export interface TableOperatorProps {
  editor: LexicalEditor;
  eventEmitter: EventEmitter;
}

const getCellNodeHeight = (
  cell: TableCellNode,
  activeEditor: LexicalEditor,
): number | undefined => {
  const domCellNode = activeEditor.getElementByKey(cell.getKey());
  return domCellNode?.clientHeight;
};

const getTableRowHeight = (tableRow: TableRowNode, editor: LexicalEditor): number | undefined => {
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
  return height;
};

export function TableOperator({ editor, eventEmitter }: TableOperatorProps) {
  const tableKeyRef = useRef<string>('');
  const [table, setTable] = useState<TableNode | null>(null);
  const [tableWidths, setTableWidths] = useState<readonly number[]>([]);
  const [tableRowHeights, setTableRowHeights] = useState<readonly number[]>([]);
  const { styles } = useStyles();
  const { refs, floatingStyles, context } = useFloating({
    middleware: [
      offset(({ rects }) => {
        return -rects.reference.height;
      }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.height = rects.reference.height + 'px';
        },
      }),
    ],
    placement: 'top-start',
  });

  useEffect(() => {
    eventEmitter.on('table:resize', ({ newColWidths, heightChange, newHeight }) => {
      if (newColWidths) {
        setTableWidths(newColWidths);
      }
      if (newHeight) {
        setTableRowHeights((heights) => {
          const newHeights = [...heights];
          newHeights[heightChange] = newHeight;
          return newHeights;
        });
      }
      context.update();
    });
    return () => {
      eventEmitter.off('table:resize');
    };
  }, [eventEmitter]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const table = editor.read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) || $isTableSelection(selection)) {
              return $getNearestNodeOfType(selection.anchor.getNode(), TableNode);
            }
            return false;
          });
          setTable(table || null);
          const key = table && table?.getKey();
          // if (key === tableKeyRef.current) {
          //     return false;
          // }
          tableKeyRef.current = table ? table.getKey() : '';
          if (key) {
            const element = editor.getElementByKey(key);
            const tableNode = element?.querySelector('table');
            if (tableNode) {
              setTableWidths(table.__colWidths || []);
              editor.read(() => {
                // console.info(table.getChildren());
                setTableRowHeights(
                  table.getChildren().map((row) => {
                    if ($isTableRowNode(row)) {
                      return getTableRowHeight(row, editor) || 0;
                    }
                    return 0;
                  }),
                );
              });
              refs.setReference(tableNode);
            }
          }
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, [editor]);

  const preventDefault = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const selectTableRow = useCallback(
    (rowIndex: number) => {
      if (!table) return;
      editor.dispatchCommand(SELECT_TABLE_COMMAND, { rowIndex, table: table.getKey() });
    },
    [editor, table],
  );

  const selectTableColumn = useCallback(
    (columnIndex: number) => {
      if (!table) return;
      editor.dispatchCommand(SELECT_TABLE_COMMAND, { columnIndex, table: table.getKey() });
    },
    [editor, table],
  );

  const selectAllTable = useCallback(() => {
    if (!table) return;
    editor.dispatchCommand(SELECT_TABLE_COMMAND, { table: table.getKey() });
  }, [editor, table]);

  return table ? (
    <div
      className={styles}
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        pointerEvents: 'none',
        width: tableWidths.reduce((acc, width) => acc + width, 0) + 'px',
      }}
    >
      <div className="table-column-controller">
        {tableWidths.map((v, key) => {
          return (
            <div
              className="table-column-controller-item"
              key={key}
              onClick={() => selectTableColumn(key)}
              onMouseDown={preventDefault}
              style={{ width: v + 'px' }}
            />
          );
        })}
      </div>
      <div className="table-row-controller">
        {tableRowHeights.map((v, key) => {
          return (
            <div
              className="table-row-controller-item"
              key={key}
              onClick={() => selectTableRow(key)}
              onMouseDown={preventDefault}
              style={{ height: v + 'px' }}
            />
          );
        })}
      </div>
      <div className="table-row-corner" onClick={selectAllTable} onMouseDown={preventDefault} />
    </div>
  ) : null;
}
