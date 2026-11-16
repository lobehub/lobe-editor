import {
  type BaseBinding,
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
} from '@/editor-kernel/linear-text';
import { $getAtomicHolePointContext } from '@/plugins/common/node/atomic-hole-selection';

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
const resolveRawRelativeSelectionPoints = (
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

const normalizeResolvedPoint = (
  binding: Binding,
  point: { key: string; offset: number },
): { key: string; offset: number } => {
  const node = $getNodeByKey(point.key);
  if (!node) return point;
  const context = $getAtomicHolePointContext({
    ...point,
    type: $isElementNode(node) ? 'element' : 'text',
  });
  if (!context) return point;

  const cursor =
    context.side === 'before' ? context.hole.getBeforeCursor() : context.hole.getAfterCursor();
  if (!cursor) return point;
  const normalized = createRelativePositionForLexicalPoint(
    {
      key: cursor.getKey(),
      offset: context.side === 'before' ? cursor.getTextContentSize() : 0,
      type: 'text',
    },
    binding,
  );
  return normalized ? { key: cursor.getKey(), offset: context.side === 'before' ? 1 : 0 } : point;
};

const normalizeResolvedPoints = (
  binding: Binding,
  points: RelativeSelectionPoints,
): RelativeSelectionPoints => {
  const anchor = { key: points.anchorKey, offset: points.anchorOffset };
  const focus = { key: points.focusKey, offset: points.focusOffset };
  const anchorNode = $getNodeByKey(anchor.key);
  const focusNode = $getNodeByKey(focus.key);
  const anchorContext = anchorNode
    ? $getAtomicHolePointContext({
        ...anchor,
        type: $isElementNode(anchorNode) ? 'element' : 'text',
      })
    : null;
  const focusContext = focusNode
    ? $getAtomicHolePointContext({
        ...focus,
        type: $isElementNode(focusNode) ? 'element' : 'text',
      })
    : null;
  if (anchorContext && focusContext && anchorContext.hole.is(focusContext.hole)) {
    const side = anchorContext.side === focusContext.side ? anchorContext.side : 'before';
    const cursor =
      side === 'before'
        ? anchorContext.hole.getBeforeCursor()
        : anchorContext.hole.getAfterCursor();
    if (cursor) {
      const offset = side === 'before' ? cursor.getTextContentSize() : 0;
      return {
        anchorKey: cursor.getKey(),
        anchorOffset: offset,
        focusKey: cursor.getKey(),
        focusOffset: offset,
      };
    }
  }
  const normalizedAnchor = normalizeResolvedPoint(binding, anchor);
  const normalizedFocus = normalizeResolvedPoint(binding, focus);
  return {
    anchorKey: normalizedAnchor.key,
    anchorOffset: normalizedAnchor.offset,
    focusKey: normalizedFocus.key,
    focusOffset: normalizedFocus.offset,
  };
};

/**
 * Resolve durable positions while projecting atomic Hole payload positions to
 * one of the two legal boundary cursors. This keeps remote awareness from
 * rendering a caret inside an Artifact/card implementation.
 */
export const resolveRelativeSelectionPoints = (
  binding: Binding,
  anchorPos: RelativePosition,
  focusPos: RelativePosition,
): RelativeSelectionPoints | null => {
  let normalized: RelativeSelectionPoints | null = null;
  binding.editor.getEditorState().read(() => {
    const points = resolveRawRelativeSelectionPoints(binding, anchorPos, focusPos);
    if (points) normalized = normalizeResolvedPoints(binding, points);
  });
  return normalized;
};

export const normalizeRelativeSelectionForAtomicHoles = (
  binding: BaseBinding,
  anchorPos: RelativePosition,
  focusPos: RelativePosition,
): { anchorPos: RelativePosition; focusPos: RelativePosition } => {
  try {
    if (!('collabNodeMap' in binding) || !('root' in binding)) {
      return { anchorPos, focusPos };
    }
    const richBinding = binding as Binding;
    let points: RelativeSelectionPoints | null = null;
    richBinding.editor.getEditorState().read(() => {
      points = resolveRawRelativeSelectionPoints(richBinding, anchorPos, focusPos);
    });
    const resolvedPoints = points;
    if (!resolvedPoints) return { anchorPos, focusPos };

    let normalized: { anchorPos: RelativePosition; focusPos: RelativePosition } = {
      anchorPos,
      focusPos,
    };
    const lexicalEditor = binding.editor;
    lexicalEditor.getEditorState().read(() => {
      const normalizedPoints = normalizeResolvedPoints(richBinding, resolvedPoints);
      const anchor = {
        key: normalizedPoints.anchorKey,
        offset: normalizedPoints.anchorOffset,
      };
      const focus = {
        key: normalizedPoints.focusKey,
        offset: normalizedPoints.focusOffset,
      };
      const anchorNode = $getNodeByKey(anchor.key);
      const focusNode = $getNodeByKey(focus.key);
      if (!anchorNode || !focusNode) return;
      const nextAnchor = createRelativePositionForLexicalPoint(
        {
          key: anchor.key,
          offset: anchor.offset,
          type: $isElementNode(anchorNode) ? 'element' : 'text',
        },
        richBinding,
      );
      const nextFocus = createRelativePositionForLexicalPoint(
        {
          key: focus.key,
          offset: focus.offset,
          type: $isElementNode(focusNode) ? 'element' : 'text',
        },
        richBinding,
      );
      if (nextAnchor && nextFocus) normalized = { anchorPos: nextAnchor, focusPos: nextFocus };
    });
    return normalized;
  } catch {
    return { anchorPos, focusPos };
  }
};

/** Convert a transient Lexical point into the v1 Yjs relative position. */
export const createRelativePositionForLexicalPoint = (
  point: LinearTextPointResult,
  binding: Binding,
): RelativePosition | null => {
  const collabNode = (
    point.key === 'root' ? binding.root : binding.collabNodeMap.get(point.key)
  ) as CollabNodePosition | undefined;
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
