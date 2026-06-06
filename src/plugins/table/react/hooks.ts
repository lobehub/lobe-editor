/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { $findTableNode, $isTableSelection, TableNode } from '@lexical/table';
import { debounce } from 'es-toolkit/compat';
import { $getNodeByKey, $getSelection, $isRangeSelection, LexicalEditor } from 'lexical';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getTableSelectionIndexes, isTableFullySelected } from '../utils';

export interface TableControllerSelection {
  isTableFocused: boolean;
  isTableSelected: boolean;
  selectedColumns: number[];
  selectedRows: number[];
}

const isSameSelection = (
  current: TableControllerSelection,
  next: TableControllerSelection,
): boolean => {
  return (
    current.isTableFocused === next.isTableFocused &&
    current.isTableSelected === next.isTableSelected &&
    current.selectedColumns.length === next.selectedColumns.length &&
    current.selectedRows.length === next.selectedRows.length &&
    current.selectedColumns.every((column, index) => column === next.selectedColumns[index]) &&
    current.selectedRows.every((row, index) => row === next.selectedRows[index])
  );
};

const readTableControllerSelection = (
  editor: LexicalEditor,
  tableKey: string,
): TableControllerSelection => {
  const rootElement = editor.getRootElement();
  const activeElement = rootElement?.ownerDocument.activeElement;
  const isEditorFocused = Boolean(
    rootElement &&
    activeElement &&
    (activeElement === rootElement || rootElement.contains(activeElement)),
  );

  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    const tableNode = $getNodeByKey<TableNode>(tableKey);

    if (!tableNode) {
      return {
        isTableFocused: false,
        isTableSelected: false,
        selectedColumns: [],
        selectedRows: [],
      };
    }

    const columnCount = tableNode.getColumnCount();
    const rowCount = tableNode.getChildrenSize();

    const selectionIndexes = getTableSelectionIndexes(selection, tableKey, columnCount, rowCount);
    const anchorNode = $isRangeSelection(selection) ? $getNodeByKey(selection.anchor.key) : null;
    const isTableFocused =
      isEditorFocused &&
      (($isTableSelection(selection) && selection.tableKey === tableKey) ||
        Boolean(anchorNode && $findTableNode(anchorNode)?.getKey() === tableKey));

    return {
      isTableFocused,
      isTableSelected:
        isEditorFocused && isTableFullySelected(selection, tableKey, columnCount, rowCount),
      selectedColumns: isEditorFocused ? selectionIndexes.selectedColumns : [],
      selectedRows: isEditorFocused ? selectionIndexes.selectedRows : [],
    };
  });
};

export const useTableControllerSelection = (editor: LexicalEditor, node: TableNode) => {
  const tableKey = node.getKey();
  const [selection, setSelection] = useState(() => readTableControllerSelection(editor, tableKey));

  useEffect(() => {
    let frame: number | null = null;
    const updateSelection = () => {
      const nextSelection = readTableControllerSelection(editor, tableKey);
      setSelection((currentSelection) => {
        return isSameSelection(currentSelection, nextSelection) ? currentSelection : nextSelection;
      });
    };

    const scheduleUpdateSelection = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      frame = requestAnimationFrame(() => {
        frame = null;
        updateSelection();
      });
    };

    const unregisterRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
      prevRootElement?.removeEventListener('focusin', scheduleUpdateSelection);
      prevRootElement?.removeEventListener('focusout', scheduleUpdateSelection);
      rootElement?.addEventListener('focusin', scheduleUpdateSelection);
      rootElement?.addEventListener('focusout', scheduleUpdateSelection);
      updateSelection();
    });

    const unregisterUpdateListener = editor.registerUpdateListener(updateSelection);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      unregisterRootListener();
      unregisterUpdateListener();
    };
  }, [editor, tableKey]);

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
