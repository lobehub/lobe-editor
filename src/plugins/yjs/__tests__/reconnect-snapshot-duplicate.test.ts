import { createBinding, type Provider, type ProviderAwareness } from '@lexical/yjs';
import { $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import {
  $getRoot,
  $isElementNode,
  ElementNode,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalNode,
} from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from '@/headless/default-plugins';
import { $setNodeProperties } from '@/plugins/properties/state';
import { YjsPlugin } from '@/plugins/yjs/plugin';
import {
  decodeYjsBase64,
  encodeYjsBase64,
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
  type LobeYjsClientMessage,
} from '@/plugins/yjs/protocol';
import {
  WebSocketYjsProvider,
  type WebSocketLike,
  type WebSocketMessageEvent,
} from '@/plugins/yjs/websocket-provider';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';
import type { IEditor } from '@/types';

type SocketListener = (event: WebSocketMessageEvent) => void;

/**
 * This relay deliberately models a room restart that writes the persisted JSON
 * projection into a fresh Y.Doc. It is the failure mode we must not hide by
 * suppressing a client's reconnect update: the fresh structs have different
 * Yjs client IDs but represent the same logical XML children.
 */
class RestartableRoom {
  doc = new Doc();
  readonly sockets: RestartableSocket[] = [];
  updateCount = 0;

  connect(socket: RestartableSocket): void {
    this.sockets.push(socket);
    socket.serverMessage({
      nonce: `reconnect-nonce-${this.sockets.length}`,
      protocol: LOBE_YJS_PROTOCOL,
      roomId: socket.roomId,
      type: 'hello',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  /** Replace the relay's CRDT with a JSON-rebuilt document using new IDs. */
  replaceWithFreshSnapshot(doc: Doc): void {
    this.doc.destroy();
    this.doc = doc;
  }

  receive(socket: RestartableSocket, raw: string): void {
    const message = JSON.parse(raw) as LobeYjsClientMessage;

    if (message.type === 'auth') {
      socket.clientId = message.clientId;
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
        awareness: [],
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

    if (message.type !== 'update') return;

    this.updateCount += 1;
    applyUpdate(this.doc, decodeYjsBase64(message.update));
    for (const peer of this.sockets) {
      if (peer !== socket && peer.readyState === RestartableSocket.OPEN) {
        peer.serverMessage({
          ...message,
          protocol: LOBE_YJS_PROTOCOL,
          sender: socket.clientId,
          version: LOBE_YJS_PROTOCOL_VERSION,
        });
      }
    }
    socket.serverMessage({
      messageId: message.messageId,
      protocol: LOBE_YJS_PROTOCOL,
      type: 'update-ack',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  destroy(): void {
    this.doc.destroy();
  }
}

class RestartableSocket implements WebSocketLike {
  static readonly OPEN = 1;
  static readonly instances: RestartableSocket[] = [];

  readonly roomId: string;
  clientId = 0;
  readyState = 0;
  private readonly listeners = new Map<string, Set<SocketListener>>();
  private readonly queuedMessages: unknown[] = [];

  constructor(
    url: string,
    private readonly room: RestartableRoom,
  ) {
    this.roomId = decodeURIComponent(new URL(url).pathname.split('/').at(-1) || '');
    RestartableSocket.instances.push(this);
    room.connect(this);
  }

  addEventListener(type: string, listener: SocketListener): void {
    const callbacks = this.listeners.get(type) ?? new Set<SocketListener>();
    callbacks.add(listener);
    this.listeners.set(type, callbacks);
  }

  close(): void {
    this.serverClose();
  }

  open(): void {
    this.readyState = RestartableSocket.OPEN;
    this.emit('open', {});
  }

  send(data: string): void {
    this.room.receive(this, data);
  }

  serverClose(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close', {});
  }

  serverMessage(message: unknown): void {
    if (this.readyState !== RestartableSocket.OPEN) {
      this.queuedMessages.push(message);
      return;
    }
    this.emit('message', { data: JSON.stringify(message) });
  }

  flushQueuedMessages(): void {
    for (const message of this.queuedMessages.splice(0)) this.serverMessage(message);
  }

  private emit(type: string, event: WebSocketMessageEvent): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

class NoopProvider implements Provider {
  readonly awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map(),
    off: () => undefined,
    on: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };

  connect(): void {}
  disconnect(): void {}
  off(): void {}
  on(): void {}
}

const createPeer = (
  room: RestartableRoom,
  requestId: string,
  shouldBootstrap: boolean,
): { doc: Doc; kernel: IEditor; provider: WebSocketYjsProvider; root: HTMLElement } => {
  const doc = new Doc();
  const provider = new WebSocketYjsProvider('reconnect-room', doc, {
    documentId: 'reconnect-room',
    legacyProtocol: false,
    requestId,
    ticket: `${requestId}-ticket`,
    webSocketConstructor: class extends RestartableSocket {
      constructor(url: string) {
        super(url, room);
      }
    },
    wsBaseUrl: 'ws://reconnect.test',
  });
  const kernel = Editor.createEditor();
  kernel.registerPlugins([
    ...DEFAULT_HEADLESS_EDITOR_PLUGINS,
    [
      YjsPlugin,
      {
        id: 'reconnect-room',
        providerFactory: () => provider,
        shouldBootstrap,
        yjsDoc: doc,
      },
    ],
  ]);
  const root = document.createElement('div');
  kernel.setRootElement(root);
  return { doc, kernel, provider, root };
};

const openLatestSocket = async (): Promise<void> => {
  const socket = RestartableSocket.instances.at(-1);
  if (!socket) throw new Error('Expected a reconnect socket.');
  socket.open();
  socket.flushQueuedMessages();
  await moment();
};

const settle = async (): Promise<void> => {
  await moment();
  await Promise.resolve();
  await moment();
};

const editorProjection = (kernel: IEditor): { artifactCount: number; text: string } => {
  const lexical = kernel.getLexicalEditor()!;
  return lexical.getEditorState().read(() => {
    let artifactCount = 0;
    const visit = (node: LexicalNode): void => {
      if (node.getType() === 'artifact') artifactCount += 1;
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    visit($getRoot());
    return { artifactCount, text: $getRoot().getTextContent() };
  });
};

const semanticEditorText = (kernel: IEditor): string => {
  const lexical = kernel.getLexicalEditor()!;
  return lexical.getEditorState().read(() => ElementNode.prototype.getTextContent.call($getRoot()));
};

/** Rebuild a server Y.Doc by importing only the persisted JSON projection. */
const createFreshServerDoc = async (json: string): Promise<Doc> => {
  const snapshotKernel = Editor.createEditor();
  snapshotKernel.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
  snapshotKernel.initHeadlessEditor();
  snapshotKernel.setDocument('json', json);
  await settle();

  const snapshotDoc = new Doc();
  const snapshotProvider = new NoopProvider();
  const snapshotEditor = snapshotKernel.getLexicalEditor()!;
  const snapshotBinding = createBinding(
    snapshotEditor,
    snapshotProvider,
    'reconnect-room',
    snapshotDoc,
    new Map([['reconnect-room', snapshotDoc]]),
  );
  syncCurrentEditorStateToYjs(snapshotBinding, snapshotProvider);
  snapshotBinding.root.destroy(snapshotBinding);
  snapshotKernel.destroy();
  return snapshotDoc;
};

describe('browser reconnect against a JSON-rebuilt Yjs snapshot', () => {
  const resources: Array<{
    doc: Doc;
    kernel: IEditor;
    provider: WebSocketYjsProvider;
  }> = [];
  let room: RestartableRoom;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    RestartableSocket.instances.length = 0;
    room = new RestartableRoom();
  });

  afterEach(() => {
    while (resources.length > 0) {
      const resource = resources.pop()!;
      resource.provider.close();
      resource.kernel.destroy();
      resource.doc.destroy();
    }
    room.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.fails('diagnoses a fresh-identity reconnect snapshot as an unsupported merge', async () => {
    const first = createPeer(room, 'browser-a', true);
    const second = createPeer(room, 'browser-b', false);
    resources.push(first, second);

    first.kernel.setDocument('markdown', 'Deterministic reconnect body');
    first.kernel.getLexicalEditor()!.update(
      () => {
        const artifact = $createArtifactNode('<main>stable artifact</main>', 'Stable artifact');
        $getRoot().append(artifact);
        $setNodeProperties(artifact, {
          nodeId: 'reconnect-artifact',
          provenance: {
            generationId: 'reconnect-generation',
            requestId: 'reconnect-request',
            source: 'ai',
          },
        });
      },
      { discrete: true },
    );
    await settle();

    await openLatestSocket();
    second.kernel.setDocument('markdown', 'placeholder');
    await openLatestSocket();
    await settle();

    const before = editorProjection(first.kernel);
    expect(before.artifactCount).toBe(1);
    expect(before.text).toContain('Deterministic reconnect body');
    expect(editorProjection(second.kernel)).toEqual(before);

    // The room restart reconstructs the same logical document from JSON, so
    // this update contains new Yjs client IDs even though the DB projection is
    // unchanged. A correct reconnect must not merge those XML children twice.
    const freshServerDoc = await createFreshServerDoc(
      first.kernel.getDocument('json') as unknown as string,
    );
    room.replaceWithFreshSnapshot(freshServerDoc);

    RestartableSocket.instances.at(-2)?.serverClose();
    await vi.advanceTimersByTimeAsync(500);
    await openLatestSocket();
    await settle();

    expect(editorProjection(first.kernel)).toEqual(before);

    // A second reconnect exercises repeated sync/hydration against the same
    // client Doc. It must remain idempotent as well.
    RestartableSocket.instances.at(-1)?.serverClose();
    await vi.advanceTimersByTimeAsync(500);
    await openLatestSocket();
    await settle();
    expect(editorProjection(first.kernel)).toEqual(before);
  });

  it('keeps one projection across five exact-snapshot reconnects and repeated hydration', async () => {
    const first = createPeer(room, 'browser-a', true);
    const second = createPeer(room, 'browser-b', false);
    resources.push(first, second);

    first.kernel.setDocument('markdown', 'Deterministic reconnect body');
    first.kernel.getLexicalEditor()!.update(
      () => {
        const artifact = $createArtifactNode('<main>stable artifact</main>', 'Stable artifact');
        $getRoot().append(artifact);
        $setNodeProperties(artifact, {
          nodeId: 'reconnect-artifact',
          provenance: {
            generationId: 'reconnect-generation',
            requestId: 'reconnect-request',
            source: 'ai',
          },
        });
      },
      { discrete: true },
    );
    await settle();

    await openLatestSocket();
    second.kernel.setDocument('markdown', 'placeholder');
    await openLatestSocket();
    await settle();

    const before = editorProjection(first.kernel);
    const updatesBeforeReconnect = room.updateCount;
    expect(before.artifactCount).toBe(1);
    expect(editorProjection(second.kernel)).toEqual(before);
    expect(semanticEditorText(first.kernel)).toBe(before.text);
    expect(semanticEditorText(second.kernel)).toBe(before.text);
    expect(semanticEditorText(first.kernel)).toBe(semanticEditorText(second.kernel));

    // This is the supported restart contract: persistence restores the exact
    // Yjs update bytes, preserving every struct/client ID.
    const persistedUpdate = encodeStateAsUpdate(room.doc);
    let firstSocket = RestartableSocket.instances.at(-2);
    for (let reconnect = 0; reconnect < 5; reconnect += 1) {
      const restoredServerDoc = new Doc();
      applyUpdate(restoredServerDoc, persistedUpdate);
      room.replaceWithFreshSnapshot(restoredServerDoc);

      firstSocket?.serverClose();
      await vi.advanceTimersByTimeAsync(500);
      await openLatestSocket();
      await settle();
      firstSocket = RestartableSocket.instances.at(-1);

      expect(editorProjection(first.kernel)).toEqual(before);
      expect(semanticEditorText(first.kernel)).toBe(before.text);
      expect(semanticEditorText(second.kernel)).toBe(before.text);
      expect(room.updateCount).toBe(updatesBeforeReconnect);

      // Force a second sync against the same server identity without another
      // local edit. Reconnect should keep the existing collab mapping rather
      // than replaying a full Y.XmlText delta into the same CollabTextNode.
      firstSocket?.serverClose();
      await vi.advanceTimersByTimeAsync(500);
      await openLatestSocket();
      await settle();
      firstSocket = RestartableSocket.instances.at(-1);
      expect(editorProjection(first.kernel)).toEqual(before);
      expect(semanticEditorText(first.kernel)).toBe(before.text);
      expect(room.updateCount).toBe(updatesBeforeReconnect);
    }
  });

  it('retains a local edit made during a reconnect gap and keeps undo local to A', async () => {
    const first = createPeer(room, 'browser-a', true);
    const second = createPeer(room, 'browser-b', false);
    resources.push(first, second);

    first.kernel.setDocument('markdown', 'Shared reconnect body');
    await settle();
    await openLatestSocket();
    second.kernel.setDocument('markdown', 'placeholder');
    await openLatestSocket();
    await settle();

    const persistedUpdate = encodeStateAsUpdate(room.doc);
    const firstSocket = RestartableSocket.instances.at(-2);
    firstSocket?.serverClose();
    await settle();

    // The browser remains editable while the transport reconnects. This
    // update must enter the provider's pending queue and be merged after the
    // exact server snapshot is restored; it must not be overwritten by the
    // sync barrier.
    first.kernel.getLexicalEditor()!.update(() => {
      const textNode = $getRoot().getAllTextNodes()[0];
      textNode?.setTextContent('Shared reconnect body + local edit');
    });
    await settle();

    const restoredServerDoc = new Doc();
    applyUpdate(restoredServerDoc, persistedUpdate);
    room.replaceWithFreshSnapshot(restoredServerDoc);
    await vi.advanceTimersByTimeAsync(500);
    await openLatestSocket();
    await settle();
    await settle();

    expect(editorProjection(first.kernel).text).toContain('local edit');
    expect(editorProjection(second.kernel).text).toContain('local edit');

    // A's local history can undo its own edit on both peers, while B's empty
    // local stack must not fall through to Lexical's non-collaborative stack.
    second.kernel.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
    await settle();
    expect(editorProjection(second.kernel).text).toContain('local edit');

    first.kernel.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
    await settle();
    await settle();
    expect(editorProjection(first.kernel).text).not.toContain('local edit');
    expect(editorProjection(second.kernel).text).not.toContain('local edit');

    first.kernel.getLexicalEditor()!.dispatchCommand(REDO_COMMAND, undefined);
    await settle();
    await settle();
    expect(editorProjection(first.kernel).text).toContain('local edit');
    expect(editorProjection(second.kernel).text).toContain('local edit');
  });
});
