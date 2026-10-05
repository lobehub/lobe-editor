'use client';

import type { LexicalEditor } from 'lexical';
import type { FC } from 'react';
import { useRef } from 'react';

import {
  type CollaborationAnchor,
  type CollaborationPresenceSnapshot,
  type CollaborationResolvedPoint,
  type CollaborationService,
  ICollaborationService,
} from '@/common/collaboration';
import { useLexicalComposerContext, useLexicalEditor } from '@/editor-kernel/react';
import type { ILocaleKeys } from '@/types';

import {
  type CollaborationCursorLabelFormatter,
  ensureCollaborationAgentCursorStyles,
  formatCollaborationCursorLabel,
} from '../../collaboration/cursor-label';

interface PresencePayload {
  anchor?: CollaborationAnchor | null;
  focus?: CollaborationAnchor | null;
  state?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readPayload = (value: unknown): PresencePayload | null => {
  if (!isRecord(value)) return null;
  return {
    ...(value.anchor === null || isRecord(value.anchor)
      ? { anchor: value.anchor as CollaborationAnchor | null }
      : {}),
    ...(value.focus === null || isRecord(value.focus)
      ? { focus: value.focus as CollaborationAnchor | null }
      : {}),
    ...(Object.hasOwn(value, 'state') ? { state: value.state } : {}),
  };
};

const readDisplay = (
  value: unknown,
): { color: string; name: string; role?: string; status?: string } => {
  const record = isRecord(value) ? value : {};
  const nested = isRecord(record.state) ? record.state : record;
  const state = isRecord(nested.state) ? nested.state : nested;
  const awarenessData = isRecord(state.awarenessData) ? state.awarenessData : state;
  const role =
    typeof state.role === 'string'
      ? state.role
      : typeof awarenessData.role === 'string'
        ? awarenessData.role
        : undefined;
  return {
    color: typeof state.color === 'string' && state.color.length > 0 ? state.color : '#7c3aed',
    name:
      typeof state.name === 'string' && state.name.length > 0
        ? state.name
        : role === 'agent'
          ? 'AI Agent'
          : 'Collaborator',
    ...(role ? { role } : {}),
    ...(typeof awarenessData.status === 'string'
      ? { status: awarenessData.status }
      : typeof state.status === 'string'
        ? { status: state.status }
        : {}),
  };
};

const getTextNode = (element: HTMLElement): Text | null => {
  if (element.nodeType === Node.TEXT_NODE) return element as unknown as Text;
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
};

const toDOMPoint = (
  lexicalEditor: LexicalEditor,
  point: CollaborationResolvedPoint,
): { node: Node; offset: number } | null => {
  const element = lexicalEditor.getElementByKey(point.key);
  if (!element) return null;
  if (point.type === 'text') {
    const text = getTextNode(element);
    if (!text) return null;
    return { node: text, offset: Math.max(0, Math.min(point.offset, text.data.length)) };
  }
  return { node: element, offset: Math.max(0, Math.min(point.offset, element.childNodes.length)) };
};

const createRange = (
  lexicalEditor: LexicalEditor,
  anchor: CollaborationResolvedPoint,
  focus: CollaborationResolvedPoint,
): Range | null => {
  const anchorPoint = toDOMPoint(lexicalEditor, anchor);
  const focusPoint = toDOMPoint(lexicalEditor, focus);
  const document = lexicalEditor.getRootElement()?.ownerDocument;
  if (!anchorPoint || !focusPoint || !document) return null;
  try {
    const range = document.createRange();
    const order = compareDOMPoints(anchorPoint, focusPoint);
    const start = order <= 0 ? anchorPoint : focusPoint;
    const end = order <= 0 ? focusPoint : anchorPoint;
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range;
  } catch {
    return null;
  }
};

const compareDOMPoints = (
  left: { node: Node; offset: number },
  right: { node: Node; offset: number },
): number => {
  if (left.node === right.node) return left.offset - right.offset;
  if (left.node.contains(right.node)) {
    const child = directChild(left.node, right.node);
    if (child) {
      const childIndex = Array.prototype.indexOf.call(left.node.childNodes, child) as number;
      return left.offset <= childIndex ? -1 : 1;
    }
  }
  if (right.node.contains(left.node)) {
    const child = directChild(right.node, left.node);
    if (child) {
      const childIndex = Array.prototype.indexOf.call(right.node.childNodes, child) as number;
      return right.offset <= childIndex ? 1 : -1;
    }
  }
  const relation = left.node.compareDocumentPosition(right.node);
  if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
};

const directChild = (ancestor: Node, descendant: Node): Node | null => {
  let child: Node | null = descendant;
  while (child?.parentNode && child.parentNode !== ancestor) child = child.parentNode;
  return child?.parentNode === ancestor ? child : null;
};

const clearLayer = (layer: HTMLElement): void => {
  while (layer.firstChild) layer.firstChild.remove();
};

const renderPresence = (
  lexicalEditor: LexicalEditor,
  service: CollaborationService,
  presence: ReadonlyMap<string, CollaborationPresenceSnapshot>,
  host: HTMLElement,
  layer: HTMLElement,
  localPeerId?: string,
  labelFormatter: CollaborationCursorLabelFormatter = formatCollaborationCursorLabel,
): void => {
  const root = lexicalEditor.getRootElement();
  if (!root) return;
  clearLayer(layer);
  syncLayerGeometry(root, host, layer);
  const layerRect = layer.getBoundingClientRect();

  presence.forEach((snapshot) => {
    if (snapshot.peerId === localPeerId) return;
    const payload = readPayload(snapshot.state);
    if (!payload?.anchor || !payload.focus) return;
    const display = readDisplay(payload.state);
    if (display.status === 'done' || display.status === 'error') return;

    let resolved: { anchor: CollaborationResolvedPoint; focus: CollaborationResolvedPoint } | null;
    try {
      resolved = service.resolvePoints(payload.anchor, payload.focus);
    } catch {
      resolved = null;
    }
    if (!resolved) return;
    const range = createRange(lexicalEditor, resolved.anchor, resolved.focus);
    if (!range) return;

    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width !== 0 || rect.height !== 0,
    );
    const collapsed = range.collapsed;
    const color = display.color;
    const visibleRects = rects.length > 0 ? rects : [range.getBoundingClientRect()];
    const firstRect = visibleRects.find((rect) => rect.width !== 0 || rect.height !== 0);
    if (!firstRect) return;

    const formatted = labelFormatter({
      name: display.name,
      role: display.role,
      status: display.status,
    });
    const label = typeof formatted === 'string' ? { label: formatted, loading: false } : formatted;

    for (const rect of visibleRects) {
      const marker = layer.ownerDocument.createElement('span');
      marker.dataset.loroPresencePeer = snapshot.peerId;
      marker.setAttribute('aria-label', label.label);
      marker.style.background = collapsed ? color : `${color}33`;
      marker.style.borderLeft = collapsed ? `2px solid ${color}` : `1px solid ${color}`;
      marker.style.boxSizing = 'border-box';
      marker.style.height = `${Math.max(rect.height, 16)}px`;
      marker.style.left = `${rect.left - layerRect.left}px`;
      marker.style.pointerEvents = 'none';
      marker.style.position = 'absolute';
      marker.style.top = `${rect.top - layerRect.top}px`;
      marker.style.width = collapsed ? '2px' : `${Math.max(rect.width, 2)}px`;
      marker.style.zIndex = '2';
      layer.append(marker);
    }

    const name = layer.ownerDocument.createElement('span');
    name.dataset.loroPresenceLabel = snapshot.peerId;
    if (display.role === 'agent') name.dataset.loroPresenceAgentStatus = display.status ?? '';
    name.setAttribute('aria-label', label.label);
    name.style.background = color;
    name.style.boxSizing = 'border-box';
    name.style.color = '#fff';
    name.style.fontFamily = 'Arial, sans-serif';
    name.style.fontSize = '12px';
    name.style.fontWeight = 'bold';
    name.style.left = `${firstRect.left - layerRect.left - 2}px`;
    name.style.lineHeight = '12px';
    name.style.padding = '2px';
    name.style.pointerEvents = 'none';
    name.style.position = 'absolute';
    name.style.top = `${firstRect.top - layerRect.top - 16}px`;
    name.style.whiteSpace = 'nowrap';
    name.style.zIndex = '3';
    name.textContent = label.label;
    if (label.loading) {
      ensureCollaborationAgentCursorStyles();
      const dot = layer.ownerDocument.createElement('span');
      dot.className = 'lobe-collaboration-agent-loading-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '•';
      name.append(dot);
    }
    layer.append(name);
  });
};

/**
 * Keep the overlay outside Lexical's managed contenteditable subtree. The
 * layer still tracks the root's viewport rectangle, so the marker coordinates
 * remain correct when either the host or the editor root scrolls.
 */
const syncLayerGeometry = (root: HTMLElement, host: HTMLElement, layer: HTMLElement): void => {
  const rootRect = root.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const isBody = host === root.ownerDocument.body;
  const view = root.ownerDocument.defaultView;
  const scrollLeft = isBody ? (view?.scrollX ?? 0) : host.scrollLeft;
  const scrollTop = isBody ? (view?.scrollY ?? 0) : host.scrollTop;
  layer.style.height = `${rootRect.height}px`;
  layer.style.left = `${rootRect.left - (isBody ? 0 : hostRect.left) + scrollLeft}px`;
  layer.style.top = `${rootRect.top - (isBody ? 0 : hostRect.top) + scrollTop}px`;
  layer.style.width = `${rootRect.width}px`;
};

export interface LoroPresencePluginProps {
  awarenessLabelFormatter?: CollaborationCursorLabelFormatter;
  enabled?: boolean;
}

/**
 * Render Loro's durable text anchors as a DOM overlay. It deliberately uses
 * `ICollaborationService.resolvePoints`; no Yjs RelativePosition or CRDT
 * internals cross into the browser projection.
 */
export const LoroPresencePlugin: FC<LoroPresencePluginProps> = ({
  awarenessLabelFormatter,
  enabled = true,
}) => {
  const [editor] = useLexicalComposerContext();
  const presenceRef = useRef(new Map<string, CollaborationPresenceSnapshot>());
  const layerRef = useRef<HTMLElement | null>(null);

  useLexicalEditor(
    (lexicalEditor) => {
      if (!enabled || typeof document === 'undefined') return undefined;
      const root = lexicalEditor.getRootElement();
      if (!root) return undefined;
      const service = editor.requireService(ICollaborationService);
      if (!service) return undefined;
      const labelFormatter =
        awarenessLabelFormatter ??
        ((input) =>
          formatCollaborationCursorLabel(input, (key) => editor.t(key as keyof ILocaleKeys)));

      // Match the existing Yjs cursor portal: the overlay is a sibling of the
      // managed editor root (or document.body as the last resort), never a
      // child of the contenteditable Lexical tree.
      const host = root.parentElement ?? root.ownerDocument.body;
      const layer = document.createElement('div');
      layer.dataset.loroPresenceLayer = 'true';
      layer.style.pointerEvents = 'none';
      layer.style.position = 'absolute';
      layer.style.zIndex = '1';
      const previousHostPosition = host.style.position;
      const hostPosition = host.ownerDocument.defaultView?.getComputedStyle(host).position;
      if (host !== host.ownerDocument.body && hostPosition === 'static') {
        host.style.position = 'relative';
      }
      host.append(layer);
      layerRef.current = layer;

      const transport = service.transport as CollaborationTransportPortWithPresence;
      transport.getPresence?.().forEach((snapshot) => {
        if (snapshot.state !== null) presenceRef.current.set(snapshot.peerId, snapshot);
      });
      const rerender = (): void => {
        if (layerRef.current)
          renderPresence(
            lexicalEditor,
            service,
            presenceRef.current,
            host,
            layerRef.current,
            transport.peerId,
            labelFormatter,
          );
      };
      const disposePresence = transport.onPresence?.((snapshot) => {
        if (snapshot.state === null) {
          presenceRef.current.delete(snapshot.peerId);
        } else {
          const previous = presenceRef.current.get(snapshot.peerId);
          if (!previous || snapshot.sequence >= previous.sequence) {
            presenceRef.current.set(snapshot.peerId, snapshot);
          }
        }
        rerender();
      });
      const disposeStatus = transport.onStatus?.((status) => {
        if (status !== 'disconnected') return;
        presenceRef.current.clear();
        rerender();
      });
      const disposeReadiness = service.subscribeReadiness(rerender);
      const disposeUpdate = lexicalEditor.registerUpdateListener(rerender);
      const onResize = (): void => rerender();
      window.addEventListener('resize', onResize);
      root.addEventListener('scroll', onResize, { passive: true });
      host.addEventListener('scroll', onResize, { passive: true });
      rerender();

      return () => {
        disposePresence?.();
        disposeStatus?.();
        disposeReadiness();
        disposeUpdate();
        window.removeEventListener('resize', onResize);
        root.removeEventListener('scroll', onResize);
        host.removeEventListener('scroll', onResize);
        layer.remove();
        layerRef.current = null;
        presenceRef.current.clear();
        if (host !== host.ownerDocument.body && host.style.position !== previousHostPosition) {
          host.style.position = previousHostPosition;
        }
      };
    },
    [awarenessLabelFormatter, editor, enabled],
  );

  return null;
};

interface CollaborationTransportPortWithPresence {
  getPresence?: () => readonly CollaborationPresenceSnapshot[];
  onStatus?: (listener: (status: string) => void) => () => void;
  peerId?: string;
  onPresence?: (listener: (presence: CollaborationPresenceSnapshot) => void) => () => void;
}

export default LoroPresencePlugin;
