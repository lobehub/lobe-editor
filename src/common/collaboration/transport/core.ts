import {
  type CollaborationDescriptor,
  type CollaborationPeerId,
  type CollaborationPresenceSnapshot,
  type CollaborationSenderId,
  encodeCollaborationV2Message,
  LOBE_COLLABORATION_PROTOCOL,
  LOBE_COLLABORATION_PROTOCOL_VERSION,
  parseCollaborationV2ServerMessage,
} from './protocol';

const OPEN_READY_STATE = 1;
const MIN_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10_000;
const DEFAULT_MAX_SEEN_MESSAGE_IDS = 10_000;
const CLOSE_CODE_INVALID_MESSAGE = 4400;
const CLOSE_CODE_TICKET_REJECTED = 4401;

export interface CollaborationWebSocketMessageEvent {
  data?: ArrayBuffer | Uint8Array | string;
}

export interface CollaborationWebSocketLike {
  addEventListener(
    type: string,
    listener: (event: CollaborationWebSocketMessageEvent) => void,
  ): void;
  close(code?: number, reason?: string): void;
  readyState: number;
  send(data: string): void;
}

export type CollaborationWebSocketConstructor = new (url: string) => CollaborationWebSocketLike;
export type CollaborationRefreshTicket = () => string | Promise<string>;
export type CollaborationTransportStatus =
  'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface CollaborationEngineAdapter<Update> {
  readonly peerId: CollaborationPeerId;
  applyRemoteUpdate(update: Update): void;
  applySnapshot(snapshot: string): void;
  decodeUpdate(payload: string): Update;
  encodeUpdate(update: Update): string;
  exportUpdatesSince(causalVersion: string): readonly Update[];
  getCausalVersion(): string;
  subscribeLocalUpdates(listener: (update: Update) => void): () => void;
}

export interface CollaborationTransportCoreOptions<Update> {
  autoReconnect?: boolean;
  clientKind: 'agent' | 'browser';
  descriptor: CollaborationDescriptor;
  documentId?: string;
  engine: CollaborationEngineAdapter<Update>;
  maxSeenMessageIds?: number;
  onPresence?: (presence: CollaborationPresenceSnapshot) => void;
  refreshTicket?: CollaborationRefreshTicket;
  requestId?: string;
  roomId: string;
  ticket: string;
  webSocketConstructor?: CollaborationWebSocketConstructor;
  wsBaseUrl: string;
}

interface PendingUpdate<Update> {
  id: string;
  payload: string;
  update: Update;
}

interface PendingWaiter {
  reject(error: Error): void;
  resolve(): void;
}

interface CoreEventMap {
  error: (error: Error) => void;
  presence: (presence: CollaborationPresenceSnapshot) => void;
  status: (status: CollaborationTransportStatus) => void;
  sync: (synced: boolean) => void;
}

export class CollaborationTransportCoreError extends Error {
  readonly code: string;
  readonly fatal: boolean;

  constructor(message: string, code: string, fatal = true) {
    super(message);
    this.name = 'CollaborationTransportCoreError';
    this.code = code;
    this.fatal = fatal;
  }
}

const createMessageId = (peerId: string, sequence: number): string =>
  `${peerId}-${sequence.toString(36)}-${Date.now().toString(36)}`;

const sameDescriptor = (left: CollaborationDescriptor, right: CollaborationDescriptor): boolean =>
  left.engine === right.engine &&
  left.bindingSchema === right.bindingSchema &&
  left.epoch === right.epoch;

const runtimeWebSocket = (): CollaborationWebSocketConstructor | undefined => {
  const value = (
    globalThis as typeof globalThis & { WebSocket?: CollaborationWebSocketConstructor }
  ).WebSocket;
  return value;
};

export class CollaborationTransportCore<Update> {
  private readonly listeners: { [K in keyof CoreEventMap]: Set<CoreEventMap[K]> } = {
    error: new Set(),
    presence: new Set(),
    status: new Set(),
    sync: new Set(),
  };
  private readonly pendingSyncWaiters = new Set<PendingWaiter>();
  private readonly pendingUpdateWaiters = new Set<PendingWaiter>();
  private readonly pendingUpdates: PendingUpdate<Update>[] = [];
  private readonly presence = new Map<string, CollaborationPresenceSnapshot>();
  private readonly unacknowledged = new Map<string, PendingUpdate<Update>>();
  private readonly seenMessageIds = new Set<string>();
  private readonly unsubscribeLocalUpdates: () => void;
  private authenticated = false;
  private connectionTerminated = false;
  private disposed = false;
  private socketGeneration = 0;
  private handshake: 'idle' | 'awaiting-hello' | 'authenticated' | 'synced' = 'idle';
  private openingSocket = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private presenceSequence = 0;
  private shouldConnect = false;
  private socket: CollaborationWebSocketLike | null = null;
  private synced = false;
  private syncInvalidatedBeforeClose = false;
  private nonce: string | null = null;
  private sender: CollaborationSenderId | null = null;

  constructor(private readonly options: CollaborationTransportCoreOptions<Update>) {
    this.unsubscribeLocalUpdates = options.engine.subscribeLocalUpdates((update) => {
      this.enqueueUpdate(update, false);
    });
  }

  connect(): void {
    if (this.disposed || this.connectionTerminated) {
      this.emit('status', 'disconnected');
      return;
    }
    this.shouldConnect = true;
    if (this.socket || this.openingSocket || this.reconnectTimer) return;
    void this.openSocket(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');
  }

  disconnect(): void {
    this.shouldConnect = false;
    this.socketGeneration += 1;
    this.clearReconnectTimer();
    const socket = this.socket;
    this.socket = null;
    this.authenticated = false;
    this.synced = false;
    this.handshake = 'idle';
    this.sender = null;
    this.presence.clear();
    this.syncInvalidatedBeforeClose = false;
    if (socket) socket.close();
    this.emit('sync', false);
    this.emit('status', 'disconnected');
    this.rejectWaiters(this.pendingSyncWaiters, new Error('Collaboration transport disconnected.'));
    this.rejectWaiters(
      this.pendingUpdateWaiters,
      new Error('Collaboration transport disconnected.'),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.connectionTerminated = true;
    this.disconnect();
    this.unsubscribeLocalUpdates();
    this.pendingUpdates.length = 0;
    this.unacknowledged.clear();
    this.seenMessageIds.clear();
    this.presence.clear();
  }

  waitForSync(): Promise<void> {
    if (this.synced) return Promise.resolve();
    if (this.connectionTerminated) {
      return Promise.reject(
        new CollaborationTransportCoreError('Transport is terminated.', 'terminated'),
      );
    }
    return new Promise<void>((resolve, reject) => {
      this.pendingSyncWaiters.add({ resolve, reject });
    });
  }

  waitForPendingUpdates(timeoutMs = 10_000): Promise<void> {
    if (this.pendingUpdates.length === 0 && this.unacknowledged.size === 0)
      return Promise.resolve();
    if (this.connectionTerminated || !this.shouldConnect) {
      return Promise.reject(new Error('Collaboration transport is disconnected.'));
    }
    const timeout = Number.isFinite(timeoutMs)
      ? Math.min(Math.max(Math.trunc(timeoutMs), 1), 10 * 60_000)
      : 10_000;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const waiter: PendingWaiter = {
        reject: (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.pendingUpdateWaiters.delete(waiter);
          reject(error);
        },
        resolve: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.pendingUpdateWaiters.delete(waiter);
          resolve();
        },
      };
      const timer = setTimeout(
        () => waiter.reject(new Error('Collaboration update acknowledgement timed out.')),
        timeout,
      );
      this.pendingUpdateWaiters.add(waiter);
      this.resolvePendingUpdateWaiters();
    });
  }

  setPresence(state: unknown, sequence = ++this.presenceSequence): void {
    if (!this.authenticated || !this.isSocketReady()) return;
    this.send({
      ...this.base(),
      sequence,
      state,
      type: 'presence',
    });
  }

  clearPresence(): void {
    this.setPresence(null);
  }

  getPresence(): readonly CollaborationPresenceSnapshot[] {
    return [...this.presence.values()];
  }

  on<T extends keyof CoreEventMap>(type: T, listener: CoreEventMap[T]): void {
    this.listeners[type].add(listener as never);
  }

  off<T extends keyof CoreEventMap>(type: T, listener: CoreEventMap[T]): void {
    this.listeners[type].delete(listener as never);
  }

  private enqueueUpdate(update: Update, dedupeByPayload: boolean): void {
    const payload = this.options.engine.encodeUpdate(update);
    if (dedupeByPayload && this.hasQueuedPayload(payload)) return;
    const pending = {
      id: createMessageId(this.options.engine.peerId, ++this.sequence),
      payload,
      update,
    };
    if (!this.authenticated || !this.isSocketReady() || !this.synced) {
      this.pendingUpdates.push(pending);
      return;
    }
    this.sendUpdate(pending);
  }

  private hasQueuedPayload(payload: string): boolean {
    return (
      this.pendingUpdates.some((item) => item.payload === payload) ||
      [...this.unacknowledged.values()].some((item) => item.payload === payload)
    );
  }

  private sendUpdate(update: PendingUpdate<Update>): void {
    if (!this.authenticated || !this.isSocketReady() || !this.synced) {
      if (!this.hasQueuedPayload(update.payload)) this.pendingUpdates.push(update);
      return;
    }
    this.unacknowledged.set(update.id, update);
    this.send({
      ...this.base(),
      messageId: update.id,
      type: 'update',
      update: update.payload,
    });
  }

  private flushPendingUpdates(): void {
    if (!this.authenticated || !this.isSocketReady() || !this.synced) return;
    const pending = this.pendingUpdates.splice(0);
    pending.forEach((update) => this.sendUpdate(update));
  }

  private resendUnacknowledged(): void {
    if (!this.authenticated || !this.isSocketReady()) return;
    for (const update of this.unacknowledged.values()) {
      this.send({ ...this.base(), messageId: update.id, type: 'update', update: update.payload });
    }
  }

  private async openSocket(status: 'connecting' | 'reconnecting'): Promise<void> {
    if (this.openingSocket || !this.shouldConnect || this.connectionTerminated || this.disposed)
      return;
    this.openingSocket = true;
    const generation = ++this.socketGeneration;
    try {
      if (status === 'reconnecting' && this.options.refreshTicket) {
        const ticket = await this.options.refreshTicket();
        if (this.disposed || !this.shouldConnect || generation !== this.socketGeneration) return;
        if (typeof ticket !== 'string' || ticket.trim().length === 0) {
          this.fail(
            new CollaborationTransportCoreError(
              'Ticket refresh returned an invalid ticket.',
              'ticket_invalid',
            ),
          );
          return;
        }
        this.options.ticket = ticket.trim();
      }
      if (this.disposed || !this.shouldConnect || generation !== this.socketGeneration) return;
      const Constructor = this.options.webSocketConstructor ?? runtimeWebSocket();
      if (!Constructor) throw new Error('No WebSocket constructor is available.');
      const socket = new Constructor(
        `${this.options.wsBaseUrl}/collaboration/${encodeURIComponent(this.options.roomId)}?protocol=${LOBE_COLLABORATION_PROTOCOL}`,
      );
      this.socket = socket;
      this.authenticated = false;
      this.synced = false;
      this.handshake = 'awaiting-hello';
      this.syncInvalidatedBeforeClose = false;
      this.emit('status', status);
      socket.addEventListener('open', () => undefined);
      socket.addEventListener('message', (event) => this.handleMessage(socket, event));
      socket.addEventListener('close', () => this.handleClose(socket));
      socket.addEventListener('error', () => {
        if (socket === this.socket) this.invalidateTransport();
      });
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.openingSocket = false;
    }
  }

  private handleMessage(
    socket: CollaborationWebSocketLike,
    event: CollaborationWebSocketMessageEvent,
  ): void {
    if (socket !== this.socket) return;
    const text =
      typeof event.data === 'string'
        ? event.data
        : event.data instanceof ArrayBuffer
          ? new TextDecoder().decode(event.data)
          : event.data instanceof Uint8Array
            ? new TextDecoder().decode(event.data)
            : null;
    const message = text ? parseCollaborationV2ServerMessage(text) : null;
    if (!message) {
      this.rejectSocket(socket, 'Invalid lobe-collaboration-v2 message.');
      return;
    }
    if (message.type === 'hello') {
      if (this.handshake !== 'awaiting-hello') {
        this.rejectSocket(socket, 'Unexpected collaboration hello.');
        return;
      }
      this.nonce = message.nonce;
      this.send({
        ...this.base(),
        nonce: message.nonce,
        peerId: this.options.engine.peerId,
        ticket: this.options.ticket,
        clientKind: this.options.clientKind,
        documentId: this.options.documentId,
        requestId: this.options.requestId,
        type: 'auth',
      });
      return;
    }
    if (
      !('roomId' in message) ||
      message.roomId !== this.options.roomId ||
      !sameDescriptor(message.descriptor, this.options.descriptor)
    ) {
      this.rejectSocket(socket, 'Collaboration room or descriptor mismatch.');
      return;
    }
    switch (message.type) {
      case 'auth-ok': {
        if (this.handshake !== 'awaiting-hello') {
          this.rejectSocket(socket, 'Unexpected collaboration auth-ok.');
          return;
        }
        if (message.peerId !== this.options.engine.peerId) {
          this.rejectSocket(socket, 'Authenticated peer does not match the engine peer.');
          return;
        }
        this.sender = message.sender;
        this.authenticated = true;
        this.handshake = 'authenticated';
        this.emit('status', 'connected');
        this.send({
          ...this.base(),
          causalVersion: this.options.engine.getCausalVersion(),
          type: 'sync-request',
        });
        return;
      }
      case 'sync': {
        if (!this.authenticated || this.handshake !== 'authenticated') {
          this.rejectSocket(socket, 'Collaboration sync arrived before authentication.');
          return;
        }
        try {
          if (message.snapshot !== undefined) this.options.engine.applySnapshot(message.snapshot);
          for (const update of message.updates)
            this.options.engine.applyRemoteUpdate(this.options.engine.decodeUpdate(update));
        } catch (error) {
          this.fail(
            error instanceof Error ? error : new Error('Collaboration sync import failed.'),
          );
          return;
        }
        this.synced = true;
        this.handshake = 'synced';
        this.resendUnacknowledged();
        this.presence.clear();
        message.presence.forEach((presence) => {
          this.presence.set(presence.peerId, presence);
          this.emit('presence', presence);
        });
        for (const update of this.options.engine.exportUpdatesSince(message.causalVersion))
          this.enqueueUpdate(update, true);
        this.flushPendingUpdates();
        this.emit('sync', true);
        this.resolveWaiters(this.pendingSyncWaiters);
        return;
      }
      case 'update': {
        if (this.handshake !== 'synced') {
          this.rejectSocket(socket, 'Collaboration update arrived before sync.');
          return;
        }
        if (
          !message.sender ||
          message.sender === this.sender ||
          this.seenMessageIds.has(message.messageId)
        )
          return;
        try {
          this.options.engine.applyRemoteUpdate(this.options.engine.decodeUpdate(message.update));
          this.rememberSeen(message.messageId);
        } catch (error) {
          this.fail(
            error instanceof Error ? error : new Error('Collaboration update import failed.'),
          );
        }
        return;
      }
      case 'update-ack': {
        if (this.handshake !== 'synced') {
          this.rejectSocket(socket, 'Collaboration ack arrived before sync.');
          return;
        }
        this.unacknowledged.delete(message.messageId);
        this.rememberSeen(message.messageId);
        this.resolvePendingUpdateWaiters();
        return;
      }
      case 'presence': {
        if (this.handshake !== 'synced') {
          this.rejectSocket(socket, 'Collaboration presence arrived before sync.');
          return;
        }
        if (message.state === null) this.presence.delete(message.peerId);
        else this.presence.set(message.peerId, message);
        this.emit('presence', message);
        return;
      }
      case 'error': {
        this.fail(
          new CollaborationTransportCoreError(
            message.message,
            message.code,
            message.fatal !== false,
          ),
        );
        return;
      }
      default: {
        return;
      }
    }
  }

  private handleClose(socket: CollaborationWebSocketLike): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.invalidateTransport();
    if (this.connectionTerminated) return;
    if (this.options.autoReconnect !== false && this.shouldConnect) this.scheduleReconnect();
    else this.fail(new Error('Collaboration socket closed.'));
  }

  private invalidateTransport(): void {
    this.authenticated = false;
    this.synced = false;
    if (!this.syncInvalidatedBeforeClose) {
      this.syncInvalidatedBeforeClose = true;
      this.emit('sync', false);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.shouldConnect || this.connectionTerminated) return;
    const delay = Math.min(
      MIN_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt +
        Math.floor(Math.random() * MIN_RECONNECT_DELAY_MS),
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempt += 1;
    this.emit('status', 'reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket('reconnecting');
    }, delay);
  }

  private rejectSocket(socket: CollaborationWebSocketLike, reason: string): void {
    this.connectionTerminated = true;
    this.shouldConnect = false;
    this.fail(new CollaborationTransportCoreError(reason, 'invalid_protocol'));
    socket.close(CLOSE_CODE_INVALID_MESSAGE, reason);
  }

  private fail(error: Error): void {
    this.connectionTerminated = true;
    this.shouldConnect = false;
    this.invalidateTransport();
    this.emit('error', error);
    this.rejectWaiters(this.pendingSyncWaiters, error);
    this.rejectWaiters(this.pendingUpdateWaiters, error);
    this.socket?.close(CLOSE_CODE_TICKET_REJECTED, error.message);
  }

  private send(message: object): void {
    if (!this.isSocketReady()) return;
    this.socket?.send(encodeCollaborationV2Message(message as never));
  }

  private emit<T extends keyof CoreEventMap>(type: T, ...args: Parameters<CoreEventMap[T]>): void {
    this.listeners[type].forEach((listener) =>
      (listener as (...listenerArgs: Parameters<CoreEventMap[T]>) => void)(...args),
    );
  }

  private base() {
    return {
      descriptor: this.options.descriptor,
      protocol: LOBE_COLLABORATION_PROTOCOL,
      roomId: this.options.roomId,
      version: LOBE_COLLABORATION_PROTOCOL_VERSION,
    } as const;
  }

  private isSocketReady(): boolean {
    return this.socket?.readyState === OPEN_READY_STATE;
  }

  private rememberSeen(messageId: string): void {
    this.seenMessageIds.add(messageId);
    const max = Math.max(1, this.options.maxSeenMessageIds ?? DEFAULT_MAX_SEEN_MESSAGE_IDS);
    while (this.seenMessageIds.size > max) {
      const first = this.seenMessageIds.values().next().value;
      if (first === undefined) break;
      this.seenMessageIds.delete(first);
    }
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private resolveWaiters(waiters: Set<PendingWaiter>): void {
    waiters.forEach((waiter) => waiter.resolve());
    waiters.clear();
  }

  private rejectWaiters(waiters: Set<PendingWaiter>, error: Error): void {
    waiters.forEach((waiter) => waiter.reject(error));
    waiters.clear();
  }

  private resolvePendingUpdateWaiters(): void {
    if (this.pendingUpdates.length > 0 || this.unacknowledged.size > 0) return;
    this.resolveWaiters(this.pendingUpdateWaiters);
  }
}
