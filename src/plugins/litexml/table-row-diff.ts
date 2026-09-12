import {
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  type TableRowNode,
} from '@lexical/table';
import type { ElementNode, LexicalEditor } from 'lexical';
import { $nodesOfType } from 'lexical';

import { $prepareCopiedNode, $preserveNodeIdentity } from '@/plugins/properties/utils';

import {
  $createTableRowDiffNode,
  TableRowDiffNode,
  type TableRowDiffType,
} from './node/TableRowDiffNode';
import {
  captureTableDiffLogicalIdentity,
  copyTableDiffReviewMetadata,
  restoreTableDiffLogicalIdentity,
} from './table-diff-identity';
import { $cloneNode } from './utils';

export interface TableRowDiffPair {
  add: TableRowDiffNode;
  remove: TableRowDiffNode;
}

export function $areTableRowStructuresCompatible(
  previousRow: ElementNode,
  nextRow: ElementNode,
): boolean {
  const previousCells = previousRow.getChildren();
  const nextCells = nextRow.getChildren();

  if (
    previousCells.length !== nextCells.length ||
    !previousCells.every($isTableCellNode) ||
    !nextCells.every($isTableCellNode)
  ) {
    return false;
  }

  return previousCells.every((previousCell, index) => {
    const nextCell = nextCells[index];
    return (
      $isTableCellNode(nextCell) &&
      previousCell.getColSpan() === nextCell.getColSpan() &&
      previousCell.getRowSpan() === nextCell.getRowSpan()
    );
  });
}

export function $createTableRowDiffFromRow(
  editor: LexicalEditor,
  row: TableRowNode,
  diffType: TableRowDiffType,
  changeId?: string,
): TableRowDiffNode {
  const source = $cloneNode(row, editor) as TableRowNode;
  // The add side is a review-only copy. Its cells must not temporarily share
  // the before row's durable identities; those identities are restored from
  // the paired remove row only when the proposed row is accepted.
  if (diffType === 'add') {
    source.getChildren().forEach($prepareCopiedNode);
  }
  const diffRow = $createTableRowDiffNode(diffType, changeId, row.getHeight());
  captureTableDiffLogicalIdentity(row, diffRow);
  diffRow.append(...source.getChildren());
  return diffRow;
}

export function $createPlainTableRowFromDiff(
  editor: LexicalEditor,
  row: TableRowDiffNode,
): TableRowNode {
  const plainRow = $createTableRowNode(row.getHeight());
  restoreTableDiffLogicalIdentity(row, plainRow);
  if (row.getDiffType() === 'add') copyTableDiffReviewMetadata(row, plainRow);
  const pair = $getTableRowDiffPair(row);
  const sourceCells = pair?.add === row ? pair.remove.getChildren() : [];
  plainRow.append(
    ...row.getChildren().map((child, index) => {
      const clone = $cloneNode(child, editor);
      const sourceCell = sourceCells[index];
      if ($isTableCellNode(sourceCell) && $isTableCellNode(clone)) {
        $preserveNodeIdentity(sourceCell, clone);
      }
      return clone;
    }),
  );
  return plainRow;
}

export function $getTableRowDiffPair(node: TableRowDiffNode): TableRowDiffPair | null {
  const changeId = node.getChangeId();
  if (!changeId) return null;

  const matchingRows = $nodesOfType(TableRowDiffNode).filter(
    (candidate) => candidate.getChangeId() === changeId,
  );
  if (matchingRows.length !== 2) return null;

  const remove = matchingRows.find((candidate) => candidate.getDiffType() === 'remove');
  const add = matchingRows.find((candidate) => candidate.getDiffType() === 'add');
  if (!remove || !add) return null;

  const parent = remove.getParent();
  if (
    !$isTableNode(parent) ||
    add.getParent() !== parent ||
    remove.getNextSibling() !== add ||
    !$areTableRowStructuresCompatible(remove, add)
  ) {
    return null;
  }

  return { add, remove };
}

export function $normalizeTableRowDiffPairs(): boolean {
  const rows = $nodesOfType(TableRowDiffNode);
  const groups = new Map<string, TableRowDiffNode[]>();

  rows.forEach((row) => {
    const changeId = row.getChangeId();
    if (!changeId) return;
    const group = groups.get(changeId) || [];
    group.push(row);
    groups.set(changeId, group);
  });

  let changed = false;
  groups.forEach((group) => {
    const pair = group.length === 2 ? $getTableRowDiffPair(group[0]) : null;
    if (pair) return;

    group.forEach((row) => row.setChangeId());
    changed = true;
  });

  return changed;
}

export function registerTableRowDiffNormalization(editor: LexicalEditor): () => void {
  let destroyed = false;
  let scheduled = false;

  const unregister = editor.registerUpdateListener(() => {
    if (scheduled || destroyed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (destroyed) return;

      const shouldNormalize = editor.getEditorState().read(() => {
        const rows = $nodesOfType(TableRowDiffNode);
        return rows.some((row) => row.getChangeId() && !$getTableRowDiffPair(row));
      });
      if (!shouldNormalize) return;

      editor.update(() => {
        $normalizeTableRowDiffPairs();
      });
    });
  });

  return () => {
    destroyed = true;
    unregister();
  };
}
