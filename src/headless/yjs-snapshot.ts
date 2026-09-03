import { createBinding, type Provider, type ProviderAwareness, type UserState } from '@lexical/yjs';
import { applyUpdate, Doc } from 'yjs';

import Editor, { moment } from '@/editor-kernel';
import { hydrateLexicalFromYjsState } from '@/plugins/yjs/plugin/utils/sync';

import { DEFAULT_HEADLESS_EDITOR_PLUGINS } from './default-plugins';

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
