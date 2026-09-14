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
  COLLABORATIVE_AGENT_STREAM_RECOVERY_TIMEOUT_MS,
  CollaborativeAgentEditor,
  hashRewriteText,
} from '../collaborative-agent-editor';
import { exportYjsSnapshotProjection } from '../yjs-snapshot';
import type { CollaborativeRewriteStreamResult } from '../collaborative-agent-editor';
import { moment } from '@/editor-kernel';
import { $createArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { $createHoleNode } from '@/plugins/common/node/hole';
import { $createCodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { LITEXML_REWRITE_RANGE_COMMAND } from '@/plugins/litexml/command';
import { $setNodeProperties } from '@/plugins/properties/state';
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
  private syncError: Error | null = null;
  private readonly syncWaiters = new Set<{
    reject: (error: Error) => void;
    resolve: () => void;
  }>();

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
    this.syncError = null;
    this.synced = true;
    this.listeners.status.forEach((listener) => listener({ status: 'connected' }));
    this.listeners.sync.forEach((listener) => listener(true));
    this.syncWaiters.forEach(({ resolve }) => resolve());
    this.syncWaiters.clear();
  }

  emitDisconnected(): void {
    this.synced = false;
    this.listeners.status.forEach((listener) => listener({ status: 'disconnected' }));
    this.listeners.sync.forEach((listener) => listener(false));
  }

  failSync(error = new Error('terminal auth failure')): void {
    this.syncError = error;
    this.synced = false;
    this.syncWaiters.forEach(({ reject }) => reject(error));
    this.syncWaiters.clear();
  }

  waitForSync(): Promise<void> {
    if (this.synced) return Promise.resolve();
    if (this.syncError) return Promise.reject(this.syncError);
    return new Promise((resolve, reject) => {
      this.syncWaiters.add({ reject, resolve });
    });
  }

  off(type: 'reload' | 'status' | 'sync' | 'update', callback: unknown): void {
    this.listeners[type].delete(callback as never);
  }

  on(type: 'reload' | 'status' | 'sync' | 'update', callback: unknown): void {
    this.listeners[type].add(callback as never);
  }
}

const seedDocument = (markdown = 'Hello collaborative world\n\nHuman paragraph'): Uint8Array => {
  const source = new HeadlessEditor();
  source.hydrateMarkdown(markdown);
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

const seedMixedDocument = (): Uint8Array => {
  const source = new HeadlessEditor();
  source.hydrateMarkdown('Rewrite this paragraph\n\nKeep this paragraph');
  const editor = source.kernel.getLexicalEditor()!;
  editor.update(
    () => {
      const first = $getRoot().getFirstChild();
      if (!first) throw new Error('mixed seed paragraph missing');
      const code = $createCodeMirrorNode('javascript', 'const answer = 42;');
      const artifact = $createArtifactNode(
        '<!doctype html><html><body><main>Stable artifact</main></body></html>',
        'Stable artifact',
      );
      first.insertAfter(code);
      code.insertAfter($createHoleNode(artifact));
    },
    { discrete: true },
  );
  const doc = new Doc();
  const provider = new TestProvider(null, doc);
  const binding = createBinding(
    editor,
    provider,
    'mixed-stream-room',
    doc,
    new Map([['mixed-stream-room', doc]]),
  );
  syncCurrentEditorStateToYjs(binding, provider);
  const update = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  source.destroy();
  return update;
};

const seedCrossBlockMixedDocument = async (): Promise<Uint8Array> => {
  const source = new HeadlessEditor();
  source.hydrateMarkdown(
    'Deterministic direct text\n\n啊是的啊是的\n\nDeterministic direct text\n\na的啊是的啊是的啊是\n\n啊是的啊是的啊是的啊是的啊是的啊是的啊是的啊是的啊是啊是的啊是的啊是的啊是的啊是的\n\nplaceholder',
  );
  const editor = source.kernel.getLexicalEditor()!;
  editor.update(
    () => {
      const paragraphs = $getRoot()
        .getChildren()
        .filter((node) => node.getType() === 'paragraph');
      const third = paragraphs[2];
      const beforeCode = paragraphs[4];
      const first = paragraphs[0];
      const second = paragraphs[1];
      const afterArtifact = paragraphs[3];
      const afterCode = paragraphs[5];
      if (!first || !second || !third || !afterArtifact || !beforeCode || !afterCode) {
        throw new Error('cross-block seed paragraphs missing');
      }

      const artifact = $createArtifactNode(
        '<!doctype html><html><head><title>俄罗斯方块 Pro</title></head><body><main>俄罗斯方块</main></body></html>',
        '俄罗斯方块 Pro',
      );
      const code = $createCodeMirrorNode('rust', 'fn quick_sort(arr: &mut [i32]) {}');
      third.insertAfter(artifact);
      beforeCode.insertAfter(code);
      if (!$isElementNode(afterCode)) throw new Error('cross-block trailing paragraph missing');
      afterCode.clear();
      $setNodeProperties(first, { nodeId: 'e0e0e47c-6692-42b9-a392-ae006492af93' });
      $setNodeProperties(second, { nodeId: 'b3420393-4824-444e-8724-52bb46245128' });
      $setNodeProperties(third, { nodeId: '84834662-b70e-473b-b80e-18ceb90e1a61' });
      $setNodeProperties(afterArtifact, { nodeId: '807b1588-c336-4005-8036-6b4cc1366cdf' });
      $setNodeProperties(beforeCode, { nodeId: '62c8467f-cf2b-4bea-8e2b-ca57cd2bc8c4' });
      $setNodeProperties(afterCode, { nodeId: '2bc7e472-c4b8-4cda-87ac-2593d9bd1bbf' });
      $setNodeProperties(artifact, {
        annotationIds: ['8f5d90d3-35c1-4661-9b2f-5be5be9c0b48'],
        nodeId: '518501d0-a34b-47bd-a04b-6304a14b6497',
        provenance: {
          createdAt: '2026-09-05T00:20:34.412Z',
          generationId: 'rwr_JQ8RWLO1q5XTU2E2hG:generation:1',
          model: 'deepseek/deepseek-v4-pro[1m]',
          provider: 'anthropic',
          requestId: 'rwr_JQ8RWLO1q5XTU2E2hG',
          sessionId: 'rws_vSPfpKtb7ftIKw5M58',
          source: 'ai',
          turnIndex: 1,
        },
      });
      $setNodeProperties(code, {
        nodeId: '7e40a569-22f3-4248-a5f3-470124f3456e',
        provenance: {
          createdAt: '2026-09-05T00:06:56.655Z',
          generationId: 'rwr_6iZpFS3GL8NY0nIxFB:generation:1',
          model: 'deepseek/deepseek-v4-pro[1m]',
          provider: 'anthropic',
          requestId: 'rwr_6iZpFS3GL8NY0nIxFB',
          source: 'ai',
          turnIndex: 1,
        },
      });
    },
    { discrete: true },
  );
  await moment();
  const doc = new Doc();
  const provider = new TestProvider(null, doc);
  const binding = createBinding(
    editor,
    provider,
    'cross-block-stream-room',
    doc,
    new Map([['cross-block-stream-room', doc]]),
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

const captureCrossBlockText = (agent: CollaborativeAgentEditor) => {
  const internal = agent as unknown as {
    kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
  };
  const lexicalEditor = internal.kernel.getLexicalEditor()!;
  lexicalEditor.update(
    () => {
      const paragraphs = $getRoot()
        .getChildren()
        .filter((node) => node.getType() === 'paragraph');
      const firstText =
        paragraphs[0] && $isElementNode(paragraphs[0]) ? paragraphs[0].getFirstDescendant() : null;
      const thirdText =
        paragraphs[2] && $isElementNode(paragraphs[2]) ? paragraphs[2].getLastDescendant() : null;
      if (!$isTextNode(firstText) || !$isTextNode(thirdText)) {
        throw new Error('cross-block selection paragraphs missing');
      }
      const selection = $createRangeSelection();
      selection.anchor.set(firstText.getKey(), 0, 'text');
      selection.focus.set(thirdText.getKey(), thirdText.getTextContentSize(), 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
  return captureCollaborativeRewriteSelection(internal.kernel as never, {
    roomId: 'stream-room',
  });
};

const captureHello = (agent: CollaborativeAgentEditor) => captureText(agent, 'Hello');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const countSerializedNodeType = (value: unknown, type: string): number => {
  if (!value || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  const nestedRoot =
    record.root && typeof record.root === 'object' ? countSerializedNodeType(record.root, type) : 0;
  return (
    (record.type === type ? 1 : 0) +
    nestedRoot +
    (Array.isArray(record.children)
      ? record.children.reduce((count, child) => count + countSerializedNodeType(child, type), 0)
      : 0)
  );
};

const serializedRootTypes = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') return [];
  const root = (value as { root?: unknown }).root;
  if (!root || typeof root !== 'object') return [];
  const children = (root as { children?: unknown }).children;
  return Array.isArray(children)
    ? children.flatMap((child) =>
        child && typeof child === 'object' && typeof (child as { type?: unknown }).type === 'string'
          ? [(child as { type: string }).type]
          : [],
      )
    : [];
};

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

  it('keeps a stream pending across ticket expiry and resumes after a fresh sync without duplication', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-reconnect');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-reconnect',
      requestId: 'stream-request-reconnect',
      sessionId: 'stream-session-reconnect',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Hi',
      chunkId: 'reconnect-chunk-1',
      sessionId: 'stream-session-reconnect',
      sequence: 1,
    });

    first.provider.emitDisconnected();
    let settled = false;
    const pending = first.agent
      .appendRewriteChunk({
        chunk: ' there',
        chunkId: 'reconnect-chunk-2',
        sessionId: 'stream-session-reconnect',
        sequence: 2,
      })
      .then((result) => {
        settled = true;
        return result;
      });
    const duplicatePending = first.agent.appendRewriteChunk({
      chunk: ' there',
      chunkId: 'reconnect-chunk-2',
      sessionId: 'stream-session-reconnect',
      sequence: 2,
    });
    await flush();
    expect(settled).toBe(false);

    first.provider.connect();
    const resumed = await pending;
    expect(resumed).toMatchObject({ sequence: 2, status: 'streaming' });
    await expect(duplicatePending).resolves.toEqual(resumed);
    const finalized = await first.agent.finalizeRewriteSession({
      sessionId: 'stream-session-reconnect',
    });
    expect(finalized.status).toBe('applied');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Hi there collaborative world');
    expect(projection.markdown).not.toContain('there there');
  });

  it('stops a stream on terminal auth failure instead of writing a queued chunk', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-terminal-auth');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-terminal-auth',
      requestId: 'stream-request-terminal-auth',
      sessionId: 'stream-session-terminal-auth',
      selection,
    });
    first.provider.emitDisconnected();
    const pending = first.agent.appendRewriteChunk({
      chunk: ' never-write',
      chunkId: 'terminal-auth-chunk',
      sessionId: 'stream-session-terminal-auth',
      sequence: 1,
    });
    first.provider.failSync(new Error('ticket rejected'));

    await expect(pending).resolves.toMatchObject({
      error: 'stream-stopped-provider-disconnected',
      status: 'stopped',
    });
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).not.toContain('never-write');
  });

  it('stops a stream after the bounded reconnect window', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-reconnect-timeout');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-reconnect-timeout',
      requestId: 'stream-request-reconnect-timeout',
      sessionId: 'stream-session-reconnect-timeout',
      selection,
    });
    vi.useFakeTimers();
    try {
      first.provider.emitDisconnected();
      const pending = first.agent.appendRewriteChunk({
        chunk: ' timeout-write',
        chunkId: 'timeout-chunk',
        sessionId: 'stream-session-reconnect-timeout',
        sequence: 1,
      });
      await vi.advanceTimersByTimeAsync(COLLABORATIVE_AGENT_STREAM_RECOVERY_TIMEOUT_MS);
      await expect(pending).resolves.toMatchObject({
        error: 'stream-stopped-provider-disconnected',
        status: 'stopped',
      });
      const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(
        first.agent,
      );
      expect(projection.markdown).not.toContain('timeout-write');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not write a pending chunk after abort or active disconnect', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-abort-reconnect');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-abort-reconnect',
      requestId: 'stream-request-abort-reconnect',
      sessionId: 'stream-session-abort-reconnect',
      selection,
    });
    first.provider.emitDisconnected();
    const pending = first.agent.appendRewriteChunk({
      chunk: ' aborted-write',
      chunkId: 'aborted-chunk',
      sessionId: 'stream-session-abort-reconnect',
      sequence: 1,
    });
    await expect(
      first.agent.abortRewriteSession({
        reason: 'user-cancelled',
        sessionId: 'stream-session-abort-reconnect',
      }),
    ).resolves.toMatchObject({ status: 'aborted' });
    await expect(pending).resolves.toMatchObject({ status: 'aborted' });
    first.provider.connect();
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).not.toContain('aborted-write');

    const secondRoom = new TestRoom(seedDocument());
    rooms.push(secondRoom);
    const second = createAgent(secondRoom, 'stream-request-active-disconnect');
    agents.push(second.agent);
    docs.push(second.doc);
    await second.agent.connect();
    const secondSelection = captureHello(second.agent);
    if (!secondSelection) throw new Error('second selection capture failed');
    await second.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-active-disconnect',
      requestId: 'stream-request-active-disconnect',
      sessionId: 'stream-session-active-disconnect',
      selection: secondSelection,
    });
    second.provider.emitDisconnected();
    const pendingDisconnect = second.agent.appendRewriteChunk({
      chunk: ' disconnected-write',
      chunkId: 'disconnected-chunk',
      sessionId: 'stream-session-active-disconnect',
      sequence: 1,
    });
    await second.agent.disconnect();
    await expect(pendingDisconnect).resolves.toMatchObject({
      error: 'stream-stopped-provider-disconnected',
      status: 'stopped',
    });
  });

  it.each([
    { output: '## 全文总结\n\n这是一段普通正文。', types: ['heading', 'paragraph', 'paragraph'] },
    { output: '这是一段普通正文。', types: ['paragraph', 'paragraph'] },
    {
      output: '全文总结\n========\n\n这是一段普通正文。',
      types: ['heading', 'paragraph', 'paragraph'],
    },
  ])(
    'materializes complete heading rewrites using output block structure: $output',
    async ({ output, types }) => {
      const original = 'Hello collaborative world';
      const room = new TestRoom(seedDocument(`## ${original}\n\nHuman paragraph`));
      rooms.push(room);
      const first = createAgent(room, 'heading-rewrite-request');
      const second = createAgent(room, 'heading-observer-request');
      agents.push(first.agent, second.agent);
      docs.push(first.doc, second.doc);
      await first.agent.connect();
      await second.agent.connect();
      const selection = captureText(first.agent, original);
      if (!selection) throw new Error('heading selection missing');
      await first.agent.startRewriteSession({
        expectedTextHash: hashRewriteText(original),
        generationId: 'heading-generation',
        requestId: 'heading-rewrite-request',
        sessionId: 'heading-session',
        selection,
      });
      await first.agent.appendRewriteChunk({
        chunk: output,
        chunkId: 'heading-chunk',
        sessionId: 'heading-session',
      });
      expect(
        (await first.agent.finalizeRewriteSession({ sessionId: 'heading-session' })).status,
      ).toBe('applied');
      for (const peer of [first, second]) {
        const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(
          peer.agent,
        );
        expect(serializedRootTypes(projection.editorData)).toEqual(types);
        expect(projection.markdown).toContain('Human paragraph');
        expect(projection.markdown).not.toContain('\\#');
        expect(projection.markdown).not.toContain('**这是一段');
      }
    },
  );

  it('keeps the heading and surrounding text for a partial inline rewrite', async () => {
    const room = new TestRoom(seedDocument('## Hello collaborative world\n\nHuman paragraph'));
    rooms.push(room);
    const first = createAgent(room, 'partial-heading-request');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureText(first.agent, 'collaborative');
    if (!selection) throw new Error('partial heading selection missing');
    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('collaborative'),
      generationId: 'partial-heading-generation',
      requestId: 'partial-heading-request',
      sessionId: 'partial-heading-session',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'edited',
      chunkId: 'partial-heading-chunk',
      sessionId: 'partial-heading-session',
    });
    expect(
      (await first.agent.finalizeRewriteSession({ sessionId: 'partial-heading-session' })).status,
    ).toBe('applied');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(serializedRootTypes(projection.editorData)).toEqual(['heading', 'paragraph']);
    expect(projection.markdown).toContain('## Hello edited world');
    expect(projection.markdown).toContain('Human paragraph');
  });

  it('parses Markdown only when a streamed text response is finalized', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-markdown');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('selection capture failed');

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-generation-markdown',
      provenanceSessionId: 'stream-provenance-markdown',
      requestId: 'stream-request-markdown',
      sessionId: 'stream-session-markdown',
      selection,
      turnIndex: 11,
    });
    expect(started.status).toBe('streaming');
    await first.agent.appendRewriteChunk({
      chunk: '**Hi** `sort`',
      chunkId: 'markdown-chunk-1',
      sessionId: 'stream-session-markdown',
    });
    const finalized = await first.agent.finalizeRewriteSession({
      sessionId: 'stream-session-markdown',
    });
    expect(finalized.status).toBe('applied');

    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('**Hi**');
    expect(projection.markdown).toContain('`sort`');
    expect(JSON.stringify(projection.editorData)).toContain('"format":1');
    expect(JSON.stringify(projection.editorData)).toContain('codeInline');
    expect(JSON.stringify(projection.editorData)).toContain('stream-provenance-markdown');
    expect(JSON.stringify(projection.editorData)).toContain('"turnIndex":11');
  });

  it('restarts a stream from a provenance-rebased Markdown list range', async () => {
    const room = new TestRoom(seedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-list-first');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureHello(first.agent);
    if (!selection) throw new Error('list stream selection capture failed');
    expect(selection.targetNodeIds).toBeDefined();

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'stream-list-first-generation',
      provenanceSessionId: 'stream-list-provenance',
      requestId: 'stream-list-first',
      sessionId: 'stream-list-first-session',
      selection,
      turnIndex: 1,
    });
    expect(started.status).toBe('streaming');
    await first.agent.appendRewriteChunk({
      chunk: '1. **甲**：调用 `sort`。\n2. **乙**：保留原文。\n3. **丙**：高亮随滚动。',
      chunkId: 'stream-list-first-chunk',
      sessionId: 'stream-list-first-session',
    });
    expect(
      (await first.agent.finalizeRewriteSession({ sessionId: 'stream-list-first-session' })).status,
    ).toBe('applied');

    const second = createAgent(room, 'stream-list-second');
    agents.push(second.agent);
    docs.push(second.doc);
    await second.agent.connect();
    const unverifiedRelocated = second.agent.resolveSelectionByProvenance('stream-list-provenance');
    expect(unverifiedRelocated).toMatchObject({ quotedText: expect.any(String) });
    expect(unverifiedRelocated?.quotedText).toBe('甲：调用 sort。 乙：保留原文。 丙：高亮随滚动。');
    const relocated = second.agent.resolveSelectionByProvenance(
      'stream-list-provenance',
      hashRewriteText('甲：调用 sort。 乙：保留原文。 丙：高亮随滚动。'),
      selection.targetNodeIds,
    );
    expect(relocated).toMatchObject({
      quotedText: '甲：调用 sort。 乙：保留原文。 丙：高亮随滚动。',
    });

    const secondStarted = await second.agent.startRewriteSession({
      expectedTextHash: hashRewriteText(relocated!.quotedText),
      generationId: 'stream-list-second-generation',
      provenanceSessionId: 'stream-list-provenance',
      requestId: 'stream-list-second',
      sessionId: 'stream-list-second-session',
      selection: {
        baseStateVector: relocated!.baseStateVector,
        endNodeId: relocated!.endNodeId!,
        endOffset: relocated!.endOffset!,
        kind: 'block',
        quotedText: relocated!.quotedText,
        quotedTextHash: hashRewriteText(relocated!.quotedText),
        startNodeId: relocated!.startNodeId!,
        startOffset: relocated!.startOffset!,
        targetNodeIds: relocated!.targetNodeIds,
      },
      turnIndex: 2,
    });
    expect(secondStarted.status).toBe('streaming');
    await second.agent.appendRewriteChunk({
      chunk: '**更新**',
      chunkId: 'stream-list-second-chunk',
      sessionId: 'stream-list-second-session',
    });
    expect(
      (await second.agent.finalizeRewriteSession({ sessionId: 'stream-list-second-session' }))
        .status,
    ).toBe('applied');
    const finalProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(
      second.agent,
    );
    expect(finalProjection.markdown).toContain('**更新**');
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

  it('resumes a stream after a recoverable transport drop and keeps the partial region intact', async () => {
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
    const pending = first.agent.appendRewriteChunk({
      chunk: ' never resume',
      chunkId: 'chunk-2',
      sessionId: 'stream-session-disconnect',
    });
    first.provider.emitSync();
    expect(await pending).toMatchObject({ sequence: 2, status: 'streaming' });
    expect(
      (
        await first.agent.appendRewriteChunk({
          chunk: ' still resumed',
          chunkId: 'chunk-3',
          sessionId: 'stream-session-disconnect',
        })
      ).status,
    ).toBe('streaming');
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Partial never resume still resumed collaborative world');
    expect(JSON.stringify(projection.editorData)).toContain('rewriteRegionStatus');
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

  it('rewrites one paragraph without duplicating neighboring Artifact or code nodes', async () => {
    const room = new TestRoom(seedMixedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-mixed-undo');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();
    const selection = captureText(first.agent, 'Rewrite this paragraph');
    if (!selection) throw new Error('mixed selection capture failed');

    await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText('Rewrite this paragraph'),
      generationId: 'stream-generation-mixed-undo',
      requestId: 'stream-request-mixed-undo',
      sessionId: 'stream-session-mixed-undo',
      selection,
    });
    await first.agent.appendRewriteChunk({
      chunk: 'Rewritten paragraph',
      chunkId: 'mixed-chunk-1',
      sessionId: 'stream-session-mixed-undo',
    });
    await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-mixed-undo' });

    const internal = first.agent as unknown as {
      kernel: { getLexicalEditor: () => ReturnType<HeadlessEditor['kernel']['getLexicalEditor']> };
    };
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(projection.markdown).toContain('Rewritten paragraph');
    expect(countSerializedNodeType(projection.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(projection.editorData, 'code')).toBe(1);

    internal.kernel.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
    await flush();
    const undone = await __exportCollaborativeAgentEditorProjectionForPersistence(first.agent);
    expect(undone.markdown).toContain('Rewrite this paragraph');
    expect(countSerializedNodeType(undone.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(undone.editorData, 'code')).toBe(1);
  });

  it('keeps a cross-three-paragraph range adjacent to Artifact and code on both peers', async () => {
    const room = new TestRoom(await seedCrossBlockMixedDocument());
    rooms.push(room);
    const first = createAgent(room, 'stream-request-cross-three');
    const second = createAgent(room, 'stream-request-cross-three-peer');
    agents.push(first.agent);
    docs.push(first.doc);
    await first.agent.connect();

    const initialProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(
      first.agent,
    );
    const secondInternal = second.agent as unknown as {
      kernel: { setDocument: (type: string, content: string) => void };
    };
    // Page mounts the JSON document before the browser provider has completed
    // its first sync. Keep that ordering here; it is the hydration path that
    // can expose stale root children when an Agent later replaces a range.
    secondInternal.kernel.setDocument('json', JSON.stringify(initialProjection.editorData));
    agents.push(second.agent);
    docs.push(second.doc);
    await second.agent.connect();
    const hydratedSecond = await __exportCollaborativeAgentEditorProjectionForPersistence(
      second.agent,
    );
    expect(serializedRootTypes(hydratedSecond.editorData)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
      'artifact',
      'paragraph',
      'paragraph',
      'code',
      'paragraph',
    ]);
    expect(countSerializedNodeType(hydratedSecond.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(hydratedSecond.editorData, 'code')).toBe(1);

    const selection = captureCrossBlockText(first.agent);
    expect(selection?.targetNodeIds).toHaveLength(3);
    expect(selection?.targetNodeIds).toEqual([
      'e0e0e47c-6692-42b9-a392-ae006492af93',
      'b3420393-4824-444e-8724-52bb46245128',
      '84834662-b70e-473b-b80e-18ceb90e1a61',
    ]);
    expect(selection?.quotedText).toBe(
      'Deterministic direct text 啊是的啊是的 Deterministic direct text',
    );
    if (!selection) throw new Error('cross-three-paragraph selection capture failed');

    const started = await first.agent.startRewriteSession({
      expectedTextHash: hashRewriteText(selection.quotedText),
      generationId: 'stream-generation-cross-three',
      requestId: 'stream-request-cross-three',
      sessionId: 'stream-session-cross-three',
      selection,
    });
    expect(started.status).toBe('streaming');
    await first.agent.appendRewriteChunk({
      chunk: 'Cross-block replacement ',
      chunkId: 'cross-three-chunk-1',
      sessionId: 'stream-session-cross-three',
    });
    await first.agent.appendRewriteChunk({
      chunk: 'with two chunks',
      chunkId: 'cross-three-chunk-2',
      sessionId: 'stream-session-cross-three',
    });
    expect(
      (await first.agent.finalizeRewriteSession({ sessionId: 'stream-session-cross-three' }))
        .status,
    ).toBe('applied');

    const firstProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(
      first.agent,
    );
    const secondProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(
      second.agent,
    );
    const expectedRootTypes = [
      'paragraph',
      'artifact',
      'paragraph',
      'paragraph',
      'code',
      'paragraph',
    ];
    expect(serializedRootTypes(firstProjection.editorData)).toEqual(expectedRootTypes);
    expect(serializedRootTypes(secondProjection.editorData)).toEqual(expectedRootTypes);
    expect(countSerializedNodeType(firstProjection.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(firstProjection.editorData, 'code')).toBe(1);
    expect(countSerializedNodeType(secondProjection.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(secondProjection.editorData, 'code')).toBe(1);
    expect(firstProjection.markdown).toContain('Cross-block replacement with two chunks');
    expect(secondProjection.markdown).toContain('Cross-block replacement with two chunks');

    const persistedProjection = await exportYjsSnapshotProjection({
      roomId: 'stream-room',
      update: encodeStateAsUpdate(first.doc),
    });
    expect(serializedRootTypes(persistedProjection.editorData)).toEqual(expectedRootTypes);
    expect(countSerializedNodeType(persistedProjection.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(persistedProjection.editorData, 'code')).toBe(1);
  });

  it('applies a direct cross-three-paragraph text rewrite without duplicating siblings', async () => {
    const room = new TestRoom(await seedCrossBlockMixedDocument());
    rooms.push(room);
    const first = createAgent(room, 'direct-request-cross-three');
    const second = createAgent(room, 'direct-request-cross-three-peer');
    agents.push(first.agent, second.agent);
    docs.push(first.doc, second.doc);
    await first.agent.connect();
    await second.agent.connect();

    const selection = captureCrossBlockText(first.agent);
    if (!selection) throw new Error('direct cross-three-paragraph selection capture failed');
    expect(selection.targetNodeIds).toHaveLength(3);
    const result = await first.agent.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText(selection.quotedText),
      generationId: 'direct-generation-cross-three',
      mode: 'direct',
      replacementText: 'Direct cross-block replacement',
      requestId: 'direct-request-cross-three',
      selection,
    });
    expect(result).toMatchObject({
      affectedNodeIds: selection.targetNodeIds,
      status: 'applied',
    });

    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(second.agent);
    expect(serializedRootTypes(projection.editorData)).toEqual([
      'paragraph',
      'artifact',
      'paragraph',
      'paragraph',
      'code',
      'paragraph',
    ]);
    expect(countSerializedNodeType(projection.editorData, 'artifact')).toBe(1);
    expect(countSerializedNodeType(projection.editorData, 'code')).toBe(1);
    expect(projection.markdown).toContain('Direct cross-block replacement');
  });
});
