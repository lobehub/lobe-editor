import type { LexicalEditor, LexicalNode } from 'lexical';
import { $getRoot, $isTextNode } from 'lexical';
import { Cursor } from 'loro-crdt';

import {
  type BoundCausalVersion,
  type CollaborationAnchor,
  type CollaborationDescriptor,
  type CollaborationDocumentPort,
  type CollaborationPoint,
  type CollaborationReadiness,
  type CollaborationResolvedPoint,
  type CollaborationResolvedPoints,
  type CollaborationService,
  type CollaborationTransportPort,
  parseCollaborationAnchor,
} from '@/common/collaboration';
import type { PropertiesCollaborationProvider } from '@/plugins/properties/service/properties';

import type { LoroLexicalBinding } from './binding';
import { getAttachedText } from './model';

const encode = (bytes: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const decode = (value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const noTransport: CollaborationTransportPort = {
  clearPresence: () => undefined,
  connect: () => undefined,
  disconnect: () => undefined,
  onStatus: () => () => undefined,
  onSync: (listener) => {
    listener(true);
    return () => undefined;
  },
  setPresence: () => undefined,
  waitForPendingUpdates: async () => undefined,
  waitForSync: async () => undefined,
};

const encodeAnchorPayload = (flowNodeId: string, cursor: Uint8Array): string =>
  encode(new TextEncoder().encode(JSON.stringify({ cursor: encode(cursor), flowNodeId })));

const decodeAnchorPayload = (value: string): { cursor: Uint8Array; flowNodeId?: string } => {
  try {
    const decoded = new TextDecoder().decode(decode(value));
    const payload = JSON.parse(decoded) as { cursor?: string; flowNodeId?: string };
    if (typeof payload.cursor === 'string') {
      return { cursor: decode(payload.cursor), flowNodeId: payload.flowNodeId };
    }
  } catch {
    // Older callers may carry the raw Cursor encoding; retain that format.
  }
  return { cursor: decode(value) };
};

/**
 * Engine-neutral service facade for the Loro binding. Network transport is
 * deliberately injected; the default is a local/headless no-op transport.
 */
export class LoroCollaborationService implements CollaborationService {
  readonly descriptor: CollaborationDescriptor;
  readonly document: CollaborationDocumentPort;
  readonly transport: CollaborationTransportPort;

  constructor(
    private readonly binding: LoroLexicalBinding,
    transport: CollaborationTransportPort = noTransport,
  ) {
    this.descriptor = binding.descriptor;
    this.transport = transport;
    this.document = {
      exportSnapshot: () => binding.exportSnapshot(),
      importCausalUpdate: (update, descriptor) => {
        if (
          descriptor.engine !== this.descriptor.engine ||
          descriptor.bindingSchema !== this.descriptor.bindingSchema ||
          descriptor.epoch !== this.descriptor.epoch
        ) {
          throw new Error('Loro causal update descriptor does not match the active binding.');
        }
        binding.applyUpdate(update);
      },
      importSnapshot: (snapshot, descriptor) => {
        if (
          descriptor.engine !== this.descriptor.engine ||
          descriptor.bindingSchema !== this.descriptor.bindingSchema ||
          descriptor.epoch !== this.descriptor.epoch
        ) {
          throw new Error('Loro snapshot descriptor does not match the active binding.');
        }
        binding.applyUpdate(snapshot);
      },
    };
  }

  capturePoint(point: CollaborationPoint): CollaborationAnchor | null {
    const node = this.binding.canonical.findNodeById(point.nodeId);
    if (!node) return null;
    const flow = getAttachedText(node, 'flow');
    if (!flow) return null;
    const offset = this.binding.logicalOffsetToFlowOffset(point.nodeId, point.offset);
    if (offset === null) return null;
    const cursor = flow.getCursor(offset, 0);
    if (!cursor) return null;
    return {
      cursor: encodeAnchorPayload(point.nodeId, cursor.encode()),
      descriptor: this.descriptor,
      kind: 'text-cursor',
    };
  }

  dispose(): void {
    this.binding.dispose();
  }

  getAnnotations(): PropertiesCollaborationProvider | null {
    return this.binding.getPropertiesProvider();
  }

  getLexicalEditor(): LexicalEditor | null {
    return this.binding.editor;
  }

  getReadiness(): CollaborationReadiness {
    const phase = this.binding.getPhase();
    if (phase === 'ready') return 'ready';
    if (phase === 'incompatible') return 'incompatible';
    if (phase === 'disposed') return 'disposed';
    return 'initializing';
  }

  getVersionProof(): BoundCausalVersion {
    const version = this.binding.canonical.doc.version().toJSON();
    return {
      causalVersion: {
        kind: 'crdt-causal-version',
        value: encode(new TextEncoder().encode(JSON.stringify(Object.fromEntries(version)))),
      },
      descriptor: this.descriptor,
    };
  }

  resolveAnchorOffset(anchor: CollaborationAnchor, nodeId: string): number | null {
    const parsed = parseCollaborationAnchor(anchor, this.descriptor);
    if (parsed.kind !== 'text-cursor') return null;
    const node = this.binding.canonical.findNodeById(nodeId);
    const flow = node ? getAttachedText(node, 'flow') : null;
    if (!flow) return null;
    const payload = decodeAnchorPayload(parsed.cursor);
    const cursor = Cursor.decode(payload.cursor);
    const flowOffset = this.binding.canonical.doc.getCursorPos(cursor)?.offset;
    return flowOffset === undefined
      ? null
      : this.binding.flowOffsetToLogicalOffset(nodeId, flowOffset);
  }

  resolvePoints(
    anchor: CollaborationAnchor,
    focus: CollaborationAnchor,
  ): CollaborationResolvedPoints | null {
    const anchorOffset = this.resolveAnchorOffset(anchor, this.findAnchorNodeId(anchor));
    const focusOffset = this.resolveAnchorOffset(focus, this.findAnchorNodeId(focus));
    if (anchorOffset === null || focusOffset === null) return null;
    const resolvedAnchor = this.resolveLexicalPoint(this.findAnchorNodeId(anchor), anchorOffset);
    const resolvedFocus = this.resolveLexicalPoint(this.findAnchorNodeId(focus), focusOffset);
    return resolvedAnchor && resolvedFocus
      ? { anchor: resolvedAnchor, focus: resolvedFocus }
      : null;
  }

  subscribe(listener: () => void): () => void {
    return this.binding.subscribeReadiness(listener);
  }

  subscribeReadiness(listener: (readiness: CollaborationReadiness) => void): () => void {
    return this.binding.subscribeReadiness(() => listener(this.getReadiness()));
  }

  private findAnchorNodeId(anchor: CollaborationAnchor): string {
    if (anchor.kind === 'node-boundary') return anchor.nodeId;
    const payload = decodeAnchorPayload(anchor.cursor);
    if (payload.flowNodeId) return payload.flowNodeId;
    // The wire text-cursor intentionally carries only the cursor. The caller
    // must resolve it against a known flow owner; this fallback keeps the
    // service total and returns no point when there is no unique owner.
    const nodes = this.binding.canonical.getNodes();
    const flowNode = nodes.find((node) => Boolean(getAttachedText(node, 'flow')));
    return flowNode ? (this.binding.canonical.readNodeId(flowNode) ?? '') : '';
  }

  private resolveLexicalPoint(nodeId: string, offset: number): CollaborationResolvedPoint | null {
    const editor = this.binding.editor;
    return editor.getEditorState().read(() => {
      let owner: LexicalNode | null = null;
      const findOwner = (node: LexicalNode): void => {
        if (owner) return;
        if (this.binding.getNodeIdentity(node) === nodeId) {
          owner = node;
          return;
        }
        if (
          'getChildren' in node &&
          typeof (node as { getChildren?: unknown }).getChildren === 'function'
        ) {
          (node as LexicalNode & { getChildren: () => LexicalNode[] })
            .getChildren()
            .forEach(findOwner);
        }
      };
      findOwner($getRoot());
      if (!owner || !('getChildren' in owner)) return null;
      let cursor = 0;
      let fallback: CollaborationResolvedPoint | null = null;
      for (const child of (
        owner as LexicalNode & { getChildren: () => LexicalNode[] }
      ).getChildren()) {
        if ($isTextNode(child)) {
          const length = child.getTextContentSize();
          if (offset <= cursor + length) {
            return { key: child.getKey(), offset: offset - cursor, type: 'text' };
          }
          fallback = { key: child.getKey(), offset: length, type: 'text' };
          cursor += length;
        } else if (child.getType() === 'linebreak') {
          cursor += 1;
        }
      }
      return fallback;
    });
  }
}

export const createLoroCollaborationService = (
  binding: LoroLexicalBinding,
  transport?: CollaborationTransportPort,
): LoroCollaborationService => new LoroCollaborationService(binding, transport);
