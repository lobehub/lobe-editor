import { afterEach, describe, expect, it, vi } from 'vitest';
import { $getRoot, createEditor, ParagraphNode } from 'lexical';

import {
  encodeCollaborationV2Message,
  LOBE_COLLABORATION_PROTOCOL,
  LOBE_COLLABORATION_PROTOCOL_VERSION,
  parseCollaborationV2ClientMessage,
  type CollaborationDescriptor,
} from './protocol';
import type { CollaborationWebSocketLike, CollaborationWebSocketMessageEvent } from './core';
import { LoroWebSocketProvider } from '@/plugins/loro/transport-provider';
import { LoroCanonicalDocument } from '@/plugins/loro/model';
import { LoroLexicalBinding } from '@/plugins/loro/binding';

const descriptor = {
  bindingSchema: 'lexical-loro-v1',
  engine: 'loro',
  epoch: 0,
} as const satisfies CollaborationDescriptor;

type SocketListener = (event: CollaborationWebSocketMessageEvent) => void;

class FakeRoom {
  readonly sockets = new Set<FakeSocket>();
  readonly server = new LoroCanonicalDocument(undefined, descriptor);
  private revision = 0;
  private seen = new Set<string>();
  private appliedCount = 0;
  private lastUpdate: { messageId: string; sender: FakeSocket; update: string } | null = null;

  get appliedUpdates(): number {
    return this.appliedCount;
  }

  get connectionCount(): number {
    return this.sockets.size;
  }

  connect(socket: FakeSocket): void {
    this.sockets.add(socket);
    queueMicrotask(() =>
      socket.receive({
        nonce: 'challenge',
        protocol: LOBE_COLLABORATION_PROTOCOL,
        type: 'hello',
        version: LOBE_COLLABORATION_PROTOCOL_VERSION,
      }),
    );
  }

  disconnect(socket: FakeSocket): void {
    this.sockets.delete(socket);
  }

  receive(sender: FakeSocket, text: string): void {
    const message = parseCollaborationV2ClientMessage(text);
    if (!message) throw new Error(`invalid client message: ${text}`);
    if (message.type === 'auth') {
      sender.peerId = message.peerId;
      sender.authenticated = true;
      sender.receive({
        ...this.base(),
        peerId: message.peerId,
        sender: sender.sender,
        type: 'auth-ok',
      });
      return;
    }
    if (message.type === 'sync-request') {
      sender.receive({
        ...this.base(),
        causalVersion: this.causalVersion(),
        presence: [],
        snapshot: encodeBytes(this.server.exportSnapshot()),
        type: 'sync',
        updates: [],
      });
      return;
    }
    if (message.type === 'presence') return;
    if (!sender.authenticated || message.type !== 'update') throw new Error('update before auth');
    if (this.seen.has(message.messageId)) {
      sender.receive({
        ...this.base(),
        acceptedRoomRevision: this.revision,
        causalVersion: this.causalVersion(),
        messageId: message.messageId,
        type: 'update-ack',
      });
      return;
    }
    this.seen.add(message.messageId);
    this.server.import(decodeBytes(message.update), { trusted: true });
    this.appliedCount += 1;
    this.lastUpdate = { messageId: message.messageId, sender, update: message.update };
    this.revision += 1;
    sender.receive({
      ...this.base(),
      acceptedRoomRevision: this.revision,
      causalVersion: this.causalVersion(),
      messageId: message.messageId,
      type: 'update-ack',
    });
    for (const socket of this.sockets) {
      if (socket === sender || !socket.authenticated) continue;
      socket.receive({
        ...this.base(),
        messageId: message.messageId,
        sender: sender.sender,
        type: 'update',
        update: message.update,
      });
    }
  }

  replayLastUpdate(): void {
    if (!this.lastUpdate) return;
    for (const socket of this.sockets) {
      if (socket === this.lastUpdate.sender || !socket.authenticated) continue;
      socket.receive({
        ...this.base(),
        messageId: this.lastUpdate.messageId,
        sender: this.lastUpdate.sender.sender,
        type: 'update',
        update: this.lastUpdate.update,
      });
    }
  }

  private base() {
    return {
      descriptor,
      protocol: LOBE_COLLABORATION_PROTOCOL,
      roomId: 'loro-room',
      version: LOBE_COLLABORATION_PROTOCOL_VERSION,
    } as const;
  }

  private causalVersion(): string {
    return encodeBytes(this.server.doc.version().encode());
  }
}

class FakeSocket implements CollaborationWebSocketLike {
  readonly readyState = 1;
  readonly sender = `sender-${Math.random().toString(36).slice(2)}`;
  peerId = '';
  authenticated = false;
  private readonly listeners = new Map<string, Set<SocketListener>>();

  constructor(private readonly room: FakeRoom) {
    room.connect(this);
  }

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) ?? new Set<SocketListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    this.room.receive(this, data);
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

const encodeBytes = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const decodeBytes = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64'));

describe('Loro v2 transport provider', () => {
  const providers: LoroWebSocketProvider[] = [];
  const documents: LoroCanonicalDocument[] = [];
  const rooms: FakeRoom[] = [];

  afterEach(() => {
    providers.splice(0).forEach((provider) => provider.dispose());
    documents.splice(0).forEach((document) => document.doc.free());
    rooms.splice(0).forEach((room) => room.server.doc.free());
  });

  it('round-trips real Loro updates through a shared socket core and de-duplicates a resent id', async () => {
    const room = new FakeRoom();
    rooms.push(room);
    const first = new LoroCanonicalDocument(undefined, descriptor);
    const second = new LoroCanonicalDocument(undefined, descriptor);
    documents.push(first, second);
    const firstProvider = new LoroWebSocketProvider(first, descriptor, 'loro-room', {
      allowStandaloneCanonicalImport: true,
      ticket: 'ticket-a',
      webSocketConstructor: class {
        constructor() {
          return new FakeSocket(room) as unknown as this;
        }
      } as never,
      wsBaseUrl: 'ws://fake',
    });
    const secondProvider = new LoroWebSocketProvider(second, descriptor, 'loro-room', {
      allowStandaloneCanonicalImport: true,
      ticket: 'ticket-b',
      webSocketConstructor: class {
        constructor() {
          return new FakeSocket(room) as unknown as this;
        }
      } as never,
      wsBaseUrl: 'ws://fake',
    });
    providers.push(firstProvider, secondProvider);

    first.commit(() => first.meta.set('offline', 'local'), { origin: 'loro:lexical/local' });

    firstProvider.connect();
    secondProvider.connect();
    await Promise.all([firstProvider.waitForSync(), secondProvider.waitForSync()]);

    first.commit(() => first.meta.set('text', 'hello'), { origin: 'loro:lexical/local' });
    await firstProvider.waitForPendingUpdates();
    expect(second.meta.get('text')).toBe('hello');
    expect(room.server.meta.get('text')).toBe('hello');
    expect(first.meta.get('offline')).toBe('local');
    expect(second.meta.get('offline')).toBe('local');
    expect(room.server.meta.get('offline')).toBe('local');
    const appliedUpdates = room.appliedUpdates;
    room.replayLastUpdate();
    expect(room.appliedUpdates).toBe(appliedUpdates);
    expect(room['seen'].size).toBe(appliedUpdates);

    firstProvider.disconnect();
    expect(room.connectionCount).toBe(1);
    firstProvider.connect();
    await firstProvider.waitForSync();
    expect(room.connectionCount).toBe(2);
  });

  it('requires and uses one binding gate for the initial snapshot and remote updates', async () => {
    const room = new FakeRoom();
    rooms.push(room);
    const canonical = new LoroCanonicalDocument(undefined, descriptor);
    documents.push(canonical);
    const rawImport = vi.spyOn(canonical, 'import');
    const ingest = vi.fn();
    const provider = new LoroWebSocketProvider(canonical, descriptor, 'loro-room', {
      applyRemoteUpdate: ingest,
      ticket: 'binding-ticket',
      webSocketConstructor: class {
        constructor() {
          return new FakeSocket(room) as unknown as this;
        }
      } as never,
      wsBaseUrl: 'ws://fake',
    });
    providers.push(provider);

    provider.connect();
    await provider.waitForSync();

    expect(ingest).toHaveBeenCalledTimes(1);
    expect(rawImport).not.toHaveBeenCalled();
    const remote = new LoroCanonicalDocument(undefined, descriptor);
    const remoteProvider = new LoroWebSocketProvider(remote, descriptor, 'loro-room', {
      allowStandaloneCanonicalImport: true,
      ticket: 'remote-ticket',
      webSocketConstructor: class {
        constructor() {
          return new FakeSocket(room) as unknown as this;
        }
      } as never,
      wsBaseUrl: 'ws://fake',
    });
    documents.push(remote);
    providers.push(remoteProvider);
    remoteProvider.connect();
    await remoteProvider.waitForSync();
    remote.commit(() => remote.meta.set('remote', 'update'), { origin: 'loro:remote-test' });
    await remoteProvider.waitForPendingUpdates();
    expect(ingest.mock.calls.length).toBeGreaterThan(1);
    expect(rawImport).not.toHaveBeenCalled();
    expect(
      () =>
        new LoroWebSocketProvider(
          new LoroCanonicalDocument(undefined, descriptor),
          descriptor,
          'room',
          {
            ticket: 'missing-gate',
            webSocketConstructor: class {
              constructor() {
                return new FakeSocket(room) as unknown as this;
              }
            } as never,
            wsBaseUrl: 'ws://fake',
          },
        ),
    ).toThrow('binding-owned applyRemoteUpdate gate');
  });

  it('keeps the real binding ready after a gated initial snapshot without double import', async () => {
    const room = new FakeRoom();
    rooms.push(room);
    room.server.commit(
      () => {
        room.server.createNode({
          flow: 'server body',
          nodeId: 'server-paragraph',
          role: 'element',
          type: 'paragraph',
        });
      },
      { origin: 'loro:seed' },
    );
    const doc = new LoroCanonicalDocument(undefined, descriptor, { initialize: false });
    const editor = createEditor({
      namespace: 'loro-provider-gate-test',
      nodes: [ParagraphNode],
      onError: (error) => {
        throw error;
      },
    });
    const binding = new LoroLexicalBinding({ doc, editor, shouldBootstrap: false });
    const rawImport = vi.spyOn(doc, 'import');
    const provider = new LoroWebSocketProvider(doc, descriptor, 'loro-room', {
      applyRemoteUpdate: (update) => binding.applyUpdate(update, { trusted: true }),
      ticket: 'binding-ticket',
      webSocketConstructor: class {
        constructor() {
          return new FakeSocket(room) as unknown as this;
        }
      } as never,
      wsBaseUrl: 'ws://fake',
    });
    providers.push(provider);
    documents.push(doc);

    provider.connect();
    await provider.waitForSync();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(rawImport).toHaveBeenCalledTimes(1);
    expect(binding.getReadiness()).toBe('ready');
    expect(editor.getEditorState().read(() => $getRoot().getTextContent())).toBe('server body');
    binding.dispose();
  });
});
