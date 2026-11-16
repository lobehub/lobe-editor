import {
  $computeTableMapSkipCellCheck,
  $findTableNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, NodeKey, NodeMutation } from 'lexical';
import { $getNodeByKey } from 'lexical';

import {
  $getTableColumnAligns,
  normalizeTableColumnAligns,
  parseTableColumnAlignsAttribute,
  stringifyTableColumnAligns,
  type TableColumnAlign,
  tableColumnAlignsState,
} from '../node/column-align';

const createColumnAlignsJSON = (aligns: TableColumnAlign[]) =>
  aligns.length > 0 ? { $: { [tableColumnAlignsState.key]: aligns } } : {};

export const readColumnAlignsAttribute = (xmlNode: Element) =>
  createColumnAlignsJSON(parseTableColumnAlignsAttribute(xmlNode.getAttribute('colAligns')));

export const readMarkdownColumnAligns = (align: unknown) =>
  createColumnAlignsJSON(normalizeTableColumnAligns(align));

export function $writeColumnAlignsAttribute(table: TableNode, attributes: Record<string, string>) {
  const colAligns = $getTableColumnAligns(table);
  if (colAligns.length > 0) {
    attributes.colAligns = stringifyTableColumnAligns(colAligns);
  }
}

function $applyTableColumnAligns(editor: LexicalEditor, table: TableNode) {
  const aligns = $getTableColumnAligns(table);
  const [tableMap] = $computeTableMapSkipCellCheck(table, null, null);

  tableMap.forEach((row, rowIndex) => {
    row.forEach((cellMap, columnIndex) => {
      if (!cellMap || cellMap.startRow !== rowIndex || cellMap.startColumn !== columnIndex) return;
      const { cell } = cellMap;
      const element = editor.getElementByKey(cell.getKey());
      if (!element) return;
      // A cell's own element format wins; Lexical already wrote it to `text-align`.
      if (cell.getFormatType()) return;
      element.style.textAlign = aligns[columnIndex] ?? '';
    });
  });
}

export function registerTableColumnAlignDOM(editor: LexicalEditor) {
  const apply = (tableKeys: Set<NodeKey>) => {
    if (tableKeys.size === 0) return;
    editor.getEditorState().read(() => {
      for (const key of tableKeys) {
        const table = $getNodeByKey(key);
        if ($isTableNode(table)) $applyTableColumnAligns(editor, table);
      }
    });
  };

  const collect = (mutations: Map<NodeKey, NodeMutation>) => {
    const tableKeys = new Set<NodeKey>();
    editor.getEditorState().read(() => {
      for (const [key, mutation] of mutations) {
        if (mutation === 'destroyed') continue;
        const node = $getNodeByKey(key);
        if ($isTableNode(node)) {
          tableKeys.add(key);
        } else if ($isTableRowNode(node) || $isTableCellNode(node)) {
          const table = $findTableNode(node);
          if (table) tableKeys.add(table.getKey());
        }
      }
    });
    apply(tableKeys);
  };

  return mergeRegister(
    editor.registerMutationListener(TableNode, collect, { skipInitialization: false }),
    editor.registerMutationListener(TableRowNode, collect, { skipInitialization: true }),
    editor.registerMutationListener(TableCellNode, collect, { skipInitialization: true }),
  );
}
