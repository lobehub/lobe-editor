import type { LexicalEditor } from 'lexical';

import { BLOCK_ID_ATTRIBUTE } from '@/plugins/block/constants';

import { $getNodeProperties } from './state';

/** A minimal Lexical editor shape used by the DOM measurement helpers. */
export type AnnotationDOMEditor = Pick<LexicalEditor, 'getElementByKey'>;

export interface AnnotationDOMTarget {
  id: string;
  nodeKeys?: ReadonlyArray<string>;
}

export interface AnnotationAnchorMeasurement {
  /** The first DOM element belonging to the annotation, ordered top-to-bottom. */
  element: HTMLElement;
  /** All unique DOM elements contributing to this annotation anchor. */
  elements: HTMLElement[];
  /** Top edge in editor-root content coordinates, independent of scroll position. */
  anchorY: number;
  /**
   * Stable semantic anchor identity for annotations in the same editor block.
   *
   * This deliberately uses the nearest `[data-block-id]` ancestor rather than
   * Lexical text-node keys: range annotations split their boundary TextNodes
   * when created, so those keys are not a durable grouping identity.
   */
  anchorGroupKey?: string;
  /** Union height of the contributing DOM rects in editor-root content coordinates. */
  height: number;
}

// A Lexical key is only unique within an editor instance. Keep the root part of
// the grouping identity so two editor surfaces cannot accidentally share a
// block id, while avoiding a DOM mutation just for measurement metadata.
const annotationRootIdentities = new WeakMap<HTMLElement, string>();
let nextAnnotationRootIdentity = 1;

function getAnnotationRootIdentity(root: HTMLElement): string {
  const existing = annotationRootIdentities.get(root);
  if (existing) return existing;

  const identity = `root-${nextAnnotationRootIdentity++}`;
  annotationRootIdentities.set(root, identity);
  return identity;
}

function getClosestSemanticBlock(element: HTMLElement, root: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current && current !== root) {
    if (current.hasAttribute('data-block-id') && current.dataset.blockId) return current;
    current = current.parentElement;
  }
  return null;
}

/** Resolve a business node key to its visual block wrapper when one exists. */
export function getBlockElementByNodeKey(
  root: HTMLElement,
  nodeKey: string,
): HTMLElement | null {
  const attributeNames = [BLOCK_ID_ATTRIBUTE] as const;
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    for (const attributeName of attributeNames) {
      try {
        const match = root.querySelector<HTMLElement>(
          `[${attributeName}="${CSS.escape(nodeKey)}"]`,
        );
        if (match) return match;
      } catch {
        // Fall through to an exact attribute comparison below.
      }
    }
  }

  for (const attributeName of attributeNames) {
    const match = Array.from(root.querySelectorAll<HTMLElement>(`[${attributeName}]`)).find(
      (element) => element.getAttribute(attributeName) === nodeKey,
    );
    if (match) return match;
  }
  return null;
}

const clearNodePropertiesFromDOM = (element: HTMLElement): void => {
  delete element.dataset.annotationIds;
  delete element.dataset.annotation;
  delete element.dataset.annotationScope;
  delete element.dataset.provenance;
  delete element.dataset.aiGenerated;
  delete element.dataset.aiSessionId;
  delete element.dataset.aiRequestId;
  delete element.dataset.aiTurnIndex;
  delete element.dataset.aiSessionActive;
  delete element.dataset.aiSessionHover;
  element.classList.remove('ai-session-active', 'ai-session-hover');
};

/** Synchronizes state-backed metadata to DOM without changing Lexical node implementations. */
export function syncNodePropertiesToDOM(editor: LexicalEditor): void {
  let root: HTMLElement | null;
  try {
    root = editor.getRootElement();
    if (!root) return;
  } catch {
    // @lexical/headless intentionally throws for DOM accessors.
    return;
  }

  const desired = new Map<
    HTMLElement,
    {
      annotationIds: Set<string>;
      block: boolean;
      provenanceAI: boolean;
      provenanceRequestIds: Set<string>;
      provenanceSessionIds: Set<string>;
      provenanceTurnIndexes: Set<number>;
    }
  >();

  editor.getEditorState().read(() => {
    editor.getEditorState()._nodeMap.forEach((node) => {
      const directElement = editor.getElementByKey(node.getKey());
      const blockElement = getBlockElementByNodeKey(root!, node.getKey());
      const element = blockElement ?? directElement;
      if (!element || !root!.contains(element)) return;

      const properties = $getNodeProperties(node);
      const annotationIds = properties.annotationIds ?? [];
      const provenance = properties.provenance;
      const provenanceAI = provenance?.source === 'ai';
      if (annotationIds.length === 0 && !provenanceAI) return;

      const entry = desired.get(element) ?? {
        annotationIds: new Set<string>(),
        block: Boolean(blockElement),
        provenanceAI: false,
        provenanceRequestIds: new Set<string>(),
        provenanceSessionIds: new Set<string>(),
        provenanceTurnIndexes: new Set<number>(),
      };
      annotationIds.forEach((id) => entry.annotationIds.add(id));
      entry.block ||= Boolean(blockElement);
      entry.provenanceAI ||= provenanceAI;
      if (provenanceAI && provenance?.sessionId) {
        entry.provenanceSessionIds.add(provenance.sessionId);
      }
      if (provenanceAI && provenance?.requestId) {
        entry.provenanceRequestIds.add(provenance.requestId);
      }
      if (provenanceAI && provenance?.turnIndex !== undefined) {
        entry.provenanceTurnIndexes.add(provenance.turnIndex);
      }
      desired.set(element, entry);
    });
  });

  const managedSelector =
    '[data-annotation-ids], [data-annotation="true"], [data-annotation-scope], [data-provenance], [data-ai-generated], [data-ai-session-id], [data-ai-request-id], [data-ai-turn-index], [data-ai-session-active], [data-ai-session-hover]';
  if (root.matches(managedSelector)) clearNodePropertiesFromDOM(root);
  root
    .querySelectorAll<HTMLElement>(managedSelector)
    .forEach(clearNodePropertiesFromDOM);

  desired.forEach(
    (
      {
        annotationIds,
        block,
        provenanceAI,
        provenanceRequestIds,
        provenanceSessionIds,
        provenanceTurnIndexes,
      },
      element,
    ) => {
    if (annotationIds.size > 0) {
      element.dataset.annotationIds = [...annotationIds].join(',');
      element.dataset.annotation = 'true';
      element.dataset.annotationScope = block ? 'block' : 'range';
    }
    if (provenanceAI) {
      element.dataset.provenance = 'ai';
      element.dataset.aiGenerated = 'true';
    }
    if (provenanceSessionIds.size === 1) {
      element.dataset.aiSessionId = [...provenanceSessionIds][0];
    }
    if (provenanceRequestIds.size === 1) {
      element.dataset.aiRequestId = [...provenanceRequestIds][0];
    }
    if (provenanceTurnIndexes.size === 1) {
      element.dataset.aiTurnIndex = String([...provenanceTurnIndexes][0]);
    }
  },
  );
}

export function getAnnotationIdsFromDOM(element: Element): string[] {
  const value = element.getAttribute('data-annotation-ids');
  return value ? value.split(',').filter(Boolean) : [];
}

export function $isAnnotationNode(element: Element): boolean {
  return element.hasAttribute('data-annotation-ids');
}

/**
 * Finds the nearest element (or ancestor) that owns scrolling for an editor surface.
 *
 * This intentionally does not fall back to `window`: editor pages commonly place the editor in
 * a nested pane, and synchronizing against the viewport would make the rail drift as soon as the
 * pane itself is scrolled.
 */
export function findNearestScrollContainer(element: Element | null): HTMLElement | null {
  const isHTMLElement = typeof HTMLElement !== 'undefined' && element instanceof HTMLElement;
  let current = isHTMLElement ? (element as HTMLElement) : (element?.parentElement ?? null);

  while (current) {
    const style = typeof window === 'undefined' ? null : window.getComputedStyle(current);
    const overflowY = [style?.overflowY, current.style.overflowY, current.style.overflow].join(' ');
    const overflowX = [style?.overflowX, current.style.overflowX, current.style.overflow].join(' ');
    const isScrollable = /(?:auto|scroll|overlay)/.test(`${overflowY} ${overflowX}`);

    if (isScrollable) return current;
    current = current.parentElement;
  }

  return null;
}

/**
 * Returns DOM nodes that represent an annotation. Node keys are preferred because they remain
 * precise for a range annotation; the data attribute is the fallback for hydrated/collaborative
 * records where the Lexical node map may not have been exposed to the host.
 */
export function getAnnotationElementsFromDOM(
  root: HTMLElement,
  target: AnnotationDOMTarget,
  lexicalEditor?: AnnotationDOMEditor | null,
): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const add = (element: Element | null | undefined) => {
    if (!(element instanceof HTMLElement) || !root.contains(element) || seen.has(element)) return;
    seen.add(element);
    elements.push(element);
  };

  for (const nodeKey of target.nodeKeys ?? []) {
    add(
      getBlockElementByNodeKey(root, nodeKey) ??
        lexicalEditor?.getElementByKey(nodeKey) ??
        null,
    );
  }

  // Always include the attribute match as well. Overlapping range/block annotations can have
  // different DOM nodes for the same id, and the top-most one is the stable document anchor.
  // This also handles records arriving from Yjs before the corresponding Lexical node key is
  // available to a host.
  for (const element of root.querySelectorAll<HTMLElement>('[data-annotation-ids]')) {
    if (getAnnotationIdsFromDOM(element).includes(target.id)) add(element);
  }

  return elements;
}

/**
 * Measures an annotation's top edge relative to the editor root's content box.
 *
 * `getBoundingClientRect()` values are viewport-relative. Subtracting the root rect cancels any
 * outer pane scroll; adding root.scrollTop handles the less common case where the root itself is
 * the scroll container. This keeps `anchorY` stable while either the document or rail scrolls.
 */
export function measureAnnotationAnchor(
  root: HTMLElement,
  target: AnnotationDOMTarget,
  lexicalEditor?: AnnotationDOMEditor | null,
): AnnotationAnchorMeasurement | null {
  const elements = getAnnotationElementsFromDOM(root, target, lexicalEditor);
  if (elements.length === 0) return null;

  const rootRect = root.getBoundingClientRect();
  const rects = elements.flatMap((element) => {
    const clientRects = Array.from(element.getClientRects());
    return clientRects.length > 0 ? clientRects : [element.getBoundingClientRect()];
  });
  if (rects.length === 0) return null;

  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const rootScrollTop = root.scrollTop || 0;
  const rootClientTop = root.clientTop || 0;
  const anchorY = top - rootRect.top + rootScrollTop - rootClientTop;
  const orderedElements = [...elements].sort(
    (left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top,
  );
  const firstElement = orderedElements[0];
  // An annotation can contribute several split text nodes. Pick the first
  // contributing node's nearest semantic block, but keep looking if that node
  // was hydrated outside a block wrapper while another contributing node was
  // mounted correctly. Never treat the editor root itself as a block.
  const blockElement = orderedElements
    .map((element) => getClosestSemanticBlock(element, root))
    .find((element): element is HTMLElement => Boolean(element));
  const blockId = blockElement?.dataset.blockId;

  return {
    anchorY,
    anchorGroupKey: blockId ? `block:${getAnnotationRootIdentity(root)}:${blockId}` : undefined,
    element: firstElement,
    elements,
    height: Math.max(0, bottom - top),
  };
}

/** Converts a viewport rect (for example AnnotationComposerContext.rect) to editor coordinates. */
export function getEditorDocumentY(root: HTMLElement, rect: Pick<DOMRectReadOnly, 'top'>): number {
  const rootRect = root.getBoundingClientRect();
  return rect.top - rootRect.top + (root.scrollTop || 0) - (root.clientTop || 0);
}

/**
 * Returns the document Y at the top edge of the editor's current scroll viewport.
 *
 * This is deliberately different from `getEditorDocumentY(root, rootRect)`: when
 * the root is inside a scrolling pane, the pane viewport may be above the root's
 * current rect after scrolling. It is the safe last-resort anchor for a composer
 * whose native range and saved Lexical nodes are both unavailable.
 */
export function getEditorViewportY(
  root: HTMLElement,
  scrollContainer?: Pick<HTMLElement, 'getBoundingClientRect'> | null,
): number {
  const rootRect = root.getBoundingClientRect();
  const viewportTop = scrollContainer?.getBoundingClientRect().top ?? rootRect.top;
  return viewportTop - rootRect.top + (root.scrollTop || 0) - (root.clientTop || 0);
}
