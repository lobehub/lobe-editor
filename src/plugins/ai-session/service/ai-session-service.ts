import EventEmitter from 'eventemitter3';
import {
  $getRoot,
  $isTextNode,
  type BaseSelection,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { $getNodeProperties, $setNodeProperties } from '@/plugins/properties/state';
import { $getSelectionNodes } from '@/plugins/properties/utils';
import { syncNodePropertiesToDOM } from '@/plugins/properties/utils-dom';

import type {
  AISessionHighlightKind,
  AISessionMark,
  AISessionRange,
  AISessionRangeInput,
} from '../types';
import {
  AI_SESSION_ACTIVE_CLASS,
  AI_SESSION_ACTIVE_HIGHLIGHT_NAME,
  AI_SESSION_HOVER_CLASS,
  AI_SESSION_HOVER_HIGHLIGHT_NAME,
} from '../types';
import type { IAISessionService } from './i-ai-session-service';

type AISessionServiceEvents = {
  change: () => void;
};

const isValidSessionId = (sessionId: unknown): sessionId is string =>
  typeof sessionId === 'string' && sessionId.trim().length > 0;

const normalizeMark = (mark: AISessionMark): AISessionMark => {
  if (!isValidSessionId(mark.sessionId)) {
    throw new Error('AISessionMark.sessionId must be a non-empty string.');
  }

  const normalized: AISessionMark = {
    sessionId: mark.sessionId,
  };
  if (typeof mark.requestId === 'string' && mark.requestId.length > 0) {
    normalized.requestId = mark.requestId;
  }
  if (Number.isSafeInteger(mark.turnIndex) && mark.turnIndex !== undefined && mark.turnIndex >= 0) {
    normalized.turnIndex = mark.turnIndex;
  }
  return normalized;
};

const getTextNodes = (nodes: ReadonlyArray<LexicalNode>): LexicalNode[] => {
  const textNodes: LexicalNode[] = [];
  const visit = (node: LexicalNode): void => {
    if ($isTextNode(node)) {
      textNodes.push(node);
      return;
    }
    if ('getChildren' in node && typeof node.getChildren === 'function') {
      node.getChildren().forEach(visit);
    }
  };
  nodes.forEach(visit);
  return textNodes;
};

const setSessionMark = (node: LexicalNode, mark: AISessionMark): void => {
  const normalized = normalizeMark(mark);
  $setNodeProperties(node, (previous) => ({
    ...previous,
    provenance: {
      ...previous.provenance,
      ...normalized,
      source: 'ai',
    },
  }));
};

const removeSessionMark = (node: LexicalNode, sessionId?: string): void => {
  const current = $getNodeProperties(node).provenance;
  if (current?.source !== 'ai') return;
  if (sessionId !== undefined && current.sessionId !== sessionId) return;

  $setNodeProperties(node, (previous) => {
    const next = { ...previous };
    delete next.provenance;
    return next;
  });
};

interface CSSHighlightRegistryLike {
  delete: (name: string) => boolean;
  set: (name: string, highlight: unknown) => unknown;
}

interface CSSHighlightConstructor {
  new (...ranges: Range[]): unknown;
}

interface BrowserWindowLike extends Window {
  CSS?: {
    highlights?: CSSHighlightRegistryLike;
  };
  Highlight?: CSSHighlightConstructor;
}

interface CSSHighlightSupport {
  constructor: CSSHighlightConstructor;
  registry: CSSHighlightRegistryLike;
}

interface OverlayRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

type RootElementOwner = {
  getRootElement?: () => HTMLElement | null;
};

const safeGetRootElement = (editor: RootElementOwner | null | undefined): HTMLElement | null => {
  try {
    return editor?.getRootElement?.() ?? null;
  } catch {
    // Headless and restricted Agent facades intentionally reject DOM access.
    return null;
  }
};

const getCSSHighlightSupport = (root: HTMLElement | null): CSSHighlightSupport | null => {
  const browserWindow = root?.ownerDocument.defaultView as BrowserWindowLike | null;
  const registry = browserWindow?.CSS?.highlights;
  const HighlightConstructor = browserWindow?.Highlight;
  if (!registry || !HighlightConstructor) return null;

  return { constructor: HighlightConstructor, registry };
};

const getDOMTextNodes = (element: HTMLElement): Text[] => {
  const textNodes: Text[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }
  return textNodes;
};

const compareDOMTextNodes = (left: Text, right: Text): number => {
  if (left === right) return 0;
  return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
};

const mergeOverlayRects = (rects: ReadonlyArray<DOMRect | DOMRectReadOnly>): OverlayRect[] => {
  const ordered = rects
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({ bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top }))
    .sort((left, right) => left.top - right.top || left.left - right.left);
  const merged: OverlayRect[] = [];

  for (const rect of ordered) {
    const previous = merged.at(-1);
    const sameLine =
      previous &&
      rect.left <= previous.right + 2 &&
      rect.top <= previous.bottom + 2 &&
      rect.bottom >= previous.top - 2;
    if (sameLine) {
      previous.bottom = Math.max(previous.bottom, rect.bottom);
      previous.left = Math.min(previous.left, rect.left);
      previous.right = Math.max(previous.right, rect.right);
      previous.top = Math.min(previous.top, rect.top);
    } else {
      merged.push({ ...rect });
    }
  }

  return merged;
};

export class AISessionService
  extends EventEmitter<AISessionServiceEvents>
  implements IAISessionService
{
  private activeSessionId: string | null = null;
  private editor: LexicalEditor | null = null;
  private fallbackElements = new Set<HTMLElement>();
  private highlightRegistry: CSSHighlightRegistryLike | null = null;
  private highlightOverlayContainer: HTMLElement | null = null;
  private highlightOverlayElements: HTMLElement[] = [];
  private layoutCleanup: (() => void) | null = null;
  private hoveredSessionId: string | null = null;

  bindEditor(editor: LexicalEditor): void {
    this.layoutCleanup?.();
    this.layoutCleanup = null;
    this.editor = editor;
    this.bindHighlightLayoutListeners();
    this.refresh();
  }

  applyAISessionMark(range: AISessionRangeInput, mark: AISessionMark): void {
    if (!this.editor) throw new Error('AISessionService is not bound to an editor.');
    const normalized = normalizeMark(mark);
    this.editor.update(() => {
      for (const node of getTextNodes($getSelectionNodes(range))) {
        setSessionMark(node, normalized);
      }
    });
  }

  removeAISessionMark(range: AISessionRangeInput): void {
    if (!this.editor) throw new Error('AISessionService is not bound to an editor.');
    this.editor.update(() => {
      for (const node of getTextNodes($getSelectionNodes(range))) removeSessionMark(node);
    });
  }

  clearAISessionMarks(sessionId?: string): void {
    if (!this.editor) throw new Error('AISessionService is not bound to an editor.');
    this.editor.update(() => {
      $getRoot()
        .getAllTextNodes()
        .forEach((node) => removeSessionMark(node, sessionId));
    });
  }

  getAISessionRanges(sessionId: string): AISessionRange[] {
    if (!this.editor || !isValidSessionId(sessionId)) return [];

    return this.editor.getEditorState().read(() => {
      const ranges: AISessionRange[] = [];
      for (const node of $getRoot().getAllTextNodes()) {
        const provenance = $getNodeProperties(node).provenance;
        if (provenance?.source !== 'ai' || provenance.sessionId !== sessionId) continue;

        const startOffset = 0;
        const endOffset = node.getTextContentSize();
        ranges.push({
          ...(provenance.requestId ? { requestId: provenance.requestId } : {}),
          ...(provenance.turnIndex !== undefined ? { turnIndex: provenance.turnIndex } : {}),
          end: endOffset,
          endOffset,
          key: node.getKey(),
          nodeKey: node.getKey(),
          sessionId,
          start: startOffset,
          startOffset,
          text: node.getTextContent(),
        });
      }
      return ranges;
    });
  }

  getRanges(sessionId: string): AISessionRange[] {
    return this.getAISessionRanges(sessionId);
  }

  getRangeBySessionId(sessionId: string): AISessionRange[] {
    return this.getAISessionRanges(sessionId);
  }

  setActiveSessionId(sessionId: string | null): void {
    this.setSessionHighlight('active', sessionId);
  }

  setHoveredSessionId(sessionId: string | null): void {
    this.setSessionHighlight('hover', sessionId);
  }

  focusSession(sessionId: string | null): void {
    this.setActiveSessionId(sessionId);
  }

  clearSessionFocus(): void {
    this.setActiveSessionId(null);
  }

  setSessionHighlight(kind: AISessionHighlightKind, sessionId: string | null): void {
    if (sessionId !== null && !isValidSessionId(sessionId)) {
      throw new Error('AISession highlight sessionId must be a non-empty string or null.');
    }
    if (kind === 'active') {
      if (this.activeSessionId === sessionId) return;
      this.activeSessionId = sessionId;
    } else {
      if (this.hoveredSessionId === sessionId) return;
      this.hoveredSessionId = sessionId;
    }
    this.refreshHighlights();
    this.emit('change');
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  getHoveredSessionId(): string | null {
    return this.hoveredSessionId;
  }

  private clearCSSHighlights(): void {
    const root = safeGetRootElement(this.editor);
    const currentRegistry = getCSSHighlightSupport(root)?.registry;
    const registries = new Set<CSSHighlightRegistryLike>();
    if (this.highlightRegistry) registries.add(this.highlightRegistry);
    if (currentRegistry) registries.add(currentRegistry);
    registries.forEach((registry) => {
      registry.delete(AI_SESSION_ACTIVE_HIGHLIGHT_NAME);
      registry.delete(AI_SESSION_HOVER_HIGHLIGHT_NAME);
    });
    this.highlightRegistry = null;
  }

  private clearFallbackHighlights(): void {
    for (const element of this.fallbackElements) {
      element.classList.remove(AI_SESSION_ACTIVE_CLASS, AI_SESSION_HOVER_CLASS);
      delete element.dataset.aiSessionActive;
      delete element.dataset.aiSessionHover;
    }
    this.fallbackElements.clear();
  }

  private clearHighlightDiagnostics(root: HTMLElement): void {
    delete root.dataset.aiActiveSessionId;
    delete root.dataset.aiHoverSessionId;
    delete root.dataset.aiHighlightRenderer;
  }

  private updateHighlightDiagnostics(
    root: HTMLElement,
    renderer: 'class' | 'css-highlight' | 'none' | 'overlay',
  ): void {
    if (this.activeSessionId) root.dataset.aiActiveSessionId = this.activeSessionId;
    else delete root.dataset.aiActiveSessionId;
    if (this.hoveredSessionId) root.dataset.aiHoverSessionId = this.hoveredSessionId;
    else delete root.dataset.aiHoverSessionId;
    root.dataset.aiHighlightRenderer = renderer;
  }

  private clearHighlightOverlays(): void {
    this.highlightOverlayElements.forEach((element) => element.remove());
    this.highlightOverlayElements = [];
    this.highlightOverlayContainer?.remove();
    this.highlightOverlayContainer = null;
  }

  private bindHighlightLayoutListeners(): void {
    const root = safeGetRootElement(this.editor);
    const browserWindow = root?.ownerDocument.defaultView;
    if (!root || !browserWindow) return;

    const refresh = () => this.refreshHighlights();
    browserWindow.addEventListener('resize', refresh);
    browserWindow.addEventListener('scroll', refresh, true);

    const resizeObserver =
      typeof browserWindow.ResizeObserver === 'function'
        ? new browserWindow.ResizeObserver(refresh)
        : null;
    resizeObserver?.observe(root);

    const mutationObserver =
      typeof browserWindow.MutationObserver === 'function'
        ? new browserWindow.MutationObserver(refresh)
        : null;
    mutationObserver?.observe(root, {
      attributes: true,
      attributeFilter: ['data-ai-session-id'],
      childList: true,
      subtree: true,
    });

    this.layoutCleanup = () => {
      browserWindow.removeEventListener('resize', refresh);
      browserWindow.removeEventListener('scroll', refresh, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }

  private getHighlightOverlayHost(root: HTMLElement): HTMLElement {
    return root.parentElement ?? root.ownerDocument.body ?? root.ownerDocument.documentElement;
  }

  private ensureHighlightOverlayContainer(root: HTMLElement): HTMLElement {
    const host = this.getHighlightOverlayHost(root);
    if (this.highlightOverlayContainer?.parentElement === host) return this.highlightOverlayContainer;

    this.clearHighlightOverlays();
    const container = root.ownerDocument.createElement('div');
    container.className = root.className;
    container.dataset.aiSessionHighlightOverlay = 'true';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';
    container.style.position = 'absolute';
    container.style.zIndex = '1';
    host.append(container);
    this.highlightOverlayContainer = container;
    return container;
  }

  private renderHighlightOverlay(
    root: HTMLElement,
    sessionId: string | null,
    kind: AISessionHighlightKind,
  ): boolean {
    if (!sessionId) return false;
    const range = this.getSessionDOMRange(sessionId);
    if (!range || typeof range.getClientRects !== 'function') return false;

    const rects = mergeOverlayRects(Array.from(range.getClientRects()));
    if (rects.length === 0) return false;

    const container = this.ensureHighlightOverlayContainer(root);
    const hostRect = this.getHighlightOverlayHost(root).getBoundingClientRect();
    const host = this.getHighlightOverlayHost(root);
    const overlayGroup = root.ownerDocument.createElement('span');
    overlayGroup.dataset.aiSessionHighlightKind = kind;
    for (const rect of rects) {
      const overlay = root.ownerDocument.createElement('span');
      overlay.className = 'ai-session-highlight-overlay';
      overlay.dataset.aiSessionHighlightKind = kind;
      overlay.style.pointerEvents = 'none';
      overlay.style.left = `${rect.left - hostRect.left + host.scrollLeft}px`;
      overlay.style.top = `${rect.top - hostRect.top + host.scrollTop}px`;
      overlay.style.width = `${Math.max(0, rect.right - rect.left)}px`;
      overlay.style.height = `${Math.max(0, rect.bottom - rect.top)}px`;
      overlay.style.position = 'absolute';
      overlayGroup.append(overlay);
      this.highlightOverlayElements.push(overlay);
    }
    container.append(overlayGroup);
    return true;
  }

  private getSessionDOMTextNodes(
    root: HTMLElement,
    sessionId: string,
    ranges: ReadonlyArray<AISessionRange>,
  ): Text[] {
    const lexicalElements = ranges
      .map((range) => this.editor?.getElementByKey(range.nodeKey || range.key) ?? null)
      .filter((element): element is HTMLElement => Boolean(element && root.contains(element)));
    const markedElements = Array.from(
      root.querySelectorAll<HTMLElement>('[data-ai-session-id]'),
    ).filter((element) => element.dataset.aiSessionId === sessionId);
    const elements = lexicalElements.length > 0 ? lexicalElements : markedElements;
    const seen = new Set<Text>();
    const textNodes: Text[] = [];
    for (const element of elements) {
      for (const textNode of getDOMTextNodes(element)) {
        if (seen.has(textNode)) continue;
        seen.add(textNode);
        textNodes.push(textNode);
      }
    }
    textNodes.sort(compareDOMTextNodes);
    return textNodes;
  }

  private getSessionDOMRange(sessionId: string): Range | null {
    if (!this.editor || !isValidSessionId(sessionId)) return null;
    const root = safeGetRootElement(this.editor);
    if (!root) return null;

    const ranges = this.getAISessionRanges(sessionId);
    if (ranges.length === 0) return null;
    const textNodes = this.getSessionDOMTextNodes(root, sessionId, ranges);
    if (textNodes.length === 0) return null;

    const first = textNodes[0];
    const last = textNodes.at(-1)!;
    try {
      const range = root.ownerDocument.createRange();
      range.setStart(first, 0);
      range.setEnd(last, last.data.length);
      return range;
    } catch {
      return null;
    }
  }

  private applyCSSHighlight(
    registry: CSSHighlightRegistryLike,
    HighlightConstructor: CSSHighlightConstructor,
    name: string,
    sessionId: string | null,
  ): boolean {
    if (!sessionId) return false;
    const range = this.getSessionDOMRange(sessionId);
    if (!range) return false;
    registry.set(name, new HighlightConstructor(range));
    this.highlightRegistry = registry;
    return true;
  }

  private applyFallbackHighlights(root: HTMLElement): void {
    const elements = root.querySelectorAll<HTMLElement>('[data-ai-session-id]');
    for (const element of elements) {
      const sessionId = element.dataset.aiSessionId;
      if (!sessionId) continue;
      const isActive = sessionId === this.activeSessionId;
      const isHovered = sessionId === this.hoveredSessionId;
      if (!isActive && !isHovered) continue;
      element.classList.toggle(AI_SESSION_ACTIVE_CLASS, isActive);
      element.classList.toggle(AI_SESSION_HOVER_CLASS, isHovered);
      if (isActive) element.dataset.aiSessionActive = 'true';
      if (isHovered) element.dataset.aiSessionHover = 'true';
      this.fallbackElements.add(element);
    }
  }

  refresh(): void {
    if (this.editor) syncNodePropertiesToDOM(this.editor);
    this.refreshHighlights();
    this.emit('change');
  }

  refreshHighlights(): void {
    const root = safeGetRootElement(this.editor);
    this.clearCSSHighlights();
    this.clearFallbackHighlights();
    this.clearHighlightOverlays();
    if (!root) return;

    const support = getCSSHighlightSupport(root);
    if (support) {
      const activeHighlight = this.applyCSSHighlight(
        support.registry,
        support.constructor,
        AI_SESSION_ACTIVE_HIGHLIGHT_NAME,
        this.activeSessionId,
      );
      const hoverHighlight = this.applyCSSHighlight(
        support.registry,
        support.constructor,
        AI_SESSION_HOVER_HIGHLIGHT_NAME,
        this.hoveredSessionId,
      );
      this.updateHighlightDiagnostics(
        root,
        activeHighlight || hoverHighlight ? 'css-highlight' : 'none',
      );
      return;
    }

    const activeOverlay = this.renderHighlightOverlay(root, this.activeSessionId, 'active');
    const hoverOverlay = this.renderHighlightOverlay(root, this.hoveredSessionId, 'hover');
    const hasOverlay = activeOverlay || hoverOverlay;
    if (hasOverlay) {
      this.updateHighlightDiagnostics(root, 'overlay');
      return;
    }

    this.applyFallbackHighlights(root);
    this.updateHighlightDiagnostics(root, this.fallbackElements.size > 0 ? 'class' : 'none');
  }

  subscribe(listener: () => void): () => void {
    this.on('change', listener);
    return () => this.off('change', listener);
  }

  destroy(): void {
    this.layoutCleanup?.();
    this.layoutCleanup = null;
    this.clearCSSHighlights();
    this.clearFallbackHighlights();
    this.clearHighlightOverlays();
    const root = safeGetRootElement(this.editor);
    if (root) this.clearHighlightDiagnostics(root);
    this.activeSessionId = null;
    this.editor = null;
    this.hoveredSessionId = null;
    this.removeAllListeners();
  }
}

/** Low-level utility for code already running inside `editor.update`. */
export const $applyAISessionMark = (
  range: BaseSelection,
  mark: AISessionMark,
): number => {
  const normalized = normalizeMark(mark);
  const nodes = getTextNodes($getSelectionNodes(range));
  for (const node of nodes) setSessionMark(node, normalized);
  return nodes.length;
};

/** Low-level utility for code already running inside `editor.update`. */
export const $removeAISessionMark = (range: BaseSelection): number => {
  const nodes = getTextNodes($getSelectionNodes(range));
  for (const node of nodes) removeSessionMark(node);
  return nodes.length;
};
