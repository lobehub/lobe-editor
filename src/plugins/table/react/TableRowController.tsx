import { $isTableRowNode, TableNode } from '@lexical/table';
import { cx } from 'antd-style';
import { LexicalEditor } from 'lexical';
import { memo, useEffect, useMemo, useState } from 'react';

import { styles } from './TableController/style';

interface TableRowControllerProps {
  editor: LexicalEditor;
  node: TableNode;
}

const CONTROL_SIZE = 14;
const ROW_BORDER_HEIGHT = 0.5;
const LAST_ROW_BORDER_HEIGHT = 1;

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
      <div className={cx('left', styles.rowLeft)}>
        {rowHeights.map((height, index) => {
          const isLastRow = index + 1 === rowHeights.length;

          return (
            <div
              className={cx('row', styles.row, isLastRow && styles.rowLast)}
              key={index}
              style={{ height }}
            />
          );
        })}
      </div>
      <div className={cx('corner', styles.corner)} />
    </div>
  );
});

TableRowController.displayName = 'TableRowController';

export default TableRowController;
