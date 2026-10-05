import { Doc } from 'yjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
} from '../protocol';
import {
  WebSocketYjsProvider,
  type WebSocketLike,
  WebSocketYjsProviderError,
} from '../websocket-provider';

type Listener = (event: { data?: string }) => void;

class FakeWebSocket implements WebSocketLike {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readonly closeCodes: number[] = [];
  readyState = 0;
  sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close(code?: number): void {
    this.closeCodes.push(code ?? 1000);
    this.readyState = 3;
    this.emit('close', {});
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  send(data: string): void {
    this.sent.push(data);
  }

  serverMessage(message: unknown): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  serverRawMessage(data: string): void {
    this.emit('message', { data });
  }

  private emit(type: string, event: { data?: string }): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe('WebSocketYjsProviderError', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves terminal wire code/fatal metadata through waitForSync', async () => {
    const doc = new Doc();
    const provider = new WebSocketYjsProvider('room-1', doc, {
      legacyProtocol: false,
      ticket: 'ticket-1',
      webSocketConstructor: FakeWebSocket,
      wsBaseUrl: 'ws://example.test',
    });
    provider.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    socket.serverMessage({
      nonce: 'nonce-1',
      protocol: LOBE_YJS_PROTOCOL,
      roomId: 'room-1',
      type: 'hello',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
    socket.serverMessage({
      clientId: 101,
      protocol: LOBE_YJS_PROTOCOL,
      roomId: 'room-1',
      type: 'auth-ok',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });

    const sync = provider.waitForSync();
    socket.serverMessage({
      code: 'backend_unavailable',
      fatal: true,
      message: 'relay unavailable',
      protocol: LOBE_YJS_PROTOCOL,
      type: 'error',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });

    await expect(sync).rejects.toMatchObject({
      code: 'backend_unavailable',
      fatal: true,
      message: 'relay unavailable',
      name: 'WebSocketYjsProviderError',
    } satisfies Partial<WebSocketYjsProviderError>);
    await expect(provider.waitForSync()).rejects.toMatchObject({
      code: 'backend_unavailable',
      fatal: true,
    });
    doc.destroy();
  });

  it('marks malformed protocol termination as a typed fatal provider error', async () => {
    const doc = new Doc();
    const provider = new WebSocketYjsProvider('room-1', doc, {
      legacyProtocol: false,
      ticket: 'ticket-1',
      webSocketConstructor: FakeWebSocket,
      wsBaseUrl: 'ws://example.test',
    });
    provider.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    const sync = provider.waitForSync();
    socket.serverRawMessage('{malformed');

    await expect(sync).rejects.toMatchObject({
      code: 'invalid_protocol',
      fatal: true,
    });
    doc.destroy();
  });
});
