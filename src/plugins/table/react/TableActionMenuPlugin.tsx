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
  $getNodeTriplet,
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
  TableSelection,
  getTableElement,
  getTableObserverFromTableElement,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import { Icon } from '@lobehub/ui';
import type { ElementNode, LexicalEditor } from 'lexical';
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
  getDOMSelection,
  isDOMNode,
} from 'lexical';
import { ChevronDown } from 'lucide-react';
import type { JSX } from 'react';
import * as React from 'react';
import { ReactPortal, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { dropDownStyles, useStyles } from './TableActionMenuPlugin.style';

function computeSelectionCount(selection: TableSelection): {
  columns: number;
  rows: number;
} {
  const selectionShape = selection.getShape();
  return {
    columns: selectionShape.toX - selectionShape.fromX + 1,
    rows: selectionShape.toY - selectionShape.fromY + 1,
  };
}

function $canUnmerge(): boolean {
  const selection = $getSelection();
  if (
    ($isRangeSelection(selection) && !selection.isCollapsed()) ||
    ($isTableSelection(selection) && !selection.anchor.is(selection.focus)) ||
    (!$isRangeSelection(selection) && !$isTableSelection(selection))
  ) {
    return false;
  }
  const [cell] = $getNodeTriplet(selection.anchor);
  return cell.__colSpan > 1 || cell.__rowSpan > 1;
}

function $selectLastDescendant(node: ElementNode): void {
  const lastDescendant = node.getLastDescendant();
  if ($isTextNode(lastDescendant)) {
    lastDescendant.select();
  } else if ($isElementNode(lastDescendant)) {
    lastDescendant.selectEnd();
  } else if (lastDescendant !== null) {
    lastDescendant.selectNext();
  }
}

function currentCellBackgroundColor(editor: LexicalEditor): null | string {
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) || $isTableSelection(selection)) {
      const [cell] = $getNodeTriplet(selection.anchor);
      if ($isTableCellNode(cell)) {
        return cell.getBackgroundColor();
      }
    }
    return null;
  });
}

type TableCellActionMenuProps = Readonly<{
  cellMerge: boolean;
  contextRef: { current: null | HTMLElement };
  editor: LexicalEditor;
  onClose: () => void;
  setIsMenuOpen: (isOpen: boolean) => void;
  showColorPickerModal: (title: string, showModal: (onClose: () => void) => JSX.Element) => void;
  tableCellNode: TableCellNode;
}>;

function TableActionMenu({
  editor,
  onClose,
  tableCellNode: _tableCellNode,
  setIsMenuOpen,
  contextRef,
  cellMerge,
}: TableCellActionMenuProps) {
  const dropDownRef = useRef<HTMLDivElement | null>(null);
  const [tableCellNode, updateTableCellNode] = useState(_tableCellNode);
  const [selectionCounts, updateSelectionCounts] = useState({
    columns: 1,
    rows: 1,
  });
  const [canMergeCells, setCanMergeCells] = useState(false);
  const [canUnmergeCell, setCanUnmergeCell] = useState(false);
  const [, setBackgroundColor] = useState(() => currentCellBackgroundColor(editor) || '');

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
    const menuButtonElement = contextRef.current;
    const dropDownElement = dropDownRef.current;
    const rootElement = editor.getRootElement();

    if (menuButtonElement && dropDownElement && rootElement) {
      const rootEleRect = rootElement.getBoundingClientRect();
      const menuButtonRect = menuButtonElement.getBoundingClientRect();
      dropDownElement.style.opacity = '1';
      const dropDownElementRect = dropDownElement.getBoundingClientRect();
      const margin = 5;
      let leftPosition = menuButtonRect.right + margin;
      if (
        leftPosition + dropDownElementRect.width > window.innerWidth ||
        leftPosition + dropDownElementRect.width > rootEleRect.right
      ) {
        const position = menuButtonRect.left - dropDownElementRect.width - margin;
        leftPosition = (position < 0 ? margin : position) + window.pageXOffset;
      }
      dropDownElement.style.left = `${leftPosition + window.pageXOffset}px`;

      let topPosition = menuButtonRect.top;
      if (topPosition + dropDownElementRect.height > window.innerHeight) {
        const position = menuButtonRect.bottom - dropDownElementRect.height;
        topPosition = position < 0 ? margin : position;
      }
      dropDownElement.style.top = `${topPosition}px`;
    }
  }, [contextRef, dropDownRef, editor]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropDownRef.current &&
        contextRef.current &&
        isDOMNode(event.target) &&
        !dropDownRef.current.contains(event.target) &&
        !contextRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('click', handleClickOutside);

    return () => window.removeEventListener('click', handleClickOutside);
  }, [setIsMenuOpen, contextRef]);

  const clearTableSelection = useCallback(() => {
    editor.update(() => {
      if (tableCellNode.isAttached()) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
        const tableElement = getTableElement(tableNode, editor.getElementByKey(tableNode.getKey()));

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
        onClose();
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
        onClose();
      });
    },
    [editor, onClose, selectionCounts.rows],
  );

  const insertTableColumnAtSelection = useCallback(
    (shouldInsertAfter: boolean) => {
      editor.update(() => {
        for (let i = 0; i < selectionCounts.columns; i++) {
          $insertTableColumnAtSelection(shouldInsertAfter);
        }
        onClose();
      });
    },
    [editor, onClose, selectionCounts.columns],
  );

  const deleteTableRowAtSelection = useCallback(() => {
    editor.update(() => {
      $deleteTableRowAtSelection();
      onClose();
    });
  }, [editor, onClose]);

  const deleteTableAtSelection = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode);
      tableNode.remove();

      clearTableSelection();
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

  const deleteTableColumnAtSelection = useCallback(() => {
    editor.update(() => {
      $deleteTableColumnAtSelection();
      onClose();
    });
  }, [editor, onClose]);

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
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

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
      onClose();
    });
  }, [editor, tableCellNode, clearTableSelection, onClose]);

  const { cx, styles } = dropDownStyles();

  let mergeCellButton: null | JSX.Element = null;
  if (cellMerge) {
    if (canMergeCells) {
      mergeCellButton = (
        <button
          className="item"
          data-test-id="table-merge-cells"
          onClick={() => mergeTableCellsAtSelection()}
          type="button"
        >
          <span className="text">Merge cells</span>
        </button>
      );
    } else if (canUnmergeCell) {
      mergeCellButton = (
        <button
          className="item"
          data-test-id="table-unmerge-cells"
          onClick={() => unmergeTableCellsAtSelection()}
          type="button"
        >
          <span className="text">Unmerge cells</span>
        </button>
      );
    }
  }

  return createPortal(
    <div
      className={cx('dropdown', styles)}
      onClick={(e) => {
        e.stopPropagation();
      }}
      ref={dropDownRef}
    >
      {mergeCellButton}
      {/* <DropDown
        buttonAriaLabel="Formatting options for vertical alignment"
        buttonClassName="item"
        buttonLabel="Vertical Align">
        <DropDownItem
          className="item wide"
          onClick={() => {
            formatVerticalAlign('top');
          }}>
          <div className="icon-text-container">
            <i className="icon vertical-top" />
            <span className="text">Top Align</span>
          </div>
        </DropDownItem>
        <DropDownItem
          className="item wide"
          onClick={() => {
            formatVerticalAlign('middle');
          }}>
          <div className="icon-text-container">
            <i className="icon vertical-middle" />
            <span className="text">Middle Align</span>
          </div>
        </DropDownItem>
        <DropDownItem
          className="item wide"
          onClick={() => {
            formatVerticalAlign('bottom');
          }}>
          <div className="icon-text-container">
            <i className="icon vertical-bottom" />
            <span className="text">Bottom Align</span>
          </div>
        </DropDownItem>
      </DropDown> */}
      <button
        className="item"
        data-test-id="table-insert-row-above"
        onClick={() => insertTableRowAtSelection(false)}
        type="button"
      >
        <span className="text">
          Insert {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`} above
        </span>
      </button>
      <button
        className="item"
        data-test-id="table-insert-row-below"
        onClick={() => insertTableRowAtSelection(true)}
        type="button"
      >
        <span className="text">
          Insert {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`} below
        </span>
      </button>
      <hr />
      <button
        className="item"
        data-test-id="table-insert-column-before"
        onClick={() => insertTableColumnAtSelection(false)}
        type="button"
      >
        <span className="text">
          Insert {selectionCounts.columns === 1 ? 'column' : `${selectionCounts.columns} columns`}{' '}
          left
        </span>
      </button>
      <button
        className="item"
        data-test-id="table-insert-column-after"
        onClick={() => insertTableColumnAtSelection(true)}
        type="button"
      >
        <span className="text">
          Insert {selectionCounts.columns === 1 ? 'column' : `${selectionCounts.columns} columns`}{' '}
          right
        </span>
      </button>
      <hr />
      <button
        className="item"
        data-test-id="table-delete-columns"
        onClick={() => deleteTableColumnAtSelection()}
        type="button"
      >
        <span className="text">Delete column</span>
      </button>
      <button
        className="item"
        data-test-id="table-delete-rows"
        onClick={() => deleteTableRowAtSelection()}
        type="button"
      >
        <span className="text">Delete row</span>
      </button>
      <button
        className="item"
        data-test-id="table-delete"
        onClick={() => deleteTableAtSelection()}
        type="button"
      >
        <span className="text">Delete table</span>
      </button>
      <hr />
      <button
        className="item"
        data-test-id="table-row-header"
        onClick={() => toggleTableRowIsHeader()}
        type="button"
      >
        <span className="text">
          {(tableCellNode.__headerState & TableCellHeaderStates.ROW) === TableCellHeaderStates.ROW
            ? 'Remove'
            : 'Add'}{' '}
          row header
        </span>
      </button>
      <button
        className="item"
        data-test-id="table-column-header"
        onClick={() => toggleTableColumnIsHeader()}
        type="button"
      >
        <span className="text">
          {(tableCellNode.__headerState & TableCellHeaderStates.COLUMN) ===
          TableCellHeaderStates.COLUMN
            ? 'Remove'
            : 'Add'}{' '}
          column header
        </span>
      </button>
    </div>,
    document.body,
  );
}

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
  const menuRootRef = useRef<HTMLButtonElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    const activeElement = document.activeElement;
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
    if (prevTableCellDOM.current !== tableCellNode) {
      setIsMenuOpen(false);
    }

    prevTableCellDOM.current = tableCellNode;
  }, [prevTableCellDOM, tableCellNode]);

  const { styles } = useStyles();

  return (
    <div className={styles} ref={menuButtonRef}>
      {tableCellNode && (
        <>
          <button
            className="table-cell-action-button chevron-down"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            ref={menuRootRef}
            type="button"
          >
            <Icon icon={ChevronDown} />
          </button>
          {/* {colorPickerModal} */}
          {isMenuOpen && (
            <TableActionMenu
              cellMerge={cellMerge}
              contextRef={menuRootRef}
              editor={editor}
              onClose={() => setIsMenuOpen(false)}
              setIsMenuOpen={setIsMenuOpen}
              showColorPickerModal={() => {}}
              tableCellNode={tableCellNode}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function TableActionMenuPlugin({
  anchorElem = document.body,
  cellMerge = false,
  editor,
}: {
  anchorElem?: HTMLElement;
  cellMerge?: boolean;
  editor: LexicalEditor;
}): null | ReactPortal {
  return createPortal(
    <TableCellActionMenuContainer anchorElem={anchorElem} cellMerge={cellMerge} editor={editor} />,
    anchorElem,
  );
}
