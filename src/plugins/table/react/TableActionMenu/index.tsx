/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $computeTableMapSkipCellCheck,
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  TableCellHeaderStates,
  TableCellNode,
  TableObserver,
  getTableElement,
  getTableObserverFromTableElement,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import { ActionIcon, Dropdown } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  getDOMSelection,
} from 'lexical';
import {
  ChevronDown,
  Grid2X2XIcon,
  PanelBottomCloseIcon,
  PanelLeftCloseIcon,
  PanelRightCloseIcon,
  PanelTopCloseIcon,
  TableColumnsSplitIcon,
  TableRowsSplitIcon,
} from 'lucide-react';
import {
  type JSX,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { useStyles } from './style';
import {
  $canUnmerge,
  $selectLastDescendant,
  computeSelectionCount,
  currentCellBackgroundColor,
} from './utils';

interface TableCellActionMenuProps {
  cellMerge: boolean;
  children: ReactNode;
  editor: LexicalEditor;
  tableCellNode: TableCellNode;
}

const TableActionMenu = memo<TableCellActionMenuProps>(
  ({ editor, tableCellNode: _tableCellNode, cellMerge, children }) => {
    const [tableCellNode, updateTableCellNode] = useState(_tableCellNode);
    const [selectionCounts, updateSelectionCounts] = useState({
      columns: 1,
      rows: 1,
    });
    const [canMergeCells, setCanMergeCells] = useState(false);
    const [canUnmergeCell, setCanUnmergeCell] = useState(false);
    const [, setBackgroundColor] = useState(() => currentCellBackgroundColor(editor) || '');
    const t = useTranslation();

    useEffect(() => {
      return editor.registerMutationListener(
        TableCellNode,
        (nodeMutations) => {
          const nodeUpdated = nodeMutations.get(tableCellNode.getKey()) === 'updated';

          if (nodeUpdated) {
            editor.getEditorState().read(() => {
              updateTableCellNode(tableCellNode.getLatest());
            });
            setBackgroundColor(currentCellBackgroundColor(editor) || '');
          }
        },
        { skipInitialization: true },
      );
    }, [editor, tableCellNode]);

    useEffect(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        // Merge cells
        if ($isTableSelection(selection)) {
          const currentSelectionCounts = computeSelectionCount(selection);
          updateSelectionCounts(computeSelectionCount(selection));
          setCanMergeCells(currentSelectionCounts.columns > 1 || currentSelectionCounts.rows > 1);
        }
        // Unmerge cell
        setCanUnmergeCell($canUnmerge());
      });
    }, [editor]);

    const clearTableSelection = useCallback(() => {
      editor.update(() => {
        if (tableCellNode.isAttached()) {
          const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
          const tableElement = getTableElement(
            tableNode,
            editor.getElementByKey(tableNode.getKey()),
          );

          if (tableElement === null) {
            throw new Error('TableActionMenu: Expected to find tableElement in DOM');
          }

          const tableObserver = getTableObserverFromTableElement(tableElement);
          if (tableObserver !== null) {
            tableObserver.$clearHighlight();
          }

          tableNode.markDirty();
          updateTableCellNode(tableCellNode.getLatest());
        }
        $setSelection(null);
      });
    }, [editor, tableCellNode]);

    const mergeTableCellsAtSelection = () => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isTableSelection(selection)) {
          return;
        }

        const nodes = selection.getNodes();
        const tableCells = nodes.filter($isTableCellNode);
        const targetCell = $mergeCells(tableCells);

        if (targetCell) {
          $selectLastDescendant(targetCell);
        }
      });
    };

    const unmergeTableCellsAtSelection = () => {
      editor.update(() => {
        $unmergeCell();
      });
    };

    const insertTableRowAtSelection = useCallback(
      (shouldInsertAfter: boolean) => {
        editor.update(() => {
          for (let i = 0; i < selectionCounts.rows; i++) {
            $insertTableRowAtSelection(shouldInsertAfter);
          }
        });
      },
      [editor, selectionCounts.rows],
    );

    const insertTableColumnAtSelection = useCallback(
      (shouldInsertAfter: boolean) => {
        editor.update(() => {
          for (let i = 0; i < selectionCounts.columns; i++) {
            $insertTableColumnAtSelection(shouldInsertAfter);
          }
        });
      },
      [editor, selectionCounts.columns],
    );

    const deleteTableRowAtSelection = useCallback(() => {
      editor.update(() => {
        $deleteTableRowAtSelection();
      });
    }, [editor]);

    const deleteTableAtSelection = useCallback(() => {
      editor.update(() => {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        tableNode.remove();

        clearTableSelection();
      });
    }, [editor, tableCellNode, clearTableSelection]);

    const deleteTableColumnAtSelection = useCallback(() => {
      editor.update(() => {
        $deleteTableColumnAtSelection();
      });
    }, [editor]);

    const toggleTableRowIsHeader = useCallback(() => {
      editor.update(() => {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode);

        const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);

        const rowCells = new Set<TableCellNode>();

        const newStyle = tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.ROW;

        for (let col = 0; col < gridMap[tableRowIndex].length; col++) {
          const mapCell = gridMap[tableRowIndex][col];

          if (!mapCell?.cell) {
            continue;
          }

          if (!rowCells.has(mapCell.cell)) {
            rowCells.add(mapCell.cell);
            mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.ROW);
          }
        }
        clearTableSelection();
      });
    }, [editor, tableCellNode, clearTableSelection]);

    const toggleTableColumnIsHeader = useCallback(() => {
      editor.update(() => {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);

        const tableColumnIndex = $getTableColumnIndexFromTableCellNode(tableCellNode);

        const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);

        const columnCells = new Set<TableCellNode>();
        const newStyle = tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.COLUMN;

        for (const element of gridMap) {
          const mapCell = element[tableColumnIndex];

          if (!mapCell?.cell) {
            continue;
          }

          if (!columnCells.has(mapCell.cell)) {
            columnCells.add(mapCell.cell);
            mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.COLUMN);
          }
        }
        clearTableSelection();
      });
    }, [editor, tableCellNode, clearTableSelection]);

    // Create menu items array with useMemo for performance
    const menuItems = useMemo(() => {
      return [
        // // Merge/Unmerge cells (conditional)
        // ...(cellMerge && canMergeCells
        //   ? [
        //       {
        //         key: 'table-merge-cells',
        //         label: 'Merge cells',
        //         onClick: () => mergeTableCellsAtSelection(),
        //       },
        //     ]
        //   : []),
        // ...(cellMerge && canUnmergeCell
        //   ? [
        //       {
        //         key: 'table-unmerge-cells',
        //         label: 'Unmerge cells',
        //         onClick: () => unmergeTableCellsAtSelection(),
        //       },
        //     ]
        //   : []),
        // // Divider after merge operations (if any merge operations exist)
        // ...(cellMerge && (canMergeCells || canUnmergeCell) ? [{ type: 'divider' as const }] : []),
        //
        // // Row operations
        {
          icon: PanelTopCloseIcon,
          key: 'table-insert-row-above',
          label: t(`table.insertRowAbove`, {
            count: selectionCounts.rows,
          }),
          onClick: () => insertTableRowAtSelection(false),
        },
        {
          icon: PanelBottomCloseIcon,
          key: 'table-insert-row-below',
          label: t(`table.insertRowBelow`, {
            count: selectionCounts.rows,
          }),
          onClick: () => insertTableRowAtSelection(true),
        },
        { type: 'divider' as const },

        // Column operations
        {
          icon: PanelLeftCloseIcon,
          key: 'table-insert-column-before',
          // label: `Insert ${selectionCounts.columns === 1 ? 'column' : `${selectionCounts.columns} columns`} left`,
          label: t(`table.insertColumnLeft`, {
            count: selectionCounts.columns,
          }),
          onClick: () => insertTableColumnAtSelection(false),
        },
        {
          icon: PanelRightCloseIcon,
          key: 'table-insert-column-after',
          // label: `Insert ${selectionCounts.columns === 1 ? 'column' : `${selectionCounts.columns} columns`} right`,
          label: t(`table.insertColumnRight`, {
            count: selectionCounts.columns,
          }),
          onClick: () => insertTableColumnAtSelection(true),
        },
        { type: 'divider' as const },

        // Delete operations
        {
          icon: TableColumnsSplitIcon,
          key: 'table-delete-columns',
          // label: 'Delete column',
          label: t(`table.deleteColumn`),
          onClick: () => deleteTableColumnAtSelection(),
        },
        {
          icon: TableRowsSplitIcon,
          key: 'table-delete-rows',
          // label: 'Delete row',
          label: t(`table.deleteRow`),
          onClick: () => deleteTableRowAtSelection(),
        },
        { type: 'divider' as const },
        {
          icon: Grid2X2XIcon,
          key: 'table-delete',
          // label: 'Delete table',
          label: t(`table.delete`),
          onClick: () => deleteTableAtSelection(),
        },
      ];
    }, [
      cellMerge,
      canMergeCells,
      canUnmergeCell,
      selectionCounts.rows,
      selectionCounts.columns,
      tableCellNode.__headerState,
      mergeTableCellsAtSelection,
      unmergeTableCellsAtSelection,
      insertTableRowAtSelection,
      insertTableColumnAtSelection,
      deleteTableColumnAtSelection,
      deleteTableRowAtSelection,
      deleteTableAtSelection,
      toggleTableRowIsHeader,
      toggleTableColumnIsHeader,
    ]);

    return <Dropdown menu={{ items: menuItems }}>{children}</Dropdown>;
  },
);

function TableCellActionMenuContainer({
  anchorElem,
  cellMerge,
  editor,
}: {
  anchorElem: HTMLElement;
  cellMerge: boolean;
  editor: LexicalEditor;
}): JSX.Element {
  const menuButtonRef = useRef<HTMLDivElement | null>(null);

  const [tableCellNode, setTableMenuCellNode] = useState<TableCellNode | null>(null);

  // const [colorPickerModal, showColorPickerModal] = useModal();

  const checkTableCellOverflow = useCallback((tableCellParentNodeDOM: HTMLElement): boolean => {
    const scrollableContainer = tableCellParentNodeDOM.closest(
      '.PlaygroundEditorTheme__tableScrollableWrapper',
    );
    if (scrollableContainer) {
      const containerRect = (scrollableContainer as HTMLElement).getBoundingClientRect();
      const cellRect = tableCellParentNodeDOM.getBoundingClientRect();

      // Calculate where the action button would be positioned (5px from right edge of cell)
      // Also account for the button width and table cell padding (8px)
      const actionButtonRight = cellRect.right - 5;
      const actionButtonLeft = actionButtonRight - 28; // 20px width + 8px padding

      // Only hide if the action button would overflow the container
      if (actionButtonRight > containerRect.right || actionButtonLeft < containerRect.left) {
        return true;
      }
    }
    return false;
  }, []);

  const $moveMenu = useCallback(() => {
    const menu = menuButtonRef.current;
    const selection = $getSelection();
    const nativeSelection = getDOMSelection(editor._window);
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    function disable() {
      if (menu) {
        menu.classList.remove('table-cell-action-button-container--active');
        menu.classList.add('table-cell-action-button-container--inactive');
      }
      setTableMenuCellNode(null);
    }

    if (!selection || !menu) {
      return disable();
    }

    const rootElement = editor.getRootElement();
    let tableObserver: TableObserver | null = null;
    let tableCellParentNodeDOM: HTMLElement | null = null;

    if (
      $isRangeSelection(selection) &&
      rootElement !== null &&
      nativeSelection !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const tableCellNodeFromSelection = $getTableCellNodeFromLexicalNode(
        selection.anchor.getNode(),
      );

      if (!tableCellNodeFromSelection) {
        return disable();
      }

      tableCellParentNodeDOM = editor.getElementByKey(tableCellNodeFromSelection.getKey());

      if (!tableCellParentNodeDOM || !tableCellNodeFromSelection.isAttached()) {
        return disable();
      }

      if (checkTableCellOverflow(tableCellParentNodeDOM)) {
        return disable();
      }

      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNodeFromSelection);
      const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));

      if (tableElement === null) {
        throw new Error('TableActionMenu: Expected to find tableElement in DOM');
      }

      tableObserver = getTableObserverFromTableElement(tableElement);
      setTableMenuCellNode(tableCellNodeFromSelection);
    } else if ($isTableSelection(selection)) {
      const anchorNode = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
      if (!$isTableCellNode(anchorNode)) {
        throw new Error('TableSelection anchorNode must be a TableCellNode');
      }
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(anchorNode);
      const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));
      if (tableElement === null) {
        throw new Error('TableActionMenu: Expected to find tableElement in DOM');
      }
      tableObserver = getTableObserverFromTableElement(tableElement);
      tableCellParentNodeDOM = editor.getElementByKey(anchorNode.getKey());

      if (tableCellParentNodeDOM === null) {
        return disable();
      }

      if (checkTableCellOverflow(tableCellParentNodeDOM)) {
        return disable();
      }
    } else if (!activeElement) {
      return disable();
    }
    if (tableObserver === null || tableCellParentNodeDOM === null) {
      return disable();
    }
    const enabled = !tableObserver || !tableObserver.isSelecting;
    menu.classList.toggle('table-cell-action-button-container--active', enabled);
    menu.classList.toggle('table-cell-action-button-container--inactive', !enabled);
    if (enabled) {
      const tableCellRect = tableCellParentNodeDOM.getBoundingClientRect();
      const anchorRect = anchorElem.getBoundingClientRect();
      const top = tableCellRect.top - anchorRect.top;
      const left = tableCellRect.right - anchorRect.left;
      menu.style.transform = `translate(${left}px, ${top}px)`;
    }
  }, [editor, anchorElem, checkTableCellOverflow]);

  useEffect(() => {
    // We call the $moveMenu callback every time the selection changes,
    // once up front, and once after each pointerUp
    let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
    const callback = () => {
      timeoutId = undefined;
      editor.getEditorState().read($moveMenu);
    };
    const delayedCallback = () => {
      if (timeoutId === undefined) {
        timeoutId = setTimeout(callback, 0);
      }
      return false;
    };
    return mergeRegister(
      editor.registerUpdateListener(delayedCallback),
      editor.registerCommand(SELECTION_CHANGE_COMMAND, delayedCallback, COMMAND_PRIORITY_CRITICAL),
      editor.registerRootListener((rootElement, prevRootElement) => {
        if (prevRootElement) {
          prevRootElement.removeEventListener('pointerup', delayedCallback);
        }
        if (rootElement) {
          rootElement.addEventListener('pointerup', delayedCallback);
          delayedCallback();
        }
      }),
      () => clearTimeout(timeoutId),
    );
  });

  const prevTableCellDOM = useRef(tableCellNode);

  useEffect(() => {
    prevTableCellDOM.current = tableCellNode;
  }, [prevTableCellDOM, tableCellNode]);

  const { styles } = useStyles();

  return (
    <div className={styles} ref={menuButtonRef}>
      {tableCellNode && (
        <TableActionMenu cellMerge={cellMerge} editor={editor} tableCellNode={tableCellNode}>
          <ActionIcon
            glass
            icon={ChevronDown}
            size={'small'}
            style={{
              position: 'absolute',
              right: 4,
              top: 4,
            }}
            variant={'filled'}
          />
        </TableActionMenu>
      )}
    </div>
  );
}

export default memo<{
  anchorElem?: HTMLElement;
  cellMerge?: boolean;
  editor: LexicalEditor;
}>(({ anchorElem, cellMerge = false, editor }) => {
  // Don't render portal on server side
  if (typeof document === 'undefined') {
    return null;
  }

  const root = editor.getRootElement();
  const anchor = root ? root.parentElement : null;

  const targetElement = anchorElem || anchor || document.body;

  return createPortal(
    <TableCellActionMenuContainer
      anchorElem={targetElement}
      cellMerge={cellMerge}
      editor={editor}
    />,
    targetElement,
  );
});
