import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode, NodeSelection, PointType, RangeSelection } from 'lexical';
import {
  $addUpdateTag,
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  $setSelection,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMPOSITION_START_COMMAND,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from 'lexical';

import { $getNearestNodeFromDOMNode } from '@/editor-kernel/utils';

import { ENTER_HOLE_CONTENT_COMMAND } from '../command';
import {
  $getAtomicHolePointContext,
  $isAtomicHoleElementPayloadNode,
  $normalizeAtomicHoleRangeSelection,
  $setAtomicHoleBoundaryPoint,
  type AtomicHoleBoundarySide,
  isAtomicHoleInternalEditorTarget,
} from './atomic-hole-selection';
import { $isCursorNode, type BoundaryCursorDirection, type CursorNode } from './cursor';
import { $isHoleNode, HoleNode } from './hole';
import {
  $getDownUpNode,
  $getDownUpNodeFromNode,
  $getNodeEdgePoint,
  $selectBlockEdge,
  registerSharedCommand,
} from './navigation';
import { shouldHandleNavigationEvent } from './navigation-guards';

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
    let dragNormalizationScheduled = false;
    let pointerState: {
      dragging: boolean;
      moved: boolean;
      startHit: { holeKey: string; side: AtomicHoleBoundarySide } | null;
      startX: number;
      startY: number;
      pointerId: number;
    } | null = null;
    const getHoleKey = (hole: HTMLElement): string | undefined => {
      const lexicalEditor = editor;
      let holeKey: string | undefined;
      lexicalEditor.getEditorState().read(() => {
        const structuralId = hole.getAttribute('data-block-structural-id');
        if (structuralId && $isHoleNode($getNodeByKey(structuralId))) {
          holeKey = structuralId;
          return;
        }

        const node = $getNearestNodeFromDOMNode(hole, lexicalEditor);
        if ($isHoleNode(node)) {
          holeKey = node.getKey();
          return;
        }
        if (node?.getParent() && $isHoleNode(node.getParent())) {
          holeKey = node.getParent()!.getKey();
          return;
        }

        const logicalId = hole.getAttribute('data-block-id');
        if (logicalId && $isHoleNode($getNodeByKey(logicalId))) {
          holeKey = logicalId;
        }
      });
      return holeKey;
    };

    const getTargetElement = (target: EventTarget | null): Element | null => {
      if (typeof Element !== 'undefined' && target instanceof Element) return target;
      if (typeof Node !== 'undefined' && target instanceof Node) return target.parentElement;
      return null;
    };

    const getHoleElement = (target: EventTarget | null): HTMLElement | null => {
      const targetElement = getTargetElement(target);
      const hole = targetElement?.closest<HTMLElement>('[data-hole="true"]');
      return hole && root.contains(hole) ? hole : null;
    };

    const getHoleHitSide = (target: EventTarget | null): AtomicHoleBoundarySide | null => {
      const targetElement = getTargetElement(target);
      const hitArea = targetElement?.closest<HTMLElement>('[data-hole-cursor-hit]');
      if (!hitArea || !root.contains(hitArea)) return null;
      const side = hitArea.dataset.holeCursorHit;
      return side === 'before' || side === 'after' ? side : null;
    };

    const isCompositePayloadTarget = (target: EventTarget | null): boolean => {
      const targetElement = getTargetElement(target);
      if (!targetElement) return false;
      let composite = false;
      editor.getEditorState().read(() => {
        const node = $getNearestNodeFromDOMNode(targetElement, editor);
        composite = Boolean(node && $isAtomicHoleElementPayloadNode(node));
      });
      return composite;
    };

    const isDecoratorTarget = (target: EventTarget | null): boolean => {
      const targetElement = getTargetElement(target);
      return Boolean(targetElement?.closest('[data-lexical-decorator="true"]'));
    };

    const isPayloadInteractionTarget = (target: EventTarget | null): boolean =>
      isAtomicHoleInternalEditorTarget(target, root) ||
      isCompositePayloadTarget(target) ||
      isDecoratorTarget(target);

    const findRowHole = (event: Event): HTMLElement | null => {
      const point = event as MouseEvent;
      const y = Number.isFinite(point.clientY) ? point.clientY : undefined;
      if (y === undefined) return null;

      let closest: { hole: HTMLElement; distance: number } | null = null;
      for (const hole of root.querySelectorAll<HTMLElement>('[data-hole="true"]')) {
        const rect = hole.getBoundingClientRect();
        if (rect.height <= 0) continue;
        const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        if (distance > 0) continue;
        if (!closest || distance < closest.distance) closest = { distance, hole };
      }
      return closest?.hole ?? null;
    };

    const resolvePointerHit = (
      event: Event,
    ): { hole: HTMLElement; side: AtomicHoleBoundarySide } | null => {
      const directHole = getHoleElement(event.target);
      const targetElement = getTargetElement(event.target);
      const hole = directHole ?? (targetElement === root ? findRowHole(event) : null);
      if (!hole) return null;

      const explicitSide = getHoleHitSide(event.target);
      if (explicitSide) return { hole, side: explicitSide };

      return { hole, side: sideFromPointer(hole, event) };
    };

    const normalizeDragAnchor = (): void => {
      if (
        dragNormalizationScheduled ||
        !pointerState?.dragging ||
        !pointerState.moved ||
        !pointerState.startHit
      ) {
        return;
      }
      dragNormalizationScheduled = true;
      const startHit = pointerState.startHit;
      queueMicrotask(() => {
        dragNormalizationScheduled = false;
        if (!pointerState?.dragging || !pointerState.moved || pointerState.startHit !== startHit) {
          return;
        }
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
            const hole = $getNodeByKey(startHit.holeKey);
            if (!$isHoleNode(hole)) return;
            $setAtomicHoleBoundaryPoint(selection, startHit.side, hole, 'anchor');
          },
          { tag: SKIP_SCROLL_INTO_VIEW_TAG },
        );
      });
    };

    const finishPointer = (): void => {
      if (!pointerState) return;
      // Keep the gesture through the synthetic/native click that follows
      // pointerup. The click path consumes it; the next pointerdown replaces
      // it. No pointer capture is used, so document-level pointerup/cancel
      // still closes the active gesture when release occurs outside root.
      pointerState.dragging = false;
    };

    const guardEvent = (event: Event): void => {
      if (event.type === 'pointerdown') {
        const pointer = event as PointerEvent;
        pointerState = null;
        dragNormalizationScheduled = false;
        if (pointer.button !== 0 || !editor.isEditable()) return;
        // A new gesture always supersedes an unfinished one. Payload editors
        // (including CodeMirror/iframe editors) keep their own drag model and
        // must never have their anchor rewritten to a Hole boundary.
        if (isPayloadInteractionTarget(event.target)) return;
        const hit = resolvePointerHit(event);
        const targetElement = getTargetElement(event.target);
        if (!targetElement || !root.contains(targetElement)) return;
        const holeKey = hit ? getHoleKey(hit.hole) : undefined;
        pointerState = {
          dragging: true,
          moved: false,
          pointerId: pointer.pointerId,
          startHit: holeKey && hit ? { holeKey, side: hit.side } : null,
          startX: pointer.clientX,
          startY: pointer.clientY,
        };
        return;
      }

      if (event.type === 'pointermove') {
        const pointer = event as PointerEvent;
        if (
          !pointerState ||
          !pointerState.dragging ||
          pointer.pointerId !== pointerState.pointerId
        ) {
          return;
        }
        if (
          Math.abs(pointer.clientX - pointerState.startX) > 2 ||
          Math.abs(pointer.clientY - pointerState.startY) > 2
        ) {
          pointerState.moved = true;
        }
        return;
      }

      if (event.type === 'pointercancel') {
        const pointer = event as PointerEvent;
        if (pointerState && pointer.pointerId === pointerState.pointerId) {
          pointerState = null;
          dragNormalizationScheduled = false;
        }
        return;
      }

      if (event.type === 'pointerup') {
        const pointer = event as PointerEvent;
        if (pointerState && pointer.pointerId === pointerState.pointerId) finishPointer();
        return;
      }

      const hit = resolvePointerHit(event);
      if (event.type === 'click') {
        const moved = pointerState?.moved ?? false;
        pointerState = null;
        dragNormalizationScheduled = false;
        if (moved || !hit || isPayloadInteractionTarget(event.target)) return;
        const holeKey = getHoleKey(hit.hole);
        if (!holeKey) return;
        event.preventDefault();
        event.stopPropagation();
        root.focus({ preventScroll: true });
        selectHoleBoundary(holeKey, hit.side);
      }
    };
    const guardNativeSelection = (): void => {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      if (!selection.isCollapsed) {
        normalizeDragAnchor();
      }
    };

    const eventTypes = ['click', 'pointercancel', 'pointerdown', 'pointermove', 'pointerup'];
    eventTypes.forEach((type) => root.addEventListener(type, guardEvent, true));
    document.addEventListener('selectionchange', guardNativeSelection, true);
    const clearDocumentPointer = (event: Event): void => {
      const pointer = event as PointerEvent;
      if (!pointerState || pointer.pointerId !== pointerState.pointerId) return;
      if (event.type === 'pointercancel') {
        pointerState = null;
        dragNormalizationScheduled = false;
      } else {
        finishPointer();
      }
    };
    document.addEventListener('pointerup', clearDocumentPointer, true);
    document.addEventListener('pointercancel', clearDocumentPointer, true);

    return () => {
      eventTypes.forEach((type) => root.removeEventListener(type, guardEvent, true));
      document.removeEventListener('selectionchange', guardNativeSelection, true);
      document.removeEventListener('pointerup', clearDocumentPointer, true);
      document.removeEventListener('pointercancel', clearDocumentPointer, true);
      pointerState = null;
      dragNormalizationScheduled = false;
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

  const unregisterHoleVerticalNavigation = mergeRegister(
    registerSharedCommand(
      editor,
      KEY_ARROW_UP_COMMAND,
      (event) => handleHoleVerticalArrow(editor, event, 'up'),
      COMMAND_PRIORITY_CRITICAL,
    ),
    registerSharedCommand(
      editor,
      KEY_ARROW_DOWN_COMMAND,
      (event) => handleHoleVerticalArrow(editor, event, 'down'),
      COMMAND_PRIORITY_CRITICAL,
    ),
  );

  return mergeRegister(
    editor.registerNodeTransform(HoleNode, $normalizeHoleNode),
    editor.registerUpdateListener(() => {
      handleHoleCursorInput(editor);
      scheduleSelectionGuard();
    }),
    editor.registerCommand(
      COMPOSITION_START_COMMAND,
      (event) => {
        if (isAtomicHoleInternalEditorTarget(event?.target ?? null, editor.getRootElement())) {
          return false;
        }
        moveHoleBoundaryToParagraph(editor);
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    ),
    registerSharedCommand(
      editor,
      KEY_ARROW_LEFT_COMMAND,
      (event) => handleHoleArrow(editor, event, 'left'),
      COMMAND_PRIORITY_HIGH,
    ),
    registerSharedCommand(
      editor,
      KEY_ARROW_RIGHT_COMMAND,
      (event) => handleHoleArrow(editor, event, 'right'),
      COMMAND_PRIORITY_HIGH,
    ),
    unregisterHoleVerticalNavigation,
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

function moveHoleBoundaryToParagraph(editor: LexicalEditor): boolean {
  if (!editor.isEditable()) return false;
  const selection = $getSelection();
  const context = $isRangeSelection(selection) ? getBoundaryContext(selection) : null;
  if (!context) return false;

  const { cursor, hole, side } = context;
  const pendingText = normalizeHoleCursorInput(cursor.getTextContent());
  const paragraph = $createParagraphNode();
  if (pendingText) {
    paragraph.append($createTextNode(pendingText));
    cursor.setTextContent('\uFEFF');
  }
  if (side === 'before') {
    hole.insertBefore(paragraph);
  } else {
    hole.insertAfter(paragraph);
  }
  if (pendingText || side === 'before') paragraph.selectEnd();
  else paragraph.selectStart();
  return true;
}

const normalizeHoleCursorInput = (text: string): string => text.replaceAll('\uFEFF', '');

function handleHoleCursorInput(editor: LexicalEditor): void {
  editor.getEditorState().read(() => {
    if (editor.isComposing() || !editor.isEditable()) return;
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

    const cursor = selection.anchor.getNode();
    if (!$isCursorNode(cursor)) return;

    const hole = cursor.getParent();
    if (!$isHoleNode(hole) || hole.getBoundaryCursorSide(cursor) === null) return;

    const text = normalizeHoleCursorInput(cursor.getTextContent());
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

function getBoundaryPointContext(point: PointType): {
  cursor: CursorNode;
  hole: HoleNode;
  side: 'after' | 'before';
} | null {
  const cursor = point.getNode();
  if (!$isCursorNode(cursor)) return null;
  const hole = cursor.getParent();
  if (!$isHoleNode(hole)) return null;
  const side = hole.getBoundaryCursorSide(cursor);
  return side ? { cursor, hole, side } : null;
}

function getAdjacentHoleAtTextEdge(
  point: PointType,
  direction: BoundaryCursorDirection,
): HoleNode | null {
  if (point.type !== 'text') return null;
  const node = point.getNode();
  const atEdge =
    direction === 'left' ? point.offset === 0 : point.offset === node.getTextContentSize();
  if (!atEdge) return null;

  let current: LexicalNode = node;
  while (true) {
    const parent = current.getParent();
    if (!parent || $isHoleNode(parent)) return null;
    if ($isRootNode(parent)) {
      const adjacent =
        direction === 'left' ? current.getPreviousSibling() : current.getNextSibling();
      return $isHoleNode(adjacent) ? adjacent : null;
    }

    const edge = direction === 'left' ? parent.getFirstChild() : parent.getLastChild();
    if (!edge || !edge.is(current)) return null;
    current = parent;
  }
}

function setRangeFocusToAdjacent(
  selection: RangeSelection,
  hole: HoleNode,
  direction: BoundaryCursorDirection,
): boolean {
  const adjacent = direction === 'left' ? hole.getPreviousSibling() : hole.getNextSibling();
  if (!adjacent) return false;

  if ($isHoleNode(adjacent)) {
    $setAtomicHoleBoundaryPoint(
      selection,
      direction === 'left' ? 'after' : 'before',
      adjacent,
      'focus',
    );
    return true;
  }

  const point = $getNodeEdgePoint(adjacent, direction);
  selection.focus.set(point.key, point.offset, point.type);
  return true;
}

function extendRangeFromBoundary(
  selection: RangeSelection,
  direction: BoundaryCursorDirection,
  boundaryContext: { hole: HoleNode; side: AtomicHoleBoundarySide },
): boolean {
  const entersContent =
    (boundaryContext.side === 'before' && direction === 'right') ||
    (boundaryContext.side === 'after' && direction === 'left');
  if (entersContent) {
    $setAtomicHoleBoundaryPoint(
      selection,
      boundaryContext.side === 'before' ? 'after' : 'before',
      boundaryContext.hole,
      'focus',
    );
    return true;
  }
  return setRangeFocusToAdjacent(selection, boundaryContext.hole, direction);
}

/** Extend only the focus endpoint across a Hole, retaining the anchor. */
function extendRangeAcrossHole(
  selection: RangeSelection,
  direction: BoundaryCursorDirection,
): boolean {
  const focusContext = $getAtomicHolePointContext(selection.focus);
  if (focusContext) {
    // An illegal collapsed payload point still represents the logical start
    // of this Shift range. Preserve that side before moving the focus.
    if (selection.isCollapsed()) {
      $setAtomicHoleBoundaryPoint(selection, focusContext.side, focusContext.hole, 'anchor');
    }
    $setAtomicHoleBoundaryPoint(selection, focusContext.side, focusContext.hole, 'focus');
    return extendRangeFromBoundary(selection, direction, focusContext);
  }

  const boundaryContext = getBoundaryPointContext(selection.focus);
  if (boundaryContext) {
    return extendRangeFromBoundary(selection, direction, boundaryContext);
  }

  const adjacentHole = getAdjacentHoleAtTextEdge(selection.focus, direction);
  if (!adjacentHole) return false;
  $setAtomicHoleBoundaryPoint(
    selection,
    direction === 'left' ? 'after' : 'before',
    adjacentHole,
    'focus',
  );
  return true;
}

type HoleVerticalDirection = 'down' | 'up';

function isInsideShadowRoot(node: LexicalNode): boolean {
  let current = node.getParent();
  while (current) {
    if ($isElementNode(current) && current.isShadowRoot()) return true;
    if ($isRootNode(current)) return false;
    current = current.getParent();
  }
  return false;
}

function isOpaqueHoleVerticalEdge(node: LexicalNode): boolean {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isHoleNode(current) || $isDecoratorNode(current)) return true;
    // A shadow root is the local navigation scope. An enclosing outer Hole
    // (for example the TableNode Hole around this cell) must not make the
    // cell's own paragraph edge opaque.
    if ($isElementNode(current) && current.isShadowRoot()) return false;
    current = current.getParent();
  }
  return false;
}

function getHoleVerticalSelectionTarget(
  node: LexicalNode,
  direction: HoleVerticalDirection,
): LexicalNode | null {
  // A Hole is itself a legal vertical stop. Do not flatten a run of adjacent
  // cards into the next editable paragraph; the user must be able to walk
  // through each card boundary one at a time.
  if ($isHoleNode(node)) return node;
  if (!$isElementNode(node)) return $isTextNode(node) ? node : null;
  if (node.isInline() || node.isShadowRoot()) {
    return null;
  }

  const children = node.getChildren();
  if (children.length === 0) return node;

  const orderedChildren = direction === 'up' ? [...children].reverse() : children;
  for (const child of orderedChildren) {
    if ($isHoleNode(child)) return child;
    if (isOpaqueHoleVerticalEdge(child)) continue;

    if ($isElementNode(child)) {
      if (child.isInline()) {
        const edge = direction === 'up' ? child.getLastDescendant() : child.getFirstDescendant();
        if (edge && !isOpaqueHoleVerticalEdge(edge)) return edge;
        continue;
      }
      const nestedTarget = getHoleVerticalSelectionTarget(child, direction);
      if (nestedTarget) return nestedTarget;
      continue;
    }

    // Text and line-break children identify a normal editable block. Return
    // the discovered edge itself so a skipped trailing/leading Hole cannot be
    // re-entered when the parent block's selectStart/selectEnd recurses.
    return child;
  }

  return null;
}

/** Continue the same structural sibling walk as `$getDownUpNode` after a skipped block. */
function getNextHoleVerticalCandidate(
  node: LexicalNode,
  direction: HoleVerticalDirection,
): LexicalNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    const sibling = direction === 'up' ? current.getPreviousSibling() : current.getNextSibling();
    if (sibling) return sibling;

    const parent: LexicalNode | null = current.getParent();
    if (!parent || $isRootNode(parent) || ($isElementNode(parent) && parent.isShadowRoot())) {
      return null;
    }
    current = parent;
  }
  return null;
}

function getHoleVerticalNeighbor(
  point: PointType,
  direction: HoleVerticalDirection,
): LexicalNode | null {
  return walkHoleVerticalCandidates($getDownUpNode(point, direction === 'up'), direction);
}

function getHoleVerticalNeighborFromNode(
  node: LexicalNode,
  direction: HoleVerticalDirection,
): LexicalNode | null {
  return walkHoleVerticalCandidates($getDownUpNodeFromNode(node, direction === 'up'), direction);
}

function walkHoleVerticalCandidates(
  initial: LexicalNode | null,
  direction: HoleVerticalDirection,
): LexicalNode | null {
  let candidate = initial;
  while (candidate) {
    const target = getHoleVerticalSelectionTarget(candidate, direction);
    if (target) return target;
    candidate = getNextHoleVerticalCandidate(candidate, direction);
  }
  return null;
}

function handleHoleVerticalArrow(
  editor: LexicalEditor,
  event: KeyboardEvent,
  direction: HoleVerticalDirection,
): boolean {
  if (!shouldHandleNavigationEvent(editor, event)) return false;

  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const hole = getSelectedHole(selection);
    if (!hole) return false;

    const insideShadowRoot = isInsideShadowRoot(hole);
    const neighbor = getHoleVerticalNeighborFromNode(hole, direction);
    if (!neighbor) {
      // Table/Collapsible owners retain control when their local shadow-root
      // scope has no adjacent block. At a document endpoint Hole owns the
      // arrow and keeps the NodeSelection stable.
      if (insideShadowRoot) return false;
      event.preventDefault();
      return true;
    }

    $selectBlockEdge(neighbor, direction === 'up' ? 'end' : 'start');
    event.preventDefault();
    return true;
  }

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const context = getBoundaryContext(selection);
  if (!context) return false;

  const neighbor = getHoleVerticalNeighbor(selection.focus, direction);
  if (!neighbor) {
    // Let a table/collapsible owner handle its own shadow-root endpoint.
    if (isInsideShadowRoot(context.hole)) return false;
    event.preventDefault();
    return true;
  }

  $selectBlockEdge(neighbor, direction === 'up' ? 'end' : 'start');

  // A valid Hole boundary owns plain vertical arrows even at an edge. This
  // prevents CommonPlugin/native fallback from entering Hole payloads or
  // creating a paragraph when no editable block exists in that direction.
  event.preventDefault();
  return true;
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
  if (!shouldHandleNavigationEvent(editor, event, true)) return false;

  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    if (event.shiftKey) {
      const hole = getSelectedHole(selection);
      if (!hole) return false;
      const range = $createRangeSelection();
      if (direction === 'right') {
        $setAtomicHoleBoundaryPoint(range, 'before', hole, 'anchor');
        $setAtomicHoleBoundaryPoint(range, 'after', hole, 'focus');
      } else {
        $setAtomicHoleBoundaryPoint(range, 'after', hole, 'anchor');
        $setAtomicHoleBoundaryPoint(range, 'before', hole, 'focus');
      }
      $setSelection(range);
      event.preventDefault();
      return true;
    }
    if (handleSelectedHoleArrow(selection, direction)) {
      event.preventDefault();
      return true;
    }
    return false;
  }

  if (!$isRangeSelection(selection)) return false;
  if (event.shiftKey && extendRangeAcrossHole(selection, direction)) {
    event.preventDefault();
    return true;
  }
  if (event.shiftKey && getBoundaryPointContext(selection.focus)) {
    // There is no sibling in this direction. Keep the legal boundary point
    // and avoid falling through to the plain-arrow paragraph insertion path.
    event.preventDefault();
    return true;
  }

  if (!event.shiftKey && !selection.isCollapsed()) {
    const edge =
      direction === 'left'
        ? selection.isBackward()
          ? selection.focus
          : selection.anchor
        : selection.isBackward()
          ? selection.anchor
          : selection.focus;
    const edgeContext = $getAtomicHolePointContext(edge) || getBoundaryPointContext(edge);
    if (edgeContext) {
      $setAtomicHoleBoundaryPoint(selection, edgeContext.side, edgeContext.hole, 'anchor');
      $setAtomicHoleBoundaryPoint(selection, edgeContext.side, edgeContext.hole, 'focus');
      event.preventDefault();
      return true;
    }
  }

  const contentContext = selection.isCollapsed()
    ? $getAtomicHolePointContext(selection.anchor) || $getAtomicHolePointContext(selection.focus)
    : null;
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

  if (entersContent) {
    const content =
      side === 'before' ? hole.getContentChildren()[0] : hole.getContentChildren().at(-1);
    if (!content) return false;

    if (
      editor.dispatchCommand(ENTER_HOLE_CONTENT_COMMAND, {
        from: side,
        key: content.getKey(),
      })
    ) {
      // The target owns the accepted entry: Lexical targets select their
      // internal caret, while foreign editors move focus themselves. Keeping
      // this command free of a blanket `$setSelection(null)` is important for
      // both cases and lets a target reject the request without losing the
      // Hole boundary selection.
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

  const context = getBoundaryContext(selection) || getElementBoundaryContext(selection);
  if (context) {
    const { hole, side } = context;
    if (!hole.getParent()) {
      event?.preventDefault();
      return true;
    }

    // Enter is a user-visible structural boundary. Stop Yjs capture before this
    // paragraph is written so a preceding local Code insertion cannot share
    // its Undo item and be removed by the next Meta+Z.
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
  return false;
}

function getElementBoundaryContext(selection: RangeSelection): {
  hole: HoleNode;
  side: 'after' | 'before';
} | null {
  const point = selection.anchor;
  if (point.type !== 'element') return null;
  const parent = $getNodeByKey(point.key);
  if (!$isElementNode(parent)) return null;

  if ($isHoleNode(parent)) {
    const context = $getAtomicHolePointContext(point);
    return context ? { hole: parent, side: context.side } : null;
  }

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
