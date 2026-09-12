import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $isElementNode, COMMAND_PRIORITY_EDITOR } from 'lexical';

import { genServiceId, moment } from '@/editor-kernel';
import { $getNodeProperties, $setNodeProperties } from '@/plugins/properties/state';
import { $getNodeId } from '@/plugins/properties/utils';

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
import type { RewriteCommandResultChannel, RewriteReviewEvent } from './rewriteRange';
import {
  DiffAction,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_DIFFNODE_COMMAND,
  LITEXML_REVIEW_COMMAND,
  type LiteXMLReviewCommandPayload,
} from './symbols';

interface DiffIdentityTransfer {
  afterIndex: number;
  beforeIndex: number;
  nodeId: string;
}

/**
 * Pending rewrite diffs keep the original durable ids on the before side and
 * private ids on the after side. Accept is the only point where the original
 * id/annotation anchors are transferred to after, so `$findNodeById` never
 * observes duplicate logical identities in a committed editor state.
 */
function transferRewriteIdentities(node: DiffNode, action: DiffAction): void {
  if (action !== DiffAction.Accept) return;
  const transfers = $getNodeProperties(node).rewriteIdentityMap;
  if (!Array.isArray(transfers)) return;

  const beforeContent = node.getChildAtIndex(0);
  const afterContent = node.getChildAtIndex(1);

  for (const transfer of transfers as unknown as DiffIdentityTransfer[]) {
    if (!transfer || typeof transfer.nodeId !== 'string') continue;
    const beforeNode =
      $isDiffContentNode(beforeContent) && $isDiffContentNode(afterContent)
        ? beforeContent.getChildAtIndex(transfer.beforeIndex)
        : node.getChildAtIndex(transfer.beforeIndex);
    const afterNode =
      $isDiffContentNode(beforeContent) && $isDiffContentNode(afterContent)
        ? afterContent.getChildAtIndex(transfer.afterIndex)
        : node.getChildAtIndex(transfer.afterIndex);
    if (!afterNode) continue;

    const beforeProperties = beforeNode ? $getNodeProperties(beforeNode) : {};
    if (beforeNode) {
      $setNodeProperties(beforeNode, (previous) => {
        const next = { ...previous };
        delete next.nodeId;
        delete next.annotationIds;
        return next;
      });
    }

    $setNodeProperties(afterNode, (previous) => ({
      ...previous,
      nodeId: transfer.nodeId,
      ...(beforeProperties.annotationIds ? { annotationIds: beforeProperties.annotationIds } : {}),
    }));
  }
}

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
    transferRewriteIdentities(node, action);
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

const getReviewEvent = (
  node: DiffNode | TableRowDiffNode,
  action: DiffAction,
): RewriteReviewEvent | null => {
  const properties = $getNodeProperties(node);
  const requestId = properties.rewriteRequestId;
  const commandId = properties.rewriteCommandId;
  if (typeof requestId !== 'string' || typeof commandId !== 'string') return null;

  const attempt = properties.rewriteAttempt;
  return {
    action: action === DiffAction.Accept ? 'applied' : 'rejected',
    ...(typeof attempt === 'number' && Number.isSafeInteger(attempt) ? { attempt } : {}),
    commandId,
    requestId,
  };
};

export interface PendingRewriteReview {
  affectedNodeIds: string[];
  attempt?: number;
  commandId: string;
  diffCount: number;
  requestId: string;
}

export interface RewriteReviewSettlementInput {
  attempt?: number;
  commandId: string;
  requestId: string;
  status: 'applied' | 'rejected';
}

export interface RewriteReviewSettlementResult {
  affectedNodeIds: string[];
  attempt?: number;
  commandId: string;
  requestId: string;
  stateVector?: string;
  status: 'applied' | 'noop' | 'rejected';
}

export interface IRewriteReviewService {
  listPendingReviews(): PendingRewriteReview[];
  settleReview(input: RewriteReviewSettlementInput): Promise<RewriteReviewSettlementResult>;
}

export const IRewriteReviewService = genServiceId<IRewriteReviewService>('RewriteReviewService');

const isReviewAttempt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/**
 * Match a pending diff without exposing the runtime Lexical key to callers.
 * The command id is mandatory because a request may have multiple attempts;
 * requestId alone would allow a stale panel to settle a newer diff.
 */
const matchesReview = (node: DiffNode | TableRowDiffNode, payload: LiteXMLReviewCommandPayload) => {
  const properties = $getNodeProperties(node);
  if (
    properties.rewriteRequestId !== payload.requestId ||
    properties.rewriteCommandId !== payload.commandId
  ) {
    return false;
  }

  if (payload.attempt === undefined) return properties.rewriteAttempt === undefined;
  return properties.rewriteAttempt === payload.attempt;
};

const collectReviewNodeKeys = (
  editor: LexicalEditor,
  payload: LiteXMLReviewCommandPayload,
): string[] =>
  editor.getEditorState().read(() =>
    Array.from(editor._editorState._nodeMap.values())
      .filter(
        (node): node is DiffNode | TableRowDiffNode =>
          (node instanceof DiffNode || $isTableRowDiffNode(node)) &&
          !!node.getParent() &&
          matchesReview(node, payload),
      )
      .map((node) => node.getKey()),
  );

const collectReviewAffectedNodeIds = (node: DiffNode | TableRowDiffNode): string[] => {
  const ids = new Set<string>();
  const properties = $getNodeProperties(node);

  if (typeof properties.logicalNodeId === 'string') ids.add(properties.logicalNodeId);
  if (Array.isArray(properties.rewriteIdentityMap)) {
    for (const transfer of properties.rewriteIdentityMap) {
      if (
        transfer &&
        typeof transfer === 'object' &&
        'nodeId' in transfer &&
        typeof transfer.nodeId === 'string'
      ) {
        ids.add(transfer.nodeId);
      }
    }
  }

  const visit = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object') return;
    const lexicalNode = candidate as Parameters<typeof $getNodeId>[0];
    const nodeId = $getNodeId(lexicalNode);
    if (nodeId) ids.add(nodeId);
    if ('getChildren' in lexicalNode && typeof lexicalNode.getChildren === 'function') {
      lexicalNode.getChildren().forEach(visit);
    }
  };

  // The first side is the durable/original side for modify/remove diffs. Do
  // not expose the private pending IDs assigned to generated after nodes.
  const before = node.getFirstChild();
  if (before) visit(before);
  if (ids.size === 0) visit(node);
  return [...ids];
};

const collectPendingReviewGroups = (editor: LexicalEditor): PendingRewriteReview[] =>
  editor.getEditorState().read(() => {
    const groups = new Map<string, PendingRewriteReview>();
    for (const node of editor._editorState._nodeMap.values()) {
      if (!(node instanceof DiffNode) && !$isTableRowDiffNode(node)) continue;
      if (!node.getParent()) continue;
      const properties = $getNodeProperties(node);
      if (
        typeof properties.rewriteRequestId !== 'string' ||
        typeof properties.rewriteCommandId !== 'string'
      ) {
        continue;
      }
      const attempt = isReviewAttempt(properties.rewriteAttempt)
        ? properties.rewriteAttempt
        : undefined;
      const groupKey = JSON.stringify([
        properties.rewriteRequestId,
        properties.rewriteCommandId,
        attempt ?? null,
      ]);
      const current = groups.get(groupKey);
      const affectedNodeIds = collectReviewAffectedNodeIds(node);
      if (current) {
        current.diffCount += 1;
        current.affectedNodeIds = [...new Set([...current.affectedNodeIds, ...affectedNodeIds])];
      } else {
        groups.set(groupKey, {
          affectedNodeIds,
          ...(attempt === undefined ? {} : { attempt }),
          commandId: properties.rewriteCommandId,
          diffCount: 1,
          requestId: properties.rewriteRequestId,
        });
      }
    }
    return [...groups.values()];
  });

/**
 * Settle all live diff wrappers belonging to one durable rewrite. A single
 * rewrite normally has one wrapper, while legacy modify/insert operations can
 * produce several. Snapshotting keys before the transaction makes the action
 * independent of the current selection and lets every connected client apply
 * the same Yjs transaction. Missing keys are an idempotent no-op after a
 * remote client already settled the review.
 */
const applyReviewByIdentity = (
  editor: LexicalEditor,
  payload: LiteXMLReviewCommandPayload,
  reviewChannel?: RewriteCommandResultChannel,
): { affectedNodeIds: string[]; matched: boolean } => {
  if (
    typeof payload.requestId !== 'string' ||
    payload.requestId.length === 0 ||
    typeof payload.commandId !== 'string' ||
    payload.commandId.length === 0 ||
    (payload.attempt !== undefined && !isReviewAttempt(payload.attempt)) ||
    (payload.action !== DiffAction.Accept && payload.action !== DiffAction.Reject)
  ) {
    return { affectedNodeIds: [], matched: false };
  }

  const nodeKeys = collectReviewNodeKeys(editor, payload);
  // A client may receive the server review event after another client has
  // already settled the diff. Treat that as a successful idempotent no-op.
  if (nodeKeys.length === 0) return { affectedNodeIds: [], matched: false };

  const affectedNodeIds = new Set<string>();
  editor.update(() => {
    const handled = new Set<string>();
    let emitted = false;
    for (const nodeKey of nodeKeys) {
      if (handled.has(nodeKey)) continue;
      const node = $getNodeByKey(nodeKey);
      if (!(node instanceof DiffNode) && !$isTableRowDiffNode(node)) continue;
      if (!node.getParent() || !matchesReview(node, payload)) continue;

      collectReviewAffectedNodeIds(node).forEach((nodeId) => affectedNodeIds.add(nodeId));

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

      const reviewEvent = emitted ? null : getReviewEvent(node, payload.action);
      doAction(editor, node, payload.action);
      if (reviewEvent) {
        reviewChannel?.publishReview?.(reviewEvent);
        emitted = true;
      }
    }
  });

  return {
    affectedNodeIds: [...affectedNodeIds],
    matched: affectedNodeIds.size > 0 || nodeKeys.length > 0,
  };
};

/**
 * Public service used by Page review panels. It is deliberately identity
 * based: callers never need a Lexical key or a DOM selection to settle a
 * review, and repeated calls after a remote client settled the same diff are
 * safe no-ops.
 */
export class RewriteReviewService implements IRewriteReviewService {
  constructor(
    private readonly editor: LexicalEditor,
    private readonly reviewChannel?: RewriteCommandResultChannel,
    private readonly readStateVector?: () => string | undefined,
  ) {}

  listPendingReviews(): PendingRewriteReview[] {
    return collectPendingReviewGroups(this.editor);
  }

  async settleReview(input: RewriteReviewSettlementInput): Promise<RewriteReviewSettlementResult> {
    if (
      typeof input?.requestId !== 'string' ||
      input.requestId.length === 0 ||
      typeof input.commandId !== 'string' ||
      input.commandId.length === 0 ||
      (input.attempt !== undefined && !isReviewAttempt(input.attempt)) ||
      (input.status !== 'applied' && input.status !== 'rejected')
    ) {
      throw new Error('Invalid rewrite review settlement.');
    }

    const outcome = applyReviewByIdentity(
      this.editor,
      {
        action: input.status === 'applied' ? DiffAction.Accept : DiffAction.Reject,
        ...(input.attempt === undefined ? {} : { attempt: input.attempt }),
        commandId: input.commandId,
        requestId: input.requestId,
      },
      this.reviewChannel,
    );
    // Lexical commits the update before its listeners flush. Waiting for the
    // next microtask lets the Yjs binding publish the same transaction before
    // the returned state vector is sampled.
    await moment();
    return {
      affectedNodeIds: outcome.affectedNodeIds,
      ...(input.attempt === undefined ? {} : { attempt: input.attempt }),
      commandId: input.commandId,
      requestId: input.requestId,
      ...(this.readStateVector ? { stateVector: this.readStateVector() } : {}),
      status: outcome.matched ? input.status : 'noop',
    };
  }
}

export function registerLiteXMLDiffCommand(
  editor: LexicalEditor,
  reviewChannel?: RewriteCommandResultChannel,
) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_DIFFNODE_COMMAND,
      (payload) => {
        const { action, nodeKey } = payload;
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (!(node instanceof DiffNode) && !$isTableRowDiffNode(node)) return;
          const reviewEvent = getReviewEvent(node, action);
          doAction(editor, node, action);
          if (reviewEvent) reviewChannel?.publishReview?.(reviewEvent);
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

            const reviewEvent = getReviewEvent(node, action);

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
            if (reviewEvent) reviewChannel?.publishReview?.(reviewEvent);
          });
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_REVIEW_COMMAND,
      (payload) => {
        applyReviewByIdentity(editor, payload, reviewChannel);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

// Command identities and the `DiffAction` enum live in the side-effect-free
// `./symbols` module so they stay single-instance across the package bundles.
export {
  DiffAction,
  LITEXML_DIFFNODE_ALL_COMMAND,
  LITEXML_DIFFNODE_COMMAND,
  LITEXML_REVIEW_COMMAND,
} from './symbols';
