// @vitest-environment node
import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $nodesOfType,
  $setSelection,
  HISTORY_PUSH_TAG,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalNode,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { applyUpdate, Doc, encodeStateAsUpdate } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import type { CollaborativeAgentEditor } from '@/headless/collaborative-agent-editor';
import {
  __createCollaborativeAgentEditorForTesting,
  __exportCollaborativeAgentEditorProjectionForPersistence,
  hashRewriteText,
} from '@/headless/collaborative-agent-editor';
import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from '@/headless/default-plugins';
import { migrateLegacyBlockImagesInYjsDoc } from '@/headless/yjs-snapshot';
import { INSERT_ARTIFACT_COMMAND } from '@/plugins/artifact/command';
import { $createArtifactNode, ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { APPLY_BLOCK_REWRITE_COMMAND } from '@/plugins/block/command';
import { INSERT_CODEMIRROR_COMMAND } from '@/plugins/codemirror-block/command';
import {
  $createCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { HoleNode } from '@/plugins/common/node/hole';
import { CommonPlugin } from '@/plugins/common/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { $setNodeProperties } from '@/plugins/properties';
import { PropertiesPlugin } from '@/plugins/properties/plugin';
import type { IPlugin } from '@/types';

import { YjsPlugin } from '../plugin';
import { syncCurrentEditorStateToYjs } from '../plugin/utils/sync';
import { IYjsService } from '../service';

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
  readonly awareness: ProviderAwareness = {
    getLocalState: () => null,
    getStates: () => new Map<number, UserState>(),
    off: () => undefined,
    on: () => undefined,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
  };
  publishedUpdates = 0;
  private readonly listeners = new Map<string, Set<(...args: never[]) => void>>();
  private readonly updateHandler = (update: Uint8Array, origin: unknown): void => {
    if (origin !== this) {
      this.publishedUpdates += 1;
      this.room?.publish(this, update);
    }
  };
  private synced = false;
  private readonly syncPromise: Promise<void>;
  private resolveSync!: () => void;

  constructor(
    private readonly room: MockRoom | null,
    private readonly doc: Doc,
  ) {
    this.syncPromise = new Promise((resolve) => {
      this.resolveSync = resolve;
    });
  }

  connect(): void {
    if (!this.room) throw new Error('Mock room is missing.');
    this.room.connect(this);
  }

  disconnect(): void {
    this.room?.disconnect(this);
    this.synced = false;
    this.listeners.get('sync')?.forEach((listener) => listener(false as never));
  }

  emitConnected(): void {
    this.synced = true;
    this.listeners.get('status')?.forEach((listener) => listener({ status: 'connected' } as never));
    this.listeners.get('sync')?.forEach((listener) => listener(true as never));
    this.resolveSync();
  }

  getDoc(): Doc {
    return this.doc;
  }

  getUpdateHandler(): (update: Uint8Array, origin: unknown) => void {
    return this.updateHandler;
  }

  waitForSync(): Promise<void> {
    return this.synced ? Promise.resolve() : this.syncPromise;
  }

  off(type: 'reload' | 'status' | 'sync' | 'update', listener: unknown): void {
    this.listeners.get(type)?.delete(listener as never);
  }

  on(type: 'reload' | 'status' | 'sync' | 'update', listener: unknown): void {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(listener as never);
    this.listeners.set(type, callbacks);
  }
}

const seedDocument = async (): Promise<{
  update: Uint8Array;
  artifactSource: string;
  codeSource: string;
}> => {
  const source = Editor.createEditor();
  source.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
  source.initHeadlessEditor();
  source.setDocument('markdown', 'Human paragraph\n\nKeep this paragraph');
  const artifactSource =
    '<!doctype html><html><head><title>Stable artifact</title></head><body><main>Stable artifact</main></body></html>';
  const codeSource = 'const answer = 42;';
  const editor = source.getLexicalEditor()!;
  editor.update(
    () => {
      const first = $getRoot().getFirstChild();
      const last = $getRoot().getLastChild();
      if (!first || !last || !$isElementNode(first) || !$isElementNode(last)) {
        throw new Error('seed paragraphs are missing');
      }
      const artifact = $createArtifactNode(artifactSource, 'Stable artifact');
      const code = $createCodeMirrorNode('javascript', codeSource);
      first.insertAfter(artifact);
      artifact.insertAfter(code);
      $setNodeProperties(artifact, { nodeId: 'agent-undo-artifact' });
      $setNodeProperties(code, { nodeId: 'agent-undo-code' });
    },
    { discrete: true },
  );
  await moment();

  const doc = new Doc();
  const provider = new MockProvider(null, doc);
  const binding = createBinding(editor, provider, 'agent-remote-undo', doc, new Map());
  syncCurrentEditorStateToYjs(binding, provider);
  // This is the same canonical initial room write used by the Page Agent.
  // The browser and Agent receive it as a provider snapshot, not a human edit.
  const syncDoc = () => {
    const snapshot = encodeStateAsUpdate(doc);
    binding.root.destroy(binding);
    doc.destroy();
    source.destroy();
    return snapshot;
  };
  // Keep the source values available to the test while the source editor is
  // still alive; the node ids are fixed above so Agent target resolution is
  // deterministic.
  return { artifactSource, codeSource, update: syncDoc() };
};

/** Seed the room from persisted JSON, then apply the owner-side structural
 * migration before any browser peer receives the shared snapshot. */
const seedLegacyArtifactOnlyDocument = async (
  includeTrailingParagraph = true,
): Promise<{
  update: Uint8Array;
  artifactSource: string;
}> => {
  const source = Editor.createEditor();
  source.registerPlugins([
    [CommonPlugin, { enableHotkey: false }],
    MarkdownPlugin,
    CodemirrorPlugin,
    PropertiesPlugin,
  ]);
  (source as unknown as { registerNodes: (nodes: unknown[]) => void }).registerNodes([
    ArtifactNode,
  ]);
  source.initHeadlessEditor();
  const artifactSource = '<main>legacy artifact</main>';
  const trailingParagraph = {
    children: [
      {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: 'Keep this paragraph',
        type: 'text',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  };
  source.setDocument('json', {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: 'Human paragraph',
              type: 'text',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
        {
          $: { properties: { nodeId: 'legacy-artifact' } },
          html: artifactSource,
          title: 'Legacy artifact',
          type: 'artifact',
          version: 1,
        },
        ...(includeTrailingParagraph ? [trailingParagraph] : []),
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });
  await moment();

  const doc = new Doc();
  const provider = new MockProvider(null, doc);
  const binding = createBinding(
    source.getLexicalEditor()!,
    provider,
    'agent-legacy-artifact-room',
    doc,
    new Map(),
  );
  syncCurrentEditorStateToYjs(binding, provider);
  const legacyUpdate = encodeStateAsUpdate(doc);
  binding.root.destroy(binding);
  doc.destroy();
  source.destroy();

  const roomDoc = new Doc();
  applyUpdate(roomDoc, legacyUpdate);
  const migration = await migrateLegacyBlockImagesInYjsDoc({
    doc: roomDoc,
    roomId: 'agent-legacy-artifact-room',
  });
  if (migration.changed) applyUpdate(roomDoc, migration.update, 'room-owner');
  const update = encodeStateAsUpdate(roomDoc);
  roomDoc.destroy();
  return { artifactSource, update };
};

const createBrowser = (room: MockRoom, doc: Doc, enableHotkey = false) => {
  const provider = new MockProvider(room, doc);
  const kernel = Editor.createEditor();
  const commonPlugin: IPlugin = enableHotkey
    ? CommonPlugin
    : [CommonPlugin, { enableHotkey: false }];
  kernel.registerPlugins([
    commonPlugin,
    ...DEFAULT_HEADLESS_EDITOR_PLUGINS.slice(1),
    [
      YjsPlugin,
      {
        id: 'agent-remote-undo',
        providerFactory: () => provider,
        shouldBootstrap: false,
        yjsDoc: doc,
      },
    ],
  ]);
  kernel.initHeadlessEditor();
  return { kernel, provider };
};

const createUndoKeyEvent = (): KeyboardEvent =>
  ({
    altKey: false,
    code: 'KeyZ',
    ctrlKey: false,
    key: 'z',
    metaKey: true,
    preventDefault: () => undefined,
    shiftKey: false,
    stopImmediatePropagation: () => undefined,
    stopPropagation: () => undefined,
  }) as unknown as KeyboardEvent;

const countType = (kernel: ReturnType<typeof Editor.createEditor>, type: string): number => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() => {
    let count = 0;
    const visit = (node: LexicalNode): void => {
      if (node.getType() === type) count += 1;
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    visit($getRoot());
    return count;
  });
};

const countArtifactsUnderParagraph = (kernel: ReturnType<typeof Editor.createEditor>): number => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() => {
    let count = 0;
    const visit = (node: LexicalNode): void => {
      if (node.getType() === 'artifact') {
        let parent = node.getParent();
        while (parent) {
          if (parent.getType() === 'paragraph') {
            count += 1;
            break;
          }
          parent = parent.getParent();
        }
      }
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    visit($getRoot());
    return count;
  });
};

const projection = (kernel: ReturnType<typeof Editor.createEditor>) =>
  kernel.getDocument('json') as unknown as Record<string, unknown>;

const getParagraphText = (
  kernel: ReturnType<typeof Editor.createEditor>,
  expectedText: string,
): string => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() => {
    const paragraph = $getRoot()
      .getChildren()
      .find(
        (node) => node.getType() === 'paragraph' && node.getTextContent().includes(expectedText),
      );
    return paragraph?.getTextContent() ?? '';
  });
};

const rootTypes = (kernel: ReturnType<typeof Editor.createEditor>): string[] => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node) => node.getType()),
  );
};

const isCodeHoleAt = (kernel: ReturnType<typeof Editor.createEditor>, index: number): boolean => {
  const editor = kernel.getLexicalEditor()!;
  return editor.getEditorState().read(() => {
    const node = $getRoot().getChildAtIndex(index);
    return (
      node instanceof HoleNode &&
      node.getContentChildren().some((child) => child instanceof CodeMirrorNode)
    );
  });
};

const expectCodeHoleAt = (kernel: ReturnType<typeof Editor.createEditor>, index: number): void => {
  expect(isCodeHoleAt(kernel, index)).toBe(true);
};

const expectTerminalCodeHoleAt = (
  kernel: ReturnType<typeof Editor.createEditor>,
  index: number,
): void => {
  const editor = kernel.getLexicalEditor()!;
  editor.getEditorState().read(() => {
    const node = $getRoot().getChildAtIndex(index);
    expect(node).toBeInstanceOf(HoleNode);
    if (!(node instanceof HoleNode)) return;
    expect(node.getContentChildren().some((child) => child instanceof CodeMirrorNode)).toBe(true);
    expect(node.hasValidBoundaryCursors()).toBe(true);
    expect(node.getAfterCursor()).not.toBeNull();
  });
};

const rawYjsReachableTypes = (value: unknown): unknown => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return typeof value;
  const shared = value as {
    _map?: Map<unknown, { content?: { type?: unknown }; deleted?: boolean; right?: unknown }>;
    _start?: {
      content?: { str?: unknown; type?: unknown };
      deleted?: boolean;
      right?: unknown;
    } | null;
    get?: (key: string) => unknown;
    getAttribute?: (key: string) => unknown;
    nodeName?: unknown;
    toArray?: () => unknown[];
  };
  const type =
    shared.get?.('__type') ??
    shared.getAttribute?.('__type') ??
    (typeof shared.nodeName === 'string' ? shared.nodeName : 'unknown');
  const children: unknown[] = [];
  let item = shared._start;
  while (item) {
    if (!item.deleted) {
      if (item.content?.type) children.push(rawYjsReachableTypes(item.content.type));
      else if (typeof item.content?.str === 'string') children.push('#text');
    }
    item = item.right as typeof item;
  }
  shared._map?.forEach((child) => {
    if (!child.deleted && child.content?.type) {
      children.push(rawYjsReachableTypes(child.content.type));
    }
  });
  if (children.length === 0) {
    children.push(...(shared.toArray?.() ?? []).map(rawYjsReachableTypes));
  }
  return { children, type };
};

const serializedShape = (
  value: unknown,
  paragraphAncestor = false,
): { artifactCount: number; cursorCount: number; artifactUnderParagraph: number } => {
  if (Array.isArray(value)) {
    return value.reduce(
      (total, child) => {
        const next = serializedShape(child, paragraphAncestor);
        return {
          artifactCount: total.artifactCount + next.artifactCount,
          cursorCount: total.cursorCount + next.cursorCount,
          artifactUnderParagraph: total.artifactUnderParagraph + next.artifactUnderParagraph,
        };
      },
      { artifactCount: 0, cursorCount: 0, artifactUnderParagraph: 0 },
    );
  }
  if (!value || typeof value !== 'object') {
    return { artifactCount: 0, cursorCount: 0, artifactUnderParagraph: 0 };
  }

  const record = value as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : undefined;
  const children = Array.isArray(record.children)
    ? record.children
    : record.root && typeof record.root === 'object'
      ? [record.root]
      : [];
  const childShape = serializedShape(children, paragraphAncestor || type === 'paragraph');
  return {
    artifactCount: childShape.artifactCount + (type === 'artifact' ? 1 : 0),
    cursorCount: childShape.cursorCount + (type === 'cursor' ? 1 : 0),
    artifactUnderParagraph:
      childShape.artifactUnderParagraph + (type === 'artifact' && paragraphAncestor ? 1 : 0),
  };
};

const expectPersistedArtifactShape = (kernel: ReturnType<typeof Editor.createEditor>): void => {
  const shape = serializedShape(kernel.getDocument('json'));
  expect(shape).toEqual({ artifactCount: 1, cursorCount: 0, artifactUnderParagraph: 0 });
};

const selectAfterArtifactBoundary = (kernel: ReturnType<typeof Editor.createEditor>): void => {
  const editor = kernel.getLexicalEditor()!;
  editor.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      const cursor = hole?.getAfterCursor();
      if (!hole || !cursor) throw new Error('Artifact Hole after cursor missing.');
      const selection = $createRangeSelection();
      selection.anchor.set(cursor.getKey(), 0, 'text');
      selection.focus.set(cursor.getKey(), 0, 'text');
      $setSelection(selection);
    },
    { discrete: true },
  );
};

const selectRootPointAfterArtifact = (kernel: ReturnType<typeof Editor.createEditor>): void => {
  const editor = kernel.getLexicalEditor()!;
  editor.update(
    () => {
      const hole = $nodesOfType(HoleNode)[0];
      if (!hole) throw new Error('Artifact Hole missing.');
      const root = $getRoot();
      const selection = $createRangeSelection();
      const offset = hole.getIndexWithinParent() + 1;
      selection.anchor.set(root.getKey(), offset, 'element');
      selection.focus.set(root.getKey(), offset, 'element');
      $setSelection(selection);
    },
    { discrete: true },
  );
};

describe('remote Agent structure replacement and browser undo history', () => {
  const rooms: MockRoom[] = [];
  const docs: Doc[] = [];
  const agents: CollaborativeAgentEditor[] = [];
  const kernels: Array<ReturnType<typeof Editor.createEditor>> = [];

  afterEach(async () => {
    while (agents.length > 0) await agents.pop()!.disconnect();
    while (kernels.length > 0) kernels.pop()!.destroy();
    while (docs.length > 0) docs.pop()!.destroy();
    while (rooms.length > 0) rooms.pop()!.destroy();
  });

  it('keeps remote Artifact/Code rewrites and the other peer after browser undo/redo', async () => {
    const seed = await seedDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);

    const agentDoc = new Doc();
    docs.push(agentDoc);
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-remote-undo',
      provider: new MockProvider(room, agentDoc),
      requestId: 'agent-remote-undo-request',
      roomId: 'agent-remote-undo',
      ticket: 'test-ticket',
      yjsDoc: agentDoc,
    });
    agents.push(agent);
    await agent.connect();

    const browserADoc = new Doc();
    const browserBDoc = new Doc();
    docs.push(browserADoc, browserBDoc);
    const browserA = createBrowser(room, browserADoc);
    const browserB = createBrowser(room, browserBDoc);
    kernels.push(browserA.kernel, browserB.kernel);
    browserA.provider.connect();
    browserB.provider.connect();
    await Promise.all([browserA.provider.waitForSync(), browserB.provider.waitForSync()]);
    await moment();
    await moment();
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);
    expect(countType(browserB.kernel, 'artifact')).toBe(1);
    expect(countArtifactsUnderParagraph(browserB.kernel)).toBe(0);
    expectPersistedArtifactShape(browserB.kernel);

    const artifactReplacement =
      '<!doctype html><html><head><title>Updated artifact</title></head><body><main>Updated artifact</main></body></html>';
    const codeReplacement = 'const answer = 84;';
    const artifact = agent.resolveBlockRewriteTarget({
      adapterId: 'artifact',
      nodeId: 'agent-undo-artifact',
      sourceHash: hashRewriteText(seed.artifactSource),
    });
    const code = agent.resolveBlockRewriteTarget({
      adapterId: 'codemirror',
      nodeId: 'agent-undo-code',
      sourceHash: hashRewriteText(seed.codeSource),
    });
    expect(artifact?.source).toBe(seed.artifactSource);
    expect(code?.source).toBe(seed.codeSource);

    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(seed.artifactSource),
        generationId: 'agent-artifact-generation',
        nodeId: 'agent-undo-artifact',
        output: { kind: 'source', source: artifactReplacement },
        requestId: 'agent-remote-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText(seed.codeSource),
        generationId: 'agent-code-generation',
        nodeId: 'agent-undo-code',
        output: { kind: 'source', language: 'typescript', source: codeReplacement },
        requestId: 'agent-remote-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    await moment();

    // The real Page receives the persisted Agent projection after the room
    // update. Route that echo through the same runtime/service boundary before
    // the user types; it must be recognized as already represented by Yjs.
    const persistedAgentEcho =
      await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    const browserService = browserA.kernel.requireService(IYjsService);
    expect(browserService).toBeTruthy();
    expect(
      browserService?.applyExternalEditorData(
        persistedAgentEcho.editorData as unknown as Record<string, unknown>,
      ),
    ).toBe(false);

    // A second browser peer makes an unrelated human edit after the Agent
    // structure replacement. A's Undo must not consume B's transaction.
    const browserBEditor = browserB.kernel.getLexicalEditor()!;
    browserBEditor.update(
      () => {
        const paragraph = $getRoot()
          .getChildren()
          .find(
            (node) =>
              node.getType() === 'paragraph' && node.getTextContent() === 'Keep this paragraph',
          );
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('B manual paragraph is missing');
        text.setTextContent('Keep this paragraph from peer B');
      },
      { discrete: true },
    );
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('Keep this paragraph from peer B');

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const paragraph = $getRoot()
          .getChildren()
          .find(
            (node) => node.getType() === 'paragraph' && node.getTextContent() === 'Human paragraph',
          );
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('A manual paragraph is missing');
        text.setTextContent('Human paragraph with one manual input');
      },
      { discrete: true },
    );
    await new Promise((resolve) => setTimeout(resolve, 650));
    await moment();

    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);

    browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();

    // Undo belongs to A's browser origin only: it removes A's paragraph edit,
    // while preserving both the Agent's replacements and B's remote edit.
    expect(getParagraphText(browserA.kernel, 'Human paragraph')).toBe('Human paragraph');
    expect(getParagraphText(browserA.kernel, 'Keep this paragraph')).toBe(
      'Keep this paragraph from peer B',
    );
    expect(browserA.kernel.getDocument('markdown')).toContain('Keep this paragraph from peer B');
    expect(browserA.kernel.getDocument('markdown')).toContain('Human paragraph');
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);
    expect(JSON.stringify(projection(browserA.kernel))).toContain('Updated artifact');
    expect(JSON.stringify(projection(browserA.kernel))).toContain(codeReplacement);

    browserAEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain(
      'Human paragraph with one manual input',
    );
    expect(browserA.kernel.getDocument('markdown')).toContain('Keep this paragraph from peer B');
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(JSON.stringify(projection(browserA.kernel))).toContain('Updated artifact');
    expect(JSON.stringify(projection(browserA.kernel))).toContain(codeReplacement);

    const agentProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    expect(JSON.stringify(agentProjection.editorData)).toContain('Updated artifact');
    expect(JSON.stringify(agentProjection.editorData)).toContain(codeReplacement);
    expect(agentProjection.markdown).toContain('Keep this paragraph from peer B');
  });

  it('keeps an after-boundary Enter paragraph stable across Agent updates and browser Undo/Redo', async () => {
    const seed = await seedDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);

    const agentDoc = new Doc();
    const browserADoc = new Doc();
    const browserBDoc = new Doc();
    docs.push(agentDoc, browserADoc, browserBDoc);
    const agentProvider = new MockProvider(room, agentDoc);
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-enter-undo',
      provider: agentProvider,
      requestId: 'agent-enter-undo-request',
      roomId: 'agent-enter-undo',
      ticket: 'test-ticket',
      yjsDoc: agentDoc,
    });
    agents.push(agent);
    await agent.connect();

    const browserA = createBrowser(room, browserADoc);
    const browserB = createBrowser(room, browserBDoc);
    kernels.push(browserA.kernel, browserB.kernel);
    browserA.provider.connect();
    browserB.provider.connect();
    await Promise.all([browserA.provider.waitForSync(), browserB.provider.waitForSync()]);
    await moment();
    await moment();
    const browserAPublishedBaseline = browserA.provider.publishedUpdates;
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);
    expect(countType(browserB.kernel, 'artifact')).toBe(1);
    expect(countArtifactsUnderParagraph(browserB.kernel)).toBe(0);
    expectPersistedArtifactShape(browserB.kernel);

    const initialCode = agent.resolveBlockRewriteTarget({
      adapterId: 'codemirror',
      nodeId: 'agent-undo-code',
      sourceHash: hashRewriteText(seed.codeSource),
    });
    expect(initialCode?.source).toBe(seed.codeSource);
    const artifactReplacement =
      '<!doctype html><html><head><title>Agent artifact</title></head><body><main>Agent artifact</main></body></html>';
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(seed.artifactSource),
        generationId: 'enter-artifact-generation',
        nodeId: 'agent-undo-artifact',
        output: { kind: 'source', source: artifactReplacement },
        requestId: 'agent-enter-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText(seed.codeSource),
        generationId: 'enter-code-generation',
        nodeId: 'agent-undo-code',
        output: { kind: 'source', language: 'rust', source: 'fn sentinel() { 1 }' },
        requestId: 'agent-enter-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    await moment();
    expect(browserA.provider.publishedUpdates).toBe(browserAPublishedBaseline);

    selectAfterArtifactBoundary(browserA.kernel);
    const enterEvent = { preventDefault: () => undefined } as unknown as KeyboardEvent;
    expect(browserA.kernel.getLexicalEditor()!.dispatchCommand(KEY_ENTER_COMMAND, enterEvent)).toBe(
      true,
    );
    await moment();
    expect(rootTypes(browserA.kernel)).toEqual([
      'paragraph',
      'hole',
      'paragraph',
      'hole',
      'paragraph',
    ]);
    expectCodeHoleAt(browserA.kernel, 3);
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);

    // This is a genuine browser edit after Enter. Leave the Enter paragraph as
    // its own history item so one Undo removes only this text, not the card
    // boundary itself.
    browserA.kernel.getLexicalEditor()!.update(
      () => {
        const paragraph = $getRoot().getChildren()[2];
        if (!$isElementNode(paragraph)) throw new Error('Enter paragraph missing.');
        paragraph.append($createTextNode('manual boundary note'));
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await new Promise((resolve) => setTimeout(resolve, 650));

    const nextCode = 'fn sentinel() { 2 }';
    const currentCode = agent.resolveBlockRewriteTarget({
      adapterId: 'codemirror',
      nodeId: 'agent-undo-code',
      sourceHash: hashRewriteText('fn sentinel() { 1 }'),
    });
    expect(currentCode?.source).toBe('fn sentinel() { 1 }');
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText('fn sentinel() { 1 }'),
        generationId: 'enter-code-generation-2',
        nodeId: 'agent-undo-code',
        output: { kind: 'source', language: 'rust', source: nextCode },
        requestId: 'agent-enter-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    await moment();

    const persistedEcho = await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    const browserService = browserA.kernel.requireService(IYjsService);
    expect(browserService?.applyExternalEditorData(persistedEcho.editorData as never)).toBe(false);

    // A remote peer edit arrives after the Agent update. A's Undo must not
    // consume either this peer transaction or the Agent's code replacement.
    browserB.kernel.getLexicalEditor()!.update(
      () => {
        const paragraph = $getRoot().getChildren()[4];
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('B sentinel paragraph missing.');
        text.setTextContent('peer B sentinel');
      },
      { discrete: true },
    );
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('peer B sentinel');

    browserA.kernel.getLexicalEditor()!.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(rootTypes(browserA.kernel)).toEqual([
      'paragraph',
      'hole',
      'paragraph',
      'hole',
      'paragraph',
    ]);
    expectCodeHoleAt(browserA.kernel, 3);
    expect(browserA.kernel.getDocument('markdown')).not.toContain('manual boundary note');
    expect(browserA.kernel.getDocument('markdown')).toContain('peer B sentinel');
    expect(JSON.stringify(projection(browserA.kernel))).toContain(artifactReplacement);
    expect(JSON.stringify(projection(browserA.kernel))).toContain(nextCode);
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);

    browserA.kernel.getLexicalEditor()!.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('manual boundary note');
    expect(browserA.kernel.getDocument('markdown')).toContain('peer B sentinel');
    expect(JSON.stringify(projection(browserA.kernel))).toContain(artifactReplacement);
    expect(JSON.stringify(projection(browserA.kernel))).toContain(nextCode);
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countArtifactsUnderParagraph(browserA.kernel)).toBe(0);
    expectPersistedArtifactShape(browserA.kernel);

    const agentProjection = await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    expect(JSON.stringify(agentProjection.editorData)).toContain(artifactReplacement);
    expect(JSON.stringify(agentProjection.editorData)).toContain(nextCode);
    expect(agentProjection.markdown).toContain('peer B sentinel');
  });

  it('does not let Undo after a locally inserted Code block remove that block after a remote Agent rewrite', async () => {
    const seed = await seedLegacyArtifactOnlyDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);

    const agentDoc = new Doc();
    const browserADoc = new Doc();
    const browserBDoc = new Doc();
    docs.push(agentDoc, browserADoc, browserBDoc);
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-enter-code-undo',
      provider: new MockProvider(room, agentDoc),
      requestId: 'agent-enter-code-undo-request',
      roomId: 'agent-enter-code-undo',
      ticket: 'test-ticket',
      yjsDoc: agentDoc,
    });
    agents.push(agent);
    await agent.connect();

    const browserA = createBrowser(room, browserADoc);
    const browserB = createBrowser(room, browserBDoc);
    kernels.push(browserA.kernel, browserB.kernel);
    browserA.provider.connect();
    browserB.provider.connect();
    await Promise.all([browserA.provider.waitForSync(), browserB.provider.waitForSync()]);
    await moment();
    await moment();
    expect(rootTypes(browserA.kernel)).toEqual(['paragraph', 'hole', 'paragraph']);
    expect(rootTypes(browserB.kernel)).toEqual(['paragraph', 'hole', 'paragraph']);

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Artifact Hole missing before local code insert.');
        const root = $getRoot();
        const selection = $createRangeSelection();
        const offset = hole.getIndexWithinParent() + 1;
        selection.anchor.set(root.getKey(), offset, 'element');
        selection.focus.set(root.getKey(), offset, 'element');
        $setSelection(selection);
      },
      { discrete: true },
    );
    expect(browserAEditor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined)).toBe(true);
    await moment();
    for (const text of ['c', 'const local = 1;']) {
      browserAEditor.update(
        () => {
          const code = $nodesOfType(CodeMirrorNode)[0];
          if (!code) throw new Error('Local CodeMirror node missing.');
          code.setCode(text);
          $setNodeProperties(code, { nodeId: 'agent-enter-code' });
        },
        { discrete: true },
      );
      await moment();
    }
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countType(browserB.kernel, 'code')).toBe(1);

    const codeTarget = agent.resolveBlockRewriteTarget({
      adapterId: 'codemirror',
      nodeId: 'agent-enter-code',
      sourceHash: hashRewriteText('const local = 1;'),
    });
    expect(codeTarget?.source).toBe('const local = 1;');
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText('const local = 1;'),
        generationId: 'agent-enter-code-generation',
        nodeId: 'agent-enter-code',
        output: { kind: 'source', language: 'rust', source: 'fn rewritten() {}' },
        requestId: 'agent-enter-code-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    const persistedEcho = await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    const browserService = browserA.kernel.requireService(IYjsService);
    expect(browserService?.applyExternalEditorData(persistedEcho.editorData as never)).toBe(false);
    // Match the real Page timing: the user may leave the locally inserted
    // Code block for seconds while the Agent is working before pressing Enter.
    await new Promise((resolve) => setTimeout(resolve, 2_100));

    selectRootPointAfterArtifact(browserA.kernel);
    const enterEvent = { preventDefault: () => undefined } as unknown as KeyboardEvent;
    expect(browserAEditor.dispatchCommand(KEY_ENTER_COMMAND, enterEvent)).toBe(true);
    await moment();
    expect(rootTypes(browserA.kernel)).toEqual([
      'paragraph',
      'hole',
      'paragraph',
      'hole',
      'paragraph',
    ]);
    expectCodeHoleAt(browserA.kernel, 3);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(countType(browserB.kernel, 'code')).toBe(1);
    expect(JSON.stringify(projection(browserB.kernel))).toContain('fn rewritten() {}');
    const persistedAfterEnter =
      await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    expect(JSON.stringify(persistedAfterEnter.editorData)).toContain('fn rewritten() {}');

    browserAEditor.update(
      () => {
        const paragraph = $getRoot().getChildren()[2];
        if (!$isElementNode(paragraph)) throw new Error('Boundary paragraph missing.');
        paragraph.append($createTextNode('BOUNDARY_OWN'));
      },
      { discrete: true },
    );
    await moment();

    browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    // The immediate Enter + typing may share one local Undo item; the
    // invariant is that the Agent-rewritten Code node survives that item.
    expect(rootTypes(browserA.kernel)).toEqual(['paragraph', 'hole', 'hole', 'paragraph']);
    expectCodeHoleAt(browserA.kernel, 2);
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(JSON.stringify(projection(browserA.kernel))).toContain('fn rewritten() {}');

    // The committed Yjs tree is the source of truth for Page persistence and
    // for every peer.  DOM-only reachability is insufficient here: the
    // previous regression left Code rendered in browser A while Undo had
    // already removed it from the shared Yjs document and browser B.
    const browserARaw = rawYjsReachableTypes(
      browserA.kernel.requireService(IYjsService)?.getState()?.binding.root.getSharedType(),
    );
    expect(JSON.stringify(browserARaw)).toContain('"type":"code"');
    expect(JSON.stringify(projection(browserB.kernel))).toContain('fn rewritten() {}');
    const persistedAfterUndo =
      await __exportCollaborativeAgentEditorProjectionForPersistence(agent);
    expect(JSON.stringify(persistedAfterUndo.editorData)).toContain('fn rewritten() {}');

    browserAEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(rootTypes(browserA.kernel)).toEqual([
      'paragraph',
      'hole',
      'paragraph',
      'hole',
      'paragraph',
    ]);
    expectCodeHoleAt(browserA.kernel, 3);
    expect(countType(browserA.kernel, 'artifact')).toBe(1);
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(browserA.kernel.getDocument('markdown')).toContain('BOUNDARY\\_OWN');
  });

  it('observes repeated Undo through the local Code insertion after an Agent rewrite', async () => {
    const seed = await seedLegacyArtifactOnlyDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);

    const agentDoc = new Doc();
    const browserDoc = new Doc();
    docs.push(agentDoc, browserDoc);
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-repeat-undo',
      provider: new MockProvider(room, agentDoc),
      requestId: 'agent-repeat-undo-request',
      roomId: 'agent-repeat-undo',
      ticket: 'test-ticket',
      yjsDoc: agentDoc,
    });
    agents.push(agent);
    await agent.connect();

    const browserA = createBrowser(room, browserDoc, true);
    kernels.push(browserA.kernel);
    browserA.provider.connect();
    await browserA.provider.waitForSync();
    await moment();
    await moment();

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Artifact Hole missing before local code insert.');
        const root = $getRoot();
        const selection = $createRangeSelection();
        const offset = hole.getIndexWithinParent() + 1;
        selection.anchor.set(root.getKey(), offset, 'element');
        selection.focus.set(root.getKey(), offset, 'element');
        $setSelection(selection);
      },
      { discrete: true },
    );
    expect(browserAEditor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined)).toBe(true);
    await moment();
    browserAEditor.update(
      () => {
        const code = $nodesOfType(CodeMirrorNode)[0];
        if (!code) throw new Error('Local CodeMirror node missing.');
        code.setCode('const local = 1;');
        $setNodeProperties(code, { nodeId: 'agent-repeat-undo-code' });
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();

    const codeTarget = agent.resolveBlockRewriteTarget({
      adapterId: 'codemirror',
      nodeId: 'agent-repeat-undo-code',
      sourceHash: hashRewriteText('const local = 1;'),
    });
    expect(codeTarget?.source).toBe('const local = 1;');
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText('const local = 1;'),
        generationId: 'agent-repeat-undo-generation',
        nodeId: 'agent-repeat-undo-code',
        output: { kind: 'source', language: 'rust', source: 'fn rewritten() {}' },
        requestId: 'agent-repeat-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    await moment();
    expect(JSON.stringify(projection(browserA.kernel))).toContain('fn rewritten() {}');

    browserAEditor.update(
      () => {
        const code = $nodesOfType(CodeMirrorNode)[0];
        if (!code) throw new Error('CodeMirror node missing for post-Agent local edit.');
        code.setCode('const local after agent = true;');
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    const secondCodeTarget = agent.resolveBlockRewriteTarget({
      adapterId: 'codemirror',
      nodeId: 'agent-repeat-undo-code',
      sourceHash: hashRewriteText('const local after agent = true;'),
    });
    expect(secondCodeTarget?.source).toBe('const local after agent = true;');
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText('const local after agent = true;'),
        generationId: 'agent-repeat-undo-generation-2',
        nodeId: 'agent-repeat-undo-code',
        output: { kind: 'source', language: 'rust', source: 'fn rewritten second() {}' },
        requestId: 'agent-repeat-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    await moment();

    const undoObservations: Array<{
      code: string[];
      codeCount: number;
      codeHole: boolean;
      handled: boolean;
      hasAgentRewrite: boolean;
      root: string[];
    }> = [];
    for (let index = 0; index < 8; index += 1) {
      const handled = browserAEditor.dispatchCommand(KEY_DOWN_COMMAND, createUndoKeyEvent());
      await moment();
      await moment();
      const code = browserAEditor
        .getEditorState()
        .read(() => $nodesOfType(CodeMirrorNode).map((node) => node.code));
      undoObservations.push({
        code,
        codeCount: countType(browserA.kernel, 'code'),
        codeHole: isCodeHoleAt(browserA.kernel, 2),
        handled,
        hasAgentRewrite: JSON.stringify(projection(browserA.kernel)).includes(
          'fn rewritten second() {}',
        ),
        root: rootTypes(browserA.kernel),
      });
      if (!handled || undoObservations.at(-1)?.codeCount === 0) break;
    }
    // Each Undo consumes a local stack item, but a structural item containing
    // the Agent rewrite is a deliberate no-op. The container and foreign
    // source must survive every attempted local Undo.
    expect(undoObservations.length).toBeGreaterThanOrEqual(2);
    expect(undoObservations[0]).toMatchObject({
      code: ['fn rewritten second() {}'],
      codeCount: 1,
      codeHole: true,
      handled: true,
      hasAgentRewrite: true,
      root: ['paragraph', 'hole', 'hole', 'paragraph'],
    });
    expect(undoObservations[1]).toMatchObject(undoObservations[0]);
    browserAEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expect(JSON.stringify(projection(browserA.kernel))).toContain('fn rewritten second() {}');
  });

  it('observes repeated Undo through the local Artifact insertion after an Agent rewrite', async () => {
    const seed = await seedLegacyArtifactOnlyDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);

    const agentDoc = new Doc();
    const browserDoc = new Doc();
    docs.push(agentDoc, browserDoc);
    const agent = __createCollaborativeAgentEditorForTesting({
      documentId: 'agent-repeat-artifact-undo',
      provider: new MockProvider(room, agentDoc),
      requestId: 'agent-repeat-artifact-undo-request',
      roomId: 'agent-repeat-artifact-undo',
      ticket: 'test-ticket',
      yjsDoc: agentDoc,
    });
    agents.push(agent);
    await agent.connect();

    const browserA = createBrowser(room, browserDoc);
    kernels.push(browserA.kernel);
    browserA.provider.connect();
    await browserA.provider.waitForSync();
    await moment();
    await moment();

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Artifact Hole missing before local Artifact insert.');
        const root = $getRoot();
        const selection = $createRangeSelection();
        const offset = hole.getIndexWithinParent() + 1;
        selection.anchor.set(root.getKey(), offset, 'element');
        selection.focus.set(root.getKey(), offset, 'element');
        $setSelection(selection);
      },
      { discrete: true },
    );
    const localArtifactSource = '<main>local artifact</main>';
    expect(
      browserAEditor.dispatchCommand(INSERT_ARTIFACT_COMMAND, {
        html: localArtifactSource,
        title: 'Local artifact',
      }),
    ).toBe(true);
    await moment();
    browserAEditor.update(
      () => {
        const artifact = $nodesOfType(ArtifactNode).find(
          (node) => node.getHtml() === localArtifactSource,
        );
        if (!artifact) throw new Error('Local Artifact node missing.');
        $setNodeProperties(artifact, { nodeId: 'agent-repeat-artifact-undo-node' });
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();

    const artifactTarget = agent.resolveBlockRewriteTarget({
      adapterId: 'artifact',
      nodeId: 'agent-repeat-artifact-undo-node',
      sourceHash: hashRewriteText(localArtifactSource),
    });
    expect(artifactTarget?.source).toBe(localArtifactSource);
    const rewrittenArtifactSource = '<main>Agent rewritten artifact</main>';
    await expect(
      agent.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(localArtifactSource),
        generationId: 'agent-repeat-artifact-undo-generation',
        nodeId: 'agent-repeat-artifact-undo-node',
        output: { kind: 'source', source: rewrittenArtifactSource },
        requestId: 'agent-repeat-artifact-undo-request',
      }),
    ).resolves.toMatchObject({ status: 'diff-created' });
    await moment();
    await moment();
    expect(JSON.stringify(projection(browserA.kernel))).toContain(rewrittenArtifactSource);

    const undoObservations: Array<{
      artifact: string[];
      artifactCount: number;
      handled: boolean;
      hasAgentRewrite: boolean;
    }> = [];
    for (let index = 0; index < 8; index += 1) {
      const handled = browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
      await moment();
      await moment();
      const artifact = browserAEditor
        .getEditorState()
        .read(() => $nodesOfType(ArtifactNode).map((node) => node.getHtml()));
      const hasAgentRewrite = artifact.includes(rewrittenArtifactSource);
      undoObservations.push({
        artifact,
        artifactCount: countType(browserA.kernel, 'artifact'),
        handled,
        hasAgentRewrite,
      });
      if (!handled || !hasAgentRewrite) break;
    }
    // Artifact follows the same conservative structural boundary as Code.
    expect(undoObservations.length).toBeGreaterThanOrEqual(2);
    expect(undoObservations[0]).toMatchObject({
      artifactCount: 2,
      handled: true,
      hasAgentRewrite: true,
    });
    expect(undoObservations[1]).toMatchObject(undoObservations[0]);
    browserAEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    expect(countType(browserA.kernel, 'artifact')).toBe(2);
    expect(JSON.stringify(projection(browserA.kernel))).toContain(rewrittenArtifactSource);
  });

  it('still undoes an untouched local Code container', async () => {
    const seed = await seedLegacyArtifactOnlyDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);
    const browserDoc = new Doc();
    docs.push(browserDoc);
    const browserA = createBrowser(room, browserDoc);
    kernels.push(browserA.kernel);
    browserA.provider.connect();
    await browserA.provider.waitForSync();
    await moment();
    await moment();

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Artifact Hole missing before local Code insert.');
        const root = $getRoot();
        const selection = $createRangeSelection();
        const offset = hole.getIndexWithinParent() + 1;
        selection.anchor.set(root.getKey(), offset, 'element');
        selection.focus.set(root.getKey(), offset, 'element');
        $setSelection(selection);
      },
      { discrete: true },
    );
    expect(browserAEditor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined)).toBe(true);
    await moment();
    browserAEditor.update(
      () => {
        const code = $nodesOfType(CodeMirrorNode)[0];
        if (!code) throw new Error('Local CodeMirror node missing.');
        code.setCode('const untouched = true;');
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    expect(countType(browserA.kernel, 'code')).toBe(1);

    let undoCount = 0;
    while (countType(browserA.kernel, 'code') > 0 && undoCount < 8) {
      browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
      await moment();
      await moment();
      undoCount += 1;
    }
    expect(undoCount).toBeGreaterThan(0);
    expect(countType(browserA.kernel, 'code')).toBe(0);
    expect(countType(browserA.kernel, 'artifact')).toBe(1);

    expect(browserA.kernel.getDocument('markdown')).not.toContain('const untouched = true;');
  });

  it('compares terminal Code Hole reachability between Lexical and raw Yjs after insertion', async () => {
    const seed = await seedLegacyArtifactOnlyDocument(false);
    const room = new MockRoom(seed.update);
    rooms.push(room);
    const browserDoc = new Doc();
    docs.push(browserDoc);
    const browserA = createBrowser(room, browserDoc);
    kernels.push(browserA.kernel);
    browserA.provider.connect();
    await browserA.provider.waitForSync();
    await moment();
    await moment();

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const hole = $nodesOfType(HoleNode)[0];
        if (!hole) throw new Error('Artifact Hole missing before raw-tree Code insert.');
        const root = $getRoot();
        const selection = $createRangeSelection();
        const offset = hole.getIndexWithinParent() + 1;
        selection.anchor.set(root.getKey(), offset, 'element');
        selection.focus.set(root.getKey(), offset, 'element');
        $setSelection(selection);
      },
      { discrete: true },
    );
    expect(browserAEditor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined)).toBe(true);
    await moment();
    await moment();

    const state = browserA.kernel.requireService(IYjsService)?.getState();
    if (!state) throw new Error('Yjs state missing after Code insertion.');
    const lexical = rootTypes(browserA.kernel);
    const raw = rawYjsReachableTypes(state.binding.root.getSharedType());
    const rawChildren = (raw as { children?: unknown[] }).children;
    expect(lexical).toContain('hole');
    expect(countType(browserA.kernel, 'code')).toBe(1);
    expectTerminalCodeHoleAt(browserA.kernel, 2);
    expect(rawChildren).toHaveLength(lexical.length);
    expect(rawChildren?.at(-1)).toMatchObject({ type: 'hole' });
    expect(JSON.stringify(rawChildren?.at(-1))).toContain('"type":"code"');
  });

  it('protects a local paragraph changed by a peer and leaves explicit Delete undoable', async () => {
    const seed = await seedLegacyArtifactOnlyDocument();
    const room = new MockRoom(seed.update);
    rooms.push(room);
    const browserADoc = new Doc();
    const browserBDoc = new Doc();
    docs.push(browserADoc, browserBDoc);
    const browserA = createBrowser(room, browserADoc);
    const browserB = createBrowser(room, browserBDoc);
    kernels.push(browserA.kernel, browserB.kernel);
    browserA.provider.connect();
    browserB.provider.connect();
    await Promise.all([browserA.provider.waitForSync(), browserB.provider.waitForSync()]);
    await moment();
    await moment();

    const browserAEditor = browserA.kernel.getLexicalEditor()!;
    browserAEditor.update(
      () => {
        const paragraph = $getRoot()
          .getChildren()
          .find((node) => $isElementNode(node) && node.getTextContent() === 'Human paragraph');
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('Older local paragraph missing.');
        text.setTextContent('Human paragraph older local');
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    await moment();

    browserAEditor.update(
      () => {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('local paragraph'));
        $getRoot().append(paragraph);
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    await moment();

    const browserBEditor = browserB.kernel.getLexicalEditor()!;
    browserBEditor.update(
      () => {
        const paragraph = $getRoot()
          .getChildren()
          .find((node) => $isElementNode(node) && node.getTextContent() === 'local paragraph');
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('Local paragraph missing on peer B.');
        text.setTextContent('remote paragraph');
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('remote paragraph');

    // Undoing the local paragraph insertion is a no-op once its text carries
    // a later peer edit; the peer text and its container remain intact.
    browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('remote paragraph');
    expect(browserA.kernel.getDocument('markdown')).toContain('Human paragraph older local');

    // The protected top item is consumed alone. A second Undo may now reach
    // the older local text edit, proving the first command did not fall
    // through Yjs's internal while-loop.
    browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('Human paragraph');
    expect(browserA.kernel.getDocument('markdown')).not.toContain('older local');

    // A deliberate Delete is not filtered by the insertion guard. Its own
    // Undo must restore the peer-edited paragraph.
    browserAEditor.update(
      () => {
        const paragraph = $getRoot()
          .getChildren()
          .find((node) => $isElementNode(node) && node.getTextContent() === 'remote paragraph');
        paragraph?.remove();
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    expect(browserA.kernel.getDocument('markdown')).not.toContain('remote paragraph');
    browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('remote paragraph');

    // With no intervening foreign edit, the explicit Delete remains fully
    // redoable. Undo it again to set up the symmetric foreign-Redo case.
    browserAEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).not.toContain('remote paragraph');
    browserAEditor.dispatchCommand(UNDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('remote paragraph');

    browserBEditor.update(
      () => {
        const paragraph = $getRoot()
          .getChildren()
          .find((node) => $isElementNode(node) && node.getTextContent() === 'remote paragraph');
        const text = paragraph && $isElementNode(paragraph) ? paragraph.getFirstDescendant() : null;
        if (!$isTextNode(text)) throw new Error('Restored paragraph missing on peer B.');
        text.setTextContent('remote after undo');
      },
      { discrete: true, tag: HISTORY_PUSH_TAG },
    );
    await moment();
    await moment();
    browserAEditor.dispatchCommand(REDO_COMMAND, undefined);
    await moment();
    await moment();
    expect(browserA.kernel.getDocument('markdown')).toContain('remote after undo');
  });
});
