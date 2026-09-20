import { VersionVector } from 'loro-crdt';

import { parseCollaborationDescriptor } from '@/common/collaboration/protocol';
import {
  type CollaborationEngineAdapter,
  CollaborationTransportCore,
  type CollaborationTransportCoreOptions,
  type CollaborationTransportStatus,
  type CollaborationWebSocketConstructor,
} from '@/common/collaboration/transport/core';
import type {
  CollaborationDescriptor,
  CollaborationPresenceSnapshot,
  CollaborationSenderId,
} from '@/common/collaboration/transport/protocol';

import type { LoroCanonicalDocument } from './model';

const encode = (bytes: Uint8Array): string => {
  const runtime = globalThis as typeof globalThis & {
    Buffer?: { from(value: Uint8Array): { toString(encoding: 'base64'): string } };
    btoa?: (value: string) => string;
  };
  if (runtime.Buffer) return runtime.Buffer.from(bytes).toString('base64');
  if (typeof runtime.btoa === 'function') {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.slice(index, index + 8192));
    }
    return runtime.btoa(binary);
  }
  throw new Error('No base64 encoder is available for the Loro transport.');
};

const decode = (value: string): Uint8Array => {
  const runtime = globalThis as typeof globalThis & {
    Buffer?: { from(value: string, encoding: 'base64'): Uint8Array };
    atob?: (value: string) => string;
  };
  if (runtime.Buffer) return new Uint8Array(runtime.Buffer.from(value, 'base64'));
  if (typeof runtime.atob === 'function') {
    const binary = runtime.atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  throw new Error('No base64 decoder is available for the Loro transport.');
};

const encodeVersion = (version: VersionVector): string => encode(version.encode());
const decodeVersion = (value: string): VersionVector => VersionVector.decode(decode(value));

export interface LoroTransportProviderOptions {
  /** Binding-owned gate for both the initial snapshot and incremental updates. */
  applyRemoteUpdate?: (update: Uint8Array) => void;
  /** Explicit escape hatch for standalone canonical transport tests/adapters. */
  allowStandaloneCanonicalImport?: boolean;
  autoReconnect?: boolean;
  clientKind?: 'agent' | 'browser';
  documentId?: string;
  maxSeenMessageIds?: number;
  refreshTicket?: () => string | Promise<string>;
  requestId?: string;
  ticket: string;
  webSocketConstructor?: CollaborationWebSocketConstructor;
  wsBaseUrl: string;
}

class LoroTransportEngine implements CollaborationEngineAdapter<Uint8Array> {
  readonly peerId: string;
  private exportedVersion: VersionVector;

  constructor(
    private readonly canonical: LoroCanonicalDocument,
    applyRemoteUpdateHook: ((update: Uint8Array) => void) | undefined,
    allowStandaloneCanonicalImport = false,
  ) {
    this.peerId = canonical.doc.peerIdStr;
    this.exportedVersion = canonical.doc.version();
    if (applyRemoteUpdateHook) this.ingest = applyRemoteUpdateHook;
    else if (allowStandaloneCanonicalImport) {
      this.ingest = (update) => canonical.import(update, { trusted: true });
    } else {
      throw new Error(
        'Loro transport requires a binding-owned applyRemoteUpdate gate; enable standalone canonical import explicitly for raw adapters.',
      );
    }
  }

  private readonly ingest: (update: Uint8Array) => void;

  subscribeLocalUpdates(listener: (update: Uint8Array) => void): () => void {
    return this.canonical.subscribe((event) => {
      if (event.by !== 'local') return;
      const update = this.canonical.doc.export({ mode: 'update', from: this.exportedVersion });
      this.exportedVersion = this.canonical.doc.version();
      if (update.byteLength > 0) listener(update);
    });
  }

  encodeUpdate(update: Uint8Array): string {
    return encode(update);
  }

  decodeUpdate(payload: string): Uint8Array {
    return decode(payload);
  }

  applySnapshot(snapshot: string): void {
    this.ingest(decode(snapshot));
  }

  applyRemoteUpdate(update: Uint8Array): void {
    this.ingest(update);
  }

  exportUpdatesSince(causalVersion: string): readonly Uint8Array[] {
    const update = this.canonical.doc.export({
      mode: 'update',
      from: decodeVersion(causalVersion),
    });
    return update.byteLength > 0 ? [update] : [];
  }

  getCausalVersion(): string {
    return encodeVersion(this.canonical.doc.version());
  }
}

/**
 * Loro's engine adapter over the shared v2 socket core. It intentionally does
 * not alter LoroLexicalBinding/model/service; the adapter only translates
 * causal bytes, snapshots, peer identity and local update subscriptions.
 */
export class LoroWebSocketProvider {
  readonly peerId: string;
  private readonly core: CollaborationTransportCore<Uint8Array>;

  constructor(
    readonly canonical: LoroCanonicalDocument,
    descriptor: CollaborationDescriptor,
    roomId: string,
    options: LoroTransportProviderOptions,
  ) {
    const parsedDescriptor = parseCollaborationDescriptor(descriptor);
    if (
      parsedDescriptor.engine !== 'loro' ||
      parsedDescriptor.bindingSchema !== 'lexical-loro-v1' ||
      parsedDescriptor.engine !== canonical.descriptor.engine ||
      parsedDescriptor.bindingSchema !== canonical.descriptor.bindingSchema ||
      parsedDescriptor.epoch !== canonical.descriptor.epoch
    ) {
      throw new Error('Loro transport descriptor does not match the canonical binding.');
    }
    const engine = new LoroTransportEngine(
      canonical,
      options.applyRemoteUpdate,
      options.allowStandaloneCanonicalImport,
    );
    this.peerId = engine.peerId;
    const coreOptions: CollaborationTransportCoreOptions<Uint8Array> = {
      autoReconnect: options.autoReconnect ?? Boolean(options.refreshTicket),
      clientKind: options.clientKind ?? 'browser',
      descriptor: parsedDescriptor,
      documentId: options.documentId,
      engine,
      maxSeenMessageIds: options.maxSeenMessageIds,
      refreshTicket: options.refreshTicket,
      requestId: options.requestId,
      roomId,
      ticket: options.ticket,
      webSocketConstructor: options.webSocketConstructor,
      wsBaseUrl: options.wsBaseUrl,
    };
    this.core = new CollaborationTransportCore(coreOptions);
  }

  connect(): void {
    this.core.connect();
  }

  disconnect(): void {
    this.core.disconnect();
  }

  dispose(): void {
    this.core.dispose();
  }

  waitForSync(): Promise<void> {
    return this.core.waitForSync();
  }

  waitForPendingUpdates(timeoutMs?: number): Promise<void> {
    return this.core.waitForPendingUpdates(timeoutMs);
  }

  setPresence(state: unknown, sequence?: number): void {
    this.core.setPresence(state, sequence);
  }

  clearPresence(): void {
    this.core.clearPresence();
  }

  getPresence(): readonly CollaborationPresenceSnapshot[] {
    return this.core.getPresence();
  }

  onStatus(listener: (status: CollaborationTransportStatus) => void): () => void {
    this.core.on('status', listener);
    return () => this.core.off('status', listener);
  }

  onSync(listener: (synced: boolean) => void): () => void {
    this.core.on('sync', listener);
    return () => this.core.off('sync', listener);
  }

  onPresence(listener: (presence: CollaborationPresenceSnapshot) => void): () => void {
    this.core.on('presence', listener);
    return () => this.core.off('presence', listener);
  }

  onError(listener: (error: Error) => void): () => void {
    this.core.on('error', listener);
    return () => this.core.off('error', listener);
  }
}

export type LoroTransportSenderId = CollaborationSenderId;
