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
      return $isCursorNode(current) ? null : current;
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

const sideForHoleElementPoint = (hole: HoleNode, offset: number): AtomicHoleBoundarySide | null => {
  const children = hole.getChildren();
  const lastBoundaryOffset = Math.max(0, children.length - 1);
  if (offset <= 1) return null;
  if (offset >= lastBoundaryOffset) return null;
  return offset <= children.length / 2 ? 'before' : 'after';
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

  const hole = $getAtomicHoleForNode(node);
  if (!hole) return null;
  return {
    hole,
    side: sideForContentPoint(hole, node, point.offset, point.type),
  };
};

const setBoundaryPoint = (
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

  // A range whose two endpoints are both inside one atomic payload would
  // otherwise become an inverted range between the two boundary cursors. A
  // collapsed boundary is the only unambiguous, non-content selection.
  if (anchorContext && focusContext && anchorContext.hole.is(focusContext.hole)) {
    const side = anchorContext.side === focusContext.side ? anchorContext.side : 'before';
    setBoundaryPoint(selection, side, anchorContext.hole, 'anchor');
    setBoundaryPoint(selection, side, anchorContext.hole, 'focus');
    return true;
  }

  if (anchorContext) setBoundaryPoint(selection, anchorContext.side, anchorContext.hole, 'anchor');
  if (focusContext) setBoundaryPoint(selection, focusContext.side, focusContext.hole, 'focus');
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
