import { type Binding, type Provider, type UserState } from '@lexical/yjs';
import { SKIP_COLLAB_TAG } from 'lexical';
import type { Doc } from 'yjs';

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

const serializeComparableEditorState = (state: { toJSON: () => unknown }): string => {
  const serialized = state.toJSON() as {
    root?: { direction?: string | null };
  };

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
  private state: YjsPluginState | null = null;

  getAwarenessUsers(): YjsAwarenessUser[] {
    return this.awarenessUsers;
  }

  getState(): YjsPluginState | null {
    return this.state;
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
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
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
}

export const IYjsService: IServiceID<YjsService> = {
  __serviceId: 'YjsService',
};
