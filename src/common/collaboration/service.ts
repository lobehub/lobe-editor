import type { LexicalEditor } from 'lexical';

import type { PropertiesCollaborationProvider } from '@/plugins/properties/service/properties';
import type { IServiceID } from '@/types';

import type { BoundCausalVersion, CollaborationAnchor, CollaborationDescriptor } from './protocol';
import type { CollaborationPresenceSnapshot } from './transport/protocol';

/** Backwards-compatible name for callers that used the first draft. */
export type CollaborationAnnotationsPort = PropertiesCollaborationProvider;

export interface CollaborationPoint {
  nodeId: string;
  offset: number;
}

export interface CollaborationResolvedPoint {
  key: string;
  offset: number;
  type: 'element' | 'text';
}

export interface CollaborationResolvedPoints {
  anchor: CollaborationResolvedPoint;
  focus: CollaborationResolvedPoint;
}

/**
 * A durable embedded body exposed to a CodeMirror/Artifact view. The view
 * submits one text change at a time; the engine adapter owns the CRDT
 * transaction and notifies the view when a remote projection changes.
 */
export interface CollaborationEmbeddedText {
  readonly id: string;
  applyLocalChange(from: number, to: number, insert: string): void;
  applyLocalChanges?(changes: readonly CollaborationEmbeddedTextChange[]): void;
  onChange(listener: () => void): () => void;
  read(): string;
  redo?(): boolean;
  undo?(): boolean;
}

export interface CollaborationEmbeddedTextChange {
  from: number;
  insert: string;
  to: number;
}

export type CollaborationReadiness = 'disposed' | 'incompatible' | 'initializing' | 'ready';

/**
 * Transport/presence stays opaque at this boundary on purpose. Existing Yjs
 * Agent awareness carries auth-bound fields and provider-specific metadata;
 * Loro can translate the same lifecycle later without making this port invent
 * a second presence schema. Durable points always use `CollaborationAnchor`.
 */
export interface CollaborationTransportPort {
  clearPresence(): void;
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
  getPresence?(): readonly CollaborationPresenceSnapshot[];
  onStatus(listener: (status: string) => void): () => void;
  onSync(listener: (synced: boolean) => void): () => void;
  onPresence?(listener: (presence: CollaborationPresenceSnapshot) => void): () => void;
  setPresence(value: unknown): void;
  waitForPendingUpdates(timeoutMs?: number): Promise<void>;
  waitForSync(): Promise<void>;
}

/** Snapshot persistence and causal import deliberately have separate methods. */
export interface CollaborationDocumentPort {
  exportSnapshot(): Uint8Array;
  importCausalUpdate(update: Uint8Array, descriptor: CollaborationDescriptor): void;
  importSnapshot(snapshot: Uint8Array, descriptor: CollaborationDescriptor): void;
}

export interface CollaborationService {
  readonly descriptor: CollaborationDescriptor;
  readonly document: CollaborationDocumentPort;
  readonly transport: CollaborationTransportPort;

  capturePoint(point: CollaborationPoint): CollaborationAnchor | null;
  applyExternalEditorData?(editorData: Record<string, unknown>): boolean;
  dispose(): void;
  getAnnotations(): PropertiesCollaborationProvider | null;
  getAwarenessUsers?(): readonly unknown[];
  getEmbeddedText?(nodeId: string): CollaborationEmbeddedText | null;
  getLexicalEditor(): LexicalEditor | null;
  getReadiness(): CollaborationReadiness;
  getVersionProof(): BoundCausalVersion;
  resolveAnchorOffset(anchor: CollaborationAnchor, nodeId: string): number | null;
  resolvePoints(
    anchor: CollaborationAnchor,
    focus: CollaborationAnchor,
  ): CollaborationResolvedPoints | null;
  subscribe(listener: () => void): () => void;
  subscribeAwarenessUsers?(listener: (users: readonly unknown[]) => void): () => void;
  subscribeReadiness(listener: (readiness: CollaborationReadiness) => void): () => void;
}

/** The editor-scoped neutral service registered by an engine plugin. */
export const ICollaborationService: IServiceID<CollaborationService> = {
  __serviceId: 'CollaborationService',
};
