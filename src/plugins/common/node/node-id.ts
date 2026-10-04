import {
  $getEditor,
  $getRoot,
  $getState,
  $isElementNode,
  $isRootNode,
  $setState,
  createState,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

import { $getNodeIdentityPolicy, type NodeIdentityPolicy } from './node-identity-policy';

type NodeProperties = Record<string, unknown> & { nodeId?: string };

/** `root` is the document insertion anchor, never a content-node identity. */
export function isValidContentNodeId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() !== 'root';
}

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
  if (isValidContentNodeId(nodeId)) {
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
  return isValidContentNodeId(nodeId) ? nodeId : undefined;
}

export function $setNodeId(node: LexicalNode, nodeId: string): void {
  const normalized = nodeId.trim();
  if (!normalized) throw new Error('Node ID must be a non-empty string.');
  if (!isValidContentNodeId(normalized)) {
    throw new Error('Node ID "root" is reserved for the document anchor.');
  }
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
  if (record.type !== 'root') {
    const state =
      record.$ && typeof record.$ === 'object' && !Array.isArray(record.$)
        ? (record.$ as Record<string, unknown>)
        : {};
    const properties =
      state.properties && typeof state.properties === 'object' && !Array.isArray(state.properties)
        ? (state.properties as Record<string, unknown>)
        : {};
    if (!isValidContentNodeId(properties.nodeId) && isValidContentNodeId(legacyId)) {
      record.$ = { ...state, properties: { ...properties, nodeId: legacyId } };
    } else if (!isValidContentNodeId(properties.nodeId) && 'nodeId' in properties) {
      const nextProperties = { ...properties };
      delete nextProperties.nodeId;
      const nextState: Record<string, unknown> = { ...state, properties: nextProperties };
      if (Object.keys(nextProperties).length === 0) delete nextState.properties;
      if (Object.keys(nextState).length === 0) delete record.$;
      else record.$ = nextState;
    }
    if (!isValidContentNodeId(legacyId) && 'id' in record) delete record.id;
  }
  if (Array.isArray(record.children)) record.children.forEach(migrateSerializedNodeIds);
}

const serializedNodeId = (node: Record<string, any>): string | undefined => {
  const nodeId = node.$?.properties?.nodeId;
  if (isValidContentNodeId(nodeId)) return nodeId.trim();
  if (typeof node.id === 'string' || typeof node.id === 'number') {
    const legacyId = String(node.id).trim();
    return isValidContentNodeId(legacyId) ? legacyId : undefined;
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

/** Serialize a subtree without identities so sibling order cannot stand in for identity. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function identityFreeNodeTree(
  node: LexicalNode,
  cache: WeakMap<LexicalNode, Record<string, unknown>>,
): Record<string, unknown> {
  const cached = cache.get(node);
  if (cached) return cached;
  const serialized = { ...node.exportJSON() } as Record<string, any>;
  delete serialized.id;
  if (serialized.$?.properties) {
    serialized.$ = { ...serialized.$, properties: { ...serialized.$.properties } };
    delete serialized.$.properties.nodeId;
    if (Object.keys(serialized.$.properties).length === 0) delete serialized.$.properties;
    if (Object.keys(serialized.$).length === 0) delete serialized.$;
  }
  if ($isElementNode(node)) {
    serialized.children = node.getChildren().map((child) => identityFreeNodeTree(child, cache));
  }
  cache.set(node, serialized);
  return serialized;
}

/** A stable, opaque repair ID for malformed external snapshots with duplicate IDs. */
function duplicateRepairId(sourceId: string, fingerprint: string, occurrence: number): string {
  const input = `${sourceId}\u0000${fingerprint}\u0000${occurrence}`;
  const hashes = [0x811C9DC5, 0x9E3779B9, 0x85EBCA6B, 0xC2B2AE35];
  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index);
    for (let part = 0; part < hashes.length; part++) {
      hashes[part] = Math.imul(hashes[part] ^ (code + part), 0x01000193);
    }
  }
  return `dup-${hashes.map((hash) => (hash >>> 0).toString(16).padStart(8, '0')).join('')}`;
}

function recordActiveOwners(
  node: LexicalNode,
  owners: Map<string, string>,
  policy: NodeIdentityPolicy,
): void {
  const projection = policy.project(node);
  if (projection === 'hidden') return;
  if (projection === 'content') {
    const nodeId = $getNodeId(node);
    if (nodeId && !owners.has(nodeId)) owners.set(nodeId, node.getKey());
  }
  if ($isElementNode(node)) {
    if (typeof projection === 'object') {
      const selected = node.getChildAtIndex(projection.childIndex);
      if (selected) recordActiveOwners(selected, owners, policy);
    } else {
      node.getChildren().forEach((child) => recordActiveOwners(child, owners, policy));
    }
  }
}

/** Assign identities once per root transform and repair copy/split collisions in one pass. */
export function $normalizeNodeIds(
  root: LexicalNode,
  options: { stableDuplicateRepair?: boolean } = {},
): void {
  if (!$isRootNode(root)) return;
  const editor = $getEditor();
  const policy = $getNodeIdentityPolicy();
  const previousOwners = new Map<string, string>();
  const previousFingerprints = new Map<string, Set<string>>();
  const previousIdsByFingerprint = new Map<string, Set<string>>();
  const identityFreeTrees = new WeakMap<LexicalNode, Record<string, unknown>>();
  const fingerprintCache = new WeakMap<LexicalNode, string>();
  const fingerprint = (node: LexicalNode): string => {
    const cached = fingerprintCache.get(node);
    if (cached) return cached;
    const signature = stableStringify(identityFreeNodeTree(node, identityFreeTrees));
    fingerprintCache.set(node, signature);
    return signature;
  };

  const nodes: LexicalNode[] = [];
  const visit = (node: LexicalNode) => {
    if (policy.isIdentityNode(node)) nodes.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(visit);
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

  const duplicateIds = new Set(
    [...idGroups]
      .filter(
        ([, group]) =>
          group.length > 1 && !(group.length === 2 && policy.canShareId(group[0], group[1])),
      )
      .map(([nodeId]) => nodeId),
  );
  editor.getEditorState().read(
    () => {
      recordActiveOwners($getRoot(), previousOwners, policy);
      if (options.stableDuplicateRepair && duplicateIds.size > 0) {
        const visit = (node: LexicalNode) => {
          if (policy.isIdentityNode(node)) {
            const nodeId = $getNodeId(node);
            if (nodeId && (duplicateIds.has(nodeId) || nodeId.startsWith('dup-'))) {
              const signature = fingerprint(node);
              if (duplicateIds.has(nodeId)) {
                const signatures = previousFingerprints.get(nodeId) || new Set<string>();
                signatures.add(signature);
                previousFingerprints.set(nodeId, signatures);
              }
              const ids = previousIdsByFingerprint.get(signature) || new Set<string>();
              ids.add(nodeId);
              previousIdsByFingerprint.set(signature, ids);
            }
          }
          if ($isElementNode(node)) node.getChildren().forEach(visit);
        };
        $getRoot().getChildren().forEach(visit);
      }
    },
    { editor },
  );

  const usedIds = new Set(idGroups.keys());
  const assignFreshId = (node: LexicalNode, duplicateSourceId?: string) => {
    let nodeId: string;
    if (options.stableDuplicateRepair && duplicateSourceId) {
      const signature = fingerprint(node);
      let occurrence = 0;
      do {
        nodeId = duplicateRepairId(duplicateSourceId, signature, occurrence++);
      } while (usedIds.has(nodeId));
    } else {
      nodeId = createNodeId();
      while (usedIds.has(nodeId)) nodeId = createNodeId();
    }
    $setNodeId(node, nodeId);
    usedIds.add(nodeId);
  };

  for (const [nodeId, group] of idGroups) {
    if (group.length < 2) continue;
    if (options.stableDuplicateRepair && !duplicateIds.has(nodeId)) continue;

    const previousOwner = group.find((node) => node.getKey() === previousOwners.get(nodeId));
    const matchingPreviousOwner = options.stableDuplicateRepair
      ? group.find((node) => previousFingerprints.get(nodeId)?.has(fingerprint(node)))
      : undefined;
    const notPreviouslyRepaired = options.stableDuplicateRepair
      ? group.find((node) => {
          const signature = fingerprint(node);
          const priorIds = previousIdsByFingerprint.get(signature);
          return !priorIds?.has(duplicateRepairId(nodeId, signature, 0));
        })
      : undefined;
    const primary = previousOwner || matchingPreviousOwner || notPreviouslyRepaired || group[0];
    const reviewCounterpart = group.find(
      (node) => node !== primary && policy.canShareId(primary, node),
    );
    const preserved = new Set([primary, ...(reviewCounterpart ? [reviewCounterpart] : [])]);
    for (const node of group) {
      if (!preserved.has(node)) assignFreshId(node, nodeId);
    }
  }

  for (const node of missingIds) assignFreshId(node);
}

export function editorStateHasCompleteNodeIds(
  editorState: EditorState,
  editor: LexicalEditor,
): boolean {
  let nodeCount = 0;
  let complete = true;
  editorState.read(
    () => {
      const policy = $getNodeIdentityPolicy();
      const visit = (node: LexicalNode) => {
        if (policy.isIdentityNode(node)) {
          nodeCount += 1;
          if (!$getNodeId(node)) complete = false;
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit);
      };
      visit($getRoot());
    },
    { editor },
  );
  return nodeCount > 0 && complete;
}

/** Ensure newly imported nodes can be addressed before the enclosing update commits. */
export function $ensureUniqueNodeIds(nodes: ReadonlyArray<LexicalNode>): void {
  const policy = $getNodeIdentityPolicy();
  const usedIds = new Set<string>();
  const collectExisting = (node: LexicalNode) => {
    const nodeId = $getNodeId(node);
    if (nodeId) usedIds.add(nodeId);
    if ($isElementNode(node)) node.getChildren().forEach(collectExisting);
  };
  collectExisting($getRoot());

  const ensureNode = (node: LexicalNode) => {
    if (!policy.isIdentityNode(node)) {
      if ($isElementNode(node)) node.getChildren().forEach(ensureNode);
      return;
    }
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

/** Find the active representation of a logical ID in a Lexical read/update context. */
export function $getNodeById(nodeId: string, root?: LexicalNode): LexicalNode | null {
  if (!isValidContentNodeId(nodeId)) return null;
  const policy = $getNodeIdentityPolicy();
  const start = root ?? $getRoot();

  const visit = (node: LexicalNode): LexicalNode | null => {
    if (!$isElementNode(node)) {
      return $getNodeId(node) === nodeId && policy.project(node) === 'content' ? node : null;
    }
    const projection = policy.project(node);
    if (projection === 'hidden') return null;
    if (projection === 'content' && $getNodeId(node) === nodeId) return node;
    if (typeof projection === 'object') {
      const selected = node.getChildAtIndex(projection.childIndex);
      return selected ? visit(selected) : null;
    }
    for (const child of node.getChildren()) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };

  return visit(start);
}

/** Legacy internal spelling kept for existing command callers. */
export const $findNodeById = $getNodeById;

/** Build a key-only index for one immutable editor state; never cache LexicalNode objects. */
export function $getActiveNodeIdKeys(): Map<string, string> {
  const policy = $getNodeIdentityPolicy();
  const keys = new Map<string, string>();
  const visit = (node: LexicalNode) => {
    const projection = policy.project(node);
    if (projection === 'hidden') return;
    if (projection === 'content') {
      const id = $getNodeId(node);
      if (id && !keys.has(id)) keys.set(id, node.getKey());
    }
    if ($isElementNode(node)) {
      if (typeof projection === 'object') {
        const selected = node.getChildAtIndex(projection.childIndex);
        if (selected) visit(selected);
      } else {
        node.getChildren().forEach(visit);
      }
    }
  };
  visit($getRoot());
  return keys;
}
