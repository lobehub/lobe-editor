import {
  type Binding,
  getAnchorAndFocusCollabNodesForUserState,
  type UserState,
} from '@lexical/yjs';
import type { LexicalNode } from 'lexical';
import { $getNodeByKey, $isElementNode, $isTextNode } from 'lexical';
import { createRelativePositionFromTypeIndex, type RelativePosition } from 'yjs';

import {
  getBlockOffset,
  type LinearTextPoint,
  type LinearTextPointResult,
} from '@/utils/linear-text';

interface CollabNodePosition {
  _parent?: { _xmlText?: unknown };
  getOffset?: () => number;
  getSharedType?: () => unknown;
}

export interface RelativeSelectionPoints {
  anchorKey: string;
  anchorOffset: number;
  focusKey: string;
  focusOffset: number;
}

/**
 * The Lexical Yjs resolver accepts a complete UserState even when the caller
 * only has durable positions. Keep this adapter detail out of the Agent
 * facade; no awareness identity is published by this helper.
 */
const createAgentUserState = (position: RelativePosition): UserState => ({
  anchorPos: position,
  awarenessData: {},
  color: '#7c3aed',
  focusPos: position,
  focusing: true,
  name: 'AI Agent',
});

/** Resolve durable relative positions to ephemeral Lexical keys for one read. */
export const resolveRelativeSelectionPoints = (
  binding: Binding,
  anchorPos: RelativePosition,
  focusPos: RelativePosition,
): RelativeSelectionPoints | null => {
  try {
    const points = getAnchorAndFocusCollabNodesForUserState(binding, {
      ...createAgentUserState(anchorPos),
      focusPos,
    });
    const anchorNode = points.anchorCollabNode?.getNode();
    const focusNode = points.focusCollabNode?.getNode();
    if (!anchorNode || !focusNode) return null;

    return {
      anchorKey: anchorNode.getKey(),
      anchorOffset: points.anchorOffset,
      focusKey: focusNode.getKey(),
      focusOffset: points.focusOffset,
    };
  } catch {
    return null;
  }
};

/** Convert a transient Lexical point into the v1 Yjs relative position. */
export const createRelativePositionForLexicalPoint = (
  point: LinearTextPointResult,
  binding: Binding,
): RelativePosition | null => {
  const collabNode = binding.collabNodeMap.get(point.key) as CollabNodePosition | undefined;
  if (!collabNode) return null;

  try {
    let sharedType: unknown;
    let offset = point.offset;
    if (point.type === 'text') {
      sharedType = collabNode._parent?._xmlText;
      const currentOffset = collabNode.getOffset?.();
      if (!sharedType || currentOffset === undefined || currentOffset < 0) return null;
      offset = currentOffset + 1 + point.offset;
    } else {
      sharedType = collabNode.getSharedType?.();
      const node = $getNodeByKey(point.key);
      if (!sharedType || !$isElementNode(node)) return null;

      let accumulatedOffset = 0;
      let index = 0;
      let child = node.getFirstChild();
      while (child !== null && index++ < point.offset) {
        accumulatedOffset += $isTextNode(child) ? child.getTextContentSize() + 1 : 1;
        child = child.getNextSibling();
      }
      offset = accumulatedOffset;
    }

    return createRelativePositionFromTypeIndex(sharedType as never, offset);
  } catch {
    return null;
  }
};

/** Resolve a zero-length stream anchor to its current block offset. */
export const resolveRelativeAnchorOffset = (
  binding: Binding,
  position: RelativePosition,
  block: LexicalNode,
): number | null => {
  try {
    const points = getAnchorAndFocusCollabNodesForUserState(
      binding,
      createAgentUserState(position),
    );
    const node = points.anchorCollabNode?.getNode();
    if (!node) return null;
    const point: LinearTextPoint = {
      getNode: () => node,
      offset: points.anchorOffset,
      type: $isElementNode(node) ? 'element' : 'text',
    };
    return getBlockOffset(point, block);
  } catch {
    return null;
  }
};
