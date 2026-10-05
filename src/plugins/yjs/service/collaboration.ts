import type { Provider } from '@lexical/yjs';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $isElementNode } from 'lexical';
import {
  applyUpdate,
  createRelativePositionFromJSON,
  encodeStateAsUpdate,
  encodeStateVector,
  type RelativePosition,
  relativePositionToJSON,
} from 'yjs';

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
  parseCollaborationDescriptor,
} from '@/common/collaboration';
import { getBlockPoint, getLinearTextLength } from '@/editor-kernel/linear-text';
import { $getAtomicHoleForNode } from '@/plugins/common/node/atomic-hole-selection';
import type { PropertiesCollaborationProvider } from '@/plugins/properties/service/properties';
import { $findNodeById } from '@/plugins/properties/utils';

import { encodeYjsBase64 } from '../protocol';
import {
  createRelativePositionForLexicalPoint,
  resolveRelativeAnchorOffset,
  resolveRelativeSelectionPoints,
} from '../relative-position';
import type { YjsPluginState, YjsService } from './index';

const DEFAULT_YJS_DESCRIPTOR: CollaborationDescriptor = Object.freeze({
  bindingSchema: 'lexical-yjs-v1',
  engine: 'yjs',
  epoch: 0,
});

const sameDescriptor = (left: CollaborationDescriptor, right: CollaborationDescriptor): boolean =>
  left.engine === right.engine &&
  left.bindingSchema === right.bindingSchema &&
  left.epoch === right.epoch;

const isValidPoint = (point: CollaborationPoint): boolean =>
  typeof point.nodeId === 'string' &&
  point.nodeId.trim().length > 0 &&
  Number.isSafeInteger(point.offset) &&
  point.offset >= 0;

const serializeRelativePosition = (position: RelativePosition): string =>
  JSON.stringify(relativePositionToJSON(position));

const deserializeRelativePosition = (cursor: string): RelativePosition => {
  const value = JSON.parse(cursor) as unknown;
  if (!value || typeof value !== 'object') throw new Error('Invalid Yjs collaboration cursor.');
  return createRelativePositionFromJSON(
    value as Parameters<typeof createRelativePositionFromJSON>[0],
  );
};

const toResolvedPoint = (point: {
  key: string;
  offset: number;
  type: 'element' | 'text';
}): CollaborationResolvedPoint => point;

class YjsTransportPort implements CollaborationTransportPort {
  constructor(private readonly getProvider: () => Provider) {}

  private provider(): Provider {
    return this.getProvider();
  }

  connect(): Promise<void> | void {
    return this.provider().connect();
  }

  disconnect(): Promise<void> | void {
    return this.provider().disconnect();
  }

  waitForSync(): Promise<void> {
    const provider = this.provider() as Provider & { waitForSync?: () => Promise<void> };
    if (typeof provider.waitForSync === 'function') return provider.waitForSync();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        provider.off('sync', onSync);
        provider.off('status', onStatus);
      };
      const onStatus = ({ status }: { status: string }) => {
        if (status !== 'disconnected' || settled) return;
        settled = true;
        cleanup();
        reject(new Error('Collaboration provider disconnected before sync.'));
      };
      const onSync = (synced: boolean) => {
        if (!synced || settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      provider.on('sync', onSync);
      provider.on('status', onStatus);
    });
  }

  waitForPendingUpdates(timeoutMs = 10_000): Promise<void> {
    const provider = this.provider() as Provider & {
      waitForPendingUpdates?: (timeoutMs?: number) => Promise<void>;
    };
    return provider.waitForPendingUpdates?.(timeoutMs) ?? Promise.resolve();
  }

  setPresence(value: unknown): void {
    const provider = this.provider() as Provider & {
      setAgentAwareness?: (input: unknown) => void;
    };
    if (typeof provider.setAgentAwareness === 'function') {
      provider.setAgentAwareness(value);
      return;
    }
    provider.awareness.setLocalState(value as never);
  }

  clearPresence(): void {
    const provider = this.provider() as Provider & { clearAgentAwareness?: () => void };
    if (typeof provider.clearAgentAwareness === 'function') {
      provider.clearAgentAwareness();
      return;
    }
    provider.awareness.setLocalState(null);
  }

  onStatus(listener: (status: string) => void): () => void {
    const provider = this.provider();
    const callback = ({ status }: { status: string }) => listener(status);
    provider.on('status', callback);
    return () => provider.off('status', callback);
  }

  onSync(listener: (synced: boolean) => void): () => void {
    const provider = this.provider();
    provider.on('sync', listener);
    return () => provider.off('sync', listener);
  }
}

/**
 * Adapter for the existing @lexical/yjs binding. The adapter owns all Yjs
 * cursor serialization and provider details; the common service exposes only
 * descriptor-bound anchors and causal versions.
 */
export class YjsCollaborationService implements CollaborationService {
  readonly descriptor: CollaborationDescriptor;
  readonly transport: CollaborationTransportPort;
  readonly document: CollaborationDocumentPort;

  private disposed = false;

  constructor(
    private readonly yjsService: YjsService,
    descriptor: CollaborationDescriptor = DEFAULT_YJS_DESCRIPTOR,
    private readonly annotations: PropertiesCollaborationProvider | null = null,
  ) {
    const parsedDescriptor = parseCollaborationDescriptor(descriptor);
    if (parsedDescriptor.engine !== 'yjs' || parsedDescriptor.bindingSchema !== 'lexical-yjs-v1') {
      throw new Error('Yjs collaboration service requires a lexical-yjs descriptor.');
    }
    this.descriptor = parsedDescriptor;
    this.transport = new YjsTransportPort(() => this.requireState().provider);
    this.document = {
      exportSnapshot: () => encodeStateAsUpdate(this.requireDoc()),
      importCausalUpdate: (update, descriptor) => {
        parseCollaborationDescriptor(descriptor);
        if (!sameDescriptor(this.descriptor, descriptor)) {
          throw new Error('Yjs causal update descriptor mismatch.');
        }
        applyUpdate(this.requireDoc(), update, this);
      },
      importSnapshot: (snapshot, descriptor) => {
        parseCollaborationDescriptor(descriptor);
        if (!sameDescriptor(this.descriptor, descriptor)) {
          throw new Error('Yjs snapshot descriptor mismatch.');
        }
        applyUpdate(this.requireDoc(), snapshot, this);
      },
    };
  }

  getLexicalEditor(): LexicalEditor | null {
    return this.yjsService.getState()?.binding.editor ?? null;
  }

  getReadiness(): CollaborationReadiness {
    if (this.disposed) return 'disposed';
    return this.yjsService.isReady() ? 'ready' : 'initializing';
  }

  getVersionProof(): BoundCausalVersion {
    return {
      causalVersion: {
        kind: 'crdt-causal-version',
        value: encodeYjsBase64(encodeStateVector(this.requireDoc())),
      },
      descriptor: this.descriptor,
    };
  }

  getAnnotations(): PropertiesCollaborationProvider | null {
    return this.annotations;
  }

  getAwarenessUsers(): readonly unknown[] {
    return this.yjsService.getAwarenessUsers();
  }

  subscribeAwarenessUsers(listener: (users: readonly unknown[]) => void): () => void {
    return this.yjsService.subscribeAwarenessUsers((users) => listener(users));
  }

  capturePoint(point: CollaborationPoint): CollaborationAnchor | null {
    if (!isValidPoint(point) || this.disposed) return null;
    const state = this.yjsService.getState();
    const editor = state?.binding.editor;
    if (!state || !editor) return null;

    let result: CollaborationAnchor | null = null;
    editor.getEditorState().read(() => {
      const node = $findNodeById(point.nodeId);
      if (!node) return;
      const hole = $getAtomicHoleForNode(node);
      if (hole) {
        result = {
          descriptor: this.descriptor,
          kind: 'node-boundary',
          nodeId: point.nodeId,
          side: point.offset <= 0 ? 'before' : 'after',
        };
        return;
      }
      const lexicalPoint = getBlockPoint(node, point.offset, 'end');
      if (!lexicalPoint) return;
      const position = createRelativePositionForLexicalPoint(lexicalPoint, state.binding);
      if (!position) return;
      result = {
        cursor: serializeRelativePosition(position),
        descriptor: this.descriptor,
        kind: 'text-cursor',
      };
    });
    return result;
  }

  applyExternalEditorData(editorData: Record<string, unknown>): boolean {
    return this.yjsService.applyExternalEditorData(editorData);
  }

  resolvePoints(
    anchor: CollaborationAnchor,
    focus: CollaborationAnchor,
  ): CollaborationResolvedPoints | null {
    const state = this.yjsService.getState();
    if (this.disposed || !state) return null;
    try {
      const normalizedAnchor = parseCollaborationAnchor(anchor, this.descriptor);
      const normalizedFocus = parseCollaborationAnchor(focus, this.descriptor);
      let result: CollaborationResolvedPoints | null = null;
      state.binding.editor.getEditorState().read(() => {
        const anchorPoint = this.resolveAnchorPoint(state, normalizedAnchor);
        const focusPoint = this.resolveAnchorPoint(state, normalizedFocus);
        if (anchorPoint && focusPoint) result = { anchor: anchorPoint, focus: focusPoint };
      });
      return result;
    } catch {
      return null;
    }
  }

  resolveAnchorOffset(anchor: CollaborationAnchor, nodeId: string): number | null {
    const state = this.yjsService.getState();
    if (this.disposed || !state || typeof nodeId !== 'string' || nodeId.length === 0) return null;
    try {
      const normalized = parseCollaborationAnchor(anchor, this.descriptor);
      let result: number | null = null;
      state.binding.editor.getEditorState().read(() => {
        const block = $findNodeById(nodeId);
        if (!block) return;
        if (normalized.kind === 'node-boundary') {
          if (normalized.nodeId !== nodeId) return;
          result = normalized.side === 'before' ? 0 : getLinearTextLength(block);
          return;
        }
        const position = deserializeRelativePosition(normalized.cursor);
        result = resolveRelativeAnchorOffset(state.binding, position, block);
      });
      return result;
    } catch {
      return null;
    }
  }

  subscribe(listener: () => void): () => void {
    return this.yjsService.subscribe(() => listener());
  }

  subscribeReadiness(listener: (readiness: CollaborationReadiness) => void): () => void {
    return this.yjsService.subscribeReadiness(() => listener(this.getReadiness()));
  }

  dispose(): void {
    this.disposed = true;
  }

  private resolveAnchorPoint(
    state: YjsPluginState,
    anchor: CollaborationAnchor,
  ): CollaborationResolvedPoint | null {
    if (anchor.kind === 'text-cursor') {
      const position = deserializeRelativePosition(anchor.cursor);
      const points = resolveRelativeSelectionPoints(state.binding, position, position);
      if (!points) return null;
      const node = $getNodeByKey(points.anchorKey);
      return toResolvedPoint({
        key: points.anchorKey,
        offset: points.anchorOffset,
        type: $isElementNode(node) ? 'element' : 'text',
      });
    }

    const node = $findNodeById(anchor.nodeId);
    if (!node) return null;
    const hole = $getAtomicHoleForNode(node);
    if (hole) {
      const cursor = anchor.side === 'before' ? hole.getBeforeCursor() : hole.getAfterCursor();
      if (!cursor) return null;
      return {
        key: cursor.getKey(),
        offset: anchor.side === 'before' ? cursor.getTextContentSize() : 0,
        type: 'text',
      };
    }
    const lexicalPoint = getBlockPoint(
      node,
      anchor.side === 'before' ? 0 : getLinearTextLength(node),
      anchor.side === 'before' ? 'start' : 'end',
    );
    return lexicalPoint ? toResolvedPoint(lexicalPoint) : null;
  }

  private requireState(): YjsPluginState {
    const state = this.yjsService.getState();
    if (!state) throw new Error('Yjs collaboration service is not initialized.');
    return state;
  }

  private requireDoc() {
    const state = this.requireState();
    return state.doc ?? state.binding.doc;
  }
}

export const createYjsCollaborationService = (
  yjsService: YjsService,
  descriptor?: CollaborationDescriptor,
  annotations?: PropertiesCollaborationProvider | null,
): YjsCollaborationService => new YjsCollaborationService(yjsService, descriptor, annotations);
