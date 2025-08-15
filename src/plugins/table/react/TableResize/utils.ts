import { TableCellNode, TableMapType } from '@lexical/table';
import { LexicalEditor } from 'lexical';

export const getCellColumnIndex = (tableCellNode: TableCellNode, tableMap: TableMapType) => {
  for (const element of tableMap) {
    for (const [column, element_] of element.entries()) {
      if (element_.cell === tableCellNode) {
        return column;
      }
    }
  }
};

export const getCellNodeHeight = (
  cell: TableCellNode,
  activeEditor: LexicalEditor,
): number | undefined => {
  const domCellNode = activeEditor.getElementByKey(cell.getKey());
  return domCellNode?.clientHeight;
};
