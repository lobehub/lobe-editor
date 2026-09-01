// @vitest-environment node
import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  type LexicalEditor,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyUpdate,
  createRelativePositionFromTypeIndex,
  Doc,
  encodeStateAsUpdate,
  type RelativePosition,
} from 'yjs';

import { HeadlessEditor } from '../index';
import {
  __exportCollaborativeAgentEditorProjectionForPersistence,
  __createCollaborativeAgentEditorForTesting,
  CollaborativeAgentEditor,
  hashRewriteText,
  serializeRelativePosition,
} from '../collaborative-agent-editor';
import type { BlockRewriteSelection } from '../collaborative-agent-editor';
import { LITEXML_APPLY_COMMAND, LITEXML_REWRITE_RANGE_COMMAND } from '@/plugins/litexml/command';
import { MARK_AI_GENERATED_COMMAND } from '@/plugins/properties/command';
import { captureCollaborativeRewriteSelection } from '@/plugins/yjs';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';
import type { IEditor } from '@/types';

class NoopAwareness implements ProviderAwareness {
  private localState: UserState | null = null;
  private readonly listeners = new Set<() => void>();

  getLocalState(): UserState | null {
    return this.localState;
  }

  getStates(): Map<number, UserState> {
    return this.localState ? new Map([[1, this.localState]]) : new Map();
  }

  off(_type: 'update', callback: () => void): void {
    this.listeners.delete(callback);
  }

  on(_type: 'update', callback: () => void): void {
    this.listeners.add(callback);
  }

  setLocalState(state: UserState | null): void {
    this.localState = state;
    this.listeners.forEach((listener) => listener());
  }

  setLocalStateField(field: string, value: unknown): void {
    this.setLocalState({
      ...(this.localState ?? {
        anchorPos: null,
        awarenessData: {},
        color: '#7c3aed',
        focusPos: null,
        focusing: true,
        name: 'Agent',
      }),
      [field]: value,
    });
  }
}

class MockRoom {
  private readonly providers = new Set<MockProvider>();
  private readonly stateDoc = new Doc();

  constructor(initialUpdate: Uint8Array) {
    applyUpdate(this.stateDoc, initialUpdate);
  }

  connect(provider: MockProvider): void {
    this.providers.add(provider);
    provider.getDoc().on('update', provider.getUpdateHandler());
    applyUpdate(provider.getDoc(), encodeStateAsUpdate(this.stateDoc), provider);
    queueMicrotask(() => provider.emitConnected());
  }

  disconnect(provider: MockProvider): void {
    provider.getDoc().off('update', provider.getUpdateHandler());
    this.providers.delete(provider);
  }

  publish(sender: MockProvider, update: Uint8Array): void {
    applyUpdate(this.stateDoc, update, this);
    for (const provider of this.providers) {
      if (provider === sender) continue;
      applyUpdate(provider.getDoc(), update, provider);
    }
  }

  destroy(): void {
    this.stateDoc.destroy();
  }
}

class MockProvider implements Provider {
  readonly awareness = new NoopAwareness();
  private readonly listeners = {
    reload: new Set<(doc: Doc) => void>(),
    status: new Set<(event: { status: string }) => void>(),
    sync: new Set<(isSynced: boolean) => void>(),
    update: new Set<(event: unknown) => void>(),
  };

  private readonly updateHandler = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) return;
    this.room?.publish(this, update);
  };
  private synced = false;
  private readonly syncPromise: Promise<void>;
  private resolveSync!: () => void;

  constructor(
    private readonly room: MockRoom | null = null,
    private readonly doc: Doc = new Doc(),
  ) {
    this.syncPromise = new Promise((resolve) => {
      this.resolveSync = resolve;
    });
  }

  connect(): void {
    if (!this.room) throw new Error('Mock provider room is not configured.');
    this.room.connect(this);
  }

  emitConnected(): void {
    this.listeners.status.forEach((listener) => listener({ status: 'connected' }));
    this.listeners.sync.forEach((listener) => listener(true));
    this.synced = true;
    this.resolveSync();
  }

  emitDisconnected(): void {
    this.synced = false;
    this.listeners.status.forEach((listener) => listener({ status: 'disconnected' }));
    this.listeners.sync.forEach((listener) => listener(false));
  }

  getDoc(): Doc {
    return this.doc;
  }

  getUpdateHandler(): (update: Uint8Array, origin: unknown) => void {
    return this.updateHandler;
  }

  disconnect(): void {
    this.room?.disconnect(this);
    this.listeners.sync.forEach((listener) => listener(false));
  }

  off(type: 'reload' | 'status' | 'sync' | 'update', callback: never): void {
    this.listeners[type].delete(callback as never);
  }

  on(type: 'reload' | 'status' | 'sync' | 'update', callback: never): void {
    this.listeners[type].add(callback as never);
  }

  waitForSync(): Promise<void> {
    return this.synced ? Promise.resolve() : this.syncPromise;
  }
}

const seedSharedDocument = (): Uint8Array => {
  const seedDoc = new Doc();
  const seed = new HeadlessEditor();
  seed.hydrateMarkdown('Hello collaborative world\n\nsecond paragraph');
  const lexicalEditor = seed.kernel.getLexicalEditor()!;
  const provider = new MockProvider(null, seedDoc);
  const binding = createBinding(
    lexicalEditor,
    provider,
    'agent-room',
    seedDoc,
    new Map([['agent-room', seedDoc]]),
  );
  syncCurrentEditorStateToYjs(binding, provider);
  const update = encodeStateAsUpdate(seedDoc);
  binding.root.destroy(binding);
  seedDoc.destroy();
  seed.destroy();
  return update;
};

const getRelativeTextPosition = (
  lexicalEditor: LexicalEditor,
  binding: ReturnType<typeof createBinding>,
  textKey: string,
  offset: number,
): RelativePosition => {
  return lexicalEditor.getEditorState().read(() => {
    const textNode = lexicalEditor.getEditorState()._nodeMap.get(textKey);
    if (!textNode || !$isTextNode(textNode)) throw new Error('Missing relative text node.');
    const collabNode = binding.collabNodeMap.get(textKey) as unknown as {
      _parent: { _xmlText: unknown };
      getOffset: () => number;
    };
    return createRelativePositionFromTypeIndex(
      collabNode._parent._xmlText as never,
      collabNode.getOffset() + 1 + offset,
    );
  });
};

const getRelativeRange = (
  lexicalEditor: LexicalEditor,
  binding: ReturnType<typeof createBinding>,
  textKey: string,
) => {
  return lexicalEditor.getEditorState().read(() => {
    const textNode = lexicalEditor.getEditorState()._nodeMap.get(textKey);
    if (!textNode || !$isTextNode(textNode)) throw new Error('Missing seed text node.');
    const collabNode = binding.collabNodeMap.get(textKey) as unknown as {
      _parent: { _xmlText: unknown };
      getOffset: () => number;
    };
    const start = createRelativePositionFromTypeIndex(
      collabNode._parent._xmlText as never,
      collabNode.getOffset() + 1,
    );
    const end = createRelativePositionFromTypeIndex(
      collabNode._parent._xmlText as never,
      collabNode.getOffset() + 1 + 5,
    );
    return { end, start };
  });
};

describe('CollaborativeAgentEditor', () => {
  const docs: Doc[] = [];
  const rooms: MockRoom[] = [];
  const sessions: CollaborativeAgentEditor[] = [];

  afterEach(async () => {
    while (sessions.length > 0) await sessions.pop()!.disconnect();
    while (docs.length > 0) docs.pop()!.destroy();
    while (rooms.length > 0) rooms.pop()!.destroy();
  });

  it('creates an unconnected restricted facade for pre-connect awareness', async () => {
    const session = CollaborativeAgentEditor.create({
      documentId: 'document-preconnect',
      requestId: 'request-preconnect',
      roomId: 'room-preconnect',
      ticket: 'ticket-preconnect',
    });
    sessions.push(session);

    expect(session).toBeInstanceOf(CollaborativeAgentEditor);
    expect(() =>
      session.setAgentAwareness({
        anchorPos: null,
        awarenessData: {
          documentId: 'document-preconnect',
          requestId: 'request-preconnect',
          role: 'agent',
          status: 'connecting',
        },
        color: '#7c3aed',
        focusing: true,
        focusPos: null,
        name: 'AI Agent',
      }),
    ).not.toThrow();

    // A facade created before connect must not start a provider/network side
    // effect until the worker explicitly invokes the instance lifecycle.
    await session.disconnect();
  });

  it('rejects invalid construction options and does not leave waitForSync pending on disconnect', async () => {
    await expect(
      CollaborativeAgentEditor.connect({
        documentId: '',
        requestId: 'request',
        roomId: 'room',
        ticket: 'ticket',
      }),
    ).rejects.toThrow('requires documentId');
    expect(() =>
      __createCollaborativeAgentEditorForTesting({
        documentId: 'document',
        provider: {} as never,
        requestId: 'request',
        roomId: 'room',
        ticket: 'ticket',
        yjsDoc: new Doc(),
      }),
    ).toThrow('provider is invalid');

    const pendingDoc = new Doc();
    docs.push(pendingDoc);
    const session = __createCollaborativeAgentEditorForTesting({
      documentId: 'document',
      provider: new MockProvider(),
      requestId: 'request',
      roomId: 'room',
      ticket: 'ticket',
      yjsDoc: pendingDoc,
    });
    sessions.push(session);
    const pendingSync = session.waitForSync();
    await session.disconnect();
    await expect(pendingSync).rejects.toThrow('disconnected');
  });

  it('syncs headless v1 bindings, resolves relative/block selections, gates commands, and exports', async () => {
    const room = new MockRoom(seedSharedDocument());
    rooms.push(room);
    const firstDoc = new Doc();
    const secondDoc = new Doc();
    docs.push(firstDoc, secondDoc);
    const firstProvider = new MockProvider(room, firstDoc);
    const secondProvider = new MockProvider(room, secondDoc);

    const first = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-room',
      provider: firstProvider,
      requestId: 'request-a',
      roomId: 'agent-room',
      ticket: 'test-ticket',
      yjsDoc: firstDoc,
    });
    sessions.push(first);
    await first.connect();
    const firstState = (
      first as unknown as {
        getYjsServiceState: () => { binding: ReturnType<typeof createBinding> };
      }
    ).getYjsServiceState();
    const firstText = firstState.binding.editor.getEditorState().read(() => {
      const textNode = $getRoot().getFirstDescendant();
      return textNode && $isTextNode(textNode) ? textNode.getKey() : '';
    });
    const positions = getRelativeRange(firstState.binding.editor, firstState.binding, firstText);
    const second = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-room',
      provider: secondProvider,
      requestId: 'request-b',
      roomId: 'agent-room',
      ticket: 'test-ticket',
      yjsDoc: secondDoc,
    });
    sessions.push(second);
    await second.connect();

    const relativeSelection = {
      anchorPos: serializeRelativePosition(positions.start),
      baseStateVector: first.getStateVector(),
      capturedAt: new Date().toISOString(),
      focusPos: serializeRelativePosition(positions.end),
      kind: 'relative' as const,
      quotedText: 'Hello',
      quotedTextHash: hashRewriteText('Hello'),
      roomId: 'agent-room',
    };
    const resolved = first.resolveSelection(relativeSelection);
    expect(resolved?.quotedText).toBe('Hello');
    expect(resolved?.startNodeId).toBeTruthy();
    if (!resolved || !resolved.startNodeId) throw new Error('relative selection did not resolve');
    expect(first.setSelection(resolved!.selection)).toBe(true);
    expect(first.getStateVector()).toMatch(/^[A-Za-z0-9+/]+=*$/);

    const secondText = firstState.binding.editor.getEditorState().read(() => {
      const secondBlock = $getRoot().getChildren()[1];
      const node =
        secondBlock && $isElementNode(secondBlock) ? secondBlock.getFirstDescendant() : null;
      return node && $isTextNode(node) ? node.getKey() : '';
    });
    if (!secondText) throw new Error('Missing second paragraph text node.');
    const secondEnd = getRelativeTextPosition(
      firstState.binding.editor,
      firstState.binding,
      secondText,
      6,
    );
    const crossText = firstState.binding.editor.getEditorState().read(() => {
      const range = $createRangeSelection();
      range.anchor.set(firstText, 0, 'text');
      range.focus.set(secondText, 6, 'text');
      return range.getTextContent();
    });
    const crossForward = {
      ...relativeSelection,
      anchorPos: relativeSelection.anchorPos,
      focusPos: serializeRelativePosition(secondEnd),
      quotedText: crossText,
      quotedTextHash: hashRewriteText(crossText),
    };
    const resolvedCross = first.resolveSelection(crossForward);
    expect(resolvedCross?.startNodeId).toBeTruthy();
    expect(resolvedCross?.endNodeId).toBeTruthy();
    if (!resolvedCross) throw new Error('cross-block relative selection did not resolve');
    const resolvedReverse = first.resolveSelection({
      ...crossForward,
      anchorPos: crossForward.focusPos,
      endNodeId: resolvedCross.endNodeId,
      focusPos: crossForward.anchorPos,
      startNodeId: resolvedCross.startNodeId,
    });
    const reverseIsBackward = firstState.binding.editor
      .getEditorState()
      .read(() => resolvedReverse?.selection.isBackward());
    expect(reverseIsBackward).toBe(true);
    expect(resolvedReverse?.startNodeId).toBe(resolvedCross.startNodeId);
    expect(resolvedReverse?.endNodeId).toBe(resolvedCross.endNodeId);

    // Exercise the public browser capture helper end-to-end: the RelativePosition
    // JSON it emits must resolve in a second collaborative editor, not merely
    // look structurally valid in isolation.
    const firstKernel = (first as unknown as { kernel: IEditor }).kernel;
    firstState.binding.editor.update(
      () => {
        const range = $createRangeSelection();
        range.anchor.set(firstText, 0, 'text');
        range.focus.set(secondText, 6, 'text');
        $setSelection(range);
      },
      { discrete: true },
    );
    const captured = captureCollaborativeRewriteSelection(firstKernel, {
      roomId: 'agent-room',
    });
    expect(captured?.kind).toBe('relative');
    if (!captured || captured.kind !== 'relative') {
      throw new Error('public collaborative selection capture did not produce a relative range');
    }
    expect(captured.targetNodeIds).toHaveLength(2);
    const resolvedCaptured = second.resolveSelection(captured);
    expect(resolvedCaptured?.quotedText).toBe(captured.quotedText);
    expect(resolvedCaptured?.startNodeId).toBe(captured.startNodeId);
    expect(resolvedCaptured?.endNodeId).toBe(captured.endNodeId);

    // A Select All/Cmd+A style element-spanning range must keep its durable
    // target projection in document order even if Lexical returns selected
    // nodes in the opposite traversal order.
    firstState.binding.editor.update(
      () => {
        const focusNode = $getNodeByKey(secondText);
        if (!$isTextNode(focusNode)) throw new Error('Missing second text node.');
        const range = $createRangeSelection();
        range.anchor.set(firstText, 0, 'text');
        range.focus.set(secondText, focusNode.getTextContentSize(), 'text');
        $setSelection(range);
      },
      { discrete: true },
    );
    const selectedAll = captureCollaborativeRewriteSelection(firstKernel, {
      roomId: 'agent-room',
    });
    expect(selectedAll?.kind).toBe('relative');
    expect(selectedAll?.targetNodeIds).toEqual(captured.targetNodeIds);
    if (!selectedAll || selectedAll.kind !== 'relative') {
      throw new Error('Select All capture did not produce a relative range');
    }
    const persistedSelectedAll = JSON.parse(JSON.stringify(selectedAll)) as typeof selectedAll;
    expect(persistedSelectedAll.targetNodeIds).toEqual(captured.targetNodeIds);
    expect(second.resolveSelection(persistedSelectedAll)?.quotedText).toBe(selectedAll.quotedText);
    expect(
      second.resolveSelection({
        ...captured,
        targetNodeIds: captured.targetNodeIds.slice(0, 1),
      }),
    ).toBeNull();
    expect(
      second.resolveSelection({
        ...captured,
        targetNodeIds: [...captured.targetNodeIds, captured.targetNodeIds[0]],
      }),
    ).toBeNull();
    const drifted = second.resolveSelection({ ...captured, baseStateVector: 'stale-state-vector' });
    expect(drifted).not.toBeNull();
    expect(drifted?.stateVectorDrifted).toBe(true);
    expect(
      second.resolveSelection({
        ...captured,
        quotedTextHash: hashRewriteText('not the captured text'),
      }),
    ).toBeNull();

    const blockSelection: BlockRewriteSelection = {
      endNodeId: resolved!.endNodeId!,
      endOffset: 5,
      kind: 'block',
      quotedText: 'Hello',
      quotedTextHash: hashRewriteText('Hello'),
      startNodeId: resolved!.startNodeId!,
      startOffset: 0,
    };
    expect(first.resolveSelection(blockSelection)?.quotedText).toBe('Hello');
    expect(first.resolveSelection({ ...blockSelection, startNodeId: firstText })).toBeNull();
    expect(first.resolveSelection({ ...relativeSelection, quotedText: 'Changed' })).toBeNull();

    first.setAgentAwareness({
      documentId: 'agent-room',
      requestId: 'request-a',
      status: 'thinking',
    });
    expect(first.resolveSelection(relativeSelection)).not.toBeNull();

    await expect(
      first.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
        delay: true,
        expectedTextHash: hashRewriteText('Hello'),
        generationId: 'generation-mismatch',
        replacementText: 'Wrong request',
        requestId: 'request-other',
        selection: resolved.selection,
      }),
    ).rejects.toThrow('requestId does not match');
    await expect(
      first.dispatchCommand(MARK_AI_GENERATED_COMMAND, {
        generationId: 'generation-missing-request',
      }),
    ).rejects.toThrow('requestId does not match');

    await expect(first.dispatchCommand(LITEXML_APPLY_COMMAND as never, {})).rejects.toThrow(
      'Command is not allowed',
    );
    expect(
      await first.dispatchCommand(MARK_AI_GENERATED_COMMAND, {
        generationId: 'generation-a',
        nodeIds: [resolved!.startNodeId!],
        requestId: 'request-a',
      }),
    ).toMatchObject({ status: expect.any(String) });
    let rewriteUpdates = 0;
    const countRewriteUpdate = () => {
      rewriteUpdates += 1;
    };
    firstDoc.on('update', countRewriteUpdate);
    const rewriteResult = await first.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      delay: true,
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'generation-rewrite',
      replacementText: 'Hi',
      requestId: 'request-a',
      selection: resolved.selection,
    });
    expect(rewriteResult).toMatchObject({
      affectedNodeIds: [resolved.startNodeId],
      status: 'diff-created',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    firstDoc.off('update', countRewriteUpdate);
    expect(rewriteUpdates).toBe(1);
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(second);
    expect(projection.markdown).toContain('Hi collaborative world');
    expect(JSON.stringify(projection.editorData)).toContain('diff');
    expect(JSON.stringify(projection.editorData)).toContain('generation-rewrite');

    first.setAgentStatus('done');
    expect(firstProvider.awareness.getLocalState()).toBeNull();
    first.setAgentAwareness({
      documentId: 'agent-room',
      requestId: 'request-a',
      status: 'writing',
    });
    firstProvider.emitDisconnected();
    expect(firstProvider.awareness.getLocalState()).toMatchObject({
      awarenessData: { status: 'writing' },
    });
    await expect(
      first.dispatchCommand(MARK_AI_GENERATED_COMMAND, {
        generationId: 'generation-after-disconnect',
        requestId: 'request-a',
      }),
    ).rejects.toThrow('must be synced');
  });

  it('normalizes a durable relative selection before a direct Agent rewrite', async () => {
    const room = new MockRoom(seedSharedDocument());
    rooms.push(room);
    const doc = new Doc();
    docs.push(doc);
    const provider = new MockProvider(room, doc);
    const session = __createCollaborativeAgentEditorForTesting({
      documentId: 'direct-agent-room',
      provider,
      requestId: 'direct-agent-request',
      roomId: 'agent-room',
      ticket: 'test-ticket',
      yjsDoc: doc,
    });
    sessions.push(session);
    await session.connect();

    const service = (
      session as unknown as {
        getYjsServiceState: () => { binding: ReturnType<typeof createBinding> };
      }
    ).getYjsServiceState();
    const textKey = service.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? text.getKey() : '';
    });
    if (!textKey) throw new Error('Missing direct target text node.');
    const positions = getRelativeRange(service.binding.editor, service.binding, textKey);
    const selection = {
      anchorPos: serializeRelativePosition(positions.start),
      baseStateVector: session.getStateVector(),
      capturedAt: new Date().toISOString(),
      focusPos: serializeRelativePosition(positions.end),
      kind: 'relative' as const,
      quotedText: 'Hello',
      quotedTextHash: hashRewriteText('Hello'),
      roomId: 'agent-room',
    };

    const result = await session.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'direct-relative-generation',
      mode: 'direct',
      replacementText: 'Hi',
      requestId: 'direct-agent-request',
      selection,
    });
    expect(result).toMatchObject({ status: 'applied' });
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(session);
    expect(projection.markdown).toContain('Hi collaborative world');
    expect(JSON.stringify(projection.editorData)).not.toContain('"type":"diff"');
    expect(JSON.stringify(projection.editorData)).toContain('direct-relative-generation');
  });

  it('accepts a composer-style space between two relative-positioned paragraphs', async () => {
    const room = new MockRoom(seedSharedDocument());
    rooms.push(room);
    const doc = new Doc();
    docs.push(doc);
    const provider = new MockProvider(room, doc);
    const session = __createCollaborativeAgentEditorForTesting({
      documentId: 'direct-agent-cross-room',
      provider,
      requestId: 'direct-agent-cross-request',
      roomId: 'agent-room',
      ticket: 'test-ticket',
      yjsDoc: doc,
    });
    sessions.push(session);
    await session.connect();

    const service = (
      session as unknown as {
        getYjsServiceState: () => { binding: ReturnType<typeof createBinding> };
      }
    ).getYjsServiceState();
    const [firstText, secondText] = service.binding.editor.getEditorState().read(() => {
      const blocks = $getRoot().getChildren();
      const first = blocks[0] && $isElementNode(blocks[0]) ? blocks[0].getFirstDescendant() : null;
      const second = blocks[1] && $isElementNode(blocks[1]) ? blocks[1].getFirstDescendant() : null;
      return [first, second];
    });
    if (!$isTextNode(firstText) || !$isTextNode(secondText)) {
      throw new Error('Missing cross-paragraph text nodes.');
    }
    service.binding.editor.update(
      () => {
        const range = $createRangeSelection();
        range.anchor.set(firstText.getKey(), 0, 'text');
        range.focus.set(secondText.getKey(), 6, 'text');
        $setSelection(range);
      },
      { discrete: true },
    );
    const captured = captureCollaborativeRewriteSelection(
      (session as unknown as { kernel: IEditor }).kernel,
      { roomId: 'agent-room' },
    );
    if (!captured || captured.kind !== 'relative') {
      throw new Error('Missing cross-paragraph relative capture.');
    }
    const rawQuote = service.binding.editor.getEditorState().read(() => {
      const range = $createRangeSelection();
      range.anchor.set(firstText.getKey(), 0, 'text');
      range.focus.set(secondText.getKey(), 6, 'text');
      return range.getTextContent();
    });
    const composerQuote = rawQuote.replaceAll('\n', ' ');
    expect(captured.quotedText).toBe(composerQuote);
    const result = await session.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText(composerQuote),
      generationId: 'direct-relative-cross-generation',
      mode: 'direct',
      replacementText: 'REWRITTEN',
      requestId: 'direct-agent-cross-request',
      selection: captured,
    });
    expect(result.status).toBe('applied');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(session);
    expect(projection.markdown).toContain('REWRITTEN');
    expect(projection.markdown).toContain('paragraph');
    expect(JSON.stringify(projection.editorData)).not.toContain('"type":"diff"');
  });
});
