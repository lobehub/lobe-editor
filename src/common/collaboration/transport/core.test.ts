import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CollaborationTransportCore,
  type CollaborationEngineAdapter,
  type CollaborationWebSocketConstructor,
  type CollaborationWebSocketLike,
  type CollaborationWebSocketMessageEvent,
} from './core';
import {
  LOBE_COLLABORATION_PROTOCOL,
  LOBE_COLLABORATION_PROTOCOL_VERSION,
  parseCollaborationV2ClientMessage,
  type CollaborationDescriptor,
} from './protocol';

const descriptor: CollaborationDescriptor = {
  bindingSchema: 'lexical-loro-v1',
  engine: 'loro',
  epoch: 0,
};

class TestEngine implements CollaborationEngineAdapter<string> {
  readonly peerId = '18446744073709551615';
  readonly applied: string[] = [];
  private readonly listeners = new Set<(update: string) => void>();

  subscribeLocalUpdates(listener: (update: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(update: string): void {
    this.listeners.forEach((listener) => listener(update));
  }

  encodeUpdate(update: string): string {
    return update;
  }

  decodeUpdate(payload: string): string {
    return payload;
  }

  applySnapshot(snapshot: string): void {
    this.applied.push(`snapshot:${snapshot}`);
  }

  applyRemoteUpdate(update: string): void {
    this.applied.push(update);
  }

  exportUpdatesSince(): readonly string[] {
    return [];
  }

  getCausalVersion(): string {
    return 'v0';
  }
}

class CoreRoom {
  readonly sockets = new Set<CoreSocket>();
  readonly seen = new Set<string>();
  applications = 0;
  dropNextAck = false;
  sendSyncBeforeAuth = false;
  connect(socket: CoreSocket): void {
    this.sockets.add(socket);
    queueMicrotask(() => {
      if (this.sendSyncBeforeAuth) {
        socket.receive({
          ...this.base(),
          causalVersion: 'v0',
          presence: [],
          type: 'sync',
          updates: [],
        });
        return;
      }
      socket.receive({
        nonce: 'challenge',
        protocol: LOBE_COLLABORATION_PROTOCOL,
        type: 'hello',
        version: LOBE_COLLABORATION_PROTOCOL_VERSION,
      });
    });
  }

  disconnect(socket: CoreSocket): void {
    this.sockets.delete(socket);
  }

  closeAll(): void {
    [...this.sockets].forEach((socket) => socket.close());
  }

  handle(socket: CoreSocket, text: string): void {
    const message = parseCollaborationV2ClientMessage(text);
    if (!message) throw new Error('invalid client message');
    if (message.type === 'auth') {
      socket.receive({
        ...this.base(),
        peerId: message.peerId,
        sender: socket.sender,
        type: 'auth-ok',
      });
      return;
    }
    if (message.type === 'sync-request') {
      socket.receive({
        ...this.base(),
        causalVersion: 'v0',
        presence: [],
        type: 'sync',
        updates: [],
      });
      return;
    }
    if (message.type !== 'update') return;
    if (!this.seen.has(message.messageId)) {
      this.seen.add(message.messageId);
      this.applications += 1;
    }
    if (this.dropNextAck) {
      this.dropNextAck = false;
      return;
    }
    socket.receive({
      ...this.base(),
      acceptedRoomRevision: this.applications,
      causalVersion: 'v1',
      messageId: message.messageId,
      type: 'update-ack',
    });
  }

  sendError(socket: CoreSocket, code: string, fatal = true): void {
    socket.receive({
      ...this.base(),
      code,
      fatal,
      message: code === 'ticket_expired' ? 'Collaboration ticket has expired.' : 'Auth failed.',
      type: 'error',
    });
  }

  expire(socket: CoreSocket): void {
    this.sendError(socket, 'ticket_expired');
  }

  private base() {
    return {
      descriptor,
      protocol: LOBE_COLLABORATION_PROTOCOL,
      roomId: 'room',
      version: LOBE_COLLABORATION_PROTOCOL_VERSION,
    } as const;
  }
}

class CoreSocket implements CollaborationWebSocketLike {
  readonly readyState = 1;
  readonly sender = `sender-${Math.random().toString(36).slice(2)}`;
  private readonly listeners = new Map<
    string,
    Set<(event: CollaborationWebSocketMessageEvent) => void>
  >();

  constructor(private readonly room: CoreRoom) {
    room.connect(this);
  }

  addEventListener(
    type: string,
    listener: (event: CollaborationWebSocketMessageEvent) => void,
  ): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.room.handle(this, data);
  }

  close(): void {
    this.room.disconnect(this);
    this.listeners.get('close')?.forEach((listener) => listener({}));
  }

  receive(message: unknown): void {
    this.listeners
      .get('message')
      ?.forEach((listener) => listener({ data: JSON.stringify(message) }));
  }
}

const createCore = (room: CoreRoom, engine = new TestEngine()) => ({
  core: new CollaborationTransportCore({
    autoReconnect: true,
    clientKind: 'browser',
    descriptor,
    engine,
    roomId: 'room',
    ticket: 'ticket',
    webSocketConstructor: class {
      constructor(_url: string) {
        return new CoreSocket(room) as unknown as this;
      }
    } as unknown as CollaborationWebSocketConstructor,
    wsBaseUrl: 'ws://fake',
  }),
  engine,
});

describe('shared collaboration transport core', () => {
  afterEach(() => vi.useRealTimers());

  it('reconnects and resends one unacknowledged update without reapplying it', async () => {
    vi.useFakeTimers();
    const room = new CoreRoom();
    const { core, engine } = createCore(room);
    core.connect();
    await vi.runAllTicks();
    await core.waitForSync();

    room.dropNextAck = true;
    engine.emit('offline-edit');
    const pending = core.waitForPendingUpdates(10_000);
    room.closeAll();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toBeUndefined();
    expect(room.applications).toBe(1);
    core.dispose();
  });

  it('rejects a sync frame that arrives before authentication', async () => {
    const room = new CoreRoom();
    room.sendSyncBeforeAuth = true;
    const { core } = createCore(room);
    const errors: Error[] = [];
    core.on('error', (error) => errors.push(error));
    core.connect();
    await expect(core.waitForSync()).rejects.toThrow('before authentication');
    expect(errors).toHaveLength(1);
    core.dispose();
  });

  it('dispose cancels a reconnect generation and cannot be revived', async () => {
    vi.useFakeTimers();
    const room = new CoreRoom();
    const { core } = createCore(room);
    core.connect();
    await vi.runAllTicks();
    await core.waitForSync();
    room.closeAll();
    core.dispose();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(room.sockets.size).toBe(0);
    core.connect();
    expect(room.sockets.size).toBe(0);
  });

  it('refreshes a reusable ticket after a fatal expiry without terminating the transport', async () => {
    vi.useFakeTimers();
    const room = new CoreRoom();
    const refreshTicket = vi.fn(() => 'fresh-ticket');
    const engine = new TestEngine();
    const core = new CollaborationTransportCore({
      autoReconnect: true,
      clientKind: 'browser',
      descriptor,
      engine,
      refreshTicket,
      roomId: 'room',
      ticket: 'initial-ticket',
      webSocketConstructor: class {
        constructor(_url: string) {
          return new CoreSocket(room) as unknown as this;
        }
      } as unknown as CollaborationWebSocketConstructor,
      wsBaseUrl: 'ws://fake',
    });
    const errors: Error[] = [];
    core.on('error', (error) => errors.push(error));
    core.connect();
    await vi.runAllTicks();
    await core.waitForSync();
    const socket = [...room.sockets][0];
    room.expire(socket);
    const reconnect = core.waitForSync();
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(reconnect).resolves.toBeUndefined();
    expect(refreshTicket).toHaveBeenCalledOnce();
    expect(errors).toMatchObject([{ code: 'ticket_expired', fatal: false }]);
    core.dispose();
  });

  it('keeps an unacknowledged update queued across ticket expiry and refresh', async () => {
    vi.useFakeTimers();
    const room = new CoreRoom();
    const refreshTicket = vi.fn(() => 'fresh-ticket');
    const engine = new TestEngine();
    const core = new CollaborationTransportCore({
      autoReconnect: true,
      clientKind: 'browser',
      descriptor,
      engine,
      refreshTicket,
      roomId: 'room',
      ticket: 'initial-ticket',
      webSocketConstructor: class {
        constructor(_url: string) {
          return new CoreSocket(room) as unknown as this;
        }
      } as unknown as CollaborationWebSocketConstructor,
      wsBaseUrl: 'ws://fake',
    });
    core.connect();
    await vi.runAllTicks();
    await core.waitForSync();
    room.dropNextAck = true;
    engine.emit('offline-edit');
    const pending = core.waitForPendingUpdates(10_000);
    room.expire([...room.sockets][0]);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toBeUndefined();
    expect(refreshTicket).toHaveBeenCalledOnce();
    expect(room.applications).toBe(1);
    core.dispose();
  });

  it('reports nonfatal server errors without forcing reconnect or termination', async () => {
    const room = new CoreRoom();
    const { core } = createCore(room);
    const errors: Error[] = [];
    core.on('error', (error) => errors.push(error));
    core.connect();
    await core.waitForSync();
    room.sendError([...room.sockets][0], 'rate_limited', false);
    expect(errors).toMatchObject([{ code: 'rate_limited', fatal: false }]);
    await expect(core.waitForSync()).resolves.toBeUndefined();
    expect(room.sockets.size).toBe(1);
    core.dispose();
  });

  it('does not leave a sync waiter pending when auto reconnect is disabled', async () => {
    const room = new CoreRoom();
    const engine = new TestEngine();
    const core = new CollaborationTransportCore({
      autoReconnect: false,
      clientKind: 'browser',
      descriptor,
      engine,
      roomId: 'room',
      ticket: 'ticket',
      webSocketConstructor: class {
        constructor(_url: string) {
          return new CoreSocket(room) as unknown as this;
        }
      } as unknown as CollaborationWebSocketConstructor,
      wsBaseUrl: 'ws://fake',
    });
    let failure: Promise<void> | undefined;
    const syncListener = (synced: boolean): void => {
      if (!synced) failure = core.waitForSync();
    };
    core.on('sync', syncListener);
    core.connect();
    await core.waitForSync();
    room.expire([...room.sockets][0]);
    await expect(failure).rejects.toMatchObject({ code: 'ticket_expired' });
    core.off('sync', syncListener);
    core.dispose();
  });

  it('preserves the original terminal error when sync listeners wait during failure', async () => {
    const room = new CoreRoom();
    const { core } = createCore(room);
    let syncFailure: Promise<void> | undefined;
    const syncListener = (synced: boolean): void => {
      if (!synced) syncFailure = core.waitForSync();
    };
    core.on('sync', syncListener);
    core.connect();
    await core.waitForSync();
    room.sendError([...room.sockets][0], 'unauthorized');
    await expect(syncFailure).rejects.toMatchObject({ code: 'unauthorized' });
    core.off('sync', syncListener);
    core.dispose();
  });
});
