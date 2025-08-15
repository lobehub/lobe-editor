import {
  $getTableAndElementByKey,
  $getTableColumnIndexFromTableCellNode,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
  getTableElement,
} from '@lexical/table';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import { ActionIcon } from '@lobehub/ui';
import { $getNearestNodeFromDOMNode, LexicalEditor, NodeKey } from 'lexical';
import { PlusIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLexicalComposerContext } from '@/editor-kernel/react';

import { BUTTON_WIDTH_PX, useStyles } from './style';
import { getMouseInfo, useDebounce } from './utils';

const TableHoverActionsContainer = memo<{
  anchorElem: HTMLElement;
  editor: LexicalEditor;
}>(({ anchorElem, editor }) => {
  const [iEditor] = useLexicalComposerContext();
  const [isShownRow, setShownRow] = useState<boolean>(false);
  const [isShownColumn, setShownColumn] = useState<boolean>(false);
  const [shouldListenMouseMove, setShouldListenMouseMove] = useState<boolean>(false);
  const [position, setPosition] = useState({});
  const tableSetRef = useRef<Set<NodeKey>>(new Set());
  const tableCellDOMNodeRef = useRef<HTMLElement | null>(null);
  const { cx, styles } = useStyles();

  const debouncedOnMouseMove = useDebounce(
    (event: MouseEvent) => {
      const { isOutside, tableDOMNode } = getMouseInfo(event, iEditor);

      if (isOutside) {
        setShownRow(false);
        setShownColumn(false);
        return;
      }

      if (!tableDOMNode) {
        return;
      }

      tableCellDOMNodeRef.current = tableDOMNode;

      let hoveredRowNode: TableCellNode | null = null;
      let hoveredColumnNode: TableCellNode | null = null;
      let tableDOMElement: HTMLElement | null = null;

      editor.getEditorState().read(
        () => {
          const maybeTableCell = $getNearestNodeFromDOMNode(tableDOMNode);

          if ($isTableCellNode(maybeTableCell)) {
            const table = $findMatchingParent(maybeTableCell, (node) => $isTableNode(node));
            if (!$isTableNode(table)) {
              return;
            }

            tableDOMElement = getTableElement(table, editor.getElementByKey(table.getKey()));

            if (tableDOMElement) {
              const rowCount = table.getChildrenSize();
              const colCount = (
                (table as TableNode).getChildAtIndex(0) as TableRowNode
              )?.getChildrenSize();

              const rowIndex = $getTableRowIndexFromTableCellNode(maybeTableCell);
              const colIndex = $getTableColumnIndexFromTableCellNode(maybeTableCell);

              if (rowIndex === rowCount - 1) {
                hoveredRowNode = maybeTableCell;
              } else if (colIndex === colCount - 1) {
                hoveredColumnNode = maybeTableCell;
              }
            }
          }
        },
        { editor },
      );

      if (tableDOMElement) {
        const {
          width: tableElemWidth,
          y: tableElemY,
          right: tableElemRight,
          left: tableElemLeft,
          bottom: tableElemBottom,
          height: tableElemHeight,
        } = (tableDOMElement as HTMLTableElement).getBoundingClientRect();

        // Adjust for using the scrollable table container
        const parentElement = (tableDOMElement as HTMLTableElement).parentElement;
        let tableHasScroll = false;
        if (
          parentElement &&
          parentElement.classList.contains('PlaygroundEditorTheme__tableScrollableWrapper')
        ) {
          tableHasScroll = parentElement.scrollWidth > parentElement.clientWidth;
        }
        const { y: editorElemY, left: editorElemLeft } = anchorElem.getBoundingClientRect();

        if (hoveredRowNode) {
          setShownColumn(false);
          setShownRow(true);
          setPosition({
            height: BUTTON_WIDTH_PX,
            left:
              tableHasScroll && parentElement
                ? parentElement.offsetLeft
                : tableElemLeft - editorElemLeft,
            top: tableElemBottom - editorElemY + 5,
            width: tableHasScroll && parentElement ? parentElement.offsetWidth : tableElemWidth,
          });
        } else if (hoveredColumnNode) {
          setShownColumn(true);
          setShownRow(false);
          setPosition({
            height: tableElemHeight,
            left: tableElemRight - editorElemLeft + 5,
            top: tableElemY - editorElemY,
            width: BUTTON_WIDTH_PX,
          });
        }
      }
    },
    50,
    250,
  );

  // Hide the buttons on any table dimensions change to prevent last row cells
  // overlap behind the 'Add Row' button when text entry changes cell height
  const tableResizeObserver = useMemo(() => {
    return new ResizeObserver(() => {
      setShownRow(false);
      setShownColumn(false);
    });
  }, []);

  useEffect(() => {
    if (!shouldListenMouseMove) {
      return;
    }

    document.addEventListener('mousemove', debouncedOnMouseMove);

    return () => {
      setShownRow(false);
      setShownColumn(false);
      document.removeEventListener('mousemove', debouncedOnMouseMove);
    };
  }, [shouldListenMouseMove, debouncedOnMouseMove]);

  useEffect(() => {
    return mergeRegister(
      editor.registerMutationListener(
        TableNode,
        (mutations) => {
          editor.getEditorState().read(
            () => {
              let resetObserver = false;
              for (const [key, type] of mutations) {
                switch (type) {
                  case 'created': {
                    tableSetRef.current.add(key);
                    resetObserver = true;
                    break;
                  }
                  case 'destroyed': {
                    tableSetRef.current.delete(key);
                    resetObserver = true;
                    break;
                  }
                  default: {
                    break;
                  }
                }
              }
              if (resetObserver) {
                // Reset resize observers
                tableResizeObserver.disconnect();
                for (const tableKey of tableSetRef.current) {
                  const { tableElement } = $getTableAndElementByKey(tableKey);
                  tableResizeObserver.observe(tableElement);
                }
                setShouldListenMouseMove(tableSetRef.current.size > 0);
              }
            },
            { editor },
          );
        },
        { skipInitialization: false },
      ),
    );
  }, [editor, tableResizeObserver]);

  const insertAction = (insertRow: boolean) => {
    editor.update(() => {
      if (tableCellDOMNodeRef.current) {
        const maybeTableNode = $getNearestNodeFromDOMNode(tableCellDOMNodeRef.current);
        maybeTableNode?.selectEnd();
        if (insertRow) {
          $insertTableRowAtSelection();
          setShownRow(false);
        } else {
          $insertTableColumnAtSelection();
          setShownColumn(false);
        }
      }
    });
  };

  return (
    <div>
      {isShownRow && (
        <ActionIcon
          className={cx('tableAddRows', styles.tableAddRows)}
          icon={PlusIcon}
          onClick={() => insertAction(isShownRow)}
          size={'small'}
          style={{ ...position }}
          variant={'filled'}
        />
      )}
      {isShownColumn && (
        <ActionIcon
          className={cx('tableAddColumns', styles.tableAddColumns)}
          icon={PlusIcon}
          onClick={() => insertAction(false)}
          size={'small'}
          style={{ ...position }}
          variant={'filled'}
        />
      )}
    </div>
  );
});

export default memo(
  ({ anchorElem = document.body, editor }: { anchorElem?: HTMLElement; editor: LexicalEditor }) => {
    return createPortal(
      <TableHoverActionsContainer anchorElem={anchorElem} editor={editor} />,
      anchorElem,
    );
  },
);
