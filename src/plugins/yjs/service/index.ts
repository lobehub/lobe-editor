import { type Binding, type Provider, type UserState } from '@lexical/yjs';
import { SKIP_COLLAB_TAG } from 'lexical';
import type { Doc } from 'yjs';

import { projectRuntimeHolesForJSON } from '@/plugins/common/data-source/json-data-source';
import type { IServiceID } from '@/types';

import { createEmptyPreviousEditorState } from '../plugin/utils/editor-state';
import { hydrateLexicalFromYjsState, syncCurrentEditorStateToYjs } from '../plugin/utils/sync';

export interface YjsAwarenessUser {
  clientId: number;
  state: UserState;
}

export interface YjsPluginState {
  binding: Binding;
  doc: Doc | undefined;
  docMap: Map<string, Doc>;
  id: string;
  provider: Provider;
}

type YjsPluginStateListener = (state: YjsPluginState | null) => void;
type YjsAwarenessUsersListener = (users: YjsAwarenessUser[]) => void;
type YjsReadinessListener = (ready: boolean) => void;

/**
 * `getDocument('json')` includes each Lexical runtime node key as `id`. Those
 * keys are intentionally local to one editor instance: the Agent and every
 * browser peer deserialize the same Yjs tree with different keys. Comparing
 * them makes the server's post-write echo look like a new document and causes
 * `applyExternalEditorData` to replace the shared root a second time. That
 * second replacement disconnects the existing binding history from later
 * remote edits, so a browser Undo can consume another peer's change.
 *
 * Keep durable node properties (for example `$.properties.nodeId`) and nested
 * payload data intact; only an `id` on a serialized Lexical node is runtime
 * identity.
 */
const cloneComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneComparableValue);
  if (!value || typeof value !== 'object') return value;

  const cloned: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) cloned[key] = cloneComparableValue(child);
  return cloned;
};

/** Remove runtime ids only while walking the serialized Lexical node tree. */
const normalizeComparableLexicalNode = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeComparableLexicalNode);
  if (!value || typeof value !== 'object') return cloneComparableValue(value);

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'id') continue;
    // `children` on a serialized Lexical node is the only place where nested
    // `id` fields are known to be runtime node keys. Business payloads may
    // themselves contain `{ id, type }` objects and must remain byte-stable.
    normalized[key] =
      key === 'children' && Array.isArray(child)
        ? child.map(normalizeComparableLexicalNode)
        : cloneComparableValue(child);
  }
  return normalized;
};

const normalizeComparableEditorData = (value: unknown): unknown => {
  const cloned = cloneComparableValue(value) as Record<string, unknown> | null;
  if (!cloned || typeof cloned !== 'object') return cloned;
  if (cloned.root && typeof cloned.root === 'object') {
    cloned.root = normalizeComparableLexicalNode(cloned.root);
  }
  return cloned;
};

const serializeComparableEditorState = (state: { toJSON: () => unknown }): string => {
  const serialized = normalizeComparableEditorData(state.toJSON()) as {
    root?: { direction?: string | null; [key: string]: unknown };
  };

  // Artifact/code blocks are represented by an internal Hole with boundary
  // Cursor nodes in a live Yjs binding, while persisted editorData projects
  // that runtime wrapper away. Compare the public projection on both sides so
  // a server echo does not look like a second structural replacement.
  if (serialized.root && Array.isArray(serialized.root.children)) {
    const [projectedRoot] = projectRuntimeHolesForJSON(serialized.root as never);
    if (projectedRoot) serialized.root = projectedRoot as typeof serialized.root;
  }

  // Lexical's root direction is a local default and is not represented by the
  // v1 Yjs binding. Treat the default `ltr` and hydrated `null` as equivalent;
  // meaningful RTL snapshots still produce a diff.
  if (serialized.root?.direction === 'ltr') serialized.root.direction = null;

  return JSON.stringify(serialized);
};

export class YjsService {
  private awarenessUsers: YjsAwarenessUser[] = [];
  private awarenessUsersListeners = new Set<YjsAwarenessUsersListener>();
  private listeners = new Set<YjsPluginStateListener>();
  private readinessListeners = new Set<YjsReadinessListener>();
  private ready = false;
  private state: YjsPluginState | null = null;

  getAwarenessUsers(): YjsAwarenessUser[] {
    return this.awarenessUsers;
  }

  getState(): YjsPluginState | null {
    return this.state;
  }

  /**
   * Whether the current binding has completed its initial room snapshot.
   * This is a binding lifecycle signal, not transport authentication or edit
   * permission; it remains true through transient reconnects and resets when
   * the provider replaces the document/binding.
   */
  isReady(): boolean {
    return this.state !== null && this.ready;
  }

  /**
   * Apply a server-produced editor snapshot to the shared document exactly once.
   *
   * A normal `IEditor.setDocument` call replaces the local Lexical state without
   * knowing about the Yjs binding. When the binding sees that state it can treat
   * every imported node as a new local node and append a second copy to the
   * shared tree. This path first hydrates from the shared tree, then applies the
   * snapshot with the collaboration-skip tag and replaces the shared root in a
   * single Yjs transaction. A second client receiving the same snapshot
   * therefore becomes a no-op.
   *
   * @returns whether the shared document was changed
   */
  applyExternalEditorData(editorData: Record<string, unknown>): boolean {
    const state = this.state;
    if (!state) return false;

    const { binding, provider } = state;
    const hasSharedState = !binding.root.isEmpty() || binding.root._xmlText._length > 0;

    if (hasSharedState && binding.root.isEmpty()) {
      // The tree observer normally performs this step for remote updates. The
      // explicit hydration is required here because a server snapshot can be
      // delivered before the observer callback while this client still has no
      // Yjs node mapping. Never feed a complete `toDelta()` into a populated
      // binding; that would append duplicate children.
      // A server snapshot is applied synchronously by the runtime. Use a
      // discrete Lexical update so the shared state is visible before the
      // target snapshot is compared or diffed.
      hydrateLexicalFromYjsState(binding, { discrete: true });
    }

    const previousEditorState = binding.editor.getEditorState();
    const nextEditorState = binding.editor.parseEditorState(JSON.stringify(editorData));
    const isSameState =
      serializeComparableEditorState(previousEditorState) ===
      serializeComparableEditorState(nextEditorState);

    if (hasSharedState && isSameState) {
      return false;
    }

    binding.editor.setEditorState(nextEditorState, { tag: SKIP_COLLAB_TAG });

    const replaceSharedState = () => {
      const collabRoot = binding.root as Binding['root'] & { _children: unknown[] };
      const sharedType = binding.root.getSharedType();
      if (sharedType.length > 0) sharedType.delete(0, sharedType.length);

      // The complete server snapshot replaces the shared tree. Reset the
      // binding map before syncing from an empty previous state; otherwise
      // Lexical node keys from the imported tree can be treated as inserts.
      collabRoot._children.length = 0;
      binding.collabNodeMap.clear();
      syncCurrentEditorStateToYjs(
        binding,
        provider,
        createEmptyPreviousEditorState(binding.editor),
      );
    };

    // Nested Yjs transactions join the outer transaction, so remote clients
    // observe one replace update with the binding as its local origin.
    if (state.doc) {
      state.doc.transact(replaceSharedState, binding);
    } else {
      replaceSharedState();
    }

    return true;
  }

  setAwarenessUsers(users: YjsAwarenessUser[]): void {
    this.awarenessUsers = users;
    this.awarenessUsersListeners.forEach((listener) => listener(users));
  }

  setState(state: YjsPluginState | null): void {
    const readinessChanged = this.ready;
    this.state = state;
    this.ready = false;
    this.listeners.forEach((listener) => listener(state));
    if (readinessChanged) this.readinessListeners.forEach((listener) => listener(false));
  }

  /** Publish completion of the current binding's initial room snapshot. */
  setReady(ready: boolean): void {
    const nextReady = ready && this.state !== null;
    if (this.ready === nextReady) return;
    this.ready = nextReady;
    this.readinessListeners.forEach((listener) => listener(nextReady));
  }

  subscribeAwarenessUsers(listener: YjsAwarenessUsersListener): () => void {
    this.awarenessUsersListeners.add(listener);
    listener(this.awarenessUsers);

    return () => {
      this.awarenessUsersListeners.delete(listener);
    };
  }

  subscribe(listener: YjsPluginStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeReadiness(listener: YjsReadinessListener): () => void {
    this.readinessListeners.add(listener);
    listener(this.ready);

    return () => {
      this.readinessListeners.delete(listener);
    };
  }
}

export const IYjsService: IServiceID<YjsService> = {
  __serviceId: 'YjsService',
};
