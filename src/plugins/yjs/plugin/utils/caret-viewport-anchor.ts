import { $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical';

interface ScrollableAncestorSnapshot {
  target: HTMLElement;
  scrollTop: number;
}

export interface CaretViewportAnchor {
  beginCompensation: () => void;
  caretTop: number;
  cleanup: () => void;
  endCompensation: () => void;
  root: HTMLElement;
  scrollableAncestors: ScrollableAncestorSnapshot[];
  userScrolled: () => boolean;
  view: Window | null;
}

export interface RemoteCaretViewportStabilizer {
  cancelPending: () => void;
  captureBeforeRemoteUpdate: () => void;
  dispose: () => void;
  scheduleAfterRemoteUpdate: () => void;
}

const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'overlay', 'scroll']);
const CARET_DELTA_EPSILON = 0.5;

const getOverflowY = (element: HTMLElement): string => {
  const view = element.ownerDocument.defaultView;
  if (!view) return '';

  const style = view.getComputedStyle(element);
  return style.overflowY || style.overflow;
};

const hasScrollableExtent = (element: HTMLElement): boolean =>
  element.scrollHeight > element.clientHeight || element.scrollTop !== 0;

const isScrollableAncestor = (element: HTMLElement): boolean => {
  if (!SCROLLABLE_OVERFLOW_VALUES.has(getOverflowY(element))) return false;

  return hasScrollableExtent(element);
};

/** Return nearest-first so the local editor viewport is compensated first. */
const getScrollableAncestors = (root: HTMLElement): HTMLElement[] => {
  const ancestors: HTMLElement[] = [];

  for (let element: HTMLElement | null = root; element; element = element.parentElement) {
    if (isScrollableAncestor(element)) ancestors.push(element);
  }

  const scrollingElement = root.ownerDocument.scrollingElement;
  // The document viewport scrolls through scrollingElement even when
  // html/body keep their default `overflow: visible` styles.
  if (
    scrollingElement instanceof HTMLElement &&
    !ancestors.includes(scrollingElement) &&
    hasScrollableExtent(scrollingElement)
  ) {
    ancestors.push(scrollingElement);
  }

  return ancestors;
};

const isNodeInsideRoot = (root: HTMLElement, node: Node): boolean => {
  return node === root || root.contains(node);
};

const isLogicalCollapsedSelection = (editor: LexicalEditor): boolean =>
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    return $isRangeSelection(selection) && selection.isCollapsed();
  });

const getNativeCaretTop = (root: HTMLElement): number | null => {
  const view = root.ownerDocument.defaultView;
  if (!view) return null;

  const selection = view.getSelection();
  if (!selection || selection.rangeCount !== 1 || !selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (
    !isNodeInsideRoot(root, range.commonAncestorContainer) ||
    !isNodeInsideRoot(root, range.startContainer) ||
    !isNodeInsideRoot(root, range.endContainer)
  ) {
    return null;
  }

  try {
    const rect = range.getBoundingClientRect?.();
    const firstRect = range.getClientRects?.()[0];

    // Some browsers report an all-zero collapsed Range while exposing the
    // usable caret line through getClientRects().
    if (
      rect &&
      Number.isFinite(rect.top) &&
      (rect.top !== 0 || rect.bottom !== 0 || rect.left !== 0 || rect.right !== 0)
    ) {
      return rect.top;
    }
    if (firstRect && Number.isFinite(firstRect.top)) return firstRect.top;
    return rect && Number.isFinite(rect.top) ? rect.top : null;
  } catch {
    return null;
  }
};

const readFocusedCollapsedCaretTop = (
  editor: LexicalEditor,
): { root: HTMLElement; top: number } | null => {
  if (!editor.isEditable()) return null;

  let root: HTMLElement | null;
  try {
    root = editor.getRootElement();
  } catch {
    // Headless Lexical editors intentionally do not expose a DOM root.
    return null;
  }
  if (!root) return null;

  const activeElement = root.ownerDocument.activeElement;
  if (!activeElement || !isNodeInsideRoot(root, activeElement)) return null;
  if (!isLogicalCollapsedSelection(editor)) return null;

  const top = getNativeCaretTop(root);
  return top === null ? null : { root, top };
};

/**
 * Capture the focused local caret's viewport Y coordinate before an external
 * Yjs update. This function only observes DOM/editor state and never changes
 * the logical selection or focus.
 */
export const captureCaretViewportAnchor = (editor: LexicalEditor): CaretViewportAnchor | null => {
  const caret = readFocusedCollapsedCaretTop(editor);
  if (!caret) return null;

  const view = caret.root.ownerDocument.defaultView;
  const scrollableAncestors = getScrollableAncestors(caret.root).map((target) => ({
    target,
    scrollTop: target.scrollTop,
  }));
  if (scrollableAncestors.length === 0) return null;

  let userScrolled = false;
  let isCompensating = false;
  const markUserScrolled = () => {
    if (!isCompensating) userScrolled = true;
  };
  scrollableAncestors.forEach(({ target }) => {
    target.addEventListener('scroll', markUserScrolled, { passive: true });
  });
  view?.addEventListener('scroll', markUserScrolled, { passive: true, capture: true });

  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    scrollableAncestors.forEach(({ target }) => {
      target.removeEventListener('scroll', markUserScrolled);
    });
    view?.removeEventListener('scroll', markUserScrolled, true);
  };

  return {
    beginCompensation: () => {
      isCompensating = true;
    },
    caretTop: caret.top,
    cleanup,
    endCompensation: () => {
      isCompensating = false;
    },
    root: caret.root,
    scrollableAncestors,
    userScrolled: () => userScrolled,
    view,
  };
};

const applyScrollDelta = (anchor: CaretViewportAnchor, delta: number): void => {
  let remainingDelta = delta;

  // Ancestors are nearest-first. Passing only the unconsumed remainder outward
  // avoids moving an outer page when the editor's own viewport can absorb it.
  anchor.beginCompensation();
  try {
    for (const snapshot of anchor.scrollableAncestors) {
      if (Math.abs(remainingDelta) <= CARET_DELTA_EPSILON) break;

      const { target } = snapshot;
      const before = target.scrollTop;
      const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight);
      const nextScrollTop = Math.min(maxScrollTop, Math.max(0, before + remainingDelta));
      target.scrollTop = nextScrollTop;
      remainingDelta -= target.scrollTop - before;
    }
  } finally {
    anchor.endCompensation();
  }
};

const getCurrentCaretTop = (editor: LexicalEditor, expectedRoot: HTMLElement): number | null => {
  const current = readFocusedCollapsedCaretTop(editor);
  return current?.root === expectedRoot ? current.top : null;
};

/**
 * Re-anchor after Lexical has committed its DOM. It compensates only the
 * viewport delta and never calls focus(), select(), or scrollIntoView().
 */
export const restoreCaretViewportAnchor = (
  editor: LexicalEditor,
  anchor: CaretViewportAnchor | null,
): void => {
  if (!anchor) return;

  try {
    if (anchor.userScrolled()) return;

    const currentCaretTop = getCurrentCaretTop(editor, anchor.root);
    if (currentCaretTop === null) return;

    const delta = currentCaretTop - anchor.caretTop;
    if (!Number.isFinite(delta) || Math.abs(delta) <= CARET_DELTA_EPSILON) return;

    applyScrollDelta(anchor, delta);
  } finally {
    anchor.cleanup();
  }
};

const requestFrame = (anchor: CaretViewportAnchor, callback: FrameRequestCallback) => {
  if (anchor.view && typeof anchor.view.requestAnimationFrame === 'function') {
    return {
      cancel: (handle: number) => anchor.view!.cancelAnimationFrame(handle),
      handle: anchor.view.requestAnimationFrame(callback),
    };
  }

  return {
    cancel: (handle: number) => clearTimeout(handle),
    handle: setTimeout(() => callback(Date.now()), 0) as unknown as number,
  };
};

/**
 * Keep the first remote transaction's baseline until the next paint. Agent
 * streaming may deliver several Yjs chunks in one frame; later chunks must not
 * overwrite the first viewport anchor.
 */
export const createRemoteCaretViewportStabilizer = (
  editor: LexicalEditor,
): RemoteCaretViewportStabilizer => {
  let pendingAnchor: CaretViewportAnchor | null = null;
  let frameHandle: number | null = null;
  let cancelFrame: ((handle: number) => void) | null = null;
  let disposed = false;

  const cancelPending = () => {
    if (frameHandle !== null) {
      cancelFrame?.(frameHandle);
      frameHandle = null;
      cancelFrame = null;
    }
    pendingAnchor?.cleanup();
    pendingAnchor = null;
  };

  const captureBeforeRemoteUpdate = () => {
    if (disposed || pendingAnchor) return;
    pendingAnchor = captureCaretViewportAnchor(editor);
  };

  const scheduleAfterRemoteUpdate = () => {
    if (disposed || !pendingAnchor || frameHandle !== null) return;

    const scheduled = requestFrame(pendingAnchor, () => {
      frameHandle = null;
      cancelFrame = null;
      const anchor = pendingAnchor;
      pendingAnchor = null;
      if (!disposed) restoreCaretViewportAnchor(editor, anchor);
      else anchor?.cleanup();
    });
    frameHandle = scheduled.handle;
    cancelFrame = scheduled.cancel;
  };

  return {
    cancelPending,
    captureBeforeRemoteUpdate,
    dispose: () => {
      disposed = true;
      cancelPending();
    },
    scheduleAfterRemoteUpdate,
  };
};
