import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $isElementNode, COMMAND_PRIORITY_EDITOR } from 'lexical';

import { $isDiffContentNode } from '../node/DiffContentNode';
import { DiffNode } from '../node/DiffNode';
import type { TableCellDiffNode } from '../node/TableCellDiffNode';
import { $isTableCellDiffNode } from '../node/TableCellDiffNode';
import type { TableRowDiffNode } from '../node/TableRowDiffNode';
import { $isTableRowDiffNode } from '../node/TableRowDiffNode';
import {
  $createPlainTableCellFromDiff,
  $getTableCellColumnIndex,
  $getTableCellDiffGroup,
  $getTableForCell,
  $removeTableWidthsForCompleteCellGroup,
  $shrinkTableWidthsAfterCellRemoval,
} from '../table-cell-diff';
import { $createPlainTableRowFromDiff, $getTableRowDiffPair } from '../table-row-diff';
import { DiffAction, LITEXML_DIFFNODE_ALL_COMMAND, LITEXML_DIFFNODE_COMMAND } from './symbols';

function doTableRowAction(editor: LexicalEditor, node: TableRowDiffNode, action: DiffAction) {
  const pair = $getTableRowDiffPair(node);
  if (pair) {
    const survivingRow = action === DiffAction.Accept ? pair.add : pair.remove;
    const discardedRow = action === DiffAction.Accept ? pair.remove : pair.add;
    const plainRow = $createPlainTableRowFromDiff(editor, survivingRow);
    discardedRow.remove();
    survivingRow.replace(plainRow, false);
    plainRow.selectStart();
    return;
  }

  if (node.getDiffType() === 'remove') {
    if (action === DiffAction.Accept) {
      node.remove();
    } else {
      const plainRow = $createPlainTableRowFromDiff(editor, node);
      node.replace(plainRow, false);
      plainRow.selectStart();
    }
    return;
  }

  if (action === DiffAction.Accept) {
    const plainRow = $createPlainTableRowFromDiff(editor, node);
    node.replace(plainRow, false);
    plainRow.selectStart();
  } else {
    node.remove();
  }
}

function doTableCellAction(editor: LexicalEditor, node: TableCellDiffNode, action: DiffAction) {
  const group = $getTableCellDiffGroup(node);
  const table = $getTableForCell(node);
  const columnIndex = $getTableCellColumnIndex(node);
  const span = node.getColSpan();
  const keep =
    (node.getDiffType() === 'add' && action === DiffAction.Accept) ||
    (node.getDiffType() === 'remove' && action === DiffAction.Reject);

  if (keep) {
    group.forEach((cell) => cell.replace($createPlainTableCellFromDiff(editor, cell), false));
    return;
  }
  if (table && columnIndex >= 0) {
    const widthCount = table.getColWidths()?.length;
    $removeTableWidthsForCompleteCellGroup(table, group, columnIndex, span);
    group.forEach((cell) => cell.remove());
    if (table.getColWidths()?.length === widthCount) {
      $shrinkTableWidthsAfterCellRemoval(table, columnIndex, span);
    }
    return;
  }
  group.forEach((cell) => cell.remove());
}

function doAction(editor: LexicalEditor, node: DiffNode | TableRowDiffNode, action: DiffAction) {
  if ($isTableRowDiffNode(node)) {
    doTableRowAction(editor, node, action);
    return;
  }

  const parent = node.getParent();
  if ($isTableCellDiffNode(parent)) {
    doTableCellAction(editor, parent, action);
    return;
  }

  if (node.diffType === 'modify') {
    const children = node.getChildren();
    const selectedChild = action === DiffAction.Accept ? children[1] : children[0];
    if ($isDiffContentNode(selectedChild)) {
      const parent = node.getParentOrThrow();
      selectedChild.getChildren().forEach((child) => node.insertBefore(child));
      node.remove();
      if ($isElementNode(parent)) parent.selectEnd();
    } else if (selectedChild) {
      node.replace(selectedChild, false).selectEnd();
    }
  }
  if (node.diffType === 'remove') {
    if (action === DiffAction.Accept) {
      node.remove();
    } else if (action === DiffAction.Reject) {
      const children = node.getChildren();
      node.replace(children[0], false).selectEnd();
    }
  }
  if (node.diffType === 'add') {
    if (action === DiffAction.Accept) {
      const children = node.getChildren();
      const parent = node.getParentOrThrow();
      children.forEach((child) => node.insertBefore(child));
      node.remove();
      if ($isElementNode(parent)) parent.selectEnd();
    } else if (action === DiffAction.Reject) {
      node.remove();
    }
  }
  if (node.diffType === 'listItemModify') {
    const children = node.getChildren();
    if (action === DiffAction.Accept) {
      const lastChild = children[1];
      if (!$isElementNode(lastChild)) {
        throw new Error('Expected element node as child of DiffNode');
      }
      const nodeChildrens = lastChild.getChildren();
      for (let i = nodeChildrens.length - 1; i >= 0; i--) {
        node.insertAfter(nodeChildrens[i]);
      }
      const parent = node.getParentOrThrow();
      node.remove();
      parent.selectEnd();
    } else if (action === DiffAction.Reject) {
      const firstChild = children[0];
      if (!$isElementNode(firstChild)) {
        throw new Error('Expected element node as child of DiffNode');
      }
      const nodeChildrens = firstChild.getChildren();
      for (let i = nodeChildrens.length - 1; i >= 0; i--) {
        node.insertAfter(nodeChildrens[i]);
      }
      const parent = node.getParentOrThrow();
      node.remove();
      parent.selectEnd();
    }
  }

  if (node.diffType === 'listItemRemove') {
    if (action === DiffAction.Accept) {
      node.getParentOrThrow().remove();
    } else if (action === DiffAction.Reject) {
      node.getChildren().forEach((child) => {
        node.getParentOrThrow().append(child);
      });
      node.getParentOrThrow().selectEnd();
      node.remove();
    }
  }

  if (node.diffType === 'listItemAdd') {
    if (action === DiffAction.Accept) {
      const children = node.getChildren();
      children.forEach((child) => {
        node.getParentOrThrow().append(child);
      });
      node.getParentOrThrow().selectEnd();
      node.remove();
    } else if (action === DiffAction.Reject) {
      node.remove();
    }
  }
}

export function registerLiteXMLDiffCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_DIFFNODE_COMMAND,
      (payload) => {
        const { action, nodeKey } = payload;
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (!(node instanceof DiffNode) && !$isTableRowDiffNode(node)) return;
          doAction(editor, node, action);
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_DIFFNODE_ALL_COMMAND,
      (payload) => {
        const { action } = payload;
        const nodeKeys = editor.getEditorState().read(() => {
          return Array.from(editor._editorState._nodeMap.values())
            .filter(
              (node) =>
                (node instanceof DiffNode || $isTableRowDiffNode(node)) && !!node.getParent(),
            )
            .map((node) => node.getKey());
        });
        if (!nodeKeys.length) {
          return false;
        }
        editor.update(() => {
          const handled = new Set<string>();
          nodeKeys.forEach((nodeKey) => {
            if (handled.has(nodeKey)) return;
            const node = $getNodeByKey(nodeKey);
            if (!(node instanceof DiffNode) && !$isTableRowDiffNode(node)) return;

            const pair = $isTableRowDiffNode(node) ? $getTableRowDiffPair(node) : null;
            if (pair) {
              handled.add(pair.remove.getKey());
              handled.add(pair.add.getKey());
            } else {
              const parent = node instanceof DiffNode ? node.getParent() : null;
              if ($isTableCellDiffNode(parent)) {
                $getTableCellDiffGroup(parent).forEach((cell) => {
                  const diff = cell.getFirstChild();
                  if (diff instanceof DiffNode) handled.add(diff.getKey());
                });
              }
              handled.add(nodeKey);
            }
            doAction(editor, node, action);
          });
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

// Command identities and the `DiffAction` enum live in the side-effect-free
// `./symbols` module so they stay single-instance across the package bundles.
export { DiffAction, LITEXML_DIFFNODE_ALL_COMMAND, LITEXML_DIFFNODE_COMMAND } from './symbols';
