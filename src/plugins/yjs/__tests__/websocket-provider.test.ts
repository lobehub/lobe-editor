import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import { createWebSocketYjsProvider, WebSocketYjsProvider } from '../websocket-provider';

type SocketListener = (event: { data?: string }) => void;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;

  binaryType = '';
  readyState = 0;
  sent: string[] = [];
  url: string;

  private listeners = new Map<string, Set<SocketListener>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close(): void {
    this.serverClose();
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  send(data: string): void {
    this.sent.push(data);
  }

  serverClose(): void {
    if (this.readyState === 3) return;

    this.readyState = 3;
    this.emit('close', {});
  }

  serverMessage(message: unknown): void {
    this.emit('message', { data: JSON.stringify(message) });
  }

  private emit(type: string, event: { data?: string }): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

function encodeBase64(update: Uint8Array): string {
  return window.btoa(String.fromCharCode(...update));
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function getSentMessages(socket: FakeWebSocket): Array<Record<string, string>> {
  return socket.sent.map((message) => JSON.parse(message) as Record<string, string>);
}

describe('WebSocketYjsProvider', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps documents isolated by room when a host shares the document map', () => {
    const docMap = new Map<string, Doc>();

    createWebSocketYjsProvider('room-a', docMap);
    const roomADoc = docMap.get('room-a');
    createWebSocketYjsProvider('room-b', docMap);
    createWebSocketYjsProvider('room-a', docMap);

    expect(docMap.size).toBe(2);
    expect(docMap.get('room-a')).toBe(roomADoc);
    expect(docMap.get('room-b')).not.toBe(roomADoc);

    docMap.forEach((doc) => doc.destroy());
  });

  it('re-syncs peer and local updates made during a connection gap', () => {
    const clientDoc = new Doc();
    const serverDoc = new Doc();
    const clientState = clientDoc.getMap<string>('state');
    const serverState = serverDoc.getMap<string>('state');
    clientState.set('initial', 'shared');
    applyUpdate(serverDoc, encodeStateAsUpdate(clientDoc));

    const provider = new WebSocketYjsProvider('room-1', clientDoc, 'ws://example.test');
    const syncEvents: boolean[] = [];
    provider.on('sync', (isSynced) => syncEvents.push(isSynced));
    provider.connect();

    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.open();

    const firstRequest = getSentMessages(firstSocket).find(
      (message) => message.type === 'sync-request',
    );
    expect(firstRequest?.stateVector).toBeTruthy();
    firstSocket.serverMessage({
      awareness: [],
      type: 'sync',
      update: encodeBase64(
        encodeStateAsUpdate(serverDoc, decodeBase64(firstRequest?.stateVector || '')),
      ),
    });

    firstSocket.serverClose();
    serverState.set('remoteDuringGap', 'remote');
    clientState.set('localDuringGap', 'local');

    vi.advanceTimersByTime(500);
    const reconnectSocket = FakeWebSocket.instances[1];
    reconnectSocket.open();

    const reconnectRequest = getSentMessages(reconnectSocket).find(
      (message) => message.type === 'sync-request',
    );
    expect(reconnectRequest?.stateVector).toBeTruthy();
    reconnectSocket.serverMessage({
      awareness: [],
      type: 'sync',
      update: encodeBase64(
        encodeStateAsUpdate(serverDoc, decodeBase64(reconnectRequest?.stateVector || '')),
      ),
    });

    expect(clientState.get('remoteDuringGap')).toBe('remote');
    expect(clientState.get('localDuringGap')).toBe('local');

    const publishedUpdate = getSentMessages(reconnectSocket).find(
      (message) => message.type === 'update',
    );
    expect(publishedUpdate?.update).toBeTruthy();
    applyUpdate(serverDoc, decodeBase64(publishedUpdate?.update || ''));

    expect(serverState.get('remoteDuringGap')).toBe('remote');
    expect(serverState.get('localDuringGap')).toBe('local');
    expect(syncEvents).toEqual([true, false, true]);

    provider.disconnect();
    clientDoc.destroy();
    serverDoc.destroy();
  });
});
