import {
  $getNodeByKey,
  $getRoot,
  $getState,
  $isElementNode,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  RootNode,
} from 'lexical';

import {
  $normalizeNodeIds,
  $setNodeId,
  createNodeId,
  isValidContentNodeId,
  nodePropertiesState,
} from './node-id';
import {
  $getNodeIdentityPolicy,
  getNodeIdentityPolicyRevision,
  type NodeIdentityPolicy,
} from './node-identity-policy';

/** Lexical's `_dirtyType` value for `setEditorState()`: the dirty sets no longer describe the change. */
const FULL_RECONCILE = 2;

/** Rebuild once stale index entries (deleted nodes) outnumber live nodes by this factor. */
const STALE_INDEX_FACTOR = 2;
const STALE_INDEX_SLACK = 1024;

interface UpdateCycle {
  /** A full pass normalized this pending state, so it no longer depends on the committed one. */
  full: boolean;
  /** Keys created or written in this cycle whose IDs the transform has looked at. */
  processed: Set<NodeKey>;
  /** The pending state this cycle writes into. */
  state: EditorState;
  /** Nodes already confirmed unique in this cycle, so batched updates do not re-check them. */
  verified: Map<NodeKey, { id: string; node: LexicalNode }>;
}

interface NodeIdTracker {
  cycle: UpdateCycle | null;
  /** id -> keys that held it. A superset: entries are re-checked against the live state on read. */
  keysById: Map<string, NodeKey[]>;
  indexSize: number;
  /** Committed state whose IDs are known complete and unique, and that `keysById` covers. */
  normalizedState: EditorState | null;
  policyRevision: number;
  /** IDs the policy let two nodes share at the last full pass (review before/after pairs). */
  sharedIds: Set<string>;
}

const readNodeId = (node: LexicalNode): string | undefined => {
  const nodeId = $getState(node, nodePropertiesState, 'direct').nodeId;
  return isValidContentNodeId(nodeId) ? nodeId : undefined;
};

function addToIndex(tracker: NodeIdTracker, id: string, key: NodeKey): void {
  const keys = tracker.keysById.get(id);
  if (!keys) {
    tracker.keysById.set(id, [key]);
    tracker.indexSize += 1;
  } else if (!keys.includes(key)) {
    keys.push(key);
    tracker.indexSize += 1;
  }
}

/** Attached identity nodes in the active state that currently carry `id`. */
function $getIdHolders(
  tracker: NodeIdTracker,
  id: string,
  policy: NodeIdentityPolicy,
  committed: EditorState,
): LexicalNode[] {
  const keys = tracker.keysById.get(id);
  if (!keys) return [];
  const holders: LexicalNode[] = [];
  for (let index = keys.length - 1; index >= 0; index--) {
    const node = $getNodeByKey(keys[index]);
    if (!node) {
      // Gone from both states, so no later update can bring it back.
      if (!committed._nodeMap.has(keys[index])) {
        keys.splice(index, 1);
        tracker.indexSize -= 1;
      }
      continue;
    }
    if (readNodeId(node) === id && policy.isIdentityNode(node) && node.isAttached()) {
      holders.push(node);
    }
  }
  if (keys.length === 0) tracker.keysById.delete(id);
  return holders;
}

function $rebuildIndex(tracker: NodeIdTracker, policy: NodeIdentityPolicy): void {
  tracker.keysById = new Map();
  tracker.indexSize = 0;
  const visit = (node: LexicalNode) => {
    if (policy.isIdentityNode(node)) {
      const id = readNodeId(node);
      if (id) addToIndex(tracker, id, node.getKey());
    }
    if ($isElementNode(node)) {
      for (let child = node.getFirstChild(); child; child = child.getNextSibling()) visit(child);
    }
  };
  visit($getRoot());
  tracker.sharedIds = new Set(
    [...tracker.keysById].filter(([, keys]) => keys.length > 1).map(([id]) => id),
  );
}

/**
 * Check only the nodes this update created or wrote. Returns false when it finds something the
 * full pass must decide (a duplicate, a broken review pair), before changing anything.
 */
function $normalizeChangedNodeIds(
  tracker: NodeIdTracker,
  cycle: UpdateCycle,
  changed: Set<NodeKey>,
  committed: EditorState,
): boolean {
  const policy = $getNodeIdentityPolicy();

  // Whether two nodes may share an ID depends on their ancestors, so an edit elsewhere can break
  // an existing pair without touching either node.
  for (const id of tracker.sharedIds) {
    const holders = $getIdHolders(tracker, id, policy, committed);
    if (holders.length > 2) return false;
    if (holders.length === 2 && !policy.canShareId(holders[0], holders[1])) return false;
  }

  const missing: LexicalNode[] = [];
  const checked: Array<[NodeKey, string]> = [];
  for (const key of changed) {
    cycle.processed.add(key);
    const node = $getNodeByKey(key);
    if (!node) continue;
    const verified = cycle.verified.get(key);
    if (verified && verified.node === node && readNodeId(node) === verified.id) continue;
    if (!policy.isIdentityNode(node) || !node.isAttached()) continue;

    const id = readNodeId(node);
    if (!id) {
      missing.push(node);
      continue;
    }
    const others = $getIdHolders(tracker, id, policy, committed).filter(
      (holder) => holder !== node,
    );
    if (others.length > 0) {
      const isKnownPair =
        others.length === 1 && tracker.sharedIds.has(id) && policy.canShareId(node, others[0]);
      if (!isKnownPair) return false;
    }
    addToIndex(tracker, id, key);
    checked.push([key, id]);
  }

  for (const node of missing) {
    let id = createNodeId();
    while (tracker.keysById.has(id)) id = createNodeId();
    $setNodeId(node, id);
    addToIndex(tracker, id, node.getKey());
    checked.push([node.getKey(), id]);
  }
  for (const [key, id] of checked) {
    const node = $getNodeByKey(key);
    if (node) cycle.verified.set(key, { id, node });
  }
  return true;
}

/**
 * True when every node the commit created or wrote was checked by the transform and still carries
 * the ID it was checked with. A later `skipTransforms` update batched into the same cycle, or a
 * write after the last transform run, makes this false.
 */
function $everyWrittenNodeVerified(
  cycle: UpdateCycle,
  dirtyElements: Map<NodeKey, boolean>,
  dirtyLeaves: Set<NodeKey>,
): boolean {
  const policy = $getNodeIdentityPolicy();
  const isVerified = (key: NodeKey) => {
    const node = $getNodeByKey(key);
    if (!node) return true;
    // Lexical flags the root as intentionally dirty on every transform pass, written or not.
    if (key === 'root' && !policy.isIdentityNode(node)) return true;
    if (!cycle.processed.has(key)) return false;
    const verified = cycle.verified.get(key);
    if (verified) return readNodeId(node) === verified.id;
    // Skipped as detached or non-identity when checked; it must still be one of those.
    return !policy.isIdentityNode(node) || !node.isAttached();
  };
  for (const key of dirtyLeaves) {
    if (!isVerified(key)) return false;
  }
  for (const [key, intentional] of dirtyElements) {
    // `false` marks an ancestor of a change: the element itself, and so its ID, is unchanged.
    if (intentional && !isVerified(key)) return false;
  }
  return true;
}

/**
 * Keep every identity node's ID present and unique on each update.
 *
 * Once a committed state is known to be normalized, an update can only introduce a missing or
 * duplicate ID on a node it created or wrote, so the transform checks those against an index
 * instead of walking the whole document. Anything it cannot account for (setEditorState, updates
 * with `skipTransforms`, a policy change, a duplicate) falls back to the full `$normalizeNodeIds`
 * pass with unchanged semantics.
 */
export function registerNodeIdNormalization(editor: LexicalEditor): () => void {
  const tracker: NodeIdTracker = {
    cycle: null,
    indexSize: 0,
    keysById: new Map(),
    normalizedState: null,
    policyRevision: -1,
    sharedIds: new Set(),
  };

  const unregisterTransform = editor.registerNodeTransform(RootNode, (root) => {
    const pending = editor._pendingEditorState;
    // setEditorState() inside an update swaps the pending state; the transform then runs on a
    // state that is not the one being committed. Keep the old behavior and record nothing.
    if (!pending || pending._nodeMap.get('root') !== root) {
      $normalizeNodeIds(root);
      return;
    }

    let cycle = tracker.cycle;
    if (!cycle || cycle.state !== pending) {
      cycle = { full: false, processed: new Set(), state: pending, verified: new Map() };
      tracker.cycle = cycle;
    }

    const committed = editor._editorState;
    const changed = editor._cloneNotNeeded;
    const revision = getNodeIdentityPolicyRevision(editor);
    const canCheckChangedOnly =
      changed instanceof Set &&
      editor._dirtyType !== FULL_RECONCILE &&
      tracker.policyRevision === revision &&
      (cycle.full || tracker.normalizedState === committed) &&
      tracker.indexSize <= STALE_INDEX_FACTOR * pending._nodeMap.size + STALE_INDEX_SLACK;

    if (canCheckChangedOnly && $normalizeChangedNodeIds(tracker, cycle, changed, committed)) {
      return;
    }

    $normalizeNodeIds(root);
    const policy = $getNodeIdentityPolicy();
    $rebuildIndex(tracker, policy);
    tracker.policyRevision = revision;
    cycle.full = true;
    cycle.verified.clear();
    if (changed instanceof Set) {
      for (const key of changed) {
        cycle.processed.add(key);
        const node = $getNodeByKey(key);
        const id = node && policy.isIdentityNode(node) && node.isAttached() && readNodeId(node);
        if (node && id) cycle.verified.set(key, { id, node });
      }
    }
  });

  const unregisterUpdate = editor.registerUpdateListener(
    ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
      const cycle = tracker.cycle;
      tracker.cycle = null;
      if (editorState === prevEditorState) return;

      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
        // Selection-only update: same nodes, new state object.
        tracker.normalizedState = tracker.normalizedState === prevEditorState ? editorState : null;
        return;
      }

      const trusted =
        cycle !== null &&
        cycle.state === editorState &&
        (cycle.full || tracker.normalizedState === prevEditorState) &&
        editorState.read(() => $everyWrittenNodeVerified(cycle, dirtyElements, dirtyLeaves), {
          editor,
        });
      tracker.normalizedState = trusted ? editorState : null;
    },
  );

  return () => {
    unregisterTransform();
    unregisterUpdate();
  };
}
