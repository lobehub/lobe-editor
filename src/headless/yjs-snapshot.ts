import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import { applyUpdate, Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { YjsPlugin } from '@/plugins/yjs/plugin';
import { hydrateLexicalFromYjsState } from '@/plugins/yjs/plugin/utils/sync';
import { IYjsService } from '@/plugins/yjs/service';

import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from './default-plugins';
import { HeadlessEditor } from './headless-editor';

const stripMarkdownNodeIdMarkers = (markdown: string): string =>
  markdown.replaceAll(/^[ \t]*<!--\s*lobe-node-ids?:[^\n]*-->[ \t]*(?:\r?\n[ \t]*)*/gim, '');

/** The only data exposed by the room-persistence projection helper. */
export interface YjsSnapshotProjection {
  editorData: Record<string, unknown>;
  markdown: string;
}

export interface ExportYjsSnapshotProjectionInput {
  /** Room id is the v1 binding namespace, not a network endpoint. */
  roomId: string;
  /** A complete or incremental v1 Yjs update already assembled by the room. */
  update: Uint8Array;
}

/** The server-safe, immutable output of a JSON/Markdown room bootstrap. */
export interface ImmutableYjsSnapshot {
  revision: number;
  stateVector: Uint8Array;
  update: Uint8Array;
}

export interface CreateImmutableYjsSnapshotFromEditorDataInput {
  /** Legacy Markdown body used only for an empty persisted editorData value. */
  content?: string | null;
  /** Canonical Lexical JSON, or its persisted JSON string representation. */
  editorData?: unknown;
  revision: number;
  roomId: string;
}

type EditorDataRecord = Record<string, unknown>;
type SerializedEditorData = EditorDataRecord & {
  root: EditorDataRecord & { children: unknown[]; type: unknown };
};

const isEditorDataRecord = (value: unknown): value is EditorDataRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEmptyEditorData = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (isEditorDataRecord(value) && Object.keys(value).length === 0);

const isSerializedEditorData = (value: unknown): value is SerializedEditorData => {
  if (!isEditorDataRecord(value) || !isEditorDataRecord(value.root)) return false;

  return value.root.type === 'root' && Array.isArray(value.root.children);
};

const hasFallbackMarkdown = (content: string | null | undefined): content is string =>
  typeof content === 'string' && content.trim().length > 0;

// Lexical rejects a root with zero children. Keep the same minimal empty
// document shape used by the browser store so a newly-created Page can still
// produce a durable Yjs update before its first keystroke.
const EMPTY_EDITOR_DATA: EditorDataRecord = {
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: '',
        id: '42',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: null,
    format: '',
    id: 'root',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

const resolveEditorDataForBootstrap = (input: {
  content?: string | null;
  editorData?: unknown;
}): { kind: 'editorData'; value: EditorDataRecord } | { kind: 'markdown'; value: string } => {
  let editorData = input.editorData;

  if (typeof editorData === 'string') {
    if (editorData.trim().length === 0) {
      return hasFallbackMarkdown(input.content)
        ? { kind: 'markdown', value: input.content }
        : { kind: 'editorData', value: EMPTY_EDITOR_DATA };
    }

    try {
      editorData = JSON.parse(editorData) as unknown;
    } catch {
      throw new Error('Cannot bootstrap collaboration room: persisted editorData is malformed.');
    }
  }

  if (isEmptyEditorData(editorData)) {
    return hasFallbackMarkdown(input.content)
      ? { kind: 'markdown', value: input.content }
      : { kind: 'editorData', value: EMPTY_EDITOR_DATA };
  }
  if (isSerializedEditorData(editorData)) {
    return editorData.root.children.length > 0
      ? { kind: 'editorData', value: editorData }
      : { kind: 'editorData', value: EMPTY_EDITOR_DATA };
  }

  throw new Error('Cannot bootstrap collaboration room: persisted editorData is malformed.');
};

class ReadOnlyAwareness implements ProviderAwareness {
  getLocalState(): UserState | null {
    return null;
  }

  getStates(): Map<number, UserState> {
    return new Map();
  }

  off(): void {}

  on(): void {}

  setLocalState(): void {}

  setLocalStateField(): void {}
}

/**
 * A provider-shaped adapter for the binding's local sync helpers. It has no
 * transport and therefore cannot connect, send updates, or publish awareness.
 */
const createReadOnlyProvider = (): Provider =>
  ({
    awareness: new ReadOnlyAwareness(),
    connect: () => undefined,
    disconnect: () => undefined,
    off: () => undefined,
    on: () => undefined,
  }) as Provider;

/** A local-only provider used while constructing a durable bootstrap. */
const createBootstrapProvider = (): Provider => {
  const listeners = new Map<string, Set<(...args: never[]) => void>>();
  const emit = (event: string, ...args: unknown[]): void => {
    listeners.get(event)?.forEach((listener) => listener(...(args as never[])));
  };
  const awareness = new ReadOnlyAwareness();

  return {
    awareness,
    connect: () => {
      emit('status', { status: 'connected' });
      emit('sync', true);
    },
    disconnect: () => undefined,
    off: (event: string, listener: (...args: never[]) => void) => {
      listeners.get(event)?.delete(listener);
    },
    on: (event: string, listener: (...args: never[]) => void) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    },
  } as Provider;
};

const validateInput = ({ roomId, update }: ExportYjsSnapshotProjectionInput): void => {
  if (typeof roomId !== 'string' || roomId.trim().length === 0) {
    throw new Error('exportYjsSnapshotProjection requires a non-empty roomId.');
  }
  if (!(update instanceof Uint8Array)) {
    throw new Error('exportYjsSnapshotProjection requires a Uint8Array update.');
  }
};

/**
 * Export a room update through the same DOM-free binding and node set used by
 * a collaborative Headless Editor.
 *
 * This is intentionally a standalone persistence capability. It creates and
 * destroys all temporary state inside the call, never connects a provider,
 * never calls `setDocument`, and returns only editorData/markdown. Agent
 * workers do not receive a session or a raw Y.Doc through this API.
 */
export const exportYjsSnapshotProjection = async ({
  roomId,
  update,
}: ExportYjsSnapshotProjectionInput): Promise<YjsSnapshotProjection> => {
  validateInput({ roomId, update });

  const doc = new Doc();
  const docMap = new Map<string, Doc>([[roomId, doc]]);
  const provider = createReadOnlyProvider();
  const kernel = Editor.createEditor();
  let binding: ReturnType<typeof createBinding> | undefined;

  try {
    // The complete default set is required for Artifact/Table/Properties
    // nodes to round-trip exactly as they do in the live room.
    kernel.registerPlugins([...DEFAULT_HEADLESS_EDITOR_PLUGINS]);
    const lexicalEditor = kernel.initHeadlessEditor();
    if (!lexicalEditor) throw new Error('Failed to initialize the snapshot editor.');

    applyUpdate(doc, new Uint8Array(update));
    binding = createBinding(lexicalEditor, provider, roomId, doc, docMap);
    hydrateLexicalFromYjsState(binding, { discrete: true });
    await moment();

    return {
      editorData: kernel.getDocument('json') as unknown as Record<string, unknown>,
      markdown: stripMarkdownNodeIdMarkers(kernel.getDocument('markdown') as unknown as string),
    };
  } finally {
    binding?.root.destroy(binding);
    kernel.destroy();
    doc.destroy();
  }
};

/**
 * Convert a persisted editor projection into an immutable Yjs bootstrap.
 *
 * The temporary kernel, binding, provider, and Y.Doc are all private to this
 * call. Callers receive copied bytes only; no editor service, binding, or
 * mutable Y.Doc crosses the headless package boundary.
 */
export const createImmutableYjsSnapshotFromEditorData = async ({
  content,
  editorData,
  revision,
  roomId,
}: CreateImmutableYjsSnapshotFromEditorDataInput): Promise<ImmutableYjsSnapshot> => {
  if (typeof roomId !== 'string' || roomId.trim().length === 0) {
    throw new Error('createImmutableYjsSnapshotFromEditorData requires a non-empty roomId.');
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('createImmutableYjsSnapshotFromEditorData requires a non-negative revision.');
  }

  const body = resolveEditorDataForBootstrap({ content, editorData });
  const doc = new Doc();
  const provider = createBootstrapProvider();
  const yjsPlugin = [
    YjsPlugin,
    {
      id: roomId,
      providerFactory: () => provider,
      shouldBootstrap: true,
      yjsDoc: doc,
    },
  ];
  const editor = new HeadlessEditor({
    plugins: [...DEFAULT_HEADLESS_EDITOR_PLUGINS, yjsPlugin] as never,
  });

  try {
    if (body.kind === 'editorData') editor.hydrateEditorData(body.value as never);
    else editor.hydrateMarkdown(body.value);
    await moment();

    const state = editor.kernel.requireService(IYjsService)?.getState();
    if (state?.doc !== doc) {
      throw new Error('Room bootstrap did not initialize the expected Yjs document.');
    }

    return {
      revision,
      stateVector: new Uint8Array(encodeStateVector(doc)),
      update: new Uint8Array(encodeStateAsUpdate(doc)),
    };
  } finally {
    editor.destroy();
    doc.destroy();
  }
};
