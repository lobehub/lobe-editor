import { $isElementNode, type LexicalNode } from 'lexical';

import type {
  NodeIdentityPolicy,
  NodeIdentityProjection,
} from '@/plugins/common/node/node-identity-policy';

const afterRepresentation = Object.freeze({ childIndex: 1 });

/** Shared active-view rule for live Lexical nodes and serialized preflight trees. */
export function getLiteXmlIdentityProjection(node: {
  diffType?: string;
  firstChildDiffType?: string;
  firstChildType?: string;
  type?: string;
}): NodeIdentityProjection {
  if (node.type === 'root' || node.type === 'diff-content') return 'container';
  if (node.type === 'diff') {
    if (node.diffType === 'remove' || node.diffType === 'listItemRemove') return 'hidden';
    if (node.diffType === 'modify' || node.diffType === 'listItemModify') {
      return afterRepresentation;
    }
    return 'container';
  }
  if (
    (node.type === 'table-cell-diff' || node.type === 'table-row-diff') &&
    node.diffType === 'remove'
  ) {
    return 'hidden';
  }
  if (
    node.type === 'listitem' &&
    node.firstChildType === 'diff' &&
    node.firstChildDiffType === 'listItemRemove'
  ) {
    return 'hidden';
  }
  return 'content';
}

/** Review containers and the document root are physical structure, not addressable content. */
export function isLiteXmlIdentityNode(type?: string): boolean {
  return type !== 'root' && type !== 'diff' && type !== 'diff-content';
}

function getDiffType(node: LexicalNode | null): string | undefined {
  if (!node) return undefined;
  if ('diffType' in node && typeof node.diffType === 'string') return node.diffType;
  if ('getDiffType' in node && typeof node.getDiffType === 'function') {
    return node.getDiffType() as string;
  }
  return undefined;
}

function getLiveProjection(node: LexicalNode): ReturnType<typeof getLiteXmlIdentityProjection> {
  const type = node.getType();
  if (type === 'root' || type === 'diff-content') return 'container';
  if (
    type !== 'diff' &&
    type !== 'table-cell-diff' &&
    type !== 'table-row-diff' &&
    type !== 'listitem'
  ) {
    return 'content';
  }
  const firstChild = $isElementNode(node) ? node.getFirstChild() : null;
  return getLiteXmlIdentityProjection({
    diffType: getDiffType(node),
    firstChildDiffType: getDiffType(firstChild),
    firstChildType: firstChild?.getType(),
    type,
  });
}

interface ReviewSide {
  group: string;
  side: string;
}

function getTableReviewSide(node: LexicalNode): ReviewSide | null {
  const type = node.getType();
  if (type !== 'table-cell-diff' && type !== 'table-row-diff') return null;
  if (!('getChangeId' in node) || typeof node.getChangeId !== 'function') return null;
  const changeId = node.getChangeId();
  const side = getDiffType(node);
  return changeId && side ? { group: `${type}:${changeId}`, side } : null;
}

function getReviewSide(node: LexicalNode): ReviewSide | null {
  const selfSide = getTableReviewSide(node);
  if (selfSide) return selfSide;

  let branch = node;
  for (let parent = node.getParent(); parent; branch = parent, parent = parent.getParent()) {
    const parentDiffType = getDiffType(parent);
    if (parent.getType() === 'diff') {
      if (parentDiffType === 'modify') {
        if (branch.getType() === 'diff-content' && 'side' in branch) {
          return { group: `diff:${parent.getKey()}`, side: String(branch.side) };
        }
        const branchIndex = parent.getChildren().indexOf(branch);
        if (branchIndex >= 0 && branchIndex < 2) {
          return {
            group: `diff:${parent.getKey()}`,
            side: branchIndex === 0 ? 'before' : 'after',
          };
        }
      }
      if (parentDiffType === 'listItemModify') {
        const branchIndex = parent.getChildren().indexOf(branch);
        if (branchIndex >= 0 && branchIndex < 2) {
          return {
            group: `diff:${parent.getKey()}`,
            side: branchIndex === 0 ? 'before' : 'after',
          };
        }
      }
    }

    const tableSide = getTableReviewSide(parent);
    if (tableSide) return tableSide;
  }
  return null;
}

export const liteXmlIdentityPolicy: NodeIdentityPolicy = {
  canShareId(left, right) {
    const leftSide = getReviewSide(left);
    const rightSide = getReviewSide(right);
    return Boolean(
      leftSide &&
      rightSide &&
      leftSide.group === rightSide.group &&
      leftSide.side !== rightSide.side,
    );
  },
  isIdentityNode(node) {
    return isLiteXmlIdentityNode(node.getType());
  },
  project: getLiveProjection,
};
