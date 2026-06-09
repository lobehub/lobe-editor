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
import { DropdownMenu, type DropdownMenuProps } from '@lobehub/ui';
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
import { type ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const TABLE_DELETE_PREVIEW_CLASS = 'lobe-editor-table-delete-preview';

const range = (from: number, to: number) => {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
};

const TableActionMenu = memo<TableCellActionMenuProps>(
  ({ editor, tableCellNode: _tableCellNode, cellMerge, children }) => {
    const [tableCellNode, updateTableCellNode] = useState(_tableCellNode);
    const deletePreviewElementsRef = useRef<HTMLElement[]>([]);
    const [selectionCounts, updateSelectionCounts] = useState({
      columns: 1,
      rows: 1,
    });
    const [canMergeCells, setCanMergeCells] = useState(false);
    const [canUnmergeCell, setCanUnmergeCell] = useState(false);
    const [, setBackgroundColor] = useState(() => currentCellBackgroundColor(editor) || '');
    const t = useTranslation();

    const clearDeletePreview = useCallback(() => {
      deletePreviewElementsRef.current.forEach((element) => {
        element.classList.remove(TABLE_DELETE_PREVIEW_CLASS);
      });
      document.querySelectorAll(`.${TABLE_DELETE_PREVIEW_CLASS}`).forEach((element) => {
        element.classList.remove(TABLE_DELETE_PREVIEW_CLASS);
      });
      deletePreviewElementsRef.current = [];
    }, []);

    const showDeletePreview = useCallback(
      (target: 'columns' | 'rows' | 'table') => {
        clearDeletePreview();

        editor.getEditorState().read(() => {
          if (!tableCellNode.isAttached()) {
            return;
          }

          const latestTableCellNode = tableCellNode.getLatest();
          if (!$isTableCellNode(latestTableCellNode)) {
            return;
          }

          const tableNode = $getTableNodeFromLexicalNodeOrThrow(latestTableCellNode);
          const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
          const selection = $getSelection();
          const previewCellKeys = new Set<string>();

          if (target === 'columns') {
            const selectedColumns =
              $isTableSelection(selection) && selection.tableKey === tableNode.getKey()
                ? range(selection.getShape().fromX, selection.getShape().toX)
                : [];
            const columnIndexes =
              selectedColumns.length > 0
                ? selectedColumns
                : [$getTableColumnIndexFromTableCellNode(latestTableCellNode)];

            for (const row of gridMap) {
              for (const columnIndex of columnIndexes) {
                const cell = row[columnIndex]?.cell;
                if (cell) {
                  previewCellKeys.add(cell.getKey());
                }
              }
            }
          } else if (target === 'rows') {
            const selectedRows =
              $isTableSelection(selection) && selection.tableKey === tableNode.getKey()
                ? range(selection.getShape().fromY, selection.getShape().toY)
                : [];
            const rowIndexes =
              selectedRows.length > 0
                ? selectedRows
                : [$getTableRowIndexFromTableCellNode(latestTableCellNode)];

            for (const rowIndex of rowIndexes) {
              const row = gridMap[rowIndex];
              if (!row) {
                continue;
              }

              for (const mapCell of row) {
                if (mapCell?.cell) {
                  previewCellKeys.add(mapCell.cell.getKey());
                }
              }
            }
          } else {
            for (const row of gridMap) {
              for (const mapCell of row) {
                if (mapCell?.cell) {
                  previewCellKeys.add(mapCell.cell.getKey());
                }
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
      },
      [clearDeletePreview, editor, tableCellNode],
    );

    const renderDeleteMenuLabel = useCallback(
      (label: ReactNode, target: 'columns' | 'rows' | 'table') => {
        return (
          <span
            onMouseEnter={() => showDeletePreview(target)}
            onMouseLeave={clearDeletePreview}
            style={{ display: 'block' }}
          >
            {label}
          </span>
        );
      },
      [clearDeletePreview, showDeletePreview],
    );

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

    useEffect(() => {
      return () => {
        clearDeletePreview();
      };
    }, [clearDeletePreview]);

    useEffect(() => {
      return editor.registerUpdateListener(() => {
        clearDeletePreview();
      });
    }, [clearDeletePreview, editor]);

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
      clearDeletePreview();
      editor.update(() => {
        $deleteTableRowAtSelection();
      });
    }, [clearDeletePreview, editor]);

    const deleteTableAtSelection = useCallback(() => {
      clearDeletePreview();
      editor.update(() => {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        tableNode.remove();

        clearTableSelection();
      });
    }, [clearDeletePreview, editor, tableCellNode, clearTableSelection]);

    const deleteTableColumnAtSelection = useCallback(() => {
      clearDeletePreview();
      editor.update(() => {
        $deleteTableColumnAtSelection();
      });
    }, [clearDeletePreview, editor]);

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

    const menuItems = useMemo<DropdownMenuProps['items']>(() => {
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
          label: renderDeleteMenuLabel(t(`table.deleteColumn`), 'columns'),
          onClick: () => deleteTableColumnAtSelection(),
        },
        {
          icon: TableRowsSplitIcon,
          key: 'table-delete-rows',
          // label: 'Delete row',
          label: renderDeleteMenuLabel(t(`table.deleteRow`), 'rows'),
          onClick: () => deleteTableRowAtSelection(),
        },
        { type: 'divider' as const },
        {
          icon: Grid2X2XIcon,
          key: 'table-delete',
          // label: 'Delete table',
          label: renderDeleteMenuLabel(t(`table.delete`), 'table'),
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
      renderDeleteMenuLabel,
      toggleTableRowIsHeader,
      toggleTableColumnIsHeader,
    ]);

    return <DropdownMenu items={menuItems}>{children}</DropdownMenu>;
  },
);

TableActionMenu.displayName = 'TableActionMenu';

export default TableActionMenu;
