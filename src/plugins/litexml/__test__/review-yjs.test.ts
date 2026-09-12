// @vitest-environment node
import { $getRoot } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import {
  IRewriteCommandResultService,
  IRewriteReviewService,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
  type LiteXMLModifyCommandOperation,
} from '@/plugins/litexml/command';
import { hashRewriteText } from '@/plugins/litexml/command';
import { MarkdownPlugin } from '@/plugins/markdown';
import { PropertiesPlugin } from '@/plugins/properties';
import { $getNodeId } from '@/plugins/properties/utils';
import {
  WebSocketYjsProvider,
  type WebSocketLike,
  type WebSocketMessageEvent,
} from '@/plugins/yjs';
import { YjsPlugin } from '@/plugins/yjs/plugin';
import {
  decodeYjsBase64,
  encodeYjsBase64,
  LOBE_YJS_PROTOCOL,
  LOBE_YJS_PROTOCOL_VERSION,
  type LobeYjsClientMessage,
} from '@/plugins/yjs/protocol';
import type { IEditor } from '@/types';

type SocketListener = (event: WebSocketMessageEvent) => void;

class V1RoomServer {
  readonly doc = new Doc();
  readonly sockets: V1FakeWebSocket[] = [];
  private readonly awareness = new Map<number, unknown>();

  connect(socket: V1FakeWebSocket): void {
    this.sockets.push(socket);
    socket.serverMessage({
      nonce: `review-nonce-${this.sockets.length}`,
      protocol: LOBE_YJS_PROTOCOL,
      roomId: socket.roomId,
      type: 'hello',
      version: LOBE_YJS_PROTOCOL_VERSION,
    });
  }

  receive(socket: V1FakeWebSocket, raw: string): void {
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
        if (peer !== socket && peer.readyState === V1FakeWebSocket.OPEN) {
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

    if (message.type !== 'update') return;
    const update = decodeYjsBase64(message.update);
    applyUpdate(this.doc, update);
    for (const peer of this.sockets) {
      if (peer !== socket && peer.readyState === V1FakeWebSocket.OPEN) {
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

  close(): void {
    this.doc.destroy();
  }
}

class V1FakeWebSocket implements WebSocketLike {
  static readonly OPEN = 1;
  static readonly instances: V1FakeWebSocket[] = [];

  readonly roomId: string;
  clientId = 0;
  readyState = 0;
  private readonly listeners = new Map<string, Set<SocketListener>>();
  private readonly queuedMessages: unknown[] = [];

  constructor(
    url: string,
    private readonly server: V1RoomServer,
  ) {
    this.roomId = decodeURIComponent(new URL(url).pathname.split('/').at(-1) || '');
    V1FakeWebSocket.instances.push(this);
    server.connect(this);
  }

  addEventListener(type: string, listener: SocketListener): void {
    const listeners = this.listeners.get(type) || new Set<SocketListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close(): void {
    this.readyState = 3;
    this.emit('close', {});
  }

  open(): void {
    this.readyState = V1FakeWebSocket.OPEN;
    this.emit('open', {});
  }

  send(data: string): void {
    this.server.receive(this, data);
  }

  serverMessage(message: unknown): void {
    if (this.readyState !== V1FakeWebSocket.OPEN) {
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

const createEditor = (
  room: V1RoomServer,
  documentId: string,
  clientId: string,
  shouldBootstrap: boolean,
): { doc: Doc; kernel: IEditor; provider: WebSocketYjsProvider } => {
  const doc = new Doc();
  const provider = new WebSocketYjsProvider('review-room', doc, {
    documentId,
    legacyProtocol: false,
    requestId: clientId,
    ticket: `${clientId}-ticket`,
    webSocketConstructor: class extends V1FakeWebSocket {
      constructor(url: string) {
        super(url, room);
      }
    },
    wsBaseUrl: 'ws://review.test',
  });
  const kernel = Editor.createEditor();
  kernel.registerPlugins([
    CommonPlugin,
    MarkdownPlugin,
    LitexmlPlugin,
    PropertiesPlugin,
    [
      YjsPlugin,
      {
        id: 'review-room',
        providerFactory: () => provider,
        shouldBootstrap,
        yjsDoc: doc,
      },
    ],
  ]);
  kernel.initHeadlessEditor();
  return { doc, kernel, provider };
};

const openNextSocket = async (): Promise<void> => {
  const socket = V1FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error('Expected v1 socket.');
  socket.open();
  socket.flushQueuedMessages();
  await moment();
};

const flushCollaborativeUpdate = async (): Promise<void> => {
  await moment();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await moment();
};

const nodeIdsOfBlocks = (kernel: IEditor): string[] => {
  const lexical = kernel.getLexicalEditor()!;
  return lexical.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => $getNodeId(node))
      .filter((nodeId): nodeId is string => Boolean(nodeId)),
  );
};

const createModify = (nodeId: string, value: string): LiteXMLModifyCommandOperation => ({
  action: 'modify',
  litexml: `<p id="${nodeId}">${value}</p>`,
});

describe('RewriteReviewService over two real v1 Yjs clients', () => {
  const resources: Array<{ doc: Doc; kernel: IEditor; provider: WebSocketYjsProvider }> = [];
  let room: V1RoomServer;

  afterEach(() => {
    while (resources.length > 0) {
      const resource = resources.pop()!;
      resource.provider.close();
      resource.kernel.destroy();
      resource.doc.destroy();
    }
    room?.close();
    V1FakeWebSocket.instances.length = 0;
  });

  it('settles accept/reject across v1 clients with a post-transaction state vector', async () => {
    room = new V1RoomServer();
    const first = createEditor(room, 'review-room', 'browser-a', true);
    const second = createEditor(room, 'review-room', 'browser-b', false);
    resources.push(first, second);

    first.kernel.setDocument('markdown', 'Before paragraph\n\nAnother paragraph');
    await openNextSocket();
    second.kernel.setDocument('markdown', 'placeholder');
    await openNextSocket();
    await flushCollaborativeUpdate();
    expect(second.kernel.getDocument('markdown')).toContain('Before paragraph');
    expect(second.kernel.getDocument('markdown')).toContain('Another paragraph');

    const firstLexical = first.kernel.getLexicalEditor()!;
    const [firstId, secondId] = nodeIdsOfBlocks(first.kernel);
    if (!firstId || !secondId) throw new Error('Expected two durable block ids.');
    const resultChannel = first.kernel.requireService(IRewriteCommandResultService)!;
    const reviewEvents: unknown[] = [];
    const unsubscribe = resultChannel.subscribeReview?.((event) => reviewEvents.push(event));
    const gateway = (
      await import('@/plugins/litexml/command/gateway')
    ).createCollaborativeAgentCommandGateway(firstLexical, resultChannel);

    const acceptOps = [createModify(firstId, 'Accepted paragraph')];
    Object.defineProperties(acceptOps, {
      attempt: { value: 1 },
      commandId: { value: 'review-v1-accept-command' },
      generationId: { value: 'review-v1-accept-generation' },
      requestId: { value: 'review-v1-accept-request' },
    });
    expect((await gateway.dispatch(LITEXML_MODIFY_COMMAND, acceptOps)).status).toBe('diff-created');
    await flushCollaborativeUpdate();

    const reviewService = first.kernel.requireService(IRewriteReviewService)!;
    expect(reviewService.listPendingReviews()).toEqual([
      expect.objectContaining({
        attempt: 1,
        commandId: 'review-v1-accept-command',
        diffCount: 1,
        requestId: 'review-v1-accept-request',
      }),
    ]);
    expect(second.kernel.getDocument('markdown')).toContain('Accepted paragraph');

    const beforeAcceptVector = first.provider.getStateVector();
    const accepted = await reviewService.settleReview({
      attempt: 1,
      commandId: 'review-v1-accept-command',
      requestId: 'review-v1-accept-request',
      status: 'applied',
    });
    expect(accepted).toMatchObject({
      commandId: 'review-v1-accept-command',
      requestId: 'review-v1-accept-request',
      status: 'applied',
    });
    expect(accepted.stateVector).toBeTruthy();
    expect(accepted.stateVector).not.toBe(beforeAcceptVector);
    await flushCollaborativeUpdate();
    expect(second.kernel.getDocument('markdown')).toContain('Accepted paragraph');
    expect(JSON.stringify(second.kernel.getDocument('json'))).not.toContain('"diff"');
    expect(reviewService.listPendingReviews()).toEqual([]);
    expect(Array.from(decodeYjsBase64(accepted.stateVector!))).toEqual(
      Array.from(encodeStateVector(first.doc)),
    );
    expect(reviewEvents).toEqual([
      {
        action: 'applied',
        attempt: 1,
        commandId: 'review-v1-accept-command',
        requestId: 'review-v1-accept-request',
      },
    ]);

    const duplicateAccepted = await reviewService.settleReview({
      attempt: 1,
      commandId: 'review-v1-accept-command',
      requestId: 'review-v1-accept-request',
      status: 'applied',
    });
    expect(duplicateAccepted.status).toBe('noop');
    expect(duplicateAccepted.stateVector).toBe(accepted.stateVector);
    expect(reviewEvents).toHaveLength(1);
    await flushCollaborativeUpdate();

    const rejectOps = [createModify(secondId, 'Rejected paragraph')];
    Object.defineProperties(rejectOps, {
      attempt: { value: 2 },
      commandId: { value: 'review-v1-reject-command' },
      generationId: { value: 'review-v1-reject-generation' },
      requestId: { value: 'review-v1-reject-request' },
    });
    const rejectResult = await gateway.dispatch(LITEXML_MODIFY_COMMAND, rejectOps);
    expect(rejectResult.status).toBe('diff-created');
    await flushCollaborativeUpdate();
    expect(second.kernel.getDocument('markdown')).toContain('Rejected paragraph');

    const beforeRejectVector = first.provider.getStateVector();
    const rejected = await reviewService.settleReview({
      attempt: 2,
      commandId: 'review-v1-reject-command',
      requestId: 'review-v1-reject-request',
      status: 'rejected',
    });
    expect(rejected).toMatchObject({
      commandId: 'review-v1-reject-command',
      requestId: 'review-v1-reject-request',
      status: 'rejected',
    });
    expect(rejected.stateVector).toBeTruthy();
    expect(rejected.stateVector).not.toBe(beforeRejectVector);
    await flushCollaborativeUpdate();
    expect(second.kernel.getDocument('markdown')).toContain('Accepted paragraph');
    expect(second.kernel.getDocument('markdown')).toContain('Another paragraph');
    expect(second.kernel.getDocument('markdown')).not.toContain('Rejected paragraph');
    expect(JSON.stringify(second.kernel.getDocument('json'))).not.toContain('"diff"');
    expect(Array.from(decodeYjsBase64(rejected.stateVector!))).toEqual(
      Array.from(encodeStateVector(first.doc)),
    );
    expect(reviewEvents).toHaveLength(2);
    const duplicateRejected = await reviewService.settleReview({
      attempt: 2,
      commandId: 'review-v1-reject-command',
      requestId: 'review-v1-reject-request',
      status: 'rejected',
    });
    expect(duplicateRejected.status).toBe('noop');
    expect(duplicateRejected.stateVector).toBe(rejected.stateVector);
    expect(reviewEvents).toHaveLength(2);
    unsubscribe?.();
  });

  it('applies a direct Agent rewrite in one Yjs transaction and survives JSON/Yjs reload', async () => {
    room = new V1RoomServer();
    const first = createEditor(room, 'direct-room', 'agent-a', true);
    const second = createEditor(room, 'direct-room', 'browser-b', false);
    resources.push(first, second);

    first.kernel.setDocument('markdown', 'Before paragraph\n\nAnother paragraph');
    await openNextSocket();
    second.kernel.setDocument('markdown', 'placeholder');
    await openNextSocket();
    await flushCollaborativeUpdate();

    const [firstId, secondId] = nodeIdsOfBlocks(first.kernel);
    if (!firstId || !secondId) throw new Error('Expected durable direct target ids.');
    const firstLexical = first.kernel.getLexicalEditor()!;
    const resultChannel = first.kernel.requireService(IRewriteCommandResultService)!;
    const gateway = (
      await import('@/plugins/litexml/command/gateway')
    ).createCollaborativeAgentCommandGateway(firstLexical, resultChannel);
    let yjsUpdates = 0;
    first.doc.on('update', () => {
      yjsUpdates += 1;
    });

    const direct = await gateway.dispatch(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Before paragraph Another'),
      generationId: 'direct-yjs-generation',
      mode: 'direct',
      replacementText: 'After',
      requestId: 'direct-yjs-request',
      selection: {
        anchor: { nodeId: firstId, offset: 0 },
        focus: { nodeId: secondId, offset: 7 },
        quotedText: 'Before paragraph Another',
        quotedTextHash: hashRewriteText('Before paragraph Another'),
        targetNodeIds: [firstId, secondId],
        type: 'range',
      },
    });

    expect(direct).toMatchObject({
      affectedNodeIds: [firstId, secondId],
      requestId: 'direct-yjs-request',
      status: 'applied',
    });
    expect(direct.commandId).toBeTruthy();
    expect(direct.stateVector).toBeTruthy();
    expect(yjsUpdates).toBe(1);
    await flushCollaborativeUpdate();
    expect(second.kernel.getDocument('markdown')).toContain('After');
    expect(second.kernel.getDocument('markdown')).toContain('paragraph');
    expect(JSON.stringify(first.kernel.getDocument('json'))).not.toContain('"type":"diff"');
    expect(JSON.stringify(second.kernel.getDocument('json'))).toContain('direct-yjs-generation');
    expect(Array.from(decodeYjsBase64(direct.stateVector!))).toEqual(
      Array.from(encodeStateVector(first.doc)),
    );

    // A fresh Lexical/Yjs binding must hydrate the committed direct result,
    // including the durable block id and generated provenance, without any
    // review wrapper or runtime node-key dependency.
    const reloaded = createEditor(room, 'direct-room', 'browser-reload', false);
    resources.push(reloaded);
    reloaded.kernel.setDocument('markdown', 'placeholder');
    await openNextSocket();
    await flushCollaborativeUpdate();
    expect(reloaded.kernel.getDocument('markdown')).toContain('After');
    expect(reloaded.kernel.getDocument('markdown')).toContain('paragraph');
    const reloadedJSON = JSON.stringify(reloaded.kernel.getDocument('json'));
    expect(reloadedJSON).not.toContain('"type":"diff"');
    expect(reloadedJSON).toContain(firstId);
    expect(reloadedJSON).toContain('direct-yjs-generation');
  });
});
