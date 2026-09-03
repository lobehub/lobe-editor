import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import type { Doc } from 'yjs';
import { applyUpdate, encodeStateAsUpdate, encodeStateVector } from 'yjs';

import {
  decodeYjsBase64,
  deserializeUserState,
  encodeLobeYjsMessage,
  encodeYjsBase64,
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
  type LobeYjsAwarenessMessage,
  type LobeYjsClientMessage,
  type LobeYjsHelloMessage,
  type LobeYjsMessage,
  type LobeYjsServerMessage,
  parseLobeYjsMessage,
  serializeUserState,
} from './protocol';

const DEFAULT_WS_BASE_URL = 'ws://localhost:12345';
const MAX_RECONNECT_DELAY_MS = 10_000;
const MIN_RECONNECT_DELAY_MS = 500;
const OPEN_READY_STATE = 1;
const DEFAULT_MAX_REMOTE_AWARENESS_STATES = 1_000;
const DEFAULT_MAX_SEEN_MESSAGE_IDS = 10_000;
// The browser WebSocket API only permits 1000 or application codes in the
// 3000-4999 range for client-initiated close(). RFC protocol codes such as
// 1003/1008 are server-side meanings and throw InvalidAccessError in browsers.
const CLOSE_CODE_INVALID_MESSAGE = 4400;
const CLOSE_CODE_TICKET_REJECTED = 4401;

export type WebSocketYjsProviderStatus =
  'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface WebSocketMessageEvent {
  data?: ArrayBuffer | Uint8Array | string;
}

/** The small subset shared by browser WebSocket and the `ws` Node package. */
export interface WebSocketLike {
  addEventListener: (type: string, listener: (event: WebSocketMessageEvent) => void) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
  send: (data: string) => void;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

/**
 * Return a fresh bearer capability before a reconnecting socket authenticates.
 * A one-shot Agent ticket must never be replayed by the transport itself.
 */
export type RefreshTicket = () => string | Promise<string>;

export interface WebSocketYjsProviderOptions {
  /** Reopen a socket after a transient close; single-use Agent tickets disable this. */
  autoReconnect?: boolean;
  /** Enables the pre-v1 demo wire shape for existing Page installations. */
  legacyProtocol?: boolean;
  clientKind?: 'agent' | 'browser';
  documentId?: string;
  requestId?: string;
  refreshTicket?: RefreshTicket;
  ticket?: null | string;
  maxSeenMessageIds?: number;
  webSocketConstructor?: WebSocketConstructor;
  wsBaseUrl?: string;
}

interface ProviderEventMap {
  reload: (doc: Doc) => void;
  status: (event: { status: WebSocketYjsProviderStatus }) => void;
  sync: (isSynced: boolean) => void;
  update: (event: unknown) => void;
}

interface LegacyAwarenessMessage {
  sender: number;
  state: UserState | null;
  type: 'awareness';
}

interface LegacyUpdateMessage {
  sender: number;
  type: 'update';
  update: string;
}

interface LegacySyncMessage {
  awareness: Array<{ clientId: number; state: UserState | null }>;
  type: 'sync';
  update: string;
}

type LegacyMessage = LegacyAwarenessMessage | LegacySyncMessage | LegacyUpdateMessage;

type AwarenessSender = (state: UserState | null, sequence: number) => void;

/**
 * Minimal Awareness implementation shared by browser and Node providers.
 * Relative positions are converted to/from JSON only at the wire boundary;
 * callers still see the standard @lexical/yjs UserState shape.
 */
export class WebSocketAwareness implements ProviderAwareness {
  private readonly listeners = new Set<() => void>();
  private localState: UserState | null = null;
  private sequence = 0;
  /** The Yjs client identity is stable across the provider's auth lifecycle. */
  private readonly documentClientId: number;
  /** Connection sender IDs previously assigned to this provider instance. */
  private readonly selfClientIds: Set<number>;
  /** Standard awareness map, keyed locally by the stable document client ID. */
  private readonly states = new Map<number, UserState>();

  constructor(
    clientId: number,
    private readonly send: AwarenessSender,
  ) {
    this.documentClientId = clientId;
    this.clientId = clientId;
    this.selfClientIds = new Set([clientId]);
  }

  private clientId: number;

  getLocalState(): UserState | null {
    return this.localState;
  }

  getStates(): Map<number, UserState> {
    return this.states;
  }

  getSequence(): number {
    return this.sequence;
  }

  setClientId(clientId: number): void {
    if (clientId === this.clientId) return;

    this.selfClientIds.add(clientId);
    for (const selfClientId of this.selfClientIds) this.states.delete(selfClientId);
    this.clientId = clientId;
    if (this.localState) this.states.set(this.documentClientId, this.localState);
  }

  off(type: 'update', cb: () => void): void {
    if (type === 'update') this.listeners.delete(cb);
  }

  on(type: 'update', cb: () => void): void {
    if (type === 'update') this.listeners.add(cb);
  }

  setLocalState(state: UserState | null): void {
    // Carry the stable Yjs identity through the wire state as well. The room
    // server may assign a different sender ID after reconnect; this field
    // lets a client discard an old self snapshot even before sender mapping is
    // known.
    this.localState = state
      ? {
          ...state,
          clientId: this.documentClientId,
        }
      : null;

    this.states.delete(this.clientId);
    this.states.delete(this.documentClientId);
    if (this.localState) this.states.set(this.documentClientId, this.localState);

    this.sequence += 1;
    this.emitUpdate();
    this.send(this.localState, this.sequence);
  }

  setLocalStateField(field: string, value: unknown): void {
    const nextState = {
      ...this.localState,
      [field]: value,
    } as UserState;

    this.setLocalState(nextState);
  }

  updateRemoteState(clientId: number, state: UserState | null, sequence = 0): void {
    // Servers assign a connection-scoped sender ID after auth, while legacy
    // relays may echo the Yjs document client ID. Both identify this provider;
    // never treat either form as remote. The optional stable state identity
    // also filters a stale self-awareness snapshot after reconnect.
    if (
      this.selfClientIds.has(clientId) ||
      (state && getAwarenessDocumentClientId(state) === this.documentClientId)
    ) {
      return;
    }

    const previousSequence = this.remoteSequences.get(clientId) ?? -1;
    if (sequence > 0 && sequence <= previousSequence) return;

    if (state) {
      this.states.set(clientId, state);
      this.remoteSequences.set(clientId, sequence);
      while (this.remoteSequences.size > DEFAULT_MAX_REMOTE_AWARENESS_STATES) {
        const oldest = this.remoteSequences.keys().next().value;
        if (oldest === undefined) break;
        this.remoteSequences.delete(oldest);
        this.states.delete(oldest);
      }
    } else {
      this.states.delete(clientId);
      this.remoteSequences.delete(clientId);
    }

    this.emitUpdate();
  }

  private readonly remoteSequences = new Map<number, number>();

  private emitUpdate(): void {
    this.listeners.forEach((listener) => listener());
  }
}

const getAwarenessDocumentClientId = (state: UserState | null): number | undefined => {
  if (!state || typeof state !== 'object') return undefined;
  const value = (state as UserState & { clientId?: unknown }).clientId;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
};

const getRuntimeWebSocketConstructor = (): WebSocketConstructor | undefined => {
  const runtime = globalThis as typeof globalThis & {
    WebSocket?: WebSocketConstructor;
  };

  return runtime.WebSocket;
};

const getMessageText = (data: WebSocketMessageEvent['data']): string | null => {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  return null;
};

const createMessageId = (clientId: number, sequence: number): string =>
  `${clientId.toString(36)}-${sequence.toString(36)}-${Date.now().toString(36)}`;

/**
 * Shared lifecycle for browser and Node WebSocket providers.
 *
 * The legacy flag is intentionally isolated here: it lets an existing Page
 * demo continue using the old server while all new Node/agent clients use the
 * authenticated lobe-yjs-v1 protocol.
 */
export class WebSocketYjsProviderCore implements Provider {
  readonly awareness: WebSocketAwareness;

  private readonly listeners: {
    [K in keyof ProviderEventMap]: Set<ProviderEventMap[K]>;
  } = {
    reload: new Set(),
    status: new Set(),
    sync: new Set(),
    update: new Set(),
  };
  private readonly pendingSyncWaiters = new Set<{
    reject: (error: Error) => void;
    resolve: () => void;
  }>();
  private readonly pendingUpdates: Array<{ id: string; update: Uint8Array }> = [];
  private readonly seenMessageIds = new Set<string>();
  private readonly unacknowledgedUpdates = new Map<string, Uint8Array>();
  private authenticated = false;
  private connectionTerminated = false;
  private isSynced = false;
  private openingSocket = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private shouldConnect = false;
  private socket: WebSocketLike | null = null;
  private serverClientId: number;
  private serverStateVector: Uint8Array | null = null;
  private readonly updateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;

    const id = createMessageId(this.doc.clientID, ++this.sequence);
    const bytes = new Uint8Array(update);

    if (!this.isSocketReady() || !this.authenticated) {
      this.pendingUpdates.push({ id, update: bytes });
      return;
    }

    this.sendUpdate(id, bytes);
  };

  constructor(
    protected readonly id: string,
    private readonly doc: Doc,
    private readonly options: WebSocketYjsProviderOptions = {},
  ) {
    this.serverClientId = doc.clientID;
    this.awareness = new WebSocketAwareness(doc.clientID, (state, sequence) => {
      this.sendAwareness(state, sequence);
    });
  }

  connect(): void {
    if (this.connectionTerminated) {
      this.emit('status', { status: 'disconnected' });
      return;
    }
    this.shouldConnect = true;

    if (this.socket || this.reconnectTimer || this.openingSocket) return;

    this.doc.on('update', this.updateHandler);
    void this.openSocket(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
  }

  disconnect(): void {
    this.shouldConnect = false;
    this.clearReconnectTimer();
    this.doc.off('update', this.updateHandler);
    if (this.options.autoReconnect === false) this.connectionTerminated = true;

    if (this.awareness.getLocalState()) this.awareness.setLocalState(null);

    const socket = this.socket;
    this.socket = null;
    this.authenticated = false;
    this.isSynced = false;

    if (socket) socket.close();

    this.emit('sync', false);
    this.emit('status', { status: 'disconnected' });
    this.rejectSyncWaiters(new Error('Yjs provider disconnected before initial sync.'));
  }

  /** Close is an explicit alias used by headless/Node callers. */
  close(): void {
    this.disconnect();
  }

  /** Resolve after the current connection has completed its sync barrier. */
  waitForSync(): Promise<void> {
    if (this.isSynced) return Promise.resolve();
    if (this.connectionTerminated) {
      return Promise.reject(new Error('Yjs provider cannot reconnect with this ticket.'));
    }

    return new Promise<void>((resolve, reject) => {
      this.pendingSyncWaiters.add({ reject, resolve });
    });
  }

  /** A JSON-safe state vector for diagnostics and request metadata. */
  getStateVector(): string {
    return encodeYjsBase64(encodeStateVector(this.doc));
  }

  off<T extends keyof ProviderEventMap>(type: T, cb: ProviderEventMap[T]): void {
    this.listeners[type].delete(cb as never);
  }

  on<T extends keyof ProviderEventMap>(type: T, cb: ProviderEventMap[T]): void {
    this.listeners[type].add(cb as never);
  }

  protected get legacyProtocol(): boolean {
    return this.options.legacyProtocol === true;
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private emit<T extends keyof ProviderEventMap>(
    type: T,
    ...args: Parameters<ProviderEventMap[T]>
  ): void {
    this.listeners[type].forEach((listener) => {
      (listener as (...listenerArgs: Parameters<ProviderEventMap[T]>) => void)(...args);
    });
  }

  private emitError(): void {
    this.emit('status', { status: 'disconnected' });
  }

  private getReconnectDelay(): number {
    const exponentialDelay = MIN_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt;
    const jitter = Math.floor(Math.random() * MIN_RECONNECT_DELAY_MS);

    return Math.min(exponentialDelay + jitter, MAX_RECONNECT_DELAY_MS);
  }

  private isSocketReady(): boolean {
    return this.socket?.readyState === OPEN_READY_STATE;
  }

  private async openSocket(status: 'connecting' | 'reconnecting'): Promise<void> {
    if (this.openingSocket || !this.shouldConnect || this.connectionTerminated) return;
    this.openingSocket = true;

    try {
      if (status === 'reconnecting' && this.options.refreshTicket) {
        let refreshedTicket: string | Promise<string>;
        try {
          refreshedTicket = await this.options.refreshTicket();
        } catch (error) {
          // A refresh failure means this provider cannot safely prove that the
          // next socket has a one-shot capability. Stop this instance rather
          // than retrying the consumed ticket or spinning reconnect forever.
          this.failConnection(error instanceof Error ? error : new Error(String(error)), true);
          return;
        }
        if (typeof refreshedTicket !== 'string' || refreshedTicket.trim().length === 0) {
          this.failConnection(
            new Error('Collaboration ticket refresh returned an invalid ticket.'),
            true,
          );
          return;
        }
        this.options.ticket = refreshedTicket.trim();
      }

      if (!this.shouldConnect || this.connectionTerminated) return;

      const Constructor = this.options.webSocketConstructor ?? getRuntimeWebSocketConstructor();
      if (!Constructor) throw new Error('No WebSocket constructor is available.');

      const wsBaseUrl = this.options.wsBaseUrl ?? DEFAULT_WS_BASE_URL;
      const protocolQuery = this.legacyProtocol ? '' : '&protocol=lobe-yjs-v1';
      const socket = new Constructor(
        `${wsBaseUrl}/collaboration/${encodeURIComponent(this.id)}?clientId=${this.doc.clientID}${protocolQuery}`,
      );

      this.socket = socket;
      this.authenticated = this.legacyProtocol;
      this.isSynced = false;
      this.serverStateVector = null;
      this.emit('status', { status });

      socket.addEventListener('open', () => {
        if (this.socket !== socket) {
          socket.close();
          return;
        }

        this.reconnectAttempt = 0;

        if (this.legacyProtocol) {
          this.emit('status', { status: 'connected' });
          this.requestServerDocumentState();
          this.publishLocalAwareness();
          return;
        }

        this.emit('status', { status: 'connecting' });
        // The v1 server sends hello after opening. Do not send auth before the
        // nonce is received, and do not send any Yjs payload before auth-ok.
      });

      socket.addEventListener('message', (event) => this.handleMessage(socket, event));
      socket.addEventListener('close', () => this.handleClose(socket));
      socket.addEventListener('error', () => {
        if (this.socket === socket) this.emit('status', { status: 'disconnected' });
      });
    } catch (error) {
      this.failConnection(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.openingSocket = false;
    }
  }

  private publishLocalAwareness(): void {
    const state = this.awareness.getLocalState();
    if (state) this.sendAwareness(state, this.awareness.getSequence());
  }

  private publishLocalDocumentState(): void {
    const update = this.serverStateVector
      ? encodeStateAsUpdate(this.doc, this.serverStateVector)
      : encodeStateAsUpdate(this.doc);

    if (update.byteLength === 0) {
      this.flushPendingUpdates();
      return;
    }

    this.sendUpdate(createMessageId(this.doc.clientID, ++this.sequence), update);
    this.pendingUpdates.length = 0;
  }

  private requestServerDocumentState(): void {
    if (!this.isSocketReady() || !this.authenticated) return;

    if (this.legacyProtocol) {
      this.sendLegacy({
        stateVector: encodeYjsBase64(encodeStateVector(this.doc)),
        type: 'sync-request',
      });
      return;
    }

    this.sendV1({
      protocol: LOBE_YJS_PROTOCOL,
      stateVector: encodeYjsBase64(encodeStateVector(this.doc)),
      type: 'sync-request',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  private scheduleReconnect(): void {
    if (this.options.autoReconnect === false || !this.shouldConnect || this.reconnectTimer) return;

    const delay = this.getReconnectDelay();
    this.reconnectAttempt += 1;
    this.emit('status', { status: 'reconnecting' });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket('reconnecting');
    }, delay);
  }

  private handleClose(socket: WebSocketLike): void {
    if (this.socket !== socket) return;

    this.socket = null;
    this.authenticated = false;
    this.isSynced = false;
    this.emit('sync', false);
    this.emit('status', { status: 'disconnected' });
    if (this.options.autoReconnect === false) {
      this.shouldConnect = false;
      this.connectionTerminated = true;
      this.doc.off('update', this.updateHandler);
      this.pendingUpdates.length = 0;
      this.rejectSyncWaiters(new Error('Yjs provider cannot reconnect with this ticket.'));
      return;
    }
    this.scheduleReconnect();
  }

  private failConnection(error: Error, terminal = false): void {
    this.emitError();
    if (terminal || this.options.autoReconnect === false) {
      this.shouldConnect = false;
      this.connectionTerminated = true;
      this.doc.off('update', this.updateHandler);
      this.pendingUpdates.length = 0;
      this.rejectSyncWaiters(error);
      return;
    }
    this.scheduleReconnect();
  }

  private handleMessage(socket: WebSocketLike, event: WebSocketMessageEvent): void {
    if (this.socket !== socket) return;

    const text = getMessageText(event.data);
    if (!text) {
      this.rejectSocket(socket, 'Invalid WebSocket message.');
      return;
    }

    if (this.legacyProtocol) {
      this.handleLegacyMessage(socket, text);
      return;
    }

    const message = parseLobeYjsMessage(text);
    if (!message || !this.isServerMessage(message)) {
      this.rejectSocket(socket, 'Invalid lobe-yjs-v1 message.');
      return;
    }

    switch (message.type) {
      case 'hello': {
        this.handleHello(message);
        return;
      }
      case 'auth-ok': {
        if (message.roomId !== this.id) {
          this.rejectSocket(socket, 'Authenticated room does not match provider room.');
          return;
        }

        this.serverClientId = message.clientId;
        this.awareness.setClientId(message.clientId);
        this.authenticated = true;
        this.emit('status', { status: 'connected' });
        this.requestServerDocumentState();
        this.publishLocalAwareness();
        return;
      }
      case 'error': {
        this.emitError();
        const isTerminalTicketError =
          message.code === 'ticket_replayed' ||
          message.code === 'ticket_expired' ||
          message.code === 'replay_store_full';
        if (message.fatal !== false || isTerminalTicketError) {
          this.shouldConnect = false;
          // A fatal protocol/auth error invalidates this provider session. A
          // later explicit connect must use a new provider or a new ticket;
          // never retry the consumed capability through this instance.
          this.connectionTerminated = true;
          this.doc.off('update', this.updateHandler);
          this.pendingUpdates.length = 0;
          this.rejectSyncWaiters(new Error(message.message));
          socket.close(CLOSE_CODE_TICKET_REJECTED, message.message);
        }
        return;
      }
      case 'sync': {
        this.handleSync(message.update, message.awareness, message.serverStateVector);
        return;
      }
      case 'awareness': {
        this.handleAwareness(message);
        return;
      }
      case 'update': {
        this.handleUpdate(message.sender, message.messageId, message.update);
        return;
      }
      case 'update-ack': {
        this.unacknowledgedUpdates.delete(message.messageId);
        this.rememberSeenMessageId(message.messageId);
        return;
      }
      default: {
        return;
      }
    }
  }

  private handleHello(message: LobeYjsHelloMessage): void {
    if (message.roomId !== this.id) {
      this.rejectSocket(this.socket, 'Hello room does not match provider room.');
      return;
    }

    this.sendV1({
      clientId: this.doc.clientID,
      clientKind: this.options.clientKind ?? 'browser',
      documentId: this.options.documentId,
      nonce: message.nonce,
      protocol: LOBE_YJS_PROTOCOL,
      requestId: this.options.requestId,
      ticket: this.options.ticket ?? null,
      type: 'auth',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  private handleSync(
    encodedUpdate: string,
    awareness: Array<{ clientId: number; sequence?: number; state: unknown }>,
    encodedServerStateVector?: string,
  ): void {
    try {
      applyUpdate(this.doc, decodeYjsBase64(encodedUpdate), this);
      this.serverStateVector = encodedServerStateVector
        ? decodeYjsBase64(encodedServerStateVector)
        : null;
    } catch {
      this.rejectSocket(this.socket, 'Invalid Yjs sync payload.');
      return;
    }

    for (const snapshot of awareness) {
      const state = deserializeUserState(snapshot.state as never);
      this.awareness.updateRemoteState(snapshot.clientId, state, snapshot.sequence);
    }

    this.isSynced = true;
    this.emit('sync', true);
    this.resolveSyncWaiters();
    this.publishLocalDocumentState();
    this.resendUnacknowledgedUpdates();
  }

  private handleAwareness(message: LobeYjsAwarenessMessage): void {
    if (message.sender === undefined || this.isSelfClientId(message.sender)) return;

    this.awareness.updateRemoteState(
      message.sender,
      deserializeUserState(message.state),
      message.sequence,
    );
  }

  private handleUpdate(sender: number | undefined, messageId: string, encodedUpdate: string): void {
    if (this.seenMessageIds.has(messageId)) return;
    this.rememberSeenMessageId(messageId);
    if (sender === undefined || this.isSelfClientId(sender)) return;

    try {
      const update = decodeYjsBase64(encodedUpdate);
      applyUpdate(this.doc, update, this);
      this.emit('update', update);
    } catch {
      this.emitError();
    }
  }

  private handleLegacyMessage(socket: WebSocketLike, text: string): void {
    let message: LegacyMessage;

    try {
      message = JSON.parse(text) as LegacyMessage;
    } catch {
      this.rejectSocket(socket, 'Invalid JSON message.');
      return;
    }

    if (message.type === 'awareness') {
      if (this.isSelfClientId(message.sender)) return;
      this.awareness.updateRemoteState(message.sender, message.state);
      return;
    }

    if (message.type === 'sync') {
      this.handleSync(message.update, message.awareness);
      return;
    }

    if (message.type !== 'update') return;

    if (this.isSelfClientId(message.sender)) return;

    try {
      const update = decodeYjsBase64(message.update);
      applyUpdate(this.doc, update, this);
      this.emit('update', update);
    } catch {
      this.emitError();
    }
  }

  private isServerMessage(message: LobeYjsMessage): message is LobeYjsServerMessage {
    return (
      message.type === 'auth-ok' ||
      message.type === 'awareness' ||
      message.type === 'error' ||
      message.type === 'hello' ||
      message.type === 'sync' ||
      message.type === 'update' ||
      message.type === 'update-ack'
    );
  }

  private rejectSocket(socket: WebSocketLike | null, reason: string): void {
    this.shouldConnect = false;
    this.connectionTerminated = true;
    this.doc.off('update', this.updateHandler);
    this.pendingUpdates.length = 0;
    this.emitError();
    this.rejectSyncWaiters(new Error(reason));
    socket?.close(CLOSE_CODE_INVALID_MESSAGE, reason);
  }

  /** Filter both the stable Yjs identity and the current room sender ID. */
  private isSelfClientId(clientId: number | undefined): boolean {
    return (
      clientId === undefined || clientId === this.doc.clientID || clientId === this.serverClientId
    );
  }

  private rejectSyncWaiters(error: Error): void {
    this.pendingSyncWaiters.forEach((waiter) => waiter.reject(error));
    this.pendingSyncWaiters.clear();
  }

  private resolveSyncWaiters(): void {
    this.pendingSyncWaiters.forEach((waiter) => waiter.resolve());
    this.pendingSyncWaiters.clear();
  }

  private sendAwareness(state: UserState | null, sequence: number): void {
    if (!this.isSocketReady() || !this.authenticated) return;

    if (this.legacyProtocol) {
      this.sendLegacy({
        sender: this.doc.clientID,
        state,
        type: 'awareness',
      });
      return;
    }

    this.sendV1({
      protocol: LOBE_YJS_PROTOCOL,
      sequence,
      state: serializeUserState(state),
      type: 'awareness',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  private sendUpdate(id: string, update: Uint8Array): void {
    if (!this.isSocketReady() || !this.authenticated) {
      this.pendingUpdates.push({ id, update: new Uint8Array(update) });
      return;
    }

    if (this.legacyProtocol) {
      this.sendLegacy({
        sender: this.doc.clientID,
        type: 'update',
        update: encodeYjsBase64(update),
      });
      return;
    }

    this.rememberSeenMessageId(id);
    this.unacknowledgedUpdates.set(id, new Uint8Array(update));
    this.sendV1({
      messageId: id,
      protocol: LOBE_YJS_PROTOCOL,
      type: 'update',
      update: encodeYjsBase64(update),
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  private flushPendingUpdates(): void {
    if (!this.authenticated || !this.isSocketReady() || this.pendingUpdates.length === 0) return;

    const pendingUpdates = this.pendingUpdates.splice(0);
    for (const pending of pendingUpdates) this.sendUpdate(pending.id, pending.update);
  }

  private rememberSeenMessageId(messageId: string): void {
    this.seenMessageIds.add(messageId);
    const maxSeenMessageIds = Math.max(
      1,
      this.options.maxSeenMessageIds ?? DEFAULT_MAX_SEEN_MESSAGE_IDS,
    );
    while (this.seenMessageIds.size > maxSeenMessageIds) {
      const oldest = this.seenMessageIds.values().next().value;
      if (oldest === undefined) break;
      this.seenMessageIds.delete(oldest);
    }
  }

  private resendUnacknowledgedUpdates(): void {
    if (!this.authenticated || !this.isSocketReady() || this.legacyProtocol) return;

    for (const [id, update] of this.unacknowledgedUpdates) {
      this.sendV1({
        messageId: id,
        protocol: LOBE_YJS_PROTOCOL,
        type: 'update',
        update: encodeYjsBase64(update),
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
    }
  }

  private sendLegacy(message: object): void {
    if (!this.isSocketReady()) return;
    this.socket?.send(JSON.stringify(message));
  }

  private sendV1(message: LobeYjsClientMessage): void {
    if (!this.isSocketReady()) return;
    this.socket?.send(encodeLobeYjsMessage(message));
  }
}
