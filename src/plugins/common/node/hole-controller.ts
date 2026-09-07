import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode, NodeSelection, RangeSelection } from 'lexical';
import {
  $addUpdateTag,
  $createNodeSelection,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootNode,
  $setSelection,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_HIGH,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from 'lexical';

import { $getNearestNodeFromDOMNode } from '@/editor-kernel/utils';

import { ENTER_HOLE_CONTENT_COMMAND } from '../command';
import {
  $getAtomicHolePointContext,
  $normalizeAtomicHoleRangeSelection,
  type AtomicHoleBoundarySide,
  isAtomicHoleInternalEditorTarget,
} from './atomic-hole-selection';
import { $isCursorNode, type BoundaryCursorDirection, type CursorNode } from './cursor';
import { $isHoleNode, HoleNode } from './hole';

/**
 * Owns all editor behavior specific to Hole boundary markers.
 *
 * CursorNode remains a generic text caret. This controller is registered before
 * the generic cursor controller, so it consumes Hole events without teaching
 * the shared cursor implementation about Hole or Artifact node types.
 */
export function registerHoleNode(editor: LexicalEditor): () => void {
  let reconcileScheduled = false;
  let selectionGuardScheduled = false;
  let selectionGuardDisposed = false;
  let cleanupDOMSelectionGuard: (() => void) | undefined;

  const scheduleReconcile = () => {
    if (reconcileScheduled) return;
    reconcileScheduled = true;
    queueMicrotask(() => {
      reconcileScheduled = false;
      reconcileHoleNodes(editor);
    });
  };

  const selectionNeedsGuard = (): boolean => {
    let needsGuard = false;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      needsGuard = Boolean(
        $getAtomicHolePointContext(selection.anchor) || $getAtomicHolePointContext(selection.focus),
      );
    });
    return needsGuard;
  };

  const scheduleSelectionGuard = (): void => {
    if (selectionGuardScheduled || selectionGuardDisposed || !selectionNeedsGuard()) return;
    selectionGuardScheduled = true;
    queueMicrotask(() => {
      selectionGuardScheduled = false;
      if (selectionGuardDisposed || !selectionNeedsGuard()) return;
      editor.update(
        () => {
          $normalizeAtomicHoleRangeSelection($getSelection());
        },
        { tag: SKIP_SCROLL_INTO_VIEW_TAG },
      );
    });
  };

  const selectHoleBoundary = (holeKey: string, side: AtomicHoleBoundarySide): void => {
    editor.update(
      () => {
        const hole = $getNodeByKey(holeKey);
        if (!$isHoleNode(hole)) return;
        hole.normalizeBoundaryCursors();
        const cursor = side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
        if (!cursor) return;
        if (side === 'before') cursor.selectEnd();
        else cursor.selectStart();
      },
      { tag: SKIP_SCROLL_INTO_VIEW_TAG },
    );
  };

  const pointInHoleContent = (
    target: EventTarget | null,
    root: HTMLElement,
  ): {
    element: HTMLElement;
    hole: HTMLElement;
  } | null => {
    const targetElement =
      typeof Element !== 'undefined' && target instanceof Element
        ? target
        : typeof Node !== 'undefined' && target instanceof Node
          ? target.parentElement
          : null;
    if (!targetElement) return null;
    const element = targetElement.closest<HTMLElement>('[data-hole-content="true"]');
    if (!element || !root.contains(element)) return null;
    const hole = element.closest<HTMLElement>('[data-hole="true"]');
    return hole && root.contains(hole) ? { element, hole } : null;
  };

  const sideFromPointer = (hole: HTMLElement, event: Event): AtomicHoleBoundarySide => {
    const before = hole.querySelector<HTMLElement>('[data-hole-cursor-hit="before"]');
    const after = hole.querySelector<HTMLElement>('[data-hole-cursor-hit="after"]');
    const point = event as MouseEvent;
    const x = Number.isFinite(point.clientX) ? point.clientX : undefined;
    if (x !== undefined && before && after) {
      const beforeRect = before.getBoundingClientRect();
      const afterRect = after.getBoundingClientRect();
      const beforeCenter = beforeRect.left + beforeRect.width / 2;
      const afterCenter = afterRect.left + afterRect.width / 2;
      if (beforeRect.width > 0 || afterRect.width > 0) {
        return Math.abs(x - beforeCenter) <= Math.abs(x - afterCenter) ? 'before' : 'after';
      }
    }
    const rect = hole.getBoundingClientRect();
    return x !== undefined && rect.width > 0 && x > rect.left + rect.width / 2 ? 'after' : 'before';
  };

  const installDOMSelectionGuard = (root: HTMLElement): (() => void) => {
    const document = root.ownerDocument;
    let nativeSelectionGuarded = false;
    const getHoleKey = (hole: HTMLElement): string | undefined => {
      const blockId = hole.getAttribute('data-block-id');
      if (blockId) return blockId;
      const lexicalEditor = editor;
      let holeKey: string | undefined;
      lexicalEditor.getEditorState().read(() => {
        const node = $getNearestNodeFromDOMNode(hole, lexicalEditor);
        if ($isHoleNode(node)) holeKey = node.getKey();
        else if (node?.getParent() && $isHoleNode(node.getParent())) {
          holeKey = node.getParent()!.getKey();
        }
      });
      return holeKey;
    };
    const guardEvent = (event: Event): void => {
      const hit = pointInHoleContent(event.target, root);
      if (!hit || isAtomicHoleInternalEditorTarget(event.target)) return;
      const holeKey = getHoleKey(hit.hole);
      if (!holeKey) {
        scheduleSelectionGuard();
        event.preventDefault();
        return;
      }
      const side =
        event.type === 'keydown'
          ? /^(ArrowRight|End|PageDown)$/u.test((event as KeyboardEvent).key)
            ? 'after'
            : 'before'
          : sideFromPointer(hit.hole, event);
      event.preventDefault();
      if (event.type === 'focusin' || event.type === 'selectstart') event.stopPropagation();
      selectHoleBoundary(holeKey, side);
    };
    const guardNativeSelection = (): void => {
      if (nativeSelectionGuarded) return;
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const anchorHit = pointInHoleContent(selection.anchorNode, root);
      const focusHit = pointInHoleContent(selection.focusNode, root);
      const hit = anchorHit || focusHit;
      if (!hit || isAtomicHoleInternalEditorTarget(selection.anchorNode)) return;
      const holeKey = getHoleKey(hit.hole);
      if (!holeKey) return;
      nativeSelectionGuarded = true;
      selection.removeAllRanges();
      selectHoleBoundary(holeKey, 'before');
      queueMicrotask(() => {
        nativeSelectionGuarded = false;
      });
    };

    const eventTypes = ['beforeinput', 'click', 'focusin', 'keydown', 'pointerdown', 'selectstart'];
    eventTypes.forEach((type) => root.addEventListener(type, guardEvent, true));
    document.addEventListener('selectionchange', guardNativeSelection, true);

    return () => {
      eventTypes.forEach((type) => root.removeEventListener(type, guardEvent, true));
      document.removeEventListener('selectionchange', guardNativeSelection, true);
    };
  };

  let unregisterRootListener = (): void => {};
  try {
    unregisterRootListener = editor.registerRootListener((root, previousRoot) => {
      cleanupDOMSelectionGuard?.();
      cleanupDOMSelectionGuard = undefined;
      if (previousRoot === root || !root) return;
      cleanupDOMSelectionGuard = installDOMSelectionGuard(root);
    });
  } catch {
    // Lexical's headless adapter intentionally throws for DOM-only APIs. The
    // node/update guards above remain useful there, while browser editors use
    // the root listener to install the native selection guard.
  }

  return mergeRegister(
    editor.registerNodeTransform(HoleNode, $normalizeHoleNode),
    editor.registerUpdateListener(() => {
      handleHoleCursorInput(editor);
      scheduleSelectionGuard();
    }),
    editor.registerCommand(
      KEY_ARROW_LEFT_COMMAND,
      (event) => handleHoleArrow(editor, event, 'left'),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ARROW_RIGHT_COMMAND,
      (event) => handleHoleArrow(editor, event, 'right'),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => handleHoleBackspace(editor, event),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event) => handleHoleDelete(event),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => handleHoleEnter(event),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerCommand(
      INSERT_PARAGRAPH_COMMAND,
      () => handleHoleEnter(),
      COMMAND_PRIORITY_HIGH,
    ),
    editor.registerUpdateListener(({ tags }) => {
      if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG)) {
        scheduleReconcile();
        scheduleSelectionGuard();
      }
    }),
    unregisterRootListener,
    () => {
      selectionGuardDisposed = true;
      cleanupDOMSelectionGuard?.();
      cleanupDOMSelectionGuard = undefined;
    },
  );
}

/** Repair persisted/remote Hole shapes from the document-change lifecycle. */
export function reconcileHoleNodes(editor: LexicalEditor | null | undefined): void {
  if (!editor) return;

  const holeKeys = editor.getEditorState().read(() => {
    const keys: string[] = [];
    const visit = (node: LexicalNode) => {
      if (
        $isHoleNode(node) &&
        (node.getContentChildren().length === 0 || !node.hasValidBoundaryCursors())
      ) {
        keys.push(node.getKey());
      }
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };

    $getRoot().getChildren().forEach(visit);
    return keys;
  });

  if (holeKeys.length === 0) return;

  editor.update(
    () => {
      holeKeys.forEach((key) => {
        const hole = $getNodeByKey(key);
        if ($isHoleNode(hole)) $normalizeHoleNode(hole);
      });
    },
    { tag: HISTORY_MERGE_TAG },
  );
}

export function $normalizeHoleNode(node: HoleNode): void {
  if (node.getContentChildren().length === 0) {
    const selection = $getSelection();
    const selectionWasInside = Boolean(
      selection?.getNodes().some((selected) => selected.is(node) || node.isParentOf(selected)),
    );
    const previous = node.getPreviousSibling();
    const next = node.getNextSibling();
    const parent = node.getParent();
    node.remove();

    if ($isRootNode(parent) && parent.isEmpty()) {
      const paragraph = $createParagraphNode();
      parent.append(paragraph);
      if (selectionWasInside) paragraph.selectEnd();
    } else if (selectionWasInside) {
      if (next) next.selectStart();
      else previous?.selectEnd();
    }
    return;
  }

  node.normalizeBoundaryCursors();
}

function handleHoleCursorInput(editor: LexicalEditor): void {
  editor.getEditorState().read(() => {
    if (editor.isComposing() || !editor.isEditable()) return;
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

    const cursor = selection.anchor.getNode();
    if (!$isCursorNode(cursor)) return;

    const hole = cursor.getParent();
    if (!$isHoleNode(hole) || hole.getBoundaryCursorSide(cursor) === null) return;

    const text = cursor.getTextContent().replaceAll('\uFEFF', '');
    if (!text) return;

    const cursorKey = cursor.getKey();
    editor.update(
      () => {
        const current = $getNodeByKey(cursorKey);
        if (!$isCursorNode(current)) return;
        const currentHole = current.getParent();
        if (!$isHoleNode(currentHole)) return;
        const side = currentHole.getBoundaryCursorSide(current);
        if (!side) return;

        current.setTextContent('\uFEFF');
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(text));
        if (side === 'before') currentHole.insertBefore(paragraph);
        else currentHole.insertAfter(paragraph);
        paragraph.selectEnd();
      },
      { tag: HISTORY_MERGE_TAG },
    );
  });
}

function getBoundaryContext(selection: RangeSelection): {
  cursor: CursorNode;
  hole: HoleNode;
  side: 'after' | 'before';
} | null {
  if (!selection.isCollapsed()) return null;
  const cursor = selection.anchor.getNode();
  if (!$isCursorNode(cursor)) return null;
  const hole = cursor.getParent();
  if (!$isHoleNode(hole)) return null;
  const side = hole.getBoundaryCursorSide(cursor);
  return side ? { cursor, hole, side } : null;
}

function getSelectedHole(selection: NodeSelection): HoleNode | null {
  const nodes = selection.getNodes();
  if (nodes.length !== 1) return null;

  const selected = nodes[0];
  if ($isHoleNode(selected)) return selected;
  const parent = selected.getParent();
  if (!$isHoleNode(parent)) return null;
  return parent.getContentChildren().some((content) => content.is(selected)) ? parent : null;
}

function handleSelectedHoleArrow(
  selection: NodeSelection,
  direction: BoundaryCursorDirection,
): boolean {
  const hole = getSelectedHole(selection);
  if (!hole) return false;

  const boundary = direction === 'left' ? hole.getBeforeCursor() : hole.getAfterCursor();
  if (!boundary) return false;
  if (direction === 'left') boundary.selectEnd();
  else boundary.selectStart();
  return true;
}

function handleHoleArrow(
  editor: LexicalEditor,
  event: KeyboardEvent,
  direction: BoundaryCursorDirection,
): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    if (handleSelectedHoleArrow(selection, direction)) {
      event.preventDefault();
      return true;
    }
    return false;
  }

  if (!$isRangeSelection(selection)) return false;
  const contentContext =
    $getAtomicHolePointContext(selection.anchor) || $getAtomicHolePointContext(selection.focus);
  if (contentContext) {
    event.preventDefault();
    contentContext.hole.normalizeBoundaryCursors();
    const cursor =
      direction === 'left'
        ? contentContext.hole.getBeforeCursor()
        : contentContext.hole.getAfterCursor();
    if (cursor) {
      if (direction === 'left') cursor.selectEnd();
      else cursor.selectStart();
    }
    return true;
  }
  const context = getBoundaryContext(selection);
  if (!context || !editor.isEditable()) return false;

  const { hole, side } = context;
  const entersContent =
    (side === 'before' && direction === 'right') || (side === 'after' && direction === 'left');

  if (event.shiftKey && entersContent) {
    const content =
      side === 'before' ? hole.getContentChildren()[0] : hole.getContentChildren().at(-1);
    if ($isDecoratorNode(content)) {
      const nodeSelection = $createNodeSelection();
      nodeSelection.add(content.getKey());
      $setSelection(nodeSelection);
      event.preventDefault();
      return true;
    }
  }

  if (event.shiftKey) {
    const index = hole.getIndexWithinParent();
    const parent = hole.getParent();
    if (!parent) return false;
    const boundaryOffset = side === 'before' ? index : index + 1;
    const targetOffset =
      direction === 'left'
        ? side === 'after'
          ? index
          : Math.max(0, index - 1)
        : side === 'before'
          ? index + 1
          : Math.min(parent.getChildrenSize(), index + 2);
    selection.anchor.set(parent.getKey(), boundaryOffset, 'element');
    selection.focus.set(parent.getKey(), targetOffset, 'element');
    event.preventDefault();
    return true;
  }

  if (entersContent) {
    const content =
      side === 'before' ? hole.getContentChildren()[0] : hole.getContentChildren().at(-1);
    if (!content) return false;

    if (
      editor.dispatchCommand(ENTER_HOLE_CONTENT_COMMAND, {
        edge: side === 'before' ? 'start' : 'end',
        key: content.getKey(),
      })
    ) {
      $setSelection(null);
      event.preventDefault();
      return true;
    }

    const opposite = side === 'before' ? hole.getAfterCursor() : hole.getBeforeCursor();
    if (!opposite) return false;
    if (side === 'before') opposite.selectStart();
    else opposite.selectEnd();
    event.preventDefault();
    return true;
  }

  const adjacent = side === 'before' ? hole.getPreviousSibling() : hole.getNextSibling();
  if (adjacent) {
    if (side === 'before') adjacent.selectEnd();
    else adjacent.selectStart();
    event.preventDefault();
    return true;
  }

  const paragraph = $createParagraphNode();
  if (side === 'before') {
    hole.insertBefore(paragraph);
    paragraph.selectEnd();
  } else {
    hole.insertAfter(paragraph);
    paragraph.selectStart();
  }
  event.preventDefault();
  return true;
}

function handleHoleBackspace(editor: LexicalEditor, event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const hole = getSelectedHole(selection);
    if (!hole) return false;
    event.preventDefault();
    removeHoleAndPlaceSelection(hole);
    return true;
  }

  if (!$isRangeSelection(selection)) return false;
  const context = getBoundaryContext(selection);
  if (!context) return false;
  event.preventDefault();

  if (context.side === 'after') {
    removeHoleAndPlaceSelection(context.hole);
    return true;
  }

  const previous = context.hole.getPreviousSibling();
  if (previous) {
    previous.selectEnd();
    queueMicrotask(() => editor.dispatchCommand(KEY_BACKSPACE_COMMAND, event));
  }
  return true;
}

function handleHoleDelete(event: KeyboardEvent): boolean {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const hole = getSelectedHole(selection);
    if (!hole) return false;
    event.preventDefault();
    removeHoleAndPlaceSelection(hole);
    return true;
  }

  if (!$isRangeSelection(selection)) return false;
  const context = getBoundaryContext(selection);
  if (!context) return false;
  event.preventDefault();

  if (context.side === 'before') {
    removeHoleAndPlaceSelection(context.hole);
    return true;
  }

  const next = context.hole.getNextSibling();
  next?.selectStart();
  return true;
}

/**
 * Keep Enter outside an atomic Hole. Lexical's generic paragraph insertion
 * sees a boundary cursor (or a root element point immediately beside the
 * Hole) as an ordinary caret and can append the paragraph at the document end.
 * When the point is inside a Hole payload, splitting it is worse: it can move
 * a decorator/code sibling into the Hole and make the card appear duplicated.
 * Always create the new paragraph as a sibling of the Hole at the active side.
 */
function handleHoleEnter(event?: KeyboardEvent | null): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const atomicContext =
    $getAtomicHolePointContext(selection.anchor) || $getAtomicHolePointContext(selection.focus);
  if (atomicContext) {
    // A normal Lexical Enter must never split a Hole payload. The dedicated
    // content editor (Artifact iframe/CodeMirror) owns its own Enter key; a
    // stray selection in its payload is consumed and normalized to a legal
    // boundary without changing the document.
    $normalizeAtomicHoleRangeSelection(selection);
    event?.preventDefault();
    return true;
  }

  const context = getBoundaryContext(selection) || getElementBoundaryContext(selection);
  if (!context) return false;

  const { hole, side } = context;
  if (!hole.getParent()) {
    event?.preventDefault();
    return true;
  }

  // Enter is a user-visible structural boundary. Stop Yjs capture before this
  // paragraph is written so a preceding local Code insertion cannot share its
  // Undo item and be removed by the next Meta+Z.
  $addUpdateTag(HISTORY_PUSH_TAG);
  const paragraph = $createParagraphNode();
  if (side === 'before') {
    hole.insertBefore(paragraph);
    paragraph.selectEnd();
  } else {
    hole.insertAfter(paragraph);
    paragraph.selectStart();
  }
  event?.preventDefault();
  return true;
}

function getElementBoundaryContext(selection: RangeSelection): {
  hole: HoleNode;
  side: 'after' | 'before';
} | null {
  const point = selection.anchor;
  if (point.type !== 'element') return null;
  const parent = $getNodeByKey(point.key);
  if (!$isElementNode(parent)) return null;

  const previous = parent.getChildAtIndex(point.offset - 1);
  if ($isHoleNode(previous)) return { hole: previous, side: 'after' };

  const next = parent.getChildAtIndex(point.offset);
  if ($isHoleNode(next)) return { hole: next, side: 'before' };
  return null;
}

function removeHoleAndPlaceSelection(hole: HoleNode): void {
  const previous = hole.getPreviousSibling();
  const next = hole.getNextSibling();
  const parent = hole.getParent();

  if (next) next.selectStart();
  else if (previous) previous.selectEnd();
  else if (parent) {
    const paragraph = $createParagraphNode();
    parent.append(paragraph);
    paragraph.selectEnd();
  }
  hole.remove();
}
