import type { LexicalNode, RangeSelection } from 'lexical';
import { $getNodeByKey, $isElementNode, $isRangeSelection } from 'lexical';

import { $isCursorNode } from './cursor';
import { $isHoleNode, type HoleNode } from './hole';

export type AtomicHoleBoundarySide = 'after' | 'before';

export interface AtomicHolePointContext {
  hole: HoleNode;
  side: AtomicHoleBoundarySide;
}

interface LexicalPointLike {
  key: string;
  offset: number;
  type: string;
}

/** Return the direct Hole child which contains a descendant node. */
const getDirectHoleContentChild = (hole: HoleNode, node: LexicalNode): LexicalNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (!parent) return null;
    if ($isHoleNode(parent)) {
      return parent === hole && !$isCursorNode(current) ? current : null;
    }
    current = parent;
  }
  return null;
};

/** Find the atomic Hole when a point is inside its payload. */
export const $getAtomicHoleForNode = (node: LexicalNode): HoleNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (!parent) return null;
    if ($isHoleNode(parent)) {
      return getDirectHoleContentChild(parent, node) ? parent : null;
    }
    current = parent;
  }
  return null;
};

/** Whether a point belongs to a composite Element payload owned by itself. */
export const $isAtomicHoleElementPayloadNode = (node: LexicalNode): boolean => {
  const hole = $getAtomicHoleForNode(node);
  if (!hole) return false;
  return $isElementNode(getDirectHoleContentChild(hole, node));
};

const sideForHoleElementPoint = (hole: HoleNode, offset: number): AtomicHoleBoundarySide | null => {
  const children = hole.getChildren();
  const lastBoundaryOffset = Math.max(0, children.length - 1);
  if (offset <= 1) return 'before';
  if (offset >= lastBoundaryOffset) return 'after';
  return offset <= children.length / 2 ? 'before' : 'after';
};

/**
 * Resolve a block/container point which sits immediately beside a Hole.
 * Lexical can produce these points when the browser caret lands in the root
 * element's whitespace between two decorator blocks. They are not legal Hole
 * editing points, so normalize them to the real boundary cursor on that side.
 */
const sideForAdjacentHoleElementPoint = (
  element: LexicalNode,
  offset: number,
): { hole: HoleNode; side: AtomicHoleBoundarySide } | null => {
  if (!$isElementNode(element)) return null;

  const previous = element.getChildAtIndex(offset - 1);
  if ($isHoleNode(previous)) return { hole: previous, side: 'after' };

  const next = element.getChildAtIndex(offset);
  if ($isHoleNode(next)) return { hole: next, side: 'before' };

  return null;
};

const sideForContentPoint = (
  hole: HoleNode,
  node: LexicalNode,
  offset: number,
  type: string,
): AtomicHoleBoundarySide => {
  const content = getDirectHoleContentChild(hole, node);
  const children = hole.getContentChildren();
  const childIndex = content ? children.findIndex((candidate) => candidate.is(content)) : -1;
  const defaultSide: AtomicHoleBoundarySide =
    childIndex >= 0 && childIndex >= children.length / 2 ? 'after' : 'before';

  const size =
    type === 'text' ? node.getTextContentSize() : $isElementNode(node) ? node.getChildrenSize() : 0;
  if (size <= 0 || !Number.isFinite(size)) return defaultSide;
  if (offset <= 0) return 'before';
  if (offset >= size) return 'after';
  return offset <= size / 2 ? 'before' : 'after';
};

/**
 * Resolve a Lexical point and report the nearest legal Hole boundary. Points
 * on the two real cursor children are already legal and return null.
 */
export const $getAtomicHolePointContext = (
  point: LexicalPointLike,
): AtomicHolePointContext | null => {
  const node = $getNodeByKey(point.key);
  if (!node) return null;
  if ($isHoleNode(node)) {
    const side = point.type === 'element' ? sideForHoleElementPoint(node, point.offset) : null;
    return side ? { hole: node, side } : null;
  }

  if (point.type === 'element') {
    const adjacentHole = sideForAdjacentHoleElementPoint(node, point.offset);
    if (adjacentHole) return adjacentHole;
  }

  const hole = $getAtomicHoleForNode(node);
  if (!hole) return null;
  const content = getDirectHoleContentChild(hole, node);
  // A composite Element payload owns its descendants' selection and input.
  // Only direct non-Element payloads (for example Artifact/Image decorators)
  // remain atomic at the Hole boundary.
  if ($isElementNode(content)) return null;
  return {
    hole,
    side: sideForContentPoint(hole, node, point.offset, point.type),
  };
};

export const $setAtomicHoleBoundaryPoint = (
  selection: RangeSelection,
  side: AtomicHoleBoundarySide,
  hole: HoleNode,
  point: 'anchor' | 'focus',
): void => {
  hole.normalizeBoundaryCursors();
  const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
  if (!cursor) return;
  selection[point].set(
    cursor.getKey(),
    side === 'before' ? cursor.getTextContentSize() : 0,
    'text',
    true,
  );
};

/**
 * Replace every RangeSelection endpoint that enters an atomic Hole payload
 * with a legal boundary cursor. NodeSelection is intentionally untouched: a
 * block menu may still select the whole Hole as one structural unit.
 */
export const $normalizeAtomicHoleRangeSelection = (selection: unknown): boolean => {
  if (!$isRangeSelection(selection)) return false;

  const anchorContext = $getAtomicHolePointContext(selection.anchor);
  const focusContext = $getAtomicHolePointContext(selection.focus);
  if (!anchorContext && !focusContext) return false;

  // Normalize each endpoint independently. In particular, a native drag or
  // Shift+Arrow range may start on one side of a Hole and finish on the
  // other; collapsing both endpoints would discard the user's anchor.
  if (anchorContext)
    $setAtomicHoleBoundaryPoint(selection, anchorContext.side, anchorContext.hole, 'anchor');
  if (focusContext)
    $setAtomicHoleBoundaryPoint(selection, focusContext.side, focusContext.hole, 'focus');
  return true;
};

/** Whether a DOM/selection target is an explicit internal card editor. */
export const isAtomicHoleInternalEditorTarget = (
  target: EventTarget | null,
  outerRoot?: HTMLElement | null,
): boolean => {
  const element =
    typeof Element !== 'undefined' && target instanceof Element
      ? target
      : typeof Node !== 'undefined' && target instanceof Node
        ? target.parentElement
        : null;
  if (!element) return false;
  const editableAncestor = element.closest<HTMLElement>('[contenteditable="true"]');
  if (editableAncestor && editableAncestor === outerRoot) {
    return Boolean(
      element.closest(
        'textarea, input, iframe[data-hole-interactive="true"], [data-hole-editable="true"], .cm-editor, .cm-content',
      ),
    );
  }
  return Boolean(
    element.closest(
      'textarea, input, iframe[data-hole-interactive="true"], [contenteditable="true"], [data-hole-editable="true"], .cm-editor, .cm-content',
    ),
  );
};
