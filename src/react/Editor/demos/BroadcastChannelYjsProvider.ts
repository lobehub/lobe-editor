import type { Provider, ProviderAwareness, UserState } from '@lexical/yjs';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';

const STORAGE_PREFIX = 'lobe-editor-yjs-demo';

type ProviderEventMap = {
  reload: (doc: Doc) => void;
  status: (event: { status: string }) => void;
  sync: (isSynced: boolean) => void;
  update: (event: unknown) => void;
};

type BroadcastMessage =
  | {
      sender: number;
      state: UserState | null;
      type: 'awareness';
    }
  | {
      sender: number;
      type: 'sync-request';
    }
  | {
      sender: number;
      type: 'sync-response' | 'update';
      update: Uint8Array;
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

class BroadcastChannelAwareness implements ProviderAwareness {
  private listeners = new Set<() => void>();
  private localState: UserState | null = null;
  private states = new Map<number, UserState>();

  constructor(
    private clientId: number,
    private broadcast: (message: BroadcastMessage) => void,
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
    this.broadcast({
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

export class BroadcastChannelYjsProvider implements Provider {
  awareness: BroadcastChannelAwareness;

  private channel: BroadcastChannel | null = null;
  private listeners: {
    [K in keyof ProviderEventMap]: Set<ProviderEventMap[K]>;
  } = {
    reload: new Set(),
    status: new Set(),
    sync: new Set(),
    update: new Set(),
  };
  private receivedSyncResponse = false;
  private updateHandler = (update: Uint8Array, origin: unknown) => {
    this.persistState();

    if (origin === this) {
      return;
    }

    this.broadcast({
      sender: this.doc.clientID,
      type: 'update',
      update,
    });
  };

  constructor(
    private id: string,
    private doc: Doc,
  ) {
    this.awareness = new BroadcastChannelAwareness(this.doc.clientID, (message) =>
      this.broadcast(message),
    );
  }

  connect(): void {
    if (this.channel) {
      return;
    }

    this.restoreState();

    this.channel = new BroadcastChannel(`lobe-editor-yjs:${this.id}`);
    this.channel.addEventListener('message', this.handleMessage);
    this.doc.on('update', this.updateHandler);

    this.emit('status', { status: 'connected' });
    this.broadcast({
      sender: this.doc.clientID,
      type: 'sync-request',
    });

    window.setTimeout(() => {
      if (!this.receivedSyncResponse) {
        this.emit('sync', true);
      }
    }, 250);
  }

  disconnect(): void {
    if (!this.channel) {
      return;
    }

    this.awareness.setLocalState(null);
    this.doc.off('update', this.updateHandler);
    this.channel.removeEventListener('message', this.handleMessage);
    this.channel.close();
    this.channel = null;
    this.emit('status', { status: 'disconnected' });
  }

  off<T extends keyof ProviderEventMap>(type: T, cb: ProviderEventMap[T]): void {
    this.listeners[type].delete(cb as never);
  }

  on<T extends keyof ProviderEventMap>(type: T, cb: ProviderEventMap[T]): void {
    this.listeners[type].add(cb as never);
  }

  private broadcast(message: BroadcastMessage): void {
    this.channel?.postMessage(message);
  }

  private get storageKey(): string {
    return `${STORAGE_PREFIX}:${this.id}`;
  }

  private emit<T extends keyof ProviderEventMap>(
    type: T,
    ...args: Parameters<ProviderEventMap[T]>
  ): void {
    this.listeners[type].forEach((listener) => {
      (listener as (...listenerArgs: Parameters<ProviderEventMap[T]>) => void)(...args);
    });
  }

  private handleMessage = (event: MessageEvent<BroadcastMessage>) => {
    const message = event.data;

    if (!message || message.sender === this.doc.clientID) {
      return;
    }

    if (message.type === 'awareness') {
      this.awareness.updateRemoteState(message.sender, message.state);
      return;
    }

    if (message.type === 'sync-request') {
      this.broadcast({
        sender: this.doc.clientID,
        type: 'sync-response',
        update: encodeStateAsUpdate(this.doc),
      });

      this.broadcast({
        sender: this.doc.clientID,
        state: this.awareness.getLocalState(),
        type: 'awareness',
      });
      return;
    }

    applyUpdate(this.doc, message.update, this);
    this.persistState();
    this.emit('update', message.update);

    if (message.type === 'sync-response') {
      this.receivedSyncResponse = true;
      this.emit('sync', true);
    }
  };

  private persistState(): void {
    try {
      window.localStorage.setItem(this.storageKey, encodeUint8Array(encodeStateAsUpdate(this.doc)));
    } catch {
      // Demo provider only: syncing should keep working even when storage is unavailable.
    }
  }

  private restoreState(): void {
    try {
      const persistedUpdate = window.localStorage.getItem(this.storageKey);

      if (!persistedUpdate) {
        return;
      }

      applyUpdate(this.doc, decodeUint8Array(persistedUpdate), this);
    } catch {
      window.localStorage.removeItem(this.storageKey);
    }
  }
}

export function createBroadcastChannelYjsProvider(
  id: string,
  yjsDocMap: Map<string, Doc>,
): Provider {
  const doc = yjsDocMap.get(id) || new Doc();
  yjsDocMap.set(id, doc);

  // The plugin owns when document-level sync starts; factory only creates the provider.
  const provider = new BroadcastChannelYjsProvider(id, doc);

  return provider;
}
