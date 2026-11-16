import { $getEditor, $isRootNode, type LexicalEditor, type LexicalNode } from 'lexical';

/**
 * A document format can decide which physical nodes represent one logical ID.
 * The common identity layer does not interpret review or document node types.
 */
export type NodeIdentityProjection =
  'container' | 'content' | 'hidden' | Readonly<{ childIndex: number }>;

export interface NodeIdentityPolicy {
  canShareId(left: LexicalNode, right: LexicalNode): boolean;
  /** Optional logical alias for active wrappers that must not persist nodeId. */
  getIdentityId?: (node: LexicalNode) => string | undefined;
  /** Classify one node for active lookup; hidden nodes still receive IDs in normalization. */
  project(node: LexicalNode): NodeIdentityProjection;
  isIdentityNode(node: LexicalNode): boolean;
}

const defaultPolicy: NodeIdentityPolicy = {
  canShareId: () => false,
  isIdentityNode: (node) =>
    !$isRootNode(node) && node.getType() !== 'hole' && node.getType() !== 'cursor',
  project: (node) =>
    $isRootNode(node) || node.getType() === 'hole' || node.getType() === 'cursor'
      ? 'container'
      : 'content',
};

const editorPolicies = new WeakMap<LexicalEditor, Array<{ policy: NodeIdentityPolicy }>>();
const policyRevisions = new WeakMap<LexicalEditor, number>();
const policyListeners = new WeakMap<LexicalEditor, Set<() => void>>();

export function subscribeNodeIdentityPolicy(
  editor: LexicalEditor,
  listener: () => void,
): () => void {
  const listeners = policyListeners.get(editor) || new Set<() => void>();
  listeners.add(listener);
  policyListeners.set(editor, listeners);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    listeners.delete(listener);
    if (listeners.size === 0 && policyListeners.get(editor) === listeners) {
      policyListeners.delete(editor);
    }
  };
}

export function getNodeIdentityPolicyRevision(editor: LexicalEditor): number {
  return policyRevisions.get(editor) || 0;
}

function bumpPolicyRevision(editor: LexicalEditor): void {
  policyRevisions.set(editor, getNodeIdentityPolicyRevision(editor) + 1);
  const listeners = Array.from(policyListeners.get(editor) || []);
  for (const listener of listeners) listener();
}

/** Register a document-format policy for one editor, with order-independent disposal. */
export function registerNodeIdentityPolicy(
  editor: LexicalEditor,
  policy: NodeIdentityPolicy,
): () => void {
  const entry = { policy };
  const registrations = editorPolicies.get(editor) || [];
  registrations.push(entry);
  editorPolicies.set(editor, registrations);
  bumpPolicyRevision(editor);

  return () => {
    const current = editorPolicies.get(editor);
    if (!current) return;
    const index = current.indexOf(entry);
    if (index >= 0) {
      current.splice(index, 1);
      bumpPolicyRevision(editor);
    }
    if (current.length === 0) editorPolicies.delete(editor);
  };
}

/**
 * Requires an editor-bound Lexical context. For an EditorState snapshot, pass
 * `{ editor }` to `state.read` so its document policy is unambiguous.
 */
export function $getNodeIdentityPolicy(): NodeIdentityPolicy {
  let editor: LexicalEditor;
  try {
    editor = $getEditor();
  } catch {
    throw new Error(
      'Node ID access requires editor.read/update or state.read(callback, { editor }).',
    );
  }
  return editorPolicies.get(editor)?.at(-1)?.policy || defaultPolicy;
}
