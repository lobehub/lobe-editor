// @vitest-environment node
import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import { $createListItemNode, $createListNode } from '@lexical/list';
import {
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isTextNode,
  $setSelection,
  IS_BOLD,
  IS_CODE,
  REDO_COMMAND,
  type RangeSelection,
  UNDO_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyUpdate,
  createRelativePositionFromTypeIndex,
  Doc,
  encodeStateAsUpdate,
  type RelativePosition,
} from 'yjs';

import { moment } from '@/editor-kernel';
import { HeadlessEditor } from '../index';
import {
  __exportCollaborativeAgentEditorProjectionForPersistence,
  __createCollaborativeAgentEditorForTesting,
  CollaborativeAgentEditor,
  hashRewriteText,
  serializeRelativePosition,
} from '../collaborative-agent-editor';
import type { BlockRewriteSelection } from '../collaborative-agent-editor';
import { APPLY_BLOCK_REWRITE_COMMAND } from '@/plugins/block/command';
import { INSERT_ARTIFACT_COMMAND } from '@/plugins/artifact/command';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { LITEXML_APPLY_COMMAND, LITEXML_REWRITE_RANGE_COMMAND } from '@/plugins/litexml/command';
import { BlockRewritePlugin } from '@/plugins/block/plugin/rewrite';
import { CodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { $resolveLogicalBlockNode } from '@/plugins/common/node/hole';
import { $ensureNodeIdsInTree, $getNodeId } from '@/plugins/properties';
import { PropertiesPlugin } from '@/plugins/properties';
import { MARK_AI_GENERATED_COMMAND } from '@/plugins/properties/command';
import { IAISessionService } from '@/plugins/ai-session/service';
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
  private readonly pendingAcks = new Set<MockProvider>();
  private readonly stateDoc = new Doc();

  constructor(
    initialUpdate: Uint8Array,
    private readonly options: { delayAcks?: boolean } = {},
  ) {
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
    if (this.options.delayAcks) this.pendingAcks.add(sender);
    else sender.acknowledgeUpdate();
  }

  flushAcks(): void {
    const pending = [...this.pendingAcks];
    this.pendingAcks.clear();
    pending.forEach((provider) => provider.acknowledgeUpdate());
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
    if (this.room) {
      this.pendingUpdates += 1;
      this.room.publish(this, update);
    }
  };
  private synced = false;
  private readonly syncPromise: Promise<void>;
  private resolveSync!: () => void;
  private pendingUpdates = 0;
  private readonly pendingUpdateWaiters = new Set<{
    reject: (error: Error) => void;
    resolve: () => void;
  }>();

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

  waitForPendingUpdates(timeoutMs = 1_000): Promise<void> {
    if (this.pendingUpdates === 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const waiter = {
        reject: (error: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.pendingUpdateWaiters.delete(waiter);
          reject(error);
        },
        resolve: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.pendingUpdateWaiters.delete(waiter);
          resolve();
        },
      };
      const timer = setTimeout(
        () => waiter.reject(new Error('Mock room update acknowledgement timed out.')),
        timeoutMs,
      );
      this.pendingUpdateWaiters.add(waiter);
    });
  }

  acknowledgeUpdate(): void {
    this.pendingUpdates = Math.max(0, this.pendingUpdates - 1);
    if (this.pendingUpdates > 0) return;
    this.pendingUpdateWaiters.forEach((waiter) => waiter.resolve());
    this.pendingUpdateWaiters.clear();
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
  endOffset = 5,
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
      collabNode.getOffset() + 1 + endOffset,
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

  it('resolves an Artifact by durable nodeId and applies one guarded Yjs command', async () => {
    const seedDoc = new Doc();
    docs.push(seedDoc);
    const seed = new HeadlessEditor();
    seed.hydrateMarkdown('Before artifact');
    const seedLexical = seed.kernel.getLexicalEditor();
    if (!seedLexical) throw new Error('Missing seed lexical editor.');
    seedLexical.update(
      () => {
        seed.kernel.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
          html: '<!doctype html><html><head><title>Original artifact</title></head><body><main>Original artifact</main></body></html>',
          title: 'Original artifact',
        });
        $ensureNodeIdsInTree();
      },
      { discrete: true },
    );
    const artifactInfo = seedLexical.getEditorState().read(() => {
      const artifact = seedLexical.getEditorState()._nodeMap;
      for (const node of artifact.values()) {
        if (node instanceof ArtifactNode) {
          return { nodeId: $getNodeId(node), source: node.getHtml() };
        }
      }
      return { nodeId: undefined, source: undefined };
    });
    if (!artifactInfo.nodeId || !artifactInfo.source) throw new Error('Missing Artifact node id.');
    const seedProvider = new MockProvider(null, seedDoc);
    const binding = createBinding(
      seedLexical,
      seedProvider,
      'artifact-room',
      seedDoc,
      new Map([['artifact-room', seedDoc]]),
    );
    syncCurrentEditorStateToYjs(binding, seedProvider);
    const update = encodeStateAsUpdate(seedDoc);
    binding.root.destroy(binding);
    seed.destroy();

    const room = new MockRoom(update, { delayAcks: true });
    rooms.push(room);
    const doc = new Doc();
    docs.push(doc);
    const provider = new MockProvider(room, doc);
    const session = __createCollaborativeAgentEditorForTesting({
      documentId: 'artifact-room',
      provider,
      requestId: 'artifact-request',
      roomId: 'artifact-room',
      ticket: 'test-ticket',
      yjsDoc: doc,
    });
    sessions.push(session);
    await session.connect();

    const browserDoc = new Doc();
    docs.push(browserDoc);
    const browserProvider = new MockProvider(room, browserDoc);
    const browserSession = __createCollaborativeAgentEditorForTesting({
      documentId: 'artifact-room',
      provider: browserProvider,
      requestId: 'artifact-browser-request',
      roomId: 'artifact-room',
      ticket: 'test-browser-ticket',
      yjsDoc: browserDoc,
    });
    sessions.push(browserSession);
    await browserSession.connect();

    const beforeAwareness = session.getStateVector();
    session.setAgentAwareness({
      documentId: 'artifact-room',
      requestId: 'artifact-request',
      selectionRange: {
        startNodeId: artifactInfo.nodeId,
        startOffset: 0,
        endNodeId: artifactInfo.nodeId,
        endOffset: 1,
      },
      status: 'thinking',
    });
    expect(provider.awareness.getLocalState()?.anchorPos).not.toBeNull();
    expect(provider.awareness.getLocalState()?.focusPos).not.toBeNull();
    expect(session.getStateVector()).toEqual(beforeAwareness);
    session.setAgentAwareness({
      anchorPos: null,
      focusPos: null,
      documentId: 'artifact-room',
      requestId: 'artifact-request',
      status: 'done',
    });
    expect(provider.awareness.getLocalState()?.anchorPos).toBeNull();
    session.clearAwareness();
    expect(provider.awareness.getLocalState()).toBeNull();

    const target = session.resolveBlockRewriteTarget({
      adapterId: 'artifact',
      nodeId: artifactInfo.nodeId,
      sourceHash: hashRewriteText(artifactInfo.source),
    });
    expect(target).toMatchObject({
      adapterId: 'artifact',
      nodeId: artifactInfo.nodeId,
      outputSchema: 'source',
      source: artifactInfo.source,
      sourceHash: hashRewriteText(artifactInfo.source),
    });
    const updates: Uint8Array[] = [];
    doc.on('update', (value) => updates.push(value));
    const replacement =
      '<!doctype html><html><head><title>俄罗斯方块 Pro</title></head><body><main>Updated artifact</main></body></html>';
    const result = await session.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
      adapterKey: 'artifact',
      expectedSourceHash: hashRewriteText(artifactInfo.source),
      generationId: 'artifact-generation',
      nodeId: artifactInfo.nodeId,
      output: { kind: 'source', source: replacement },
      requestId: 'artifact-request',
    });
    expect(result).toMatchObject({
      affectedNodeIds: [artifactInfo.nodeId],
      status: 'diff-created',
    });
    expect(updates).toHaveLength(1);
    await moment();
    expect(
      browserSession.resolveBlockRewriteTarget({
        adapterId: 'artifact',
        nodeId: artifactInfo.nodeId,
      }),
    ).toMatchObject({ source: replacement, title: '俄罗斯方块 Pro' });
    let acknowledged = false;
    const pendingAck = session.waitForUpdateAck(1_000).then(() => {
      acknowledged = true;
    });
    await Promise.resolve();
    expect(acknowledged).toBe(false);
    room.flushAcks();
    await pendingAck;
    expect(acknowledged).toBe(true);
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(session);
    expect(projection.markdown).toContain('Updated artifact');
    expect(JSON.stringify(projection.editorData)).toContain('artifact-generation');
    expect(JSON.stringify(projection.editorData)).toContain('俄罗斯方块 Pro');

    const stale = await session.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
      adapterKey: 'artifact',
      expectedSourceHash: hashRewriteText(artifactInfo.source),
      generationId: 'artifact-generation-stale',
      nodeId: artifactInfo.nodeId,
      output: {
        kind: 'source',
        source:
          '<!doctype html><html><head><title>Should not apply</title></head><body><main>Should not apply</main></body></html>',
      },
      requestId: 'artifact-request',
    });
    expect(stale).toMatchObject({ status: 'failed' });
    expect(
      (await __exportCollaborativeAgentEditorProjectionForPersistence(session)).markdown,
    ).not.toContain('Should not apply');
    await session.disconnect();
    expect(
      browserSession.resolveBlockRewriteTarget({
        adapterId: 'artifact',
        nodeId: artifactInfo.nodeId,
      }),
    ).toMatchObject({ source: replacement, title: '俄罗斯方块 Pro' });
  });

  it('persists a CodeMirror source rewrite to the browser peer and export projection', async () => {
    const seedDoc = new Doc();
    docs.push(seedDoc);
    const seed = new HeadlessEditor({
      plugins: [CommonPlugin, BlockRewritePlugin, PropertiesPlugin, CodemirrorPlugin],
    });
    const source = 'const value = 1;';
    const replacement = 'function quickSort(items) { return items; }';
    seed.hydrateEditorData({
      root: {
        children: [
          {
            code: source,
            codeTheme: 'default',
            language: 'javascript',
            options: { indentWithTabs: false, lineNumbers: false, tabSize: 2 },
            type: 'code',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    } as never);
    const seedLexical = seed.kernel.getLexicalEditor();
    if (!seedLexical) throw new Error('Missing CodeMirror seed editor.');
    seedLexical.update(
      () => {
        $ensureNodeIdsInTree();
      },
      { discrete: true },
    );
    await moment();
    const codeMirrorInfo = seedLexical.getEditorState().read(() => {
      const firstChild = $getRoot().getFirstChild();
      const node = firstChild ? $resolveLogicalBlockNode(firstChild) : null;
      if (!(node instanceof CodeMirrorNode)) throw new Error('Missing CodeMirror seed node.');
      return { nodeId: $getNodeId(node), source: node.code };
    });
    if (!codeMirrorInfo.nodeId) throw new Error('Missing CodeMirror durable node id.');

    const seedProvider = new MockProvider(null, seedDoc);
    const binding = createBinding(
      seedLexical,
      seedProvider,
      'codemirror-room',
      seedDoc,
      new Map([['codemirror-room', seedDoc]]),
    );
    syncCurrentEditorStateToYjs(binding, seedProvider);
    const update = encodeStateAsUpdate(seedDoc);
    binding.root.destroy(binding);
    seed.destroy();

    const room = new MockRoom(update, { delayAcks: true });
    rooms.push(room);
    const agentDoc = new Doc();
    const browserDoc = new Doc();
    docs.push(agentDoc, browserDoc);
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'codemirror-room',
      provider: new MockProvider(room, agentDoc),
      requestId: 'codemirror-agent-request',
      roomId: 'codemirror-room',
      ticket: 'test-ticket',
      yjsDoc: agentDoc,
    });
    const browser = __createCollaborativeAgentEditorForTesting({
      documentId: 'codemirror-room',
      provider: new MockProvider(room, browserDoc),
      requestId: 'codemirror-browser-request',
      roomId: 'codemirror-room',
      ticket: 'test-browser-ticket',
      yjsDoc: browserDoc,
    });
    sessions.push(agent, browser);
    await agent.connect();
    await browser.connect();

    expect(
      agent.resolveBlockRewriteTarget({
        adapterId: 'codemirror',
        nodeId: codeMirrorInfo.nodeId,
        sourceHash: hashRewriteText(source),
      }),
    ).toMatchObject({ outputSchema: 'source', source, sourceHash: hashRewriteText(source) });
    const result = await agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
      adapterKey: 'codemirror',
      expectedSourceHash: hashRewriteText(source),
      generationId: 'codemirror-generation',
      nodeId: codeMirrorInfo.nodeId,
      output: { kind: 'source', language: ' py ', source: replacement },
      requestId: 'codemirror-agent-request',
    });
    expect(result).toMatchObject({ status: 'diff-created' });
    await moment();
    expect(
      browser.resolveBlockRewriteTarget({
        adapterId: 'codemirror',
        nodeId: codeMirrorInfo.nodeId,
      }),
    ).toMatchObject({
      language: 'python',
      source: replacement,
      sourceHash: hashRewriteText(replacement),
    });
    room.flushAcks();
    await agent.waitForUpdateAck?.(1_000);
    const projection = await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    expect(JSON.stringify(projection.editorData)).toContain(replacement);
    // A language-only conversion must cross Yjs even when the source is
    // byte-for-byte unchanged; this is the common Plain Text -> JS case.
    for (const language of ['plain', 'javascript', 'rust']) {
      const languageOnly = await agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText(replacement),
        generationId: `codemirror-language-${language}`,
        nodeId: codeMirrorInfo.nodeId,
        output: { kind: 'source', language, source: replacement },
        requestId: 'codemirror-agent-request',
      });
      expect(languageOnly).toMatchObject({ status: 'diff-created' });
      await moment();
      expect(
        browser.resolveBlockRewriteTarget({
          adapterId: 'codemirror',
          nodeId: codeMirrorInfo.nodeId,
        }),
      ).toMatchObject({ language, source: replacement });
    }
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
      selectionRange: {
        startNodeId: resolved.startNodeId!,
        endNodeId: resolved.endNodeId!,
        startOffset: 0,
        endOffset: 5,
      },
      status: 'thinking',
    });
    expect(firstProvider.awareness.getLocalState()?.anchorPos).not.toBeNull();
    expect(firstProvider.awareness.getLocalState()?.focusPos).not.toBeNull();
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

  it('parses Markdown formatting for direct text rewrites without touching the next paragraph', async () => {
    const createSession = async (suffix: string) => {
      const room = new MockRoom(seedSharedDocument());
      rooms.push(room);
      const doc = new Doc();
      docs.push(doc);
      const provider = new MockProvider(room, doc);
      const session = __createCollaborativeAgentEditorForTesting({
        documentId: `markdown-${suffix}`,
        provider,
        requestId: `markdown-${suffix}-request`,
        roomId: `markdown-${suffix}`,
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
      return { service, session };
    };

    const { service, session } = await createSession('inline');
    const firstText = service.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? text : null;
    });
    if (!firstText) throw new Error('Missing inline rewrite target.');
    const positions = getRelativeRange(service.binding.editor, service.binding, firstText.getKey());
    const inlineSelection = {
      anchorPos: serializeRelativePosition(positions.start),
      baseStateVector: session.getStateVector(),
      capturedAt: new Date().toISOString(),
      focusPos: serializeRelativePosition(positions.end),
      kind: 'relative' as const,
      quotedText: 'Hello',
      quotedTextHash: hashRewriteText('Hello'),
      roomId: 'markdown-inline',
    };
    const inlineResult = await session.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'markdown-inline-generation',
      mode: 'direct',
      replacementText: '**bold** and `sort`',
      requestId: 'markdown-inline-request',
      selection: inlineSelection,
    });
    expect(inlineResult).toMatchObject({ status: 'applied' });
    const inlineShape = service.binding.editor.getEditorState().read(() => {
      const first = $getRoot().getFirstChild();
      const paragraphTexts: Array<{ format: number; text: string }> = [];
      const visit = (node: LexicalNode): void => {
        if ($isTextNode(node)) {
          paragraphTexts.push({ format: node.getFormat(), text: node.getTextContent() });
        } else if (node.getType() === 'codeInline') {
          paragraphTexts.push({
            format: IS_CODE,
            text: node.getTextContent().replaceAll('\uFEFF', ''),
          });
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };
      if ($isElementNode(first)) {
        first.getChildren().forEach(visit);
      }
      return {
        paragraphTexts,
        second: $getRoot().getChildren()[1]?.getTextContent(),
      };
    });
    expect(inlineShape.paragraphTexts).toEqual(
      expect.arrayContaining([
        { format: IS_BOLD, text: 'bold' },
        { format: IS_CODE, text: 'sort' },
      ]),
    );
    expect(inlineShape.second).toBe('second paragraph');
    service.binding.editor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    const undoneInline = await __exportCollaborativeAgentEditorProjectionForPersistence(session);
    expect(undoneInline.markdown).toContain('Hello collaborative world');
    expect(undoneInline.markdown).toContain('second paragraph');
    service.binding.editor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    const redoneInline = await __exportCollaborativeAgentEditorProjectionForPersistence(session);
    expect(redoneInline.markdown).toContain('**bold**');
    expect(redoneInline.markdown).toContain('`sort`');

    const { service: styledService, session: styledSession } = await createSession('styled');
    styledService.binding.editor.update(
      () => {
        const text = $getRoot().getFirstDescendant();
        if (!$isTextNode(text)) throw new Error('Missing styled rewrite target.');
        text.setStyle('color: red');
      },
      { discrete: true },
    );
    const styledTarget = styledService.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? text : null;
    });
    if (!styledTarget) throw new Error('Missing styled rewrite target.');
    const styledPositions = getRelativeRange(
      styledService.binding.editor,
      styledService.binding,
      styledTarget.getKey(),
    );
    const styledResult = await styledSession.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'markdown-styled-generation',
      mode: 'direct',
      replacementText: 'plain',
      requestId: 'markdown-styled-request',
      selection: {
        anchorPos: serializeRelativePosition(styledPositions.start),
        baseStateVector: styledSession.getStateVector(),
        capturedAt: new Date().toISOString(),
        focusPos: serializeRelativePosition(styledPositions.end),
        kind: 'relative' as const,
        quotedText: 'Hello',
        quotedTextHash: hashRewriteText('Hello'),
        roomId: 'markdown-styled',
      },
    });
    expect(styledResult).toMatchObject({ status: 'applied' });
    expect(
      styledService.binding.editor.getEditorState().read(() => {
        const text = $getRoot().getFirstDescendant();
        return $isTextNode(text) ? text.getStyle() : null;
      }),
    ).toBe('color: red');

    const { service: partialService, session: partialSession } =
      await createSession('partial-list');
    const partialTarget = partialService.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? text : null;
    });
    if (!partialTarget) throw new Error('Missing partial list rewrite target.');
    const partialPositions = getRelativeRange(
      partialService.binding.editor,
      partialService.binding,
      partialTarget.getKey(),
    );
    const partialSelection = {
      anchorPos: serializeRelativePosition(partialPositions.start),
      baseStateVector: partialSession.getStateVector(),
      capturedAt: new Date().toISOString(),
      focusPos: serializeRelativePosition(partialPositions.end),
      kind: 'relative' as const,
      quotedText: 'Hello',
      quotedTextHash: hashRewriteText('Hello'),
      roomId: 'markdown-partial-list',
    };
    const partialBefore = JSON.stringify(
      await __exportCollaborativeAgentEditorProjectionForPersistence(partialSession),
    );
    const partialResult = await partialSession.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('Hello'),
      generationId: 'markdown-partial-list-generation',
      mode: 'direct',
      replacementText: '1. **not safe to splice**\n2. `sort`',
      requestId: 'markdown-partial-list-request',
      selection: partialSelection,
    });
    expect(partialResult).toMatchObject({ status: 'applied' });
    const partialAfterProjection =
      await __exportCollaborativeAgentEditorProjectionForPersistence(partialSession);
    const partialAfter = JSON.stringify(partialAfterProjection);
    expect(partialAfter).not.toBe(partialBefore);
    expect(partialAfterProjection.markdown).toContain('collaborative world');
    expect(partialAfterProjection.markdown).toContain('not safe to splice');

    const { service: listItemService, session: listItemSession } = await createSession('list-item');
    listItemService.binding.editor.update(
      () => {
        const paragraph = $getRoot().getFirstChild();
        if (!$isElementNode(paragraph)) throw new Error('Missing list-item seed paragraph.');
        const list = $createListNode('bullet');
        list.append(
          $createListItemNode().append($createTextNode('Hello collaborative world')),
          $createListItemNode().append($createTextNode('Keep this item')),
        );
        paragraph.replace(list);
      },
      { discrete: true },
    );
    await moment();
    const listItemTarget = listItemService.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? { key: text.getKey(), text: text.getTextContent() } : null;
    });
    if (!listItemTarget) throw new Error('Missing list-item rewrite target.');
    const listItemPositions = getRelativeRange(
      listItemService.binding.editor,
      listItemService.binding,
      listItemTarget.key,
      listItemTarget.text.length,
    );
    const listItemResult = await listItemSession.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText(listItemTarget.text),
      generationId: 'markdown-list-item-generation',
      mode: 'direct',
      replacementText: '1. **new item**\n2. `sort`',
      requestId: 'markdown-list-item-request',
      selection: {
        anchorPos: serializeRelativePosition(listItemPositions.start),
        baseStateVector: listItemSession.getStateVector(),
        capturedAt: new Date().toISOString(),
        focusPos: serializeRelativePosition(listItemPositions.end),
        kind: 'relative' as const,
        quotedText: listItemTarget.text,
        quotedTextHash: hashRewriteText(listItemTarget.text),
        roomId: 'markdown-list-item',
      },
    });
    expect(listItemResult).toMatchObject({ status: 'applied' });
    expect(
      listItemService.binding.editor.getEditorState().read(() => {
        const list = $getRoot().getFirstChild();
        return $isElementNode(list) ? list.getChildrenSize() : 0;
      }),
    ).toBe(2);

    const { service: listService, session: listSession } = await createSession('list');
    const listTarget = listService.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? { key: text.getKey(), text: text.getTextContent() } : null;
    });
    if (!listTarget) throw new Error('Missing list rewrite target.');
    const listPositions = getRelativeRange(
      listService.binding.editor,
      listService.binding,
      listTarget.key,
      listTarget.text.length,
    );
    const listSelection = {
      anchorPos: serializeRelativePosition(listPositions.start),
      baseStateVector: listSession.getStateVector(),
      capturedAt: new Date().toISOString(),
      focusPos: serializeRelativePosition(listPositions.end),
      kind: 'relative' as const,
      quotedText: listTarget.text,
      quotedTextHash: hashRewriteText(listTarget.text),
      roomId: 'markdown-list',
    };
    const listResult = await listSession.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText(listTarget.text),
      generationId: 'markdown-list-generation',
      mode: 'direct',
      provenanceSessionId: 'markdown-list-session',
      replacementText: '1. **俄罗斯方块简介**\n2. `sort`\n3. **第三项**',
      requestId: 'markdown-list-request',
      selection: listSelection,
    });
    expect(listResult).toMatchObject({ status: 'applied' });
    const listShape = listService.binding.editor.getEditorState().read(() => {
      const rootChildren = $getRoot().getChildren();
      const list = rootChildren[0];
      const textNodes: Array<{ format: number; text: string }> = [];
      const nodeTypes: string[] = [];
      if ($isElementNode(list)) {
        const visit = (node: LexicalNode): void => {
          nodeTypes.push(node.getType());
          if ($isTextNode(node))
            textNodes.push({ format: node.getFormat(), text: node.getTextContent() });
          else if (node.getType() === 'codeInline')
            textNodes.push({
              format: IS_CODE,
              text: node.getTextContent().replaceAll('\uFEFF', ''),
            });
          if ($isElementNode(node)) node.getChildren().forEach(visit);
        };
        visit(list);
      }
      return { nodeTypes, rootTypes: rootChildren.map((node) => node.getType()), textNodes };
    });
    expect(listShape.rootTypes).toEqual(['list', 'paragraph']);
    expect(listShape.textNodes).toEqual(
      expect.arrayContaining([
        { format: IS_BOLD, text: '俄罗斯方块简介' },
        { format: IS_CODE, text: 'sort' },
        { format: IS_BOLD, text: '第三项' },
      ]),
    );
    (listSelection as { targetNodeIds?: string[] }).targetNodeIds = listResult.affectedNodeIds;
    expect(listSession.resolveSelection(listSelection)).toBeNull();
    const generatedRanges = (listSession as unknown as { kernel: IEditor }).kernel
      .requireService(IAISessionService)
      ?.getRanges('markdown-list-session');
    expect(generatedRanges?.map((range) => range.text)).toEqual([
      '俄罗斯方块简介',
      'sort',
      '第三项',
    ]);
    const unverifiedRelocated = listSession.resolveSelectionByProvenance('markdown-list-session');
    expect(unverifiedRelocated).toMatchObject({ quotedText: expect.any(String) });
    expect(unverifiedRelocated?.quotedText).toBe('俄罗斯方块简介 sort 第三项');
    const secondDoc = new Doc();
    docs.push(secondDoc);
    const secondProvider = new MockProvider(rooms.at(-1)!, secondDoc);
    const secondSession = __createCollaborativeAgentEditorForTesting({
      documentId: 'markdown-list',
      provider: secondProvider,
      requestId: 'markdown-list-second-request',
      roomId: 'markdown-list',
      ticket: 'test-ticket',
      yjsDoc: secondDoc,
    });
    sessions.push(secondSession);
    await secondSession.connect();
    const secondRanges = (secondSession as unknown as { kernel: IEditor }).kernel
      .requireService(IAISessionService)
      ?.getRanges('markdown-list-session');
    expect(secondRanges?.map((range) => range.text)).toEqual(['俄罗斯方块简介', 'sort', '第三项']);
    const relocated = secondSession.resolveSelectionByProvenance(
      'markdown-list-session',
      hashRewriteText('俄罗斯方块简介 sort 第三项'),
      listResult.affectedNodeIds,
    );
    expect(relocated).toMatchObject({ quotedText: '俄罗斯方块简介 sort 第三项' });
    const secondResult = await secondSession.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText(relocated!.quotedText),
      generationId: 'markdown-list-second-generation',
      mode: 'direct',
      provenanceSessionId: 'markdown-list-session',
      replacementText: '**续写**',
      requestId: 'markdown-list-second-request',
      selection: {
        endNodeId: relocated!.endNodeId,
        endOffset: relocated!.endOffset,
        kind: 'block' as const,
        quotedText: relocated!.quotedText,
        quotedTextHash: hashRewriteText(relocated!.quotedText),
        startNodeId: relocated!.startNodeId,
        startOffset: relocated!.startOffset,
        targetNodeIds: relocated!.targetNodeIds,
      },
      turnIndex: 2,
    });
    expect(secondResult.error).toBeUndefined();
    expect(secondResult).toMatchObject({ status: 'applied' });
    await moment();
    const secondText = (secondSession as unknown as { kernel: IEditor }).kernel.getDocument(
      'text',
    ) as unknown as string;
    expect(secondText).toContain('续写');
    expect(secondText).not.toContain('俄罗斯方块简介');
  });

  it('validates a partial rewrite inside one formatted AI text node', async () => {
    const room = new MockRoom(seedSharedDocument());
    rooms.push(room);
    const doc = new Doc();
    docs.push(doc);
    const provider = new MockProvider(room, doc);
    const session = __createCollaborativeAgentEditorForTesting({
      documentId: 'markdown-partial-ai',
      provider,
      requestId: 'markdown-partial-ai-request',
      roomId: 'markdown-partial-ai',
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
    const firstTarget = service.binding.editor.getEditorState().read(() => {
      const text = $getRoot().getFirstDescendant();
      return text && $isTextNode(text) ? { key: text.getKey(), text: text.getTextContent() } : null;
    });
    if (!firstTarget) throw new Error('Missing partial AI rewrite target.');
    const firstPositions = getRelativeRange(
      service.binding.editor,
      service.binding,
      firstTarget.key,
      firstTarget.text.length,
    );
    const firstResult = await session.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText(firstTarget.text),
      generationId: 'markdown-partial-ai-first',
      mode: 'direct',
      provenanceSessionId: 'markdown-partial-ai-session',
      replacementText: '**formatted text**',
      requestId: 'markdown-partial-ai-request',
      selection: {
        anchorPos: serializeRelativePosition(firstPositions.start),
        baseStateVector: session.getStateVector(),
        capturedAt: new Date().toISOString(),
        focusPos: serializeRelativePosition(firstPositions.end),
        kind: 'relative' as const,
        quotedText: firstTarget.text,
        quotedTextHash: hashRewriteText(firstTarget.text),
        roomId: 'markdown-partial-ai',
      },
    });
    expect(firstResult).toMatchObject({ status: 'applied' });

    const secondDoc = new Doc();
    docs.push(secondDoc);
    const secondProvider = new MockProvider(room, secondDoc);
    const secondSession = __createCollaborativeAgentEditorForTesting({
      documentId: 'markdown-partial-ai',
      provider: secondProvider,
      requestId: 'markdown-partial-ai-second-request',
      roomId: 'markdown-partial-ai',
      ticket: 'test-ticket',
      yjsDoc: secondDoc,
    });
    sessions.push(secondSession);
    await secondSession.connect();
    const secondService = (
      secondSession as unknown as {
        getYjsServiceState: () => { binding: ReturnType<typeof createBinding> };
      }
    ).getYjsServiceState();
    let partialSelection: RangeSelection | undefined;
    secondService.binding.editor.update(() => {
      const text = $getRoot()
        .getAllTextNodes()
        .find((candidate) => candidate.getTextContent() === 'formatted text');
      if (!text) throw new Error('Missing formatted AI text node.');
      partialSelection = $createRangeSelection();
      partialSelection.setTextNodeRange(text, 3, text, 7);
      $setSelection(partialSelection);
    });
    await moment();
    expect(
      secondService.binding.editor.getEditorState().read(() => $getSelection()?.getTextContent()),
    ).toBe('matt');
    const secondResult = await secondSession.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, {
      expectedTextHash: hashRewriteText('matt'),
      generationId: 'markdown-partial-ai-second',
      mode: 'direct',
      provenanceSessionId: 'markdown-partial-ai-session',
      replacementText: 'EDIT',
      requestId: 'markdown-partial-ai-second-request',
      selection: partialSelection!,
      turnIndex: 2,
    });
    expect(secondResult).toMatchObject({ status: 'applied' });
    await moment();
    expect(
      secondService.binding.editor.getEditorState().read(() => $getRoot().getTextContent()),
    ).toContain('forEDITed text');
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
