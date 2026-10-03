import {
  $getEditor,
  $getRoot,
  $getState,
  $isElementNode,
  $isRootNode,
  $setState,
  createState,
  type EditorState,
  type LexicalNode,
} from 'lexical';

type NodeProperties = Record<string, unknown> & { nodeId?: string };

const cloneProperties = (value: Record<string, unknown>): Record<string, unknown> => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Metadata is expected to be JSON-like; retain compatibility with older runtimes.
    }
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
};

const parseProperties = (value: unknown): NodeProperties => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const properties = cloneProperties(value as Record<string, unknown>);
  const nodeId = properties.nodeId;
  if (typeof nodeId === 'string' && nodeId.trim()) {
    properties.nodeId = nodeId.trim();
  } else {
    delete properties.nodeId;
  }
  return properties;
};

const isEqual = (left: NodeProperties, right: NodeProperties): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** Shared NodeState shape used by PR203: the durable ID lives at $.properties.nodeId. */
export const nodePropertiesState = createState('properties', {
  isEqual,
  unparse: cloneProperties,
  parse: parseProperties,
});

export function $getNodeId(node: LexicalNode): string | undefined {
  const nodeId = $getState(node, nodePropertiesState).nodeId;
  return typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : undefined;
}

export function $setNodeId(node: LexicalNode, nodeId: string): void {
  const normalized = nodeId.trim();
  if (!normalized) throw new Error('LiteXML node id must be a non-empty string.');
  $setState(node, nodePropertiesState, (properties) => ({ ...properties, nodeId: normalized }));
}

export function $clearNodeId(node: LexicalNode): void {
  $setState(node, nodePropertiesState, (properties) => {
    const next = { ...properties };
    delete next.nodeId;
    return next;
  });
}

export function $copyNodeProperties(source: LexicalNode, target: LexicalNode): void {
  $setState(target, nodePropertiesState, parseProperties($getState(source, nodePropertiesState)));
}

/** Migrate explicit IDs from the legacy serialized `id` field into NodeState. */
export function migrateSerializedNodeIds(node: unknown): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  const record = node as Record<string, unknown>;
  const legacyId =
    typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id).trim() : '';
  if (record.type !== 'root' && legacyId) {
    const state =
      record.$ && typeof record.$ === 'object' && !Array.isArray(record.$)
        ? (record.$ as Record<string, unknown>)
        : {};
    const properties =
      state.properties && typeof state.properties === 'object' && !Array.isArray(state.properties)
        ? (state.properties as Record<string, unknown>)
        : {};
    if (typeof properties.nodeId !== 'string' || !properties.nodeId.trim()) {
      record.$ = { ...state, properties: { ...properties, nodeId: legacyId } };
    }
  }
  if (Array.isArray(record.children)) record.children.forEach(migrateSerializedNodeIds);
}

const serializedNodeId = (node: Record<string, any>): string | undefined => {
  const nodeId = node.$?.properties?.nodeId;
  if (typeof nodeId === 'string' && nodeId.trim()) return nodeId.trim();
  if (typeof node.id === 'string' || typeof node.id === 'number') {
    const legacyId = String(node.id).trim();
    return legacyId || undefined;
  }
  return undefined;
};

function hasSameSerializedContent(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => hasSameSerializedContent(item, right[index]))
    );
  }
  if (!left || typeof left !== 'object' || !right || typeof right !== 'object') {
    return false;
  }

  const leftRecord = left as Record<string, any>;
  const rightRecord = right as Record<string, any>;
  if (
    typeof leftRecord.type === 'string' &&
    typeof rightRecord.type === 'string' &&
    leftRecord.type !== rightRecord.type
  ) {
    return false;
  }

  const getComparableEntries = (record: Record<string, any>) => {
    const entries: Array<[string, unknown]> = [];
    for (const [key, value] of Object.entries(record)) {
      if (key === 'id' && typeof record.type === 'string') continue;
      if (key === '$' && value && typeof value === 'object' && !Array.isArray(value)) {
        const state = { ...value } as Record<string, any>;
        if (state.properties) {
          state.properties = { ...state.properties };
          delete state.properties.nodeId;
          if (Object.keys(state.properties).length === 0) delete state.properties;
        }
        if (Object.keys(state).length === 0) continue;
        entries.push([key, state]);
      } else {
        entries.push([key, value]);
      }
    }
    return entries;
  };
  const leftEntries = getComparableEntries(leftRecord);
  const rightEntries = getComparableEntries(rightRecord);
  if (leftEntries.length !== rightEntries.length) return false;

  const rightValues = new Map(rightEntries);
  for (const [key, value] of leftEntries) {
    if (!rightValues.has(key)) return false;
    const rightValue = rightValues.get(key);
    if (!hasSameSerializedContent(value, rightValue)) {
      return false;
    }
  }
  return true;
}

/** Preserve IDs only when an id-less snapshot node still represents the same subtree. */
export function inheritMissingSerializedNodeIds(source: unknown, target: unknown): void {
  if (
    !source ||
    typeof source !== 'object' ||
    Array.isArray(source) ||
    !target ||
    typeof target !== 'object' ||
    Array.isArray(target)
  ) {
    return;
  }
  const sourceRecord = source as Record<string, any>;
  const targetRecord = target as Record<string, any>;
  if (sourceRecord.type !== targetRecord.type) return;

  const sourceId = serializedNodeId(sourceRecord);
  if (
    sourceRecord.type !== 'root' &&
    sourceId &&
    !serializedNodeId(targetRecord) &&
    hasSameSerializedContent(sourceRecord, targetRecord)
  ) {
    const state =
      targetRecord.$ && typeof targetRecord.$ === 'object' && !Array.isArray(targetRecord.$)
        ? targetRecord.$
        : {};
    const properties =
      state.properties && typeof state.properties === 'object' && !Array.isArray(state.properties)
        ? state.properties
        : {};
    targetRecord.$ = { ...state, properties: { ...properties, nodeId: sourceId } };
  }

  if (Array.isArray(sourceRecord.children) && Array.isArray(targetRecord.children)) {
    const length = Math.min(sourceRecord.children.length, targetRecord.children.length);
    for (let index = 0; index < length; index++) {
      inheritMissingSerializedNodeIds(sourceRecord.children[index], targetRecord.children[index]);
    }
  }
}

function createNodeId(): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoObject?.randomUUID === 'function') {
    return cryptoObject.randomUUID().replaceAll('-', '');
  }

  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface ReviewSide {
  group: string;
  side: string;
}

const getDiffType = (node: LexicalNode): string | undefined =>
  'diffType' in node && typeof node.diffType === 'string' ? node.diffType : undefined;

function recordActiveOwners(node: LexicalNode, owners: Map<string, string>): void {
  const diffType = getDiffType(node);
  if (node.getType() === 'diff') {
    if (diffType === 'remove' || diffType === 'listItemRemove') return;
    if (diffType === 'modify' || diffType === 'listItemModify') {
      if ($isElementNode(node)) {
        const after = node.getChildAtIndex(1);
        if (after) recordActiveOwners(after, owners);
      }
      return;
    }
  }
  if (
    (node.getType() === 'table-cell-diff' || node.getType() === 'table-row-diff') &&
    'getDiffType' in node &&
    typeof node.getDiffType === 'function' &&
    node.getDiffType() === 'remove'
  ) {
    return;
  }
  if (
    $isElementNode(node) &&
    node.getType() === 'listitem' &&
    node.getFirstChild()?.getType() === 'diff' &&
    getDiffType(node.getFirstChild()!) === 'listItemRemove'
  ) {
    return;
  }

  const nodeId = $getNodeId(node);
  if (nodeId && !owners.has(nodeId)) owners.set(nodeId, node.getKey());
  if ($isElementNode(node))
    node.getChildren().forEach((child) => recordActiveOwners(child, owners));
}

function getTableReviewSide(node: LexicalNode): ReviewSide | null {
  const type = node.getType();
  if (type !== 'table-cell-diff' && type !== 'table-row-diff') return null;
  if (!('getChangeId' in node) || typeof node.getChangeId !== 'function') return null;
  const changeId = node.getChangeId();
  const side =
    'getDiffType' in node && typeof node.getDiffType === 'function'
      ? node.getDiffType()
      : undefined;
  return changeId && side ? { group: `${type}:${changeId}`, side: String(side) } : null;
}

function getReviewSide(node: LexicalNode): ReviewSide | null {
  const selfSide = getTableReviewSide(node);
  if (selfSide) return selfSide;

  let branch = node;
  for (let parent = node.getParent(); parent; branch = parent, parent = parent.getParent()) {
    const parentDiffType = getDiffType(parent);
    if (parent.getType() === 'diff') {
      if (parentDiffType === 'modify') {
        if (branch.getType() === 'diff-content' && 'side' in branch) {
          return { group: `diff:${parent.getKey()}`, side: String(branch.side) };
        }
        const branchIndex = parent.getChildren().indexOf(branch);
        if (branchIndex >= 0 && branchIndex < 2) {
          return {
            group: `diff:${parent.getKey()}`,
            side: branchIndex === 0 ? 'before' : 'after',
          };
        }
      }
      if (parentDiffType === 'listItemModify') {
        const branchIndex = parent.getChildren().indexOf(branch);
        if (branchIndex >= 0 && branchIndex < 2) {
          return {
            group: `diff:${parent.getKey()}`,
            side: branchIndex === 0 ? 'before' : 'after',
          };
        }
      }
    }

    const tableSide = getTableReviewSide(parent);
    if (tableSide) return tableSide;
  }
  return null;
}

function areReviewSides(left: LexicalNode, right: LexicalNode): boolean {
  const leftSide = getReviewSide(left);
  const rightSide = getReviewSide(right);
  return Boolean(
    leftSide && rightSide && leftSide.group === rightSide.group && leftSide.side !== rightSide.side,
  );
}

/** Assign identities once per root transform and repair copy/split collisions in one pass. */
export function $normalizeNodeIds(root: LexicalNode): void {
  if (!$isRootNode(root)) return;
  const editor = $getEditor();
  const previousOwners = new Map<string, string>();
  editor.getEditorState().read(() => {
    recordActiveOwners($getRoot(), previousOwners);
  });

  const nodes: LexicalNode[] = [];
  const visit = (node: LexicalNode) => {
    if (node.getType() !== 'diff' && node.getType() !== 'diff-content') nodes.push(node);
    if ('getChildren' in node && typeof node.getChildren === 'function') {
      node.getChildren().forEach(visit);
    }
  };
  root.getChildren().forEach(visit);

  const idGroups = new Map<string, LexicalNode[]>();
  const missingIds: LexicalNode[] = [];
  for (const node of nodes) {
    const nodeId = $getNodeId(node);
    if (!nodeId) {
      missingIds.push(node);
      continue;
    }
    const group = idGroups.get(nodeId) || [];
    group.push(node);
    idGroups.set(nodeId, group);
  }

  const usedIds = new Set(idGroups.keys());
  const assignFreshId = (node: LexicalNode) => {
    let nodeId = createNodeId();
    while (usedIds.has(nodeId)) nodeId = createNodeId();
    $setNodeId(node, nodeId);
    usedIds.add(nodeId);
  };

  for (const [nodeId, group] of idGroups) {
    if (group.length < 2) continue;

    const previousOwner = group.find((node) => node.getKey() === previousOwners.get(nodeId));
    const primary = previousOwner || group[0];
    const reviewCounterpart = group.find(
      (node) => node !== primary && areReviewSides(primary, node),
    );
    const preserved = new Set([primary, ...(reviewCounterpart ? [reviewCounterpart] : [])]);
    for (const node of group) {
      if (!preserved.has(node)) assignFreshId(node);
    }
  }

  for (const node of missingIds) assignFreshId(node);
}

export function editorStateHasCompleteNodeIds(editorState: EditorState): boolean {
  let nodeCount = 0;
  let complete = true;
  editorState.read(() => {
    const visit = (node: LexicalNode) => {
      const type = node.getType();
      if (type !== 'root' && type !== 'diff' && type !== 'diff-content') {
        nodeCount += 1;
        if (!$getNodeId(node)) complete = false;
      }
      if ($isElementNode(node)) node.getChildren().forEach(visit);
    };
    visit($getRoot());
  });
  return nodeCount > 0 && complete;
}

/** Ensure newly imported nodes can be addressed before the enclosing update commits. */
export function $ensureUniqueNodeIds(nodes: ReadonlyArray<LexicalNode>): void {
  const usedIds = new Set<string>();
  const collectExisting = (node: LexicalNode) => {
    const nodeId = $getNodeId(node);
    if (nodeId) usedIds.add(nodeId);
    if ($isElementNode(node)) node.getChildren().forEach(collectExisting);
  };
  collectExisting($getRoot());

  const ensureNode = (node: LexicalNode) => {
    let nodeId = $getNodeId(node);
    if (!nodeId || usedIds.has(nodeId)) {
      do {
        nodeId = createNodeId();
      } while (usedIds.has(nodeId));
      $setNodeId(node, nodeId);
    }
    usedIds.add(nodeId);
    if ($isElementNode(node)) node.getChildren().forEach(ensureNode);
  };

  nodes.forEach(ensureNode);
}

/** Find a public ID in the user-visible side of pending review changes. */
export function $findNodeById(nodeId: string, root?: LexicalNode): LexicalNode | null {
  const start = root ?? $getRoot();

  const visit = (node: LexicalNode): LexicalNode | null => {
    const diffType = getDiffType(node);
    if (node.getType() === 'diff') {
      switch (diffType) {
        case 'remove':
        case 'listItemRemove': {
          return null;
        }
        case 'modify':
        case 'listItemModify': {
          const after = $isElementNode(node) ? node.getChildAtIndex(1) : null;
          return after ? visit(after) : null;
        }
        default: {
          break;
        }
      }
    }
    if (
      (node.getType() === 'table-cell-diff' || node.getType() === 'table-row-diff') &&
      'getDiffType' in node &&
      typeof node.getDiffType === 'function' &&
      node.getDiffType() === 'remove'
    ) {
      return null;
    }
    if (
      $isElementNode(node) &&
      node.getType() === 'listitem' &&
      node.getFirstChild()?.getType() === 'diff' &&
      getDiffType(node.getFirstChild()!) === 'listItemRemove'
    ) {
      return null;
    }
    if ($getNodeId(node) === nodeId) return node;
    if ('getChildren' in node && typeof node.getChildren === 'function') {
      for (const child of node.getChildren()) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };

  return visit(start);
}
