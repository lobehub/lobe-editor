import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';

const DEFAULT_HTTP_BASE_URL = 'http://localhost:12345';
const DEFAULT_WS_BASE_URL = 'ws://localhost:12345';
const MAX_RECONNECT_DELAY_MS = 10_000;
const MIN_RECONNECT_DELAY_MS = 500;

export type WebSocketYjsProviderStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting';

type ProviderEventMap = {
  reload: (doc: Doc) => void;
  status: (event: { status: WebSocketYjsProviderStatus }) => void;
  sync: (isSynced: boolean) => void;
  update: (event: unknown) => void;
};

type AwarenessSnapshot = {
  clientId: number;
  state: UserState | null;
};

type WebSocketMessage =
  | {
      awareness: AwarenessSnapshot[];
      type: 'sync';
      update: string;
    }
  | {
      sender: number;
      state: UserState | null;
      type: 'awareness';
    }
  | {
      sender: number;
      type: 'update';
      update: string;
    };

function encodeUint8Array(update: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;

  for (let index = 0; index < update.length; index += chunkSize) {
    binary += String.fromCharCode(...update.slice(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function decodeUint8Array(value: string): Uint8Array {
  const binary = window.atob(value);
  const update = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    update[index] = binary.charCodeAt(index);
  }

  return update;
}

class WebSocketAwareness implements ProviderAwareness {
  private listeners = new Set<() => void>();
  private localState: UserState | null = null;
  private states = new Map<number, UserState>();

  constructor(
    private clientId: number,
    private send: (message: WebSocketMessage) => void,
  ) {}

  getLocalState(): UserState | null {
    return this.localState;
  }

  getStates(): Map<number, UserState> {
    return this.states;
  }

  off(type: 'update', cb: () => void): void {
    if (type === 'update') {
      this.listeners.delete(cb);
    }
  }

  on(type: 'update', cb: () => void): void {
    if (type === 'update') {
      this.listeners.add(cb);
    }
  }

  setLocalState(state: UserState | null): void {
    this.localState = state;

    if (state) {
      this.states.set(this.clientId, state);
    } else {
      this.states.delete(this.clientId);
    }

    this.emitUpdate();
    this.send({
      sender: this.clientId,
      state,
      type: 'awareness',
    });
  }

  setLocalStateField(field: string, value: unknown): void {
    const nextState = {
      ...this.localState,
      [field]: value,
    } as UserState;

    this.setLocalState(nextState);
  }

  updateRemoteState(clientId: number, state: UserState | null): void {
    if (clientId === this.clientId) {
      return;
    }

    if (state) {
      this.states.set(clientId, state);
    } else {
      this.states.delete(clientId);
    }

    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export class WebSocketYjsProvider implements Provider {
  awareness: WebSocketAwareness;

  private listeners: {
    [K in keyof ProviderEventMap]: Set<ProviderEventMap[K]>;
  } = {
    reload: new Set(),
    status: new Set(),
    sync: new Set(),
    update: new Set(),
  };
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldConnect = false;
  private socket: WebSocket | null = null;

  private updateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin === this) {
      return;
    }

    this.send({
      sender: this.doc.clientID,
      type: 'update',
      update: encodeUint8Array(update),
    });
  };

  constructor(
    private id: string,
    private doc: Doc,
    private wsBaseUrl = DEFAULT_WS_BASE_URL,
  ) {
    this.awareness = new WebSocketAwareness(this.doc.clientID, (message) => this.send(message));
  }

  connect(): void {
    this.shouldConnect = true;

    if (this.socket || this.reconnectTimer) {
      return;
    }

    this.openSocket('connecting');
  }

  disconnect(): void {
    this.shouldConnect = false;
    this.clearReconnectTimer();

    if (!this.socket) {
      return;
    }

    this.awareness.setLocalState(null);
    this.doc.off('update', this.updateHandler);
    this.socket.close();
    this.socket = null;
    this.emit('sync', false);
    this.emit('status', { status: 'disconnected' });
  }

  off<T extends keyof ProviderEventMap>(type: T, cb: ProviderEventMap[T]): void {
    this.listeners[type].delete(cb as never);
  }

  on<T extends keyof ProviderEventMap>(type: T, cb: ProviderEventMap[T]): void {
    this.listeners[type].add(cb as never);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

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

  private getReconnectDelay(): number {
    const exponentialDelay = MIN_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt;
    const jitter = Math.floor(Math.random() * MIN_RECONNECT_DELAY_MS);

    return Math.min(exponentialDelay + jitter, MAX_RECONNECT_DELAY_MS);
  }

  private openSocket(status: WebSocketYjsProviderStatus): void {
    const socket = new WebSocket(
      `${this.wsBaseUrl}/collaboration/${encodeURIComponent(this.id)}?clientId=${this.doc.clientID}`,
    );

    this.socket = socket;
    socket.binaryType = 'arraybuffer';
    this.emit('status', { status });

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        socket.close();
        return;
      }

      this.reconnectAttempt = 0;
      this.doc.on('update', this.updateHandler);
      this.emit('status', { status: 'connected' });

      const localState = this.awareness.getLocalState();

      if (localState) {
        this.send({
          sender: this.doc.clientID,
          state: localState,
          type: 'awareness',
        });
      }
    });

    socket.addEventListener('message', (event) => this.handleMessage(socket, event));
    socket.addEventListener('close', () => this.handleClose(socket));
    socket.addEventListener('error', () => {
      this.emit('status', { status: 'disconnected' });
    });
  }

  private publishLocalDocumentState(): void {
    this.send({
      sender: this.doc.clientID,
      type: 'update',
      update: encodeUint8Array(encodeStateAsUpdate(this.doc)),
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldConnect || this.reconnectTimer) {
      return;
    }

    const delay = this.getReconnectDelay();
    this.reconnectAttempt += 1;
    this.emit('status', { status: 'reconnecting' });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket('reconnecting');
    }, delay);
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) {
      return;
    }

    this.doc.off('update', this.updateHandler);
    this.socket = null;
    this.emit('sync', false);
    this.emit('status', { status: 'disconnected' });
    this.scheduleReconnect();
  }

  private handleMessage(socket: WebSocket, event: MessageEvent<string>) {
    if (this.socket !== socket) {
      return;
    }

    let message: WebSocketMessage;

    try {
      message = JSON.parse(event.data) as WebSocketMessage;
    } catch {
      this.emit('status', { status: 'disconnected' });
      return;
    }

    if (message.type === 'awareness') {
      this.awareness.updateRemoteState(message.sender, message.state);
      return;
    }

    if (message.type === 'sync') {
      try {
        applyUpdate(this.doc, decodeUint8Array(message.update), this);
      } catch {
        this.emit('status', { status: 'disconnected' });
        return;
      }

      for (const awareness of message.awareness) {
        this.awareness.updateRemoteState(awareness.clientId, awareness.state);
      }

      this.emit('sync', true);
      this.publishLocalDocumentState();
      return;
    }

    if (message.sender === this.doc.clientID) {
      return;
    }

    try {
      const update = decodeUint8Array(message.update);
      applyUpdate(this.doc, update, this);
      this.emit('update', update);
    } catch {
      this.emit('status', { status: 'disconnected' });
    }
  }

  private send(message: WebSocketMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }
}

export function createWebSocketYjsProvider(
  id: string,
  yjsDocMap: Map<string, Doc>,
): WebSocketYjsProvider {
  const doc = yjsDocMap.get(id) || new Doc();
  yjsDocMap.set(id, doc);

  return new WebSocketYjsProvider(id, doc);
}

export async function fetchWebSocketDemoDocument(id: string): Promise<unknown> {
  const response = await fetch(`${DEFAULT_HTTP_BASE_URL}/documents/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Failed to load document: ${response.status}`);
  }

  const { content } = (await response.json()) as { content: unknown };
  return content;
}

async function postWebSocketDemoDocument(
  id: string,
  path: 'save' | 'snapshot',
  content: unknown,
): Promise<void> {
  const response = await fetch(
    `${DEFAULT_HTTP_BASE_URL}/documents/${encodeURIComponent(id)}/${path}`,
    {
      body: JSON.stringify({ content }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to ${path} document: ${response.status}`);
  }
}

export async function saveWebSocketDemoDocument(id: string, content: unknown): Promise<void> {
  await postWebSocketDemoDocument(id, 'save', content);
}

export function snapshotWebSocketDemoDocument(id: string, content: unknown): void {
  const url = `${DEFAULT_HTTP_BASE_URL}/documents/${encodeURIComponent(id)}/snapshot`;
  const body = JSON.stringify({ content });

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });

    if (navigator.sendBeacon(url, blob)) {
      return;
    }
  }

  void fetch(url, {
    body,
    headers: {
      'Content-Type': 'application/json',
    },
    keepalive: true,
    method: 'POST',
  }).catch(() => {});
}
