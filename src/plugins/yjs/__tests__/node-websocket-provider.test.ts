import { type UserState } from '@lexical/yjs';
import { $createRangeSelection, $getRoot, $isTextNode, $setSelection } from 'lexical';
import type { LexicalEditor } from 'lexical';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __createCollaborativeAgentEditorForTesting,
  __exportCollaborativeAgentEditorProjectionForPersistence,
  CollaborativeAgentEditor,
  hashRewriteText,
} from '@/headless/collaborative-agent-editor';
import { captureCollaborativeRewriteSelection } from '@/plugins/yjs';
import {
  decodeYjsBase64,
  encodeYjsBase64,
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
  type LobeYjsClientMessage,
} from '../protocol';
import {
  NodeWebSocketYjsProvider,
  type WebSocketLike,
  type WebSocketMessageEvent,
} from '../node-websocket-provider';
import { WebSocketAwareness, WebSocketYjsProvider } from '../websocket-provider';

type Listener = (event: WebSocketMessageEvent) => void;

class InMemoryRoomServer {
  readonly doc = new Doc();
  readonly sockets: FakeWebSocket[] = [];
  readonly awareness = new Map<number, unknown>();
  readonly authTickets: Array<string | null | undefined> = [];
  private readonly pendingAcks: Array<{ messageId: string; socket: FakeWebSocket }> = [];
  private nextServerClientId = 100;

  constructor(
    private readonly assignConnectionClientIds = false,
    private readonly echoAwarenessToSender = false,
    private readonly delayUpdateAcks = false,
  ) {}

  connect(socket: FakeWebSocket): void {
    this.sockets.push(socket);
    socket.serverMessage({
      nonce: `nonce-${this.sockets.length}`,
      protocol: LOBE_YJS_PROTOCOL,
      roomId: socket.roomId,
      type: 'hello',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  receive(socket: FakeWebSocket, raw: string): void {
    const message = JSON.parse(raw) as LobeYjsClientMessage;

    if (message.type === 'auth') {
      this.authTickets.push(message.ticket);
      socket.clientId = this.assignConnectionClientIds
        ? ++this.nextServerClientId
        : message.clientId;
      socket.serverMessage({
        clientId: socket.clientId,
        protocol: LOBE_YJS_PROTOCOL,
        roomId: socket.roomId,
        type: 'auth-ok',
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
      return;
    }

    if (message.type === 'sync-request') {
      socket.serverMessage({
        awareness: Array.from(this.awareness, ([clientId, state]) => ({
          clientId,
          sequence: 1,
          state,
        })),
        protocol: LOBE_YJS_PROTOCOL,
        serverStateVector: encodeYjsBase64(encodeStateVector(this.doc)),
        type: 'sync',
        update: encodeYjsBase64(
          encodeStateAsUpdate(this.doc, decodeYjsBase64(message.stateVector)),
        ),
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
      return;
    }

    if (message.type === 'awareness') {
      this.awareness.set(socket.clientId, message.state);
      for (const peer of this.sockets) {
        if (
          (peer !== socket || this.echoAwarenessToSender) &&
          peer.readyState === FakeWebSocket.OPEN
        ) {
          peer.serverMessage({
            ...message,
            protocol: LOBE_YJS_PROTOCOL,
            sender: socket.clientId,
            version: LOBE_YJS_PROTOCOL_VERSION,
          });
        }
      }
      return;
    }

    if (message.type === 'update') {
      const update = decodeYjsBase64(message.update);
      applyUpdate(this.doc, update);
      for (const peer of this.sockets) {
        if (peer !== socket && peer.readyState === FakeWebSocket.OPEN) {
          peer.serverMessage({
            ...message,
            protocol: LOBE_YJS_PROTOCOL,
            sender: socket.clientId,
            version: LOBE_YJS_PROTOCOL_VERSION,
          });
        }
      }
      if (this.delayUpdateAcks) {
        this.pendingAcks.push({ messageId: message.messageId, socket });
      } else {
        this.acknowledge(socket, message.messageId);
      }
    }
  }

  flushUpdateAcks(): void {
    const pending = this.pendingAcks.splice(0);
    for (const { messageId, socket } of pending) this.acknowledge(socket, messageId);
  }

  private acknowledge(socket: FakeWebSocket, messageId: string): void {
    socket.serverMessage({
      messageId,
      protocol: LOBE_YJS_PROTOCOL,
      type: 'update-ack',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  sendRemoteUpdate(socket: FakeWebSocket, messageId: string, key: string, value: string): void {
    const updateDoc = new Doc();
    updateDoc.getMap<string>('state').set(key, value);
    socket.serverMessage({
      messageId,
      protocol: LOBE_YJS_PROTOCOL,
      sender: 999,
      type: 'update',
      update: encodeYjsBase64(encodeStateAsUpdate(updateDoc)),
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
    updateDoc.destroy();
  }
}

class SingleUseTicketRoomServer extends InMemoryRoomServer {
  override receive(socket: FakeWebSocket, raw: string): void {
    const message = JSON.parse(raw) as LobeYjsClientMessage;
    if (message.type === 'auth' && this.authTickets.includes(message.ticket)) {
      this.authTickets.push(message.ticket);
      socket.serverMessage({
        code: 'ticket_replayed',
        fatal: true,
        message: 'ticket already used',
        protocol: LOBE_YJS_PROTOCOL,
        type: 'error',
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
      return;
    }
    super.receive(socket, raw);
  }
}

class FakeWebSocket implements WebSocketLike {
  static readonly OPEN = 1;
  static readonly instances: FakeWebSocket[] = [];

  readonly roomId: string;
  readonly closeCodes: number[] = [];
  readyState = 0;
  clientId = 0;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    url: string,
    private readonly server: InMemoryRoomServer,
  ) {
    this.roomId = decodeURIComponent(new URL(url).pathname.split('/').at(-1) || '');
    FakeWebSocket.instances.push(this);
    server.connect(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) || new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close(code?: number): void {
    if (code !== undefined && code !== 1000 && (code < 3000 || code > 4999)) {
      throw new Error(`Invalid client close code: ${code}`);
    }
    this.closeCodes.push(code ?? 1000);
    this.readyState = 3;
    this.emit('close', {});
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  send(data: string): void {
    this.server.receive(this, data);
  }

  serverMessage(message: unknown): void {
    if (this.readyState !== FakeWebSocket.OPEN) {
      this.queuedMessages.push(message);
      return;
    }

    this.emit('message', { data: JSON.stringify(message) });
  }

  serverError(): void {
    this.emit('error', {});
  }

  flushQueuedMessages(): void {
    for (const message of this.queuedMessages.splice(0)) this.serverMessage(message);
  }

  private readonly queuedMessages: unknown[] = [];

  private emit(type: string, event: WebSocketMessageEvent): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe('NodeWebSocketYjsProvider', () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
  });

  it('joins v1, waits for sync, mirrors agent awareness, and syncs updates', async () => {
    const server = new InMemoryRoomServer();
    const firstDoc = new Doc();
    const secondDoc = new Doc();
    const first = new NodeWebSocketYjsProvider('room-a', firstDoc, {
      documentId: 'room-a',
      requestId: 'request-a',
      ticket: 'ticket-a',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });
    const second = new NodeWebSocketYjsProvider('room-a', secondDoc, {
      documentId: 'room-a',
      requestId: 'request-b',
      ticket: 'ticket-b',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });

    first.setAgentAwareness({
      documentId: 'room-a',
      name: 'Agent A',
      requestId: 'request-a',
      status: 'thinking',
    });
    const firstSync = first.waitForSync();
    first.connect();
    FakeWebSocket.instances[0].open();
    firstDoc.getMap<string>('state').set('queued-before-auth', 'yes');
    FakeWebSocket.instances[0].flushQueuedMessages();
    await firstSync;

    const firstState = firstDoc.getMap<string>('state');
    firstState.set('value', 'from-agent');

    const secondSync = second.waitForSync();
    second.connect();
    FakeWebSocket.instances[1].open();
    FakeWebSocket.instances[1].flushQueuedMessages();
    await secondSync;

    expect(secondDoc.getMap<string>('state').get('queued-before-auth')).toBe('yes');
    expect(secondDoc.getMap<string>('state').get('value')).toBe('from-agent');
    expect(second.awareness.getStates().values().next().value?.awarenessData).toMatchObject({
      requestId: 'request-a',
      role: 'agent',
      status: 'thinking',
    });

    first.setAgentAwareness({
      documentId: 'room-a',
      name: 'Agent A',
      requestId: 'request-a',
      status: 'writing',
    });
    expect(second.awareness.getStates().values().next().value?.awarenessData).toMatchObject({
      requestId: 'request-a',
      status: 'writing',
    });

    first.close();
    second.close();
    firstDoc.destroy();
    secondDoc.destroy();
    server.doc.destroy();
  });

  it('keeps two browser clients and one Node agent on the same v1 room', async () => {
    const server = new InMemoryRoomServer();
    const createSocketConstructor = () =>
      class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      };
    const browserADoc = new Doc();
    const browserBDoc = new Doc();
    const agentDoc = new Doc();
    const browserOptions = {
      documentId: 'room-a',
      legacyProtocol: false,
      requestId: 'browser-request',
      ticket: 'browser-ticket',
      webSocketConstructor: createSocketConstructor(),
      wsBaseUrl: 'ws://example.test',
    };
    const browserA = new WebSocketYjsProvider('room-a', browserADoc, browserOptions);
    const browserB = new WebSocketYjsProvider('room-a', browserBDoc, browserOptions);
    const agent = new NodeWebSocketYjsProvider('room-a', agentDoc, {
      documentId: 'room-a',
      requestId: 'agent-request',
      ticket: 'agent-ticket',
      webSocketConstructor: createSocketConstructor(),
      wsBaseUrl: 'ws://example.test',
    });
    agent.setAgentAwareness({
      documentId: 'room-a',
      requestId: 'agent-request',
      status: 'writing',
    });

    const syncPromises = [browserA.waitForSync(), browserB.waitForSync(), agent.waitForSync()];
    browserA.connect();
    browserB.connect();
    agent.connect();
    FakeWebSocket.instances.forEach((socket) => {
      socket.open();
      socket.flushQueuedMessages();
    });
    await Promise.all(syncPromises);

    browserADoc.getMap<string>('state').set('browser-edit', 'shared');
    expect(browserBDoc.getMap<string>('state').get('browser-edit')).toBe('shared');
    expect(agentDoc.getMap<string>('state').get('browser-edit')).toBe('shared');

    browserA.awareness.setLocalState({
      anchorPos: null,
      awarenessData: { role: 'browser' },
      color: '#2563eb',
      focusPos: null,
      focusing: true,
      name: 'Browser A',
    });
    browserB.awareness.setLocalState({
      anchorPos: null,
      awarenessData: { role: 'browser' },
      color: '#16a34a',
      focusPos: null,
      focusing: true,
      name: 'Browser B',
    });
    const names = (provider: WebSocketYjsProvider | NodeWebSocketYjsProvider, doc: Doc) =>
      Array.from(provider.awareness.getStates().values())
        .filter((state) => state.clientId !== doc.clientID)
        .map((state) => state.name);
    expect(names(browserA, browserADoc)).toEqual(expect.arrayContaining(['Browser B', 'AI Agent']));
    expect(names(browserA, browserADoc)).not.toContain('Browser A');
    expect(names(browserB, browserBDoc)).toEqual(expect.arrayContaining(['Browser A', 'AI Agent']));
    expect(names(browserB, browserBDoc)).not.toContain('Browser B');
    expect(names(agent, agentDoc)).toEqual(expect.arrayContaining(['Browser A', 'Browser B']));
    expect(names(agent, agentDoc)).not.toContain('AI Agent');
    expect(browserA.awareness.getStates().values().next().value?.awarenessData).toMatchObject({
      documentId: 'room-a',
      requestId: 'agent-request',
      role: 'agent',
      status: 'writing',
    });

    browserA.close();
    browserB.close();
    agent.close();
    browserADoc.destroy();
    browserBDoc.destroy();
    agentDoc.destroy();
    server.doc.destroy();
  });

  it('waits for the room ack while peers already receive the broadcast', async () => {
    const server = new InMemoryRoomServer(false, false, true);
    const agentDoc = new Doc();
    const browserDoc = new Doc();
    const createSocketConstructor = () =>
      class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      };
    const agent = new NodeWebSocketYjsProvider('room-a', agentDoc, {
      documentId: 'room-a',
      requestId: 'agent-request',
      ticket: 'agent-ticket',
      webSocketConstructor: createSocketConstructor(),
      wsBaseUrl: 'ws://example.test',
    });
    const browser = new WebSocketYjsProvider('room-a', browserDoc, {
      documentId: 'room-a',
      legacyProtocol: false,
      requestId: 'browser-request',
      ticket: 'browser-ticket',
      webSocketConstructor: createSocketConstructor(),
      wsBaseUrl: 'ws://example.test',
    });

    const syncs = [agent.waitForSync(), browser.waitForSync()];
    agent.connect();
    browser.connect();
    FakeWebSocket.instances.forEach((socket) => {
      socket.open();
      socket.flushQueuedMessages();
    });
    await Promise.all(syncs);

    agentDoc.getMap<string>('state').set('artifact-source', 'updated');
    let acknowledged = false;
    const pendingAck = agent.waitForPendingUpdates(1_000).then(() => {
      acknowledged = true;
    });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    expect(browserDoc.getMap<string>('state').get('artifact-source')).toBe('updated');

    server.flushUpdateAcks();
    await pendingAck;
    expect(acknowledged).toBe(true);

    agent.close();
    browser.close();
    agentDoc.destroy();
    browserDoc.destroy();
    server.doc.destroy();
  });

  it('bounds incoming message dedupe history while retaining duplicate protection', async () => {
    const server = new InMemoryRoomServer();
    const doc = new Doc();
    const provider = new NodeWebSocketYjsProvider('room-a', doc, {
      documentId: 'room-a',
      maxSeenMessageIds: 2,
      requestId: 'agent-request',
      ticket: 'agent-ticket',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });
    const sync = provider.waitForSync();
    provider.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.flushQueuedMessages();
    await sync;

    server.sendRemoteUpdate(socket, 'one', 'dedupe', 'first');
    server.sendRemoteUpdate(socket, 'one', 'dedupe', 'duplicate');
    expect(doc.getMap<string>('state').get('dedupe')).toBe('first');

    server.sendRemoteUpdate(socket, 'two', 'two', 'value');
    server.sendRemoteUpdate(socket, 'three', 'three', 'value');
    // `one` has now aged out of the bounded history and is accepted again.
    server.sendRemoteUpdate(socket, 'one', 'dedupe-after', 'after-eviction');
    expect(doc.getMap<string>('state').get('dedupe-after')).toBe('after-eviction');

    provider.close();
    doc.destroy();
    server.doc.destroy();
  });

  it('evicts remote awareness states and sequence entries as one bounded record', () => {
    const awareness = new WebSocketAwareness(1, () => {});
    for (let clientId = 2; clientId <= 1001; clientId += 1) {
      awareness.updateRemoteState(clientId, { awarenessData: { clientId } } as never, 1);
    }
    expect(awareness.getStates().size).toBe(1000);

    // The oldest client was removed from both maps, so a fresh sequence for
    // that client is accepted rather than being rejected by stale sequence
    // state that no longer has a corresponding awareness record.
    awareness.updateRemoteState(1002, { awarenessData: { clientId: 1002 } } as never, 1);
    awareness.updateRemoteState(2, { awarenessData: { clientId: 2, fresh: true } } as never, 1);
    expect(awareness.getStates().size).toBe(1000);
    expect(awareness.getStates().get(2)).toMatchObject({ awarenessData: { fresh: true } });

    awareness.updateRemoteState(2, null, 2);
    awareness.updateRemoteState(2, { awarenessData: { clientId: 2, restored: true } } as never, 1);
    expect(awareness.getStates().get(2)).toMatchObject({ awarenessData: { restored: true } });
  });

  it('keeps local awareness out of remote states across server identity changes', () => {
    const sent: Array<UserState | null> = [];
    const awareness = new WebSocketAwareness(11, (state) => sent.push(state));
    awareness.setLocalState({
      anchorPos: null,
      awarenessData: { role: 'browser' },
      color: '#2563eb',
      focusPos: null,
      focusing: true,
      name: 'Local Tester',
    });

    expect(awareness.getLocalState()).toMatchObject({ name: 'Local Tester', clientId: 11 });
    expect(awareness.getStates()).toMatchObject(new Map([[11, awareness.getLocalState()]]));

    // A legacy/echo relay may use the document ID; an authenticated v1
    // relay uses a connection-scoped server ID. Neither may become remote.
    awareness.updateRemoteState(11, awareness.getLocalState(), 1);
    awareness.setClientId(701);
    awareness.updateRemoteState(701, awareness.getLocalState(), 2);
    expect(awareness.getStates()).toMatchObject(new Map([[11, awareness.getLocalState()]]));

    awareness.updateRemoteState(
      702,
      {
        anchorPos: null,
        awarenessData: { role: 'browser' },
        color: '#16a34a',
        focusPos: null,
        focusing: true,
        name: 'Remote User',
      },
      1,
    );
    expect(awareness.getStates().size).toBe(2);
    expect(sent.at(-1)).toMatchObject({ name: 'Local Tester', clientId: 11 });
  });

  it('does not render a local browser echo when the relay assigns a different client ID', async () => {
    const server = new InMemoryRoomServer(true, true);
    const doc = new Doc();
    const provider = new WebSocketYjsProvider('room-a', doc, {
      legacyProtocol: false,
      requestId: 'browser-request',
      ticket: 'browser-ticket',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });
    provider.awareness.setLocalState({
      anchorPos: null,
      awarenessData: { role: 'browser' },
      color: '#2563eb',
      focusPos: null,
      focusing: true,
      name: 'Local Tester',
    });

    const sync = provider.waitForSync();
    provider.connect();
    const socket = FakeWebSocket.instances.at(-1)!;
    socket.open();
    socket.flushQueuedMessages();
    await sync;

    // The fake relay echoes local awareness and also changes its server ID
    // after each connection, matching the production protocol boundary.
    expect(provider.awareness.getLocalState()).toMatchObject({ clientId: doc.clientID });
    expect(provider.awareness.getStates().get(doc.clientID)).toBe(
      provider.awareness.getLocalState(),
    );
    expect(provider.awareness.getStates().size).toBe(1);

    socket.close();
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const reconnectSocket = FakeWebSocket.instances.at(-1);
    expect(reconnectSocket).not.toBe(socket);
    reconnectSocket?.open();
    reconnectSocket?.flushQueuedMessages();
    await provider.waitForSync();
    expect(provider.awareness.getStates().get(doc.clientID)).toBe(
      provider.awareness.getLocalState(),
    );
    expect(provider.awareness.getStates().size).toBe(1);

    provider.close();
    doc.destroy();
    server.doc.destroy();
  });

  it('does not reconnect an Agent provider with a consumed single-use ticket', async () => {
    const server = new InMemoryRoomServer();
    const doc = new Doc();
    const provider = new NodeWebSocketYjsProvider('room-a', doc, {
      documentId: 'room-a',
      requestId: 'agent-request',
      ticket: 'single-use-ticket',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });
    const sync = provider.waitForSync();
    provider.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.flushQueuedMessages();
    await sync;

    socket.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(FakeWebSocket.instances).toHaveLength(1);

    provider.close();
    doc.destroy();
    server.doc.destroy();
  });

  it('terminates the provider after a fatal ticket error instead of reusing its ticket', async () => {
    const server = new InMemoryRoomServer();
    const doc = new Doc();
    const provider = new NodeWebSocketYjsProvider('room-a', doc, {
      documentId: 'room-a',
      refreshTicket: vi.fn(async () => 'fresh-ticket'),
      requestId: 'agent-request',
      ticket: 'consumed-ticket',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });
    const sync = provider.waitForSync();
    provider.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.serverMessage({
      code: 'ticket_replayed',
      fatal: true,
      message: 'ticket already used',
      protocol: LOBE_YJS_PROTOCOL,
      type: 'error',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });

    await expect(sync).rejects.toThrow('ticket already used');
    expect(socket.closeCodes).toContain(4401);
    provider.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    provider.close();
    doc.destroy();
    server.doc.destroy();
  });

  it('refreshes an Agent ticket before reconnecting the same provider', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const refreshTicket = vi.fn(async () => 'fresh-ticket');
      const provider = new NodeWebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        refreshTicket,
        requestId: 'agent-request',
        ticket: 'initial-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });

      const initialSync = provider.waitForSync();
      provider.connect();
      const firstSocket = FakeWebSocket.instances[0];
      firstSocket.open();
      firstSocket.flushQueuedMessages();
      await initialSync;
      expect(server.authTickets).toEqual(['initial-ticket']);

      firstSocket.close();
      const reconnectSync = provider.waitForSync();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(refreshTicket).toHaveBeenCalledOnce();
      const reconnectSocket = FakeWebSocket.instances[1];
      reconnectSocket.open();
      reconnectSocket.flushQueuedMessages();
      await reconnectSync;

      expect(server.authTickets).toEqual(['initial-ticket', 'fresh-ticket']);
      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes after a 60-second ticket expiry and applies after a fresh sync', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const refreshTicket = vi.fn(async () => 'fresh-ticket');
      const provider = new NodeWebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        refreshTicket,
        requestId: 'agent-request',
        ticket: 'initial-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });

      const initialSync = provider.waitForSync();
      provider.connect();
      const firstSocket = FakeWebSocket.instances[0];
      firstSocket.open();
      firstSocket.flushQueuedMessages();
      await initialSync;
      expect(server.authTickets).toEqual(['initial-ticket']);

      doc.getMap<string>('state').set('generation', 'in-progress');
      const expiryTimer = setTimeout(() => {
        firstSocket.serverMessage({
          code: 'ticket_expired',
          fatal: true,
          message: 'Collaboration ticket has expired.',
          protocol: LOBE_YJS_PROTOCOL,
          type: 'error',
          version: LOBE_YJS_PROTOCOL_VERSION,
        });
      }, 60_000);
      await vi.advanceTimersByTimeAsync(60_000);
      clearTimeout(expiryTimer);
      const refreshedSync = provider.waitForSync();
      await vi.advanceTimersByTimeAsync(2_000);

      expect(refreshTicket).toHaveBeenCalledOnce();
      expect(FakeWebSocket.instances).toHaveLength(2);
      const reconnectSocket = FakeWebSocket.instances[1];
      reconnectSocket.open();
      reconnectSocket.flushQueuedMessages();
      await refreshedSync;
      expect(server.authTickets).toEqual(['initial-ticket', 'fresh-ticket']);

      doc.getMap<string>('state').set('generation', 'applied');
      expect(server.doc.getMap<string>('state').get('generation')).toBe('applied');

      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidates sync before a socket error publishes disconnected', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const provider = new NodeWebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        requestId: 'agent-request-error-order',
        ticket: 'initial-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });
      const initialSync = provider.waitForSync();
      provider.connect();
      const socket = FakeWebSocket.instances[0]!;
      socket.open();
      socket.flushQueuedMessages();
      await initialSync;

      const lifecycle: string[] = [];
      provider.on('sync', (isSynced) => lifecycle.push(`sync:${isSynced}`));
      provider.on('status', ({ status }) => lifecycle.push(`status:${status}`));
      socket.serverError();
      expect(lifecycle.slice(0, 2)).toEqual(['sync:false', 'status:disconnected']);

      socket.close();
      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the Agent facade recover after the real ticket-expired error frame', async () => {
    const server = new InMemoryRoomServer();
    const doc = new Doc();
    const refreshTicket = vi.fn(async () => 'fresh-ticket');
    const provider = new NodeWebSocketYjsProvider('room-a', doc, {
      documentId: 'room-a',
      refreshTicket,
      requestId: 'agent-request-facade',
      ticket: 'initial-ticket',
      webSocketConstructor: class extends FakeWebSocket {
        constructor(url: string) {
          super(url, server);
        }
      },
      wsBaseUrl: 'ws://example.test',
    });
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'room-a',
      provider,
      requestId: 'agent-request-facade',
      roomId: 'room-a',
      ticket: 'initial-ticket',
      yjsDoc: doc,
    });

    try {
      const internal = agent as unknown as {
        kernel: {
          getLexicalEditor: () => LexicalEditor;
          setDocument: (type: string, content: string) => void;
        };
      };
      // setDocument starts the provider connection synchronously. Seed the
      // room before opening the fake socket so the first sync is authoritative
      // for both the facade and the relay-side Y.Doc.
      internal.kernel.setDocument('markdown', 'Hello collaborative world\n\nHuman paragraph');
      const firstSocket = FakeWebSocket.instances[0]!;
      applyUpdate(server.doc, encodeStateAsUpdate(doc));
      firstSocket.open();
      firstSocket.flushQueuedMessages();
      await agent.connect();

      const lexicalEditor = internal.kernel.getLexicalEditor();
      let selection: ReturnType<typeof captureCollaborativeRewriteSelection>;
      lexicalEditor.update(
        () => {
          const text = $getRoot().getFirstDescendant();
          if (!$isTextNode(text)) throw new Error('facade seed text missing');
          const range = $createRangeSelection();
          range.anchor.set(text.getKey(), 0, 'text');
          range.focus.set(text.getKey(), 5, 'text');
          $setSelection(range);
        },
        { discrete: true },
      );
      selection = captureCollaborativeRewriteSelection(internal.kernel as never, {
        roomId: 'room-a',
      });
      if (!selection) throw new Error('facade selection capture failed');

      await expect(
        agent.startRewriteSession({
          expectedTextHash: hashRewriteText('Hello'),
          generationId: 'facade-reconnect-generation',
          requestId: 'agent-request-facade',
          sessionId: 'facade-reconnect-session',
          selection,
        }),
      ).resolves.toMatchObject({ status: 'streaming' });
      await expect(
        agent.appendRewriteChunk({
          chunk: 'Hi',
          chunkId: 'facade-reconnect-chunk-1',
          sessionId: 'facade-reconnect-session',
          sequence: 1,
        }),
      ).resolves.toMatchObject({ status: 'streaming' });

      const lifecycle: string[] = [];
      provider.on('sync', (isSynced) => lifecycle.push(`sync:${isSynced}`));
      provider.on('status', ({ status }) => lifecycle.push(`status:${status}`));

      vi.useFakeTimers();
      const pending = agent.appendRewriteChunk({
        chunk: ' there',
        chunkId: 'facade-reconnect-chunk-2',
        sessionId: 'facade-reconnect-session',
        sequence: 2,
      });
      // A transport error may arrive before the browser/Node WebSocket emits
      // its close event. It must invalidate the old completed sync barrier
      // before the subsequent ticket-expired close path runs.
      firstSocket.serverError();
      firstSocket.serverMessage({
        code: 'ticket_expired',
        fatal: true,
        message: 'Collaboration ticket has expired.',
        protocol: LOBE_YJS_PROTOCOL,
        type: 'error',
        version: LOBE_YJS_PROTOCOL_VERSION,
      });

      expect(lifecycle.slice(0, 2)).toEqual(['sync:false', 'status:disconnected']);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(refreshTicket).toHaveBeenCalledOnce();
      const reconnectSocket = FakeWebSocket.instances[1]!;
      reconnectSocket.open();
      reconnectSocket.flushQueuedMessages();

      await expect(pending).resolves.toMatchObject({ sequence: 2, status: 'streaming' });
      await expect(
        agent.finalizeRewriteSession({ sessionId: 'facade-reconnect-session' }),
      ).resolves.toMatchObject({ status: 'applied' });
      const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
      expect(projection.markdown).toContain('Hi there collaborative world');
      expect(projection.markdown).not.toContain('there there');
    } finally {
      await agent.disconnect();
      vi.useRealTimers();
      doc.destroy();
      server.doc.destroy();
    }
  });

  it('rejects a stale old ticket after expiry instead of resuming the Agent', async () => {
    vi.useFakeTimers();
    try {
      const server = new SingleUseTicketRoomServer();
      const doc = new Doc();
      const refreshTicket = vi.fn(async () => 'initial-ticket');
      const provider = new NodeWebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        refreshTicket,
        requestId: 'agent-request',
        ticket: 'initial-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });

      const initialSync = provider.waitForSync();
      provider.connect();
      const firstSocket = FakeWebSocket.instances[0];
      firstSocket.open();
      firstSocket.flushQueuedMessages();
      await initialSync;

      firstSocket.serverMessage({
        code: 'ticket_expired',
        fatal: true,
        message: 'Collaboration ticket has expired.',
        protocol: LOBE_YJS_PROTOCOL,
        type: 'error',
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
      const refreshedSync = expect(provider.waitForSync()).rejects.toThrow('ticket already used');
      await vi.advanceTimersByTimeAsync(2_000);
      const reconnectSocket = FakeWebSocket.instances[1];
      reconnectSocket.open();
      reconnectSocket.flushQueuedMessages();
      await refreshedSync;

      expect(refreshTicket).toHaveBeenCalledOnce();
      expect(server.authTickets).toEqual(['initial-ticket', 'initial-ticket']);
      expect(FakeWebSocket.instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(FakeWebSocket.instances).toHaveLength(2);

      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps ticket expiry terminal when no refresh callback is available', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const provider = new NodeWebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        requestId: 'agent-request',
        ticket: 'initial-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });

      const initialSync = provider.waitForSync();
      provider.connect();
      const socket = FakeWebSocket.instances[0];
      socket.open();
      socket.flushQueuedMessages();
      await initialSync;

      socket.serverMessage({
        code: 'ticket_expired',
        fatal: true,
        message: 'Collaboration ticket has expired.',
        protocol: LOBE_YJS_PROTOCOL,
        type: 'error',
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
      await expect(provider.waitForSync()).rejects.toThrow(
        'Yjs provider cannot reconnect with this ticket.',
      );
      expect(socket.closeCodes).toContain(4401);
      await vi.advanceTimersByTimeAsync(20_000);
      expect(FakeWebSocket.instances).toHaveLength(1);

      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('terminates instead of replaying a ticket when refresh fails', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const provider = new NodeWebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        refreshTicket: vi.fn(async () => {
          throw new Error('ticket service unavailable');
        }),
        requestId: 'agent-request',
        ticket: 'initial-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });

      const initialSync = provider.waitForSync();
      provider.connect();
      const firstSocket = FakeWebSocket.instances[0];
      firstSocket.open();
      firstSocket.flushQueuedMessages();
      await initialSync;

      firstSocket.close();
      const reconnectSync = provider.waitForSync();
      const reconnectFailure = expect(reconnectSync).rejects.toThrow('ticket service unavailable');
      await vi.advanceTimersByTimeAsync(2_000);
      await reconnectFailure;
      expect(FakeWebSocket.instances).toHaveLength(1);
      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails the Agent sync barrier when the ticket-bound socket cannot be created', async () => {
    const doc = new Doc();
    const provider = new NodeWebSocketYjsProvider('room-a', doc, {
      documentId: 'room-a',
      requestId: 'agent-request',
      ticket: 'single-use-ticket',
      webSocketConstructor: class {
        constructor() {
          throw new Error('socket unavailable');
        }
      } as never,
      wsBaseUrl: 'ws://example.test',
    });
    const sync = provider.waitForSync();
    provider.connect();
    await expect(sync).rejects.toThrow('socket unavailable');
    expect(() => provider.connect()).not.toThrow();
    provider.close();
    doc.destroy();
  });

  it('stops browser reconnect after a terminal ticket replay error', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const provider = new WebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        legacyProtocol: false,
        requestId: 'browser-request',
        ticket: 'replayed-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });
      const sync = provider.waitForSync();
      provider.connect();
      const socket = FakeWebSocket.instances[0];
      socket.open();
      socket.flushQueuedMessages();
      await sync;

      socket.serverMessage({
        code: 'ticket_replayed',
        fatal: false,
        message: 'ticket already used',
        protocol: LOBE_YJS_PROTOCOL,
        type: 'error',
        version: LOBE_YJS_PROTOCOL_VERSION,
      });
      expect(socket.closeCodes).toContain(4401);
      vi.advanceTimersByTime(20_000);
      expect(FakeWebSocket.instances).toHaveLength(1);

      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconnects a browser provider after a transient close', async () => {
    vi.useFakeTimers();
    try {
      const server = new InMemoryRoomServer();
      const doc = new Doc();
      const provider = new WebSocketYjsProvider('room-a', doc, {
        documentId: 'room-a',
        legacyProtocol: false,
        requestId: 'browser-request',
        ticket: 'reusable-browser-ticket',
        webSocketConstructor: class extends FakeWebSocket {
          constructor(url: string) {
            super(url, server);
          }
        },
        wsBaseUrl: 'ws://example.test',
      });
      const sync = provider.waitForSync();
      provider.connect();
      const socket = FakeWebSocket.instances[0];
      socket.open();
      socket.flushQueuedMessages();
      await sync;

      socket.close();
      vi.advanceTimersByTime(20_000);
      expect(FakeWebSocket.instances).toHaveLength(2);

      provider.close();
      doc.destroy();
      server.doc.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
