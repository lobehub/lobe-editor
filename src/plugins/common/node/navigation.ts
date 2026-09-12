import { $isCodeHighlightNode, $isCodeNode } from '@lexical/code-core';
import type {
  BaseSelection,
  CommandListener,
  CommandListenerPriority,
  ElementNode,
  LexicalCommand,
  LexicalEditor,
  LexicalNode,
  PointType,
} from 'lexical';
import {
  $getRoot,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  $isTextNode,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { $isHoleNode } from './hole';

export type BlockEdge = 'start' | 'end';
export type BlockDirection = 'left' | 'right';

const isNodeWithinHole = (node: LexicalNode): boolean => {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isHoleNode(current)) return true;
    current = current.getParent();
  }
  return false;
};

/** Whether a selection belongs to a runtime Hole boundary or payload. */
export function $isSelectionInHole(selection: BaseSelection | null): boolean {
  if (!selection) return false;
  if ($isRangeSelection(selection)) {
    return (
      isNodeWithinHole(selection.anchor.getNode()) || isNodeWithinHole(selection.focus.getNode())
    );
  }
  if ($isNodeSelection(selection)) {
    return selection.getNodes().some(isNodeWithinHole);
  }
  return false;
}

function resolveElement(
  element: ElementNode,
  isBackward: boolean,
  focusOffset: number,
): LexicalNode | null {
  const parent = element.getParent();
  let offset = focusOffset;
  let block = element;
  if (parent !== null) {
    if (isBackward && focusOffset === 0) {
      offset = block.getIndexWithinParent();
      block = parent;
    } else if (!isBackward && focusOffset === block.getChildrenSize()) {
      offset = block.getIndexWithinParent() + 1;
      block = parent;
    }
  }
  const childIndex = isBackward ? offset - 1 : offset;
  if (childIndex < 0 || childIndex >= block.getChildrenSize()) {
    return null;
  }
  return block.getChildAtIndex(childIndex);
}

function isCodeNodeLastLine(focusNode: LexicalNode): boolean {
  if (!$isCodeHighlightNode(focusNode)) {
    return false;
  }
  const codeNode = focusNode.getParent();
  if (!$isCodeNode(codeNode)) {
    return false;
  }
  let last: LexicalNode | null | undefined = codeNode.getLastChild();
  do {
    if (last && last.getType() === 'linebreak') {
      return false;
    }
    if (last === focusNode) {
      return true;
    }
    last = last?.getPreviousSibling();
  } while (last !== focusNode && last);
  return last === focusNode;
}

/**
 * Resolve the nearest structural sibling used by horizontal editor movement.
 * This deliberately follows Lexical's tree and does not flatten Hole payloads.
 */
export function $getAdjacentNode(focus: PointType, isBackward: boolean): LexicalNode | null {
  const focusOffset = focus.offset;
  if (focus.type === 'element') {
    return resolveElement(focus.getNode(), isBackward, focusOffset);
  }

  const focusNode = focus.getNode();
  if (
    (isBackward && focusOffset === 0) ||
    (!isBackward && focusOffset === focusNode.getTextContentSize())
  ) {
    const possibleNode = isBackward ? focusNode.getPreviousSibling() : focusNode.getNextSibling();
    if (possibleNode === null) {
      return resolveElement(
        focusNode.getParentOrThrow(),
        isBackward,
        focusNode.getIndexWithinParent() + (isBackward ? 0 : 1),
      );
    }
    return possibleNode;
  }

  if (!isBackward && isCodeNodeLastLine(focusNode)) {
    return focusNode.getParent()?.getNextSibling() || null;
  }

  return null;
}

/**
 * Resolve the next block in the same structural walk used by plain vertical
 * arrows. Shadow roots are navigation boundaries: callers must not jump out of
 * a table cell or another isolated container while resolving its edge.
 */
export function $getDownUpNode(focus: PointType, isUp: boolean): LexicalNode | null {
  return $getDownUpNodeFromNode(focus.getNode(), isUp);
}

/** Resolve vertical siblings when the origin is a NodeSelection target. */
export function $getDownUpNodeFromNode(focusNode: LexicalNode, isUp: boolean): LexicalNode | null {
  let blockParent: LexicalNode | null = focusNode;
  while (blockParent !== null && blockParent.isInline()) {
    blockParent = blockParent.getParent();
  }
  if (!blockParent) {
    return null;
  }

  let nextNode = isUp ? blockParent.getPreviousSibling() : blockParent.getNextSibling();
  while (!nextNode && !$isRootOrShadowRoot(blockParent)) {
    const parent: LexicalNode | null = blockParent.getParent();
    if (!parent || $isRootOrShadowRoot(parent)) {
      return null;
    }
    blockParent = parent;
    nextNode = isUp ? parent.getPreviousSibling() : parent.getNextSibling();
  }
  return nextNode;
}

/** Resolve an editable point at a node's logical start/end edge. */
export function $getNodeEdgePoint(
  node: LexicalNode,
  direction: BlockDirection,
): { key: string; offset: number; type: 'element' | 'text' } {
  let current = node;
  while ($isElementNode(current)) {
    const child = direction === 'left' ? current.getLastChild() : current.getFirstChild();
    if (!child) {
      return {
        key: current.getKey(),
        offset: direction === 'left' ? current.getChildrenSize() : 0,
        type: 'element',
      };
    }
    current = child;
  }

  if ($isTextNode(current)) {
    return {
      key: current.getKey(),
      offset: direction === 'left' ? current.getTextContentSize() : 0,
      type: 'text',
    };
  }

  const parent = current.getParentOrThrow();
  return {
    key: parent.getKey(),
    offset:
      parent.getChildren().findIndex((child) => child.is(current)) + (direction === 'left' ? 1 : 0),
    type: 'element',
  };
}

/**
 * Select a block edge without entering a Hole payload. The Hole wrapper is a
 * legal navigation stop, so its start/end map to the before/after marker;
 * ordinary ElementNode/TextNode edges use Lexical's native selection helpers.
 */
export function $selectBlockEdge(node: LexicalNode, edge: BlockEdge): boolean {
  if ($isHoleNode(node)) {
    node.normalizeBoundaryCursors();
    const cursor = edge === 'start' ? node.getBeforeCursor() : node.getAfterCursor();
    if (!cursor) return false;
    if (edge === 'start') cursor.selectEnd();
    else cursor.selectStart();
    return true;
  }

  if ($isElementNode(node) || $isTextNode(node)) {
    if (edge === 'start') node.selectStart();
    else node.selectEnd();
    return true;
  }

  const parent = node.getParent();
  if (!$isElementNode(parent)) return false;
  const index = node.getIndexWithinParent();
  parent.select(edge === 'start' ? index : index + 1, edge === 'start' ? index : index + 1);
  return true;
}

/**
 * Register a command through the kernel's ordered priority dispatcher when a
 * kernel is available, with one Lexical fallback for standalone editors used
 * by focused tests. Keeping this in the shared navigation leaf prevents each
 * navigation owner from duplicating the same two-branch registration logic.
 */
export function registerSharedCommand<P>(
  editor: LexicalEditor,
  command: LexicalCommand<P>,
  listener: CommandListener<P>,
  priority: CommandListenerPriority,
): () => void {
  const kernel = getKernelFromEditor(editor);
  return kernel?.registerHighCommand
    ? kernel.registerHighCommand(command, listener, priority)
    : editor.registerCommand(command, listener, priority);
}

export function $isSelectionAtEndOfRoot(selection: { focus: PointType }): boolean {
  const focus = selection.focus;
  return focus.key === 'root' && focus.offset === $getRoot().getChildrenSize();
}
