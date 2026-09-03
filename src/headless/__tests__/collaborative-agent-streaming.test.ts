// @vitest-environment node
import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import {
  $createLineBreakNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import {
  __createCollaborativeAgentEditorForTesting,
  __exportCollaborativeAgentEditorProjectionForPersistence,
  CollaborativeAgentEditor,
  hashRewriteText,
} from '../collaborative-agent-editor';
import type { CollaborativeRewriteStreamResult } from '../collaborative-agent-editor';
import { captureCollaborativeRewriteSelection } from '@/plugins/yjs';
import { syncCurrentEditorStateToYjs } from '@/plugins/yjs/plugin/utils/sync';
import { handlePlainTextPaste } from '@/plugins/common/plugin/paste-handler';
import { HeadlessEditor } from '../index';

class MockClipboardEvent extends Event {
  constructor(readonly clipboardData: DataTransfer) {
    super('paste', { bubbles: true, cancelable: true });
  }
}

class TestAwareness implements ProviderAwareness {
  private localState: UserState | null = null;
  private readonly remoteStates = new Map<number, UserState>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly onLocalState?: (state: UserState | null) => void) {}

  getLocalState(): UserState | null {
    return this.localState;
  }

  getStates(): Map<number, UserState> {
    return new Map([
      ...(this.localState ? [[1, this.localState] as const] : []),
      ...this.remoteStates,
    ]);
  }

  off(_type: 'update', callback: () => void): void {
    this.listeners.delete(callback);
  }

  on(_type: 'update', callback: () => void): void {
    this.listeners.add(callback);
  }

  setLocalState(state: UserState | null): void {
    this.localState = state;
    this.onLocalState?.(state);
    for (const listener of this.listeners) listener();
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

  updateRemoteState(clientId: number, state: UserState | null): void {
    if (state) this.remoteStates.set(clientId, state);
    else this.remoteStates.delete(clientId);
  }
}

class TestRoom {
  private readonly providers = new Set<TestProvider>();
  private readonly stateDoc: Doc;

  constructor(initialUpdate: Uint8Array) {
    this.stateDoc = new Doc();
    applyUpdate(this.stateDoc, initialUpdate);
  }

  connect(provider: TestProvider): void {
    this.providers.add(provider);
    provider.doc.on('update', provider.updateHandler);
    applyUpdate(provider.doc, encodeStateAsUpdate(this.stateDoc), this);
    queueMicrotask(() => provider.emitSync());
  }

  disconnect(provider: TestProvider): void {
    provider.doc.off('update', provider.updateHandler);
    this.providers.delete(provider);
  }

  publish(sender: TestProvider, update: Uint8Array): void {
    applyUpdate(this.stateDoc, update, this);
    for (const provider of this.providers) {
      if (provider === sender) continue;
      applyUpdate(provider.doc, update, provider);
    }
  }

  publishAwareness(sender: TestProvider, state: UserState | null): void {
    for (const provider of this.providers) {
      if (provider === sender) continue;
      provider.awareness.updateRemoteState(sender.clientId, state);
    }
  }

  destroy(): void {
    this.stateDoc.destroy();
  }
}

class TestProvider implements Provider {
  readonly clientId: number;
  readonly awareness: TestAwareness;
  readonly doc: Doc;
  readonly updateHandler = (update: Uint8Array, origin: unknown): void => {
    if (origin !== this) this.room?.publish(this, update);
  };
  private readonly listeners = {
    reload: new Set<(doc: Doc) => void>(),
    status: new Set<(event: { status: string }) => void>(),
    sync: new Set<(isSynced: boolean) => void>(),
    update: new Set<(event: unknown) => void>(),
  };
  private synced = false;

  constructor(
    private readonly room: TestRoom | null,
    doc = new Doc(),
  ) {
    this.doc = doc;
    this.clientId = doc.clientID;
    this.awareness = new TestAwareness((state) => room?.publishAwareness(this, state));
  }

  connect(): void {
    if (!this.room) throw new Error('room missing');
    this.room.connect(this);
  }

  disconnect(): void {
    this.room?.disconnect(this);
    this.synced = false;
    this.listeners.sync.forEach((listener) => listener(false));
  }

  emitSync(): void {
    this.synced = true;
    this.listeners.status.forEach((listener) => listener({ status: 'connected' }));
    this.listeners.sync.forEach((listener) => listener(true));
  }

  emitDisconnected(): void {
    this.synced = false;
    this.listeners.status.forEach((listener) => listener({ status: 'disconnected' }));
    this.listeners.sync.forEach((listener) => listener(false));
  }

  waitForSync(): Promise<void> {
    return this.synced
      ? Promise.resolve()
      : new Promise((resolve) => {
          const onSync = (synced: boolean) => {
            if (!synced) return;
            this.off('sync', onSync);
            resolve();
          };
          this.on('sync', onSync);
        });
  }

  off(type: 'reload' | 'status' | 'sync' | 'update', callback: unknown): void {
    this.listeners[type].delete(callback as never);
  }

  on(type: 'reload' | 'status' | 'sync' | 'update', callback: unknown): void {
    this.listeners[type].add(callback as never);
  }
}

const seedDocument = (): Uint8Array => {
  const source = new HeadlessEditor();
  source.hydrateMarkdown('Hello collaborative world\n\nHuman paragraph');
  const doc = new Doc();
  const provider = new TestProvider(null, doc);
  const editor = source.kernel.getLexicalEditor()!;
  const binding = createBinding(
    editor,
    provider,
    'stream-room',
    doc,
    new Map([['stream-room', doc]]),
  );
  syncCurrentEditorStateToYjs(binding, provider);
  const update = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  source.destroy();
  return update;
};

const seedLinebreakDocument = async (): Promise<Uint8Array> => {
  const source = new HeadlessEditor();
  source.hydrateMarkdown('placeholder');
  const sourceEditor = source.kernel.getLexicalEditor()!;
  sourceEditor.update(() => {
    const paragraph = $getRoot().getFirstChild();
    if (!$isElementNode(paragraph)) throw new Error('linebreak paragraph missing');
    paragraph.clear();
    paragraph.append($createTextNode('a'), $createLineBreakNode(), $createTextNode('bc'));
  });
  await flush();

  const doc = new Doc();
  const provider = new TestProvider(null, doc);
  const binding = createBinding(
    sourceEditor,
    provider,
    'stream-room',
    doc,
    new Map([['stream-room', doc]]),
  );
  syncCurrentEditorStateToYjs(binding, provider);
  const update = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  source.destroy();
  return update;
};

const createAgent = (room: TestRoom, requestId: string) => {
  const doc = new Doc();
  const provider = new TestProvider(room, doc);
  const agent = __createCollaborativeAgentEditorForTesting({
    documentId: 'stream-room',
    provider,
    requestId,
    roomId: 'stream-room',
    ticket: 'test-ticket',
    yjsDoc: doc,
  });
  return { agent, doc, provider };
};

const captureText = (agent: CollaborativeAgentEditor, value: string) => {
  const internal = agent as unknown as {
    kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
  };
  const lexicalEditor = internal.kernel.getLexicalEditor()!;
  lexicalEditor.update(
    () => {
      const text = $getRoot().getFirstDescendant();
      if (!$isTextNode(text)) throw new Error('seed text missing');
      const start = text.getTextContent().indexOf(value);
      if (start < 0) throw new Error(`selection text missing: ${value}`);
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), start, 'text');
      selection.focus.set(text.getKey(), start + value.length, 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
  return captureCollaborativeRewriteSelection(internal.kernel as never, { roomId: 'stream-room' });
};

const captureHello = (agent: CollaborativeAgentEditor) => captureText(agent, 'Hello');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('CollaborativeAgentEditor streaming rewrite', () => {
  const rooms: TestRoom[] = [];
  const docs: Doc[] = [];
  const agents: CollaborativeAgentEditor[] = [];

  beforeEach(() => {
    vi.stubGlobal('ClipboardEvent', MockClipboardEvent);
  });

  afterEach(async () => {
    while (agents.length > 0) await agents.pop()!.disconnect();
    while (docs.length > 0) docs.pop()!.destroy();
    while (rooms.length > 0) rooms.pop()!.destroy();
  });

  it('streams visible chunks incrementally, protects the marker before token one, and finalizes without a Diff', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    // Non-target edits advance the room state vector but must not invalidate a
    // durable selection whose target quote/hash still matches.
    const firstInternal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    firstInternal.kernel.getLexicalEditor()!.update(
      () => {
        const block = $getRoot().getChildren()[1];
        const text = block && $isElementNode(block) ? block.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('non-target text missing');
        text.setTextContent('Human edited before token one');
      },
      { discrete: true },
    );
    await flush();

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation',
      provenanceSessionId: 'provenance-session',
      requestId: 'stream-request',
      sessionId: 'stream-session',
      selection,
      turnIndex: 7,
    });
    expect(started).toMatchObject({
      affectedNodeIds: [selection.startNodeId],
      caret: { nodeId: selection.startNodeId, offset: 0 },
      status: 'streaming',
    });

    const blockedBeforeFirstChunk = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const lex = blockedBeforeFirstChunk.kernel.getLexicalEditor()!;
    const markerResult = lex.getEditorState().read(() => {
      const block = $getRoot().getFirstChild();
      return block && $isElementNode(block) ? JSON.stringify(block.exportJSON()) : '';
    });
    expect(markerResult).toContain('rewriteRegionStatus');

    const firstChunk = await first.agent.appendRewriteChunk({
      chunk: 'Hi',
      chunkId: 'chunk-1',
      sessionId: 'stream-session',
    });
    expect(firstChunk).toMatchObject({
      caret: { nodeId: selection.startNodeId, offset: 2 },
      sequence: 1,
    });
    const afterFirst = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(afterFirst.markdown).toContain('Hi collaborative world');
    expect(JSON.stringify(afterFirst.editorData)).toContain('stream-generation');
    expect(JSON.stringify(afterFirst.editorData)).toContain('provenance-session');
    expect(JSON.stringify(afterFirst.editorData)).toContain('"turnIndex":7');

    const duplicate = await first.agent.appendRewriteChunk({
      chunk: 'Hi',
      chunkId: 'chunk-1',
      sessionId: 'stream-session',
    });
    expect(duplicate).toEqual(firstChunk);

    const secondChunk = await first.agent.appendRewriteChunk({
      chunk: ' there',
      chunkId: 'chunk-2',
      sessionId: 'stream-session',
    });
    expect(secondChunk.sequence).toBe(2);
    const finalized = await first.agent.finalizeRewriteSession({ sessionId: 'stream-session' });
    expect(finalized).toMatchObject({
      affectedNodeIds: [selection.startNodeId],
      caret: { nodeId: selection.startNodeId, offset: 8 },
      stateVector: expect.any(String),
      status: 'applied',
    });
    const afterFinal = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(afterFinal.markdown).toContain('Hi there collaborative world');
    expect(JSON.stringify(afterFinal.editorData)).not.toContain('rewriteRegionStatus');
    expect(JSON.stringify(afterFinal.editorData)).toContain('stream-generation');
    expect(JSON.stringify(afterFinal.editorData)).toContain('provenance-session');
    expect(JSON.stringify(afterFinal.editorData)).toContain('"turnIndex":7');
  });

  it('returns busy for disjoint same-block streams until the first stream settles', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-parallel-a');
    const second = createAgent(room, 'stream-request-parallel-b');
    agents.push(first.agent, second.agent);
    docs.push(first.doc, second.doc);
    await Promise.all([first.agent.connect(), second.agent.connect()]);

    // Capture both ranges before either stream edits the shared Y.Doc. The
    // RelativePositions must follow the first deletion to the still-disjoint
    // suffix instead of being rejected by the block-id projection.
    const firstSelection = captureText(first.agent, 'Hello');
    const secondSelection = captureText(second.agent, 'world');
    if (!firstSelection || !secondSelection) throw new Error('parallel selection capture failed');

    const firstStarted = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-parallel-a',
      requestId: 'stream-request-parallel-a',
      sessionId: 'stream-session-parallel-a',
      selection: firstSelection,
    });
    expect(firstStarted.status).toBe('streaming');

    const secondStarted = await second.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('world'),
      generationId: 'stream-generation-parallel-b',
      requestId: 'stream-request-parallel-b',
      sessionId: 'stream-session-parallel-b',
      selection: secondSelection,
    });
    expect(secondStarted).toMatchObject({
      error: 'stream-session-busy',
      status: 'conflict',
    });

    const firstFinal = await first.agent.finalizeRewriteSession({
      sessionId: 'stream-session-parallel-a',
    });
    expect(firstFinal.status).toBe('applied');
    await flush();

    const retried = await second.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('world'),
      generationId: 'stream-generation-parallel-b',
      requestId: 'stream-request-parallel-b',
      sessionId: 'stream-session-parallel-b',
      selection: secondSelection,
    });
    expect(retried.status).toBe('streaming');
    const secondChunk = await second.agent.appendRewriteChunk({
      chunk: 'EARTH',
      chunkId: 'parallel-b-1',
      sessionId: 'stream-session-parallel-b',
    });
    expect(secondChunk.status).toBe('streaming');
    const secondFinal = await second.agent.finalizeRewriteSession({
      sessionId: 'stream-session-parallel-b',
    });
    expect(secondFinal.status).toBe('applied');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(second.agent);
    expect(projection.markdown).toContain('EARTH');
  });

  it('blocks peer typing/paste inside the protected region but preserves unrelated edits', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-a');
    const second = createAgent(room, 'stream-request-b');
    agents.push(first.agent, second.agent);
    docs.push(first.doc, second.doc);
    await Promise.all([first.agent.connect(), second.agent.connect()]);
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-peer',
      requestId: 'stream-request-a',
      sessionId: 'stream-session-peer',
      selection,
    });

    await first.agent.appendRewriteChunk({
      chunk: 'Hi',
      chunkId: 'chunk-1',
      sessionId: 'stream-session-peer',
    });
    await flush();
    const secondInternal = second.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const secondLexical = secondInternal.kernel.getLexicalEditor()!;
    const before = await __exportCollaborativeAgentEditorProjectionForPersistence(second.agent);
    secondLexical.update(
      () => {
        const text = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === 'Hi');
        if (!$isTextNode(text)) throw new Error('generated text missing on peer');
        const next = $createRangeSelection();
        next.anchor.set(text.getKey(), text.getTextContentSize(), 'text');
        next.focus.set(text.getKey(), text.getTextContentSize(), 'text');
        $setSelection(next);
      },
      { discrete: true },
    );
    await flush();
    expect(
      handlePlainTextPaste({
        clipboardData: { getData: () => 'blocked paste' } as unknown as DataTransfer,
        config: {},
        editor: secondLexical,
        event: new MockClipboardEvent({} as DataTransfer),
      }),
    ).toBe('handled');
    expect(secondLexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'blocked')).toBe(true);
    const afterBlocked = await __exportCollaborativeAgentEditorProjectionForPersistence(
      second.agent,
    );
    expect(afterBlocked.markdown).toBe(before.markdown);

    // A normal edit in a different block remains available to the peer.
    secondLexical.update(
      () => {
        const block = $getRoot().getChildren()[1];
        const text = block && $isElementNode(block) ? block.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('unrelated text missing');
        text.setTextContent('Human preserved paragraph');
      },
      { discrete: true },
    );
    await flush();
    const next = await first.agent.appendRewriteChunk({
      chunk: '!',
      chunkId: 'chunk-2',
      sessionId: 'stream-session-peer',
    });
    expect(next.status).toBe('streaming');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Human preserved paragraph');
    expect(projection.markdown).toContain('Hi! collaborative world');
  });

  it('exposes one session handle for streaming integrations', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-contract');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    const session = await first.agent.startStreamingRewrite({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-contract',
      requestId: 'stream-request-contract',
      sessionId: 'stream-session-contract',
      selection,
    });
    expect(session).toMatchObject({
      generationId: 'stream-generation-contract',
      requestId: 'stream-request-contract',
      sessionId: 'stream-session-contract',
    });
    expect(typeof session.append).toBe('function');
    expect(typeof session.finalize).toBe('function');
    expect(typeof session.abort).toBe('function');
    expect((await session.append({ chunkId: '1', sequence: 1, text: 'Hi' })).status).toBe(
      'streaming',
    );
    expect((await session.finalize()).status).toBe('applied');
  });

  it('inspects durable targets without runtime keys and classifies pre-chunk failures', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-target-inspection');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    const inspection = first.agent.inspectRewriteTargets([
      selection.startNodeId,
      'missing-durable-target',
    ]);
    expect(inspection).toEqual({
      existingNodeIds: [selection.startNodeId],
      missingNodeIds: ['missing-durable-target'],
    });
    expect(JSON.stringify(inspection)).not.toContain('nodeKey');

    const firstInternal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const firstLexical = firstInternal.kernel.getLexicalEditor()!;
    firstLexical.update(
      () => {
        const text = $getRoot().getAllTextNodes()[0];
        if (!$isTextNode(text)) throw new Error('target text missing');
        text.setTextContent('Changed target');
      },
      { discrete: true },
    );
    const drifted = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-inspection-drift',
      requestId: 'stream-request-target-inspection',
      sessionId: 'stream-session-inspection-drift',
      selection,
    });
    expect(drifted).toMatchObject({ error: 'generation_conflict', status: 'conflict' });

    const missingRoom = new TestRoom(seedDocument());
    rooms.push(missingRoom);
    const missing = createAgent(missingRoom, 'stream-request-target-missing');
    agents.push(missing.agent);
    docs.push(missing.doc);
    await missing.agent.connect();
    const missingSelection = captureHello(missing.agent);
    if (!missingSelection) throw new Error('missing selection capture failed');
    const missingInternal = missing.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    missingInternal.kernel.getLexicalEditor()!.update(
      () => {
        $getRoot().getFirstChild()?.remove();
      },
      { discrete: true },
    );
    const deleted = await missing.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-inspection-missing',
      requestId: 'stream-request-target-missing',
      sessionId: 'stream-session-inspection-missing',
      selection: missingSelection,
    });
    expect(deleted).toMatchObject({ error: 'region_missing', status: 'conflict' });
  });

  it('protects the zero-length caret before the first token and treats block delete as cancel', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-first-token');
    const second = createAgent(room, 'stream-request-first-token-peer');
    agents.push(first.agent, second.agent);
    docs.push(first.doc, second.doc);
    await Promise.all([first.agent.connect(), second.agent.connect()]);
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-first-token',
      requestId: 'stream-request-first-token',
      sessionId: 'stream-session-first-token',
      selection,
    });
    expect(started.status).toBe('streaming');
    await flush();

    const secondInternal = second.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const secondLexical = secondInternal.kernel.getLexicalEditor()!;
    secondLexical.update(
      () => {
        const text = $getRoot().getAllTextNodes()[0];
        if (!$isTextNode(text)) throw new Error('first-token target missing');
        const caret = $createRangeSelection();
        caret.anchor.set(text.getKey(), 0, 'text');
        caret.focus.set(text.getKey(), 0, 'text');
        $setSelection(caret);
      },
      { discrete: true },
    );
    await flush();
    expect(secondLexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'blocked')).toBe(true);
    const firstTokenProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(
      second.agent,
    );
    expect(firstTokenProjection.markdown).not.toContain('blocked');

    // Structural block deletion remains an explicit cancellation operation;
    // the Agent must observe the missing generation region before any token is
    // emitted and must never recreate the removed block.
    secondLexical.update(
      () => {
        $getRoot().getFirstChild()?.remove();
      },
      { discrete: true },
    );
    await flush();
    const cancelled = await first.agent.finalizeRewriteSession({
      sessionId: 'stream-session-first-token',
    });
    expect(['conflict', 'stopped']).toContain(cancelled.status);
    expect(cancelled.error).toBe('region_missing');
    const afterCancel = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(afterCancel.markdown).not.toContain('Hello');
    expect(afterCancel.markdown).not.toContain('blocked');
  });

  it('guards only the generation interval and leaves same-block prefix/suffix editable', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-range-guard');
    const second = createAgent(room, 'stream-request-range-guard-peer');
    agents.push(first.agent, second.agent);
    docs.push(first.doc, second.doc);
    await Promise.all([first.agent.connect(), second.agent.connect()]);
    const selection = captureText(first.agent, 'collaborative');
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('collaborative'),
      generationId: 'stream-generation-range-guard',
      requestId: 'stream-request-range-guard',
      sessionId: 'stream-session-range-guard',
      selection,
    });
    await flush();

    const secondInternal = second.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const secondLexical = secondInternal.kernel.getLexicalEditor()!;
    const setRange = (start: number, end: number) => {
      secondLexical.update(
        () => {
          const text = $getRoot().getAllTextNodes()[0];
          if (!$isTextNode(text)) throw new Error('guard text missing');
          const next = $createRangeSelection();
          next.anchor.set(text.getKey(), start, 'text');
          next.focus.set(text.getKey(), end, 'text');
          $setSelection(next);
        },
        { discrete: true },
      );
    };

    // The selected range is gone but its zero-length durable region remains at
    // offset six. A prefix-only replacement is allowed.
    setRange(0, 5);
    expect(secondLexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'HELLO')).toBe(true);
    await flush();
    expect(
      (await __exportCollaborativeAgentEditorProjectionForPersistence(second.agent)).markdown,
    ).toContain('HELLO  world');

    // The suffix remains outside the temporary range and is editable.
    setRange(7, 12);
    expect(secondLexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'WORLD')).toBe(true);
    setRange(0, 12);
    expect(secondLexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'blocked')).toBe(true);
  });

  it('keeps the stream caret after a line break when replacing text after it', async () => {
    const room = new TestRoom(await seedLinebreakDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-linebreak');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();

    const internal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const lexical = internal.kernel.getLexicalEditor()!;
    lexical.update(
      () => {
        const text = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === 'bc');
        if (!$isTextNode(text)) throw new Error('linebreak target text missing');
        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 1, 'text');
        $setSelection(selection);
      },
      { discrete: true },
    );
    const selection = captureCollaborativeRewriteSelection(internal.kernel as never, {
      roomId: 'stream-room',
    });
    if (!selection) throw new Error('linebreak selection capture failed');
    expect(selection.startOffset).toBe(2);
    expect(selection.endOffset).toBe(3);

    const blockSelection = {
      endNodeId: selection.endNodeId,
      endOffset: selection.endOffset,
      kind: 'block' as const,
      quotedText: 'b',
      quotedTextHash: hashRewriteText('b'),
      startNodeId: selection.startNodeId,
      startOffset: selection.startOffset,
      targetNodeIds: selection.targetNodeIds,
    };
    const resolvedBlock = first.agent.resolveSelection(blockSelection);
    expect(resolvedBlock).toMatchObject({ startOffset: 2, endOffset: 3 });
    lexical.getEditorState().read(() => {
      expect(resolvedBlock?.selection.anchor.getNode().getTextContent()).toBe('bc');
      expect(resolvedBlock?.selection.anchor.offset).toBe(0);
    });

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('b'),
      generationId: 'stream-generation-linebreak',
      requestId: 'stream-request-linebreak',
      sessionId: 'stream-session-linebreak',
      selection,
    });
    expect(started.status).toBe('streaming');
    await first.agent.appendRewriteChunk({
      chunk: 'X',
      chunkId: 'linebreak-1',
      sessionId: 'stream-session-linebreak',
    });
    expect(
      (await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-linebreak' })).status,
    ).toBe('applied');

    lexical.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChild();
      if (!$isElementNode(paragraph)) throw new Error('linebreak paragraph missing after rewrite');
      expect(paragraph.getChildren().map((node) => node.getTextContent())).toEqual([
        'a',
        '\n',
        'X',
        'c',
      ]);
    });
  });

  it('repositions the zero-length stream region when its prefix changes', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-prefix-reposition');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureText(first.agent, 'collaborative');
    if (!selection) throw new Error('prefix selection capture failed');

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('collaborative'),
      generationId: 'stream-generation-prefix-reposition',
      requestId: 'stream-request-prefix-reposition',
      sessionId: 'stream-session-prefix-reposition',
      selection,
    });
    expect(started.status).toBe('streaming');

    const internal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const lexical = internal.kernel.getLexicalEditor()!;
    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      if (!$isTextNode(text)) throw new Error('prefix text missing');
      const prefix = $createRangeSelection();
      prefix.anchor.set(text.getKey(), 0, 'text');
      prefix.focus.set(text.getKey(), 5, 'text');
      $setSelection(prefix);
    });
    expect(lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'H')).toBe(true);
    await flush();
    const appended = await first.agent.appendRewriteChunk({
      chunk: 'X',
      chunkId: 'prefix-reposition-1',
      sessionId: 'stream-session-prefix-reposition',
    });
    expect(appended).toMatchObject({ status: 'streaming', caret: { offset: 3 } });
    const finalized = await first.agent.finalizeRewriteSession({
      sessionId: 'stream-session-prefix-reposition',
    });
    expect(finalized.status).toBe('applied');

    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('H X world');
    expect(projection.markdown).not.toContain('HX');
  });

  it('repositions the stream region when its prefix grows', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-prefix-growth');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureText(first.agent, 'collaborative');
    if (!selection) throw new Error('prefix growth selection capture failed');

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('collaborative'),
      generationId: 'stream-generation-prefix-growth',
      requestId: 'stream-request-prefix-growth',
      sessionId: 'stream-session-prefix-growth',
      selection,
    });
    expect(started.status).toBe('streaming');

    const internal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const lexical = internal.kernel.getLexicalEditor()!;
    lexical.update(() => {
      const text = $getRoot().getAllTextNodes()[0];
      if (!$isTextNode(text)) throw new Error('prefix growth text missing');
      const prefix = $createRangeSelection();
      prefix.anchor.set(text.getKey(), 0, 'text');
      prefix.focus.set(text.getKey(), 5, 'text');
      $setSelection(prefix);
    });
    expect(lexical.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, 'Hello expanded ')).toBe(
      true,
    );
    await flush();

    const appended = await first.agent.appendRewriteChunk({
      chunk: 'X',
      chunkId: 'prefix-growth-1',
      sessionId: 'stream-session-prefix-growth',
    });
    expect(appended).toMatchObject({ status: 'streaming', caret: { offset: 17 } });
    expect(
      (await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-prefix-growth' }))
        .status,
    ).toBe('applied');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Hello expanded  X world');
  });

  it('streams a cross-block selection into the first durable block', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-cross');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const internal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const lexical = internal.kernel.getLexicalEditor()!;
    lexical.update(
      () => {
        const [firstText, secondText] = $getRoot().getAllTextNodes();
        if (!$isTextNode(firstText) || !$isTextNode(secondText))
          throw new Error('cross text missing');
        const range = $createRangeSelection();
        range.anchor.set(firstText.getKey(), 6, 'text');
        range.focus.set(secondText.getKey(), 6, 'text');
        $setSelection(range);
      },
      { discrete: true },
    );
    const selection = captureCollaborativeRewriteSelection(internal.kernel as never, {
      roomId: 'stream-room',
    });
    if (!selection) throw new Error('cross selection capture failed');
    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText(selection.quotedText),
      generationId: 'stream-generation-cross',
      requestId: 'stream-request-cross',
      sessionId: 'stream-session-cross',
      selection,
    });
    expect(started.status).toBe('streaming');
    await first.agent.appendRewriteChunk({
      chunk: 'REPLACED',
      chunkId: 'cross-1',
      sessionId: 'stream-session-cross',
    });
    const result = await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-cross' });
    expect(result.status).toBe('applied');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Hello REPLACED paragraph');
    expect(JSON.stringify(projection.editorData)).not.toContain('rewriteRegionStatus');
  });

  it('stops without resurrecting text when the peer edits or deletes the generation region', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-delete-a');
    const second = createAgent(room, 'stream-request-delete-b');
    agents.push(first.agent, second.agent);
    docs.push(first.doc, second.doc);
    await Promise.all([first.agent.connect(), second.agent.connect()]);
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-delete',
      requestId: 'stream-request-delete-a',
      sessionId: 'stream-session-delete',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Hi',
      chunkId: 'chunk-1',
      sessionId: 'stream-session-delete',
    });
    await flush();

    const secondInternal = second.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const secondLexical = secondInternal.kernel.getLexicalEditor()!;
    // Direct updates model a remote user operation that bypasses a browser
    // command guard. The Agent must detect it before writing another chunk.
    secondLexical.update(
      () => {
        const generated = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === 'Hi');
        if (!$isTextNode(generated)) throw new Error('generated text missing on peer');
        generated.setTextContent('tampered');
      },
      { discrete: true },
    );
    await flush();
    const stopped = await first.agent.appendRewriteChunk({
      chunk: ' never resurrect',
      chunkId: 'chunk-2',
      sessionId: 'stream-session-delete',
    });
    expect(['conflict', 'stopped']).toContain(stopped.status);
    expect(stopped.error).toBe('generation_conflict');
    const tamperedProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(
      first.agent,
    );
    expect(tamperedProjection.markdown).toContain('tampered');
    expect(tamperedProjection.markdown).not.toContain('never resurrect');

    // A direct block removal is the explicit-cancel path; finalize is also
    // terminal and must not recreate the removed parent.
    secondLexical.update(
      () => {
        const block = $getRoot().getFirstChild();
        block?.remove();
      },
      { discrete: true },
    );
    await flush();
    const final = await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-delete' });
    expect(['conflict', 'stopped']).toContain(final.status);
    const afterDelete = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(afterDelete.markdown).not.toContain('Hi');
    expect(afterDelete.markdown).not.toContain('never resurrect');
  });

  it('abort leaves partial text in place and duplicate final/abort calls are idempotent', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-abort');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-abort',
      requestId: 'stream-request-abort',
      sessionId: 'stream-session-abort',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Partial',
      chunkId: 'chunk-1',
      sessionId: 'stream-session-abort',
    });
    const aborted = await first.agent.abortRewriteSession({
      reason: 'model-cancelled',
      sessionId: 'stream-session-abort',
    });
    expect(aborted).toMatchObject({ error: 'model-cancelled', status: 'aborted' });
    expect(await first.agent.abortRewriteSession({ sessionId: 'stream-session-abort' })).toEqual(
      aborted,
    );
    expect(await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-abort' })).toEqual(
      aborted,
    );
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Partial collaborative world');
    expect(JSON.stringify(projection.editorData)).not.toContain('rewriteRegionStatus');
  });

  it('cleans a persisted region after a process restart without restoring the old selection', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-recovery');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-recovery',
      requestId: 'stream-request-recovery',
      sessionId: 'stream-session-recovery',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Partial',
      chunkId: 'chunk-1',
      sessionId: 'stream-session-recovery',
    });
    await flush();

    const second = createAgent(room, 'stream-request-recovery');
    agents.push(second.agent);
    docs.push(second.doc);
    await second.agent.connect();
    const before = await __exportCollaborativeAgentEditorProjectionForPersistence(second.agent);
    expect(JSON.stringify(before.editorData)).toContain('rewriteRegionStatus');
    const recovered = await second.agent.abortRewriteSession({
      reason: 'stream-recovered-after-restart',
      sessionId: 'stream-session-recovery',
    });
    expect(recovered).toMatchObject({
      affectedNodeIds: [selection.startNodeId],
      status: 'stopped',
      stateVector: expect.any(String),
    });
    const after = await __exportCollaborativeAgentEditorProjectionForPersistence(second.agent);
    expect(after.markdown).toContain('Partial collaborative world');
    expect(JSON.stringify(after.editorData)).not.toContain('rewriteRegionStatus');
    expect(
      await second.agent.recoverRewriteSession({ sessionId: 'stream-session-recovery' }),
    ).toEqual(recovered);
    const noResurrection = await first.agent.appendRewriteChunk({
      chunk: ' never resurrect',
      chunkId: 'chunk-2',
      sessionId: 'stream-session-recovery',
    });
    expect(['conflict', 'stopped']).toContain(noResurrection.status);
    expect(
      (await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent)).markdown,
    ).not.toContain('never resurrect');
  });

  it('safely stops on a transport drop and never resumes the partial region after reconnect', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-disconnect');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-disconnect',
      requestId: 'stream-request-disconnect',
      sessionId: 'stream-session-disconnect',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Partial',
      chunkId: 'chunk-1',
      sessionId: 'stream-session-disconnect',
    });
    first.provider.emitDisconnected();
    const stopped = await first.agent.appendRewriteChunk({
      chunk: ' never resume',
      chunkId: 'chunk-2',
      sessionId: 'stream-session-disconnect',
    });
    expect(stopped.status).toBe('stopped');
    first.provider.emitSync();
    expect(
      (
        await first.agent.appendRewriteChunk({
          chunk: ' still stopped',
          chunkId: 'chunk-3',
          sessionId: 'stream-session-disconnect',
        })
      ).status,
    ).toBe('stopped');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Partial collaborative world');
    expect(projection.markdown).not.toContain('never resume');
    expect(projection.markdown).not.toContain('still stopped');
    expect(JSON.stringify(projection.editorData)).not.toContain('rewriteRegionStatus');
  });

  it('keeps one collaborative undo boundary for the streamed replacement', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-undo');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-undo',
      requestId: 'stream-request-undo',
      sessionId: 'stream-session-undo',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Hi',
      chunkId: 'chunk-1',
      sessionId: 'stream-session-undo',
    });
    await first.agent.appendRewriteChunk({
      chunk: '!',
      chunkId: 'chunk-2',
      sessionId: 'stream-session-undo',
    });
    await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-undo' });
    const internal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const lexical = internal.kernel.getLexicalEditor()!;
    lexical.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Hello collaborative world');
  });
});
