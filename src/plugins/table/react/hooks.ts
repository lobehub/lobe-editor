/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { TableNode } from '@lexical/table';
import { debounce } from 'es-toolkit/compat';
import { $getSelection, LexicalEditor } from 'lexical';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getTableSelectionIndexes, isTableFullySelected } from '../utils';

export interface TableControllerSelection {
  isTableSelected: boolean;
  selectedColumns: number[];
  selectedRows: number[];
}

const isSameSelection = (
  current: TableControllerSelection,
  next: TableControllerSelection,
): boolean => {
  return (
    current.isTableSelected === next.isTableSelected &&
    current.selectedColumns.length === next.selectedColumns.length &&
    current.selectedRows.length === next.selectedRows.length &&
    current.selectedColumns.every((column, index) => column === next.selectedColumns[index]) &&
    current.selectedRows.every((row, index) => row === next.selectedRows[index])
  );
};

const readTableControllerSelection = (
  editor: LexicalEditor,
  node: TableNode,
): TableControllerSelection => {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    const latestNode = node.getLatest();
    const columnCount = latestNode.getColumnCount();
    const rowCount = latestNode.getChildrenSize();
    const tableKey = latestNode.getKey();

    const selectionIndexes = getTableSelectionIndexes(selection, tableKey, columnCount, rowCount);

    return {
      isTableSelected: isTableFullySelected(selection, tableKey, columnCount, rowCount),
      ...selectionIndexes,
    };
  });
};

export const useTableControllerSelection = (editor: LexicalEditor, node: TableNode) => {
  const [selection, setSelection] = useState(() => readTableControllerSelection(editor, node));

  useEffect(() => {
    const updateSelection = () => {
      const nextSelection = readTableControllerSelection(editor, node);
      setSelection((currentSelection) => {
        return isSameSelection(currentSelection, nextSelection) ? currentSelection : nextSelection;
      });
    };

    updateSelection();

    return editor.registerUpdateListener(updateSelection);
  }, [editor, node]);

  return selection;
};

export function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
  maxWait?: number,
) {
  const funcRef = useRef<T | null>(null);
  funcRef.current = fn;

  return useMemo(
    () =>
      debounce(
        (...args: Parameters<T>) => {
          if (funcRef.current) {
            funcRef.current(...args);
          }
        },
        ms,
        { maxWait },
      ),
    [ms, maxWait],
  );
}
