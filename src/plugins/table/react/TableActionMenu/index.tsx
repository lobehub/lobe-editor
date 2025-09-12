/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $isTableCellNode,
  $isTableSelection,
  TableCellNode,
  TableObserver,
  getTableElement,
  getTableObserverFromTableElement,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import { ActionIcon } from '@lobehub/ui';
import type { LexicalEditor } from 'lexical';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  getDOMSelection,
} from 'lexical';
import { ChevronDown } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useAnchor } from '@/editor-kernel/react/useAnchor';
import { cleanPosition, updatePosition } from '@/utils/updatePosition';

import ActionMenu from './ActionMenu';
import { useStyles } from './style';

const TableActionMenu = memo<{
  cellMerge?: boolean;
  editor: LexicalEditor;
}>(({ cellMerge, editor }) => {
  const anchorElem = useAnchor();
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
      updatePosition({
        floating: menu,
        offset: 0,
        placement: 'top-end',
        reference: tableCellParentNodeDOM,
      });
    } else {
      cleanPosition(menu);
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
        <ActionMenu cellMerge={cellMerge} editor={editor} tableCellNode={tableCellNode}>
          <ActionIcon
            glass
            icon={ChevronDown}
            size={12}
            style={{
              transform: 'postionX(2px)',
            }}
            variant={'filled'}
          />
        </ActionMenu>
      )}
    </div>
  );
});

export default TableActionMenu;
