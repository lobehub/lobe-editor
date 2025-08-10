import { $isTableCellNode, TableDOMCell, TableSelection } from '@lexical/table';
import { TableDOMTable } from '@lexical/table/LexicalTableObserver';
import { addClassNamesToElement, removeClassNamesFromElement } from '@lexical/utils';
import { $getNearestNodeFromDOMNode, LexicalEditor, LexicalNode, RangeSelection } from 'lexical';

import { assert } from '@/editor-kernel/utils';

export function $forEachTableCell(
  grid: TableDOMTable,
  cb: (
    cell: TableDOMCell,
    lexicalNode: LexicalNode,
    cords: {
      x: number;
      y: number;
    },
  ) => void,
) {
  const { domRows } = grid;

  for (const [y, row] of domRows.entries()) {
    if (!row) {
      continue;
    }

    for (const [x, cell] of row.entries()) {
      if (!cell) {
        continue;
      }
      const lexicalNode = $getNearestNodeFromDOMNode(cell.elem);

      if (lexicalNode !== null) {
        cb(cell, lexicalNode, {
          x,
          y,
        });
      }
    }
  }
}

function $addHighlightToDOM(editor: LexicalEditor, cell: TableDOMCell): void {
  const element = cell.elem;
  const editorThemeClasses = editor._config.theme;
  const node = $getNearestNodeFromDOMNode(element);
  assert($isTableCellNode(node), 'Expected to find LexicalNode from Table Cell DOMNode');
  addClassNamesToElement(element, editorThemeClasses.tableCellSelected);
}

function $removeHighlightFromDOM(editor: LexicalEditor, cell: TableDOMCell): void {
  const element = cell.elem;
  const node = $getNearestNodeFromDOMNode(element);
  assert($isTableCellNode(node), 'Expected to find LexicalNode from Table Cell DOMNode');
  const editorThemeClasses = editor._config.theme;
  removeClassNamesFromElement(element, editorThemeClasses.tableCellSelected);
}

export function $updateDOMForSelection(
  editor: LexicalEditor,
  table: TableDOMTable,
  selection: TableSelection | RangeSelection | null,
) {
  const selectedCellNodes = new Set(selection ? selection.getNodes() : []);
  $forEachTableCell(table, (cell, lexicalNode) => {
    const elem = cell.elem;

    if (selectedCellNodes.has(lexicalNode)) {
      cell.highlighted = true;
      $addHighlightToDOM(editor, cell);
    } else {
      cell.highlighted = false;
      $removeHighlightFromDOM(editor, cell);
      if (!elem.getAttribute('style')) {
        elem.removeAttribute('style');
      }
    }
  });
}
