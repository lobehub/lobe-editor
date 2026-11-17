import {
  $getNodeByKey,
  type EditorState,
  HISTORIC_TAG,
  type LexicalNode,
  type NodeKey,
} from 'lexical';

/** The parts of an update listener payload these helpers read. */
export interface UpdateScope {
  dirtyElements: Map<NodeKey, boolean>;
  dirtyLeaves: Set<NodeKey>;
  tags: Set<string>;
}

/**
 * True when the dirty sets do not say what changed. setEditorState() (document load, undo/redo)
 * only marks the root, and history restores carry HISTORIC_TAG; scan the whole document then.
 */
export function isWholeDocumentChange({ dirtyElements, dirtyLeaves, tags }: UpdateScope): boolean {
  return (
    tags.has(HISTORIC_TAG) ||
    (dirtyLeaves.size === 0 && dirtyElements.size === 1 && dirtyElements.has('root'))
  );
}

/**
 * Whether a node the update touched matches in `state`. Lexical also puts every ancestor of a
 * changed node into `dirtyElements`, so this covers "a change inside a matching node" too.
 */
export function someDirtyNode(
  state: EditorState,
  { dirtyElements, dirtyLeaves }: UpdateScope,
  matches: (node: LexicalNode) => boolean,
): boolean {
  return state.read(() => {
    for (const key of dirtyElements.keys()) {
      const node = $getNodeByKey(key);
      if (node && matches(node)) return true;
    }
    for (const key of dirtyLeaves) {
      const node = $getNodeByKey(key);
      if (node && matches(node)) return true;
    }
    return false;
  });
}
