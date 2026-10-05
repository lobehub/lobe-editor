import { $getNodeByKey, type EditorState, type LexicalEditor } from 'lexical';

import { $getActiveNodeId, $getActiveNodeIdKeys } from '@/plugins/common/node/node-id';
import {
  getNodeIdentityPolicyRevision,
  subscribeNodeIdentityPolicy,
} from '@/plugins/common/node/node-identity-policy';
import { createDebugLogger } from '@/utils/debug';

import type { INodeIdentityService, NodeIdentitySnapshot } from './i-node-identity-service';

const logger = createDebugLogger('service', 'node-identity');

/** Implementation owned by CommonPlugin; external callers use INodeIdentityService. */
export class NodeIdentityService implements INodeIdentityService {
  private editor: LexicalEditor | null = null;
  private indexes = new WeakMap<EditorState, { keys: Map<string, string>; revision: number }>();
  private listeners = new Set<() => void>();
  private bindingToken: object | null = null;
  private unregisterBinding: (() => void) | null = null;

  bindEditor(editor: LexicalEditor): () => void {
    this.unregisterBinding?.();
    const bindingToken = {};
    this.bindingToken = bindingToken;
    this.indexes = new WeakMap();
    this.editor = editor;
    const unregisterUpdate = editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      if (editorState !== prevEditorState) this.notify();
    });
    const unregisterPolicy = subscribeNodeIdentityPolicy(editor, () => this.notify());
    let active = true;
    const unregister = () => {
      if (!active) return;
      active = false;
      unregisterUpdate();
      unregisterPolicy();
    };
    this.unregisterBinding = unregister;
    return () => {
      unregister();
      if (this.bindingToken !== bindingToken) return;
      this.bindingToken = null;
      this.unregisterBinding = null;
      this.editor = null;
      this.indexes = new WeakMap();
      this.listeners.clear();
    };
  }

  getNodeById(nodeId: string): Readonly<NodeIdentitySnapshot> | null {
    if (typeof nodeId !== 'string' || !nodeId.trim()) return null;
    const editor = this.editor;
    if (!editor) return null;
    const editorState = editor.getEditorState();
    const revision = getNodeIdentityPolicyRevision(editor);
    let index = this.indexes.get(editorState);
    if (!index || index.revision !== revision) {
      index = {
        keys: editorState.read(() => $getActiveNodeIdKeys(), { editor }),
        revision,
      };
      this.indexes.set(editorState, index);
    }
    const key = index.keys.get(nodeId);
    if (!key) return null;
    return editorState.read(
      () => {
        const node = $getNodeByKey(key);
        const id = node && $getActiveNodeId(node);
        return node && id === nodeId
          ? Object.freeze({ id, textContent: node.getTextContent(), type: node.getType() })
          : null;
      },
      { editor },
    );
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        logger.error('Node identity subscriber failed:', error);
      }
    }
  }
}
