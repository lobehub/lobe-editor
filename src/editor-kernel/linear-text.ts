import type { LexicalNode } from 'lexical';
import { $isDecoratorNode, $isElementNode, $isLineBreakNode, $isTextNode } from 'lexical';

/** A Lexical node's half-open range in the selected-text coordinate space. */
export interface LinearTextSegment {
  end: number;
  node: LexicalNode;
  start: number;
}

/**
 * Flatten a Lexical subtree into the same character coordinate space used by
 * a RangeSelection. Line breaks and inline decorators are atomic segments;
 * block decorators are intentionally not addressable text.
 */
export const getLinearTextSegments = (node: LexicalNode): LinearTextSegment[] => {
  const segments: LinearTextSegment[] = [];
  let cursor = 0;

  const visit = (candidate: LexicalNode): void => {
    if ($isLineBreakNode(candidate)) {
      // Lexical normally serializes a line break as one character. Keep the
      // minimum of one here so a custom node with an empty text projection
      // still occupies its caret position.
      const length = Math.max(1, candidate.getTextContent().length);
      segments.push({ end: cursor + length, node: candidate, start: cursor });
      cursor += length;
      return;
    }

    if ($isTextNode(candidate)) {
      const length = candidate.getTextContentSize();
      segments.push({ end: cursor + length, node: candidate, start: cursor });
      cursor += length;
      return;
    }

    if ($isDecoratorNode(candidate)) {
      // Inline decorators occupy the same character space as their selected
      // text projection, but callers still reject insertion through the atom.
      if (candidate.isInline()) {
        const length = candidate.getTextContent().length;
        if (length > 0) {
          segments.push({ end: cursor + length, node: candidate, start: cursor });
          cursor += length;
        }
      }
      return;
    }

    if ($isElementNode(candidate)) candidate.getChildren().forEach(visit);
  };

  visit(node);
  return segments;
};

export const getLinearTextLength = (node: LexicalNode): number =>
  getLinearTextSegments(node).at(-1)?.end ?? 0;

export interface LinearTextPoint {
  getNode: () => LexicalNode;
  offset: number;
  type: 'element' | 'text';
}

/** Return a Lexical point's character offset relative to a containing block. */
export const getBlockOffset = (point: LinearTextPoint, block: LexicalNode): number | null => {
  if (!$isElementNode(block) || !Number.isSafeInteger(point.offset) || point.offset < 0) {
    return null;
  }

  let pointNode: LexicalNode;
  try {
    pointNode = point.getNode();
  } catch {
    return null;
  }
  if (!pointNode.isAttached() || (!pointNode.is(block) && !block.isParentOf(pointNode))) {
    return null;
  }

  if (point.type === 'text') {
    if (!$isTextNode(pointNode) || point.offset > pointNode.getTextContentSize()) return null;
    const segment = getLinearTextSegments(block).find((candidate) => candidate.node === pointNode);
    return segment ? segment.start + point.offset : null;
  }

  if (point.type !== 'element' || !$isElementNode(pointNode)) return null;
  if (point.offset > pointNode.getChildrenSize()) return null;

  let offset = pointNode
    .getChildren()
    .slice(0, point.offset)
    .reduce((total, child) => total + getLinearTextLength(child), 0);
  let current = pointNode;
  while (!current.is(block)) {
    const parent = current.getParent();
    if (!parent || !$isElementNode(parent)) return null;
    const index = current.getIndexWithinParent();
    offset += parent
      .getChildren()
      .slice(0, index)
      .reduce((total, child) => total + getLinearTextLength(child), 0);
    current = parent;
  }
  return offset;
};

export interface LinearTextPointResult {
  key: string;
  offset: number;
  type: 'element' | 'text';
}

/** Resolve a block offset to a stable Lexical point near atomic boundaries. */
export const getBlockPoint = (
  block: LexicalNode,
  offset: number,
  direction: 'end' | 'start',
): LinearTextPointResult | null => {
  if (!$isElementNode(block)) return null;
  if (!Number.isSafeInteger(offset) || offset < 0) return null;

  const segments = getLinearTextSegments(block);
  const textLength = segments.at(-1)?.end ?? 0;
  if (offset > textLength) return null;

  const textSegments = segments.filter((segment) => $isTextNode(segment.node));
  if (textSegments.length === 0) {
    return { key: block.getKey(), offset: 0, type: 'element' };
  }

  const containing = textSegments.find((segment) => offset > segment.start && offset < segment.end);
  if (containing) {
    const textNode = containing.node;
    return { key: textNode.getKey(), offset: offset - containing.start, type: 'text' };
  }

  // Prefer the text node beginning at an atom's end. At offset 2 in
  // `a<br>bc`, for example, the correct point is the start of `bc`, not the
  // end of `a` (which is the point before the break at offset 1).
  const atStart = textSegments.find((segment) => segment.start === offset);
  if (atStart) {
    const textNode = atStart.node;
    return { key: textNode.getKey(), offset: 0, type: 'text' };
  }
  const atEnd = [...textSegments].reverse().find((segment) => segment.end === offset);
  if (atEnd) {
    const textNode = atEnd.node;
    return { key: textNode.getKey(), offset: textNode.getTextContentSize(), type: 'text' };
  }

  // A point at a line-break/decorator boundary has no Lexical text node of
  // its own. Pick the nearest text side, preserving the requested direction.
  const previous = [...textSegments].reverse().find((segment) => segment.end <= offset);
  const next = textSegments.find((segment) => segment.start >= offset);
  const boundary = direction === 'end' ? (next ?? previous) : (previous ?? next);
  if (boundary) {
    const textNode = boundary.node;
    const boundaryOffset = boundary === previous ? textNode.getTextContentSize() : 0;
    return { key: textNode.getKey(), offset: boundaryOffset, type: 'text' };
  }

  return null;
};
