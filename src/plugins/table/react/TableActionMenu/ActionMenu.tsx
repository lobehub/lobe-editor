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
  getTableElement,
  getTableObserverFromTableElement,
} from '@lexical/table';
import { Dropdown } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import { $getSelection, $setSelection } from 'lexical';
import {
  Grid2X2XIcon,
  PanelBottomCloseIcon,
  PanelLeftCloseIcon,
  PanelRightCloseIcon,
  PanelTopCloseIcon,
  TableColumnsSplitIcon,
  TableRowsSplitIcon,
} from 'lucide-react';
import { type ReactNode, memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';

import {
  $canUnmerge,
  $selectLastDescendant,
  computeSelectionCount,
  currentCellBackgroundColor,
} from './utils';

interface TableCellActionMenuProps {
  cellMerge?: boolean;
  children: ReactNode;
  className?: string;
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

TableActionMenu.displayName = 'TableActionMenu';

export default TableActionMenu;
