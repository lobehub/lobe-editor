import { $computeTableMapSkipCellCheck, $isTableNode, TableNode } from '@lexical/table';
import type { LexicalEditor, NodeKey } from 'lexical';
import { $getNodeByKey, HISTORIC_TAG, PASTE_TAG, SKIP_SCROLL_INTO_VIEW_TAG } from 'lexical';
import { useEffect, useRef } from 'react';

import { syncTableWidthDOM } from '../utils';
import { getHorizontalBorderWidth } from '../utils/distributeColumnWidth';

const MAX_AUTO_FIT_ATTEMPTS = 3;
const MIN_COLUMN_WIDTH = 75;
const LEXICAL_EXPORTED_CELL_WIDTH = 75;

const isPositiveNumber = (width: number | null | undefined): width is number => {
  return typeof width === 'number' && Number.isFinite(width) && width > 0;
};

const hasValidColumnWidths = (
  colWidths: readonly number[] | undefined,
  columnCount: number,
): colWidths is readonly number[] => {
  return (
    colWidths?.length === columnCount &&
    colWidths.every((width) => Number.isFinite(width) && width > 0)
  );
};

const getTableElement = (editor: LexicalEditor, tableKey: NodeKey) => {
  const tableElement = editor.getElementByKey(tableKey);

  return tableElement instanceof HTMLTableElement
    ? tableElement
    : tableElement?.querySelector<HTMLTableElement>('table.editor_table, table') || null;
};

const getTargetTableWidth = (tableElement: HTMLTableElement, columnCount: number) => {
  const scrollWrapper = tableElement.closest<HTMLElement>('.lobe-editor-table-scroll-wrapper');
  const container = scrollWrapper ?? tableElement.parentElement;
  const containerWidth = container?.clientWidth || container?.getBoundingClientRect().width || 0;

  if (containerWidth <= 0) {
    return 0;
  }

  return Math.max(
    containerWidth - getHorizontalBorderWidth(tableElement),
    columnCount * MIN_COLUMN_WIDTH,
  );
};

const fitColumnWidths = (
  sourceWidths: readonly number[],
  targetWidth: number,
  minWidth = MIN_COLUMN_WIDTH,
) => {
  const columnCount = sourceWidths.length;
  if (columnCount === 0 || targetWidth <= 0) {
    return null;
  }

  const nextWidths = Array.from({ length: columnCount }, () => 0);
  const remainingIndexes = new Set(sourceWidths.map((_, index) => index));
  let remainingWidth = Math.max(targetWidth, minWidth * columnCount);

  while (remainingIndexes.size > 0) {
    const remainingSourceWidth = Array.from(remainingIndexes).reduce(
      (total, index) => total + (sourceWidths[index] ?? 0),
      0,
    );
    const clampedIndexes: number[] = [];

    for (const index of remainingIndexes) {
      const proportionalWidth =
        remainingSourceWidth > 0
          ? ((sourceWidths[index] ?? 0) / remainingSourceWidth) * remainingWidth
          : remainingWidth / remainingIndexes.size;

      if (proportionalWidth < minWidth) {
        nextWidths[index] = minWidth;
        remainingWidth -= minWidth;
        clampedIndexes.push(index);
      }
    }

    if (clampedIndexes.length === 0) {
      const indexes = Array.from(remainingIndexes);
      const widthForRemaining = remainingWidth;
      const rawWidths = indexes.map((index) => {
        return remainingSourceWidth > 0
          ? ((sourceWidths[index] ?? 0) / remainingSourceWidth) * widthForRemaining
          : widthForRemaining / indexes.length;
      });
      const flooredWidths = rawWidths.map((width) => Math.floor(width));
      const flooredTotal = flooredWidths.reduce((total, width) => total + width, 0);
      const lastIndex = indexes.at(-1);

      indexes.forEach((index, offset) => {
        nextWidths[index] = flooredWidths[offset] ?? minWidth;
      });

      if (lastIndex !== undefined) {
        nextWidths[lastIndex] += Math.round(widthForRemaining - flooredTotal);
      }
      break;
    }

    clampedIndexes.forEach((index) => {
      remainingIndexes.delete(index);
    });
  }

  return nextWidths;
};

const getCellColumnWidths = (tableNode: TableNode, columnCount: number) => {
  const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
  const firstRow = tableMap[0];
  if (!firstRow) {
    return null;
  }

  const widths: Array<number | null> = Array.from({ length: columnCount }, () => null);

  for (const mapCell of firstRow) {
    const { cell, startColumn } = mapCell;
    const colSpan = Math.max(1, cell.getColSpan());
    const cellWidth = cell.getWidth();

    if (!cellWidth || cellWidth <= 0) {
      continue;
    }

    const width = cellWidth / colSpan;
    for (let index = 0; index < colSpan && startColumn + index < columnCount; index += 1) {
      widths[startColumn + index] = width;
    }
  }

  return widths.every(isPositiveNumber) ? widths : null;
};

const getSourceColumnWidths = (tableNode: TableNode, columnCount: number) => {
  const colWidths = tableNode.getColWidths();
  if (hasValidColumnWidths(colWidths, columnCount)) {
    return [...colWidths];
  }

  const cellWidths = getCellColumnWidths(tableNode, columnCount);
  // Lexical's exportDOM writes this width on every cell, so a table copied out of the editor carries no real widths.
  if (!cellWidths || cellWidths.every((width) => width === LEXICAL_EXPORTED_CELL_WIDTH)) {
    return null;
  }

  return cellWidths;
};

const getFittedTableColumnWidths = (editor: LexicalEditor, tableNode: TableNode) => {
  const columnCount = tableNode.getColumnCount();
  if (columnCount === 0) {
    return null;
  }

  const sourceWidths = getSourceColumnWidths(tableNode, columnCount);
  if (!sourceWidths) {
    return null;
  }

  const tableElement = getTableElement(editor, tableNode.getKey());
  if (!tableElement) {
    return null;
  }

  const targetWidth = getTargetTableWidth(tableElement, columnCount);
  if (targetWidth <= 0) {
    return null;
  }

  return fitColumnWidths(sourceWidths, targetWidth);
};

export const useAutoFitPastedTable = (editor: LexicalEditor | null) => {
  const pendingTableKeysRef = useRef<Set<NodeKey>>(new Set());
  const pasteTableKeysRef = useRef<Set<NodeKey>>(new Set());
  const frameIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!editor) {
      return;
    }

    const clearFrame = () => {
      for (const frameId of frameIdsRef.current) {
        cancelAnimationFrame(frameId);
      }
      frameIdsRef.current.clear();
    };

    const fitTable = (tableKey: NodeKey, remainingAttempts = MAX_AUTO_FIT_ATTEMPTS) => {
      const frameId = requestAnimationFrame(() => {
        frameIdsRef.current.delete(frameId);

        let nextColWidths: number[] | null = null;
        editor.update(
          () => {
            const tableNode = $getNodeByKey(tableKey);
            if (!$isTableNode(tableNode)) {
              pendingTableKeysRef.current.delete(tableKey);
              pasteTableKeysRef.current.delete(tableKey);
              return;
            }

            if (!pasteTableKeysRef.current.has(tableKey) || tableNode.getColumnCount() === 0) {
              pendingTableKeysRef.current.delete(tableKey);
              pasteTableKeysRef.current.delete(tableKey);
              return;
            }

            nextColWidths = getFittedTableColumnWidths(editor, tableNode);
            if (!nextColWidths) {
              return;
            }

            tableNode.setColWidths(nextColWidths);
            pendingTableKeysRef.current.delete(tableKey);
            pasteTableKeysRef.current.delete(tableKey);
          },
          { tag: [HISTORIC_TAG, SKIP_SCROLL_INTO_VIEW_TAG] },
        );

        if (nextColWidths) {
          const syncFrameId = requestAnimationFrame(() => {
            frameIdsRef.current.delete(syncFrameId);
            if (nextColWidths) {
              syncTableWidthDOM(editor, tableKey, nextColWidths);
            }
          });
          frameIdsRef.current.add(syncFrameId);
          return;
        }

        if (remainingAttempts > 0 && pendingTableKeysRef.current.has(tableKey)) {
          fitTable(tableKey, remainingAttempts - 1);
        }
      });

      frameIdsRef.current.add(frameId);
    };

    const unregisterMutationListener = editor.registerMutationListener(
      TableNode,
      (nodeMutations, { updateTags }) => {
        const isPasteUpdate = updateTags.has(PASTE_TAG);

        for (const [tableKey, mutation] of nodeMutations) {
          if (mutation !== 'created') {
            continue;
          }

          pendingTableKeysRef.current.add(tableKey);
          if (isPasteUpdate) {
            pasteTableKeysRef.current.add(tableKey);
          }
          fitTable(tableKey);
        }
      },
      { skipInitialization: true },
    );

    return () => {
      clearFrame();
      pendingTableKeysRef.current.clear();
      pasteTableKeysRef.current.clear();
      unregisterMutationListener();
    };
  }, [editor]);
};
