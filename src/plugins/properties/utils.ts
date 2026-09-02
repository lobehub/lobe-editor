import type {
  BaseSelection,
  LexicalNode,
  NodeSelection,
  RangeSelection,
  SerializedLexicalNode,
} from 'lexical';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isNodeSelection,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
} from 'lexical';

import {
  $getNodeProperties,
  $setNodeProperties,
  createDeterministicNodeId,
  createNodeId,
  isNodeId,
} from './state';
import type { NodePropertiesUpdater, NodeProvenance } from './types';

/** Runtime-only or review wrappers which must never become addressable blocks. */
const NON_LOCATABLE_NODE_TYPES = new Set([
  'cursor',
  'diff',
  'diff-content',
  'hole',
  'table-cell-diff',
  'table-row-diff',
]);

/** Temporary NodeState marker used while an Agent streams into a document. */
export const STREAMING_GENERATION_REGION_STATUS = 'streaming' as const;

export interface StreamingGenerationRegion {
  generationId: string;
  length?: number;
  requestId?: string;
  sessionId: string;
  startOffset?: number;
  status: typeof STREAMING_GENERATION_REGION_STATUS;
}

/**
 * Whether a node represents a user-facing block that can be targeted by a
 * rewrite/comment request. Text-node ranges are anchored by Yjs relative
 * positions; the durable block identity lives on their containing block.
 * Runtime boundary nodes intentionally do not.
 */
export function $isNodeIdentityTarget(node: LexicalNode): boolean {
  if (
    $isRootNode(node) ||
    $isTextNode(node) ||
    $isLineBreakNode(node) ||
    NON_LOCATABLE_NODE_TYPES.has(node.getType())
  ) {
    return false;
  }

  return (
    ($isElementNode(node) || $isDecoratorNode(node)) &&
    typeof node.isInline === 'function' &&
    !node.isInline()
  );
}

/** Block-only identity predicate used by Markdown transport markers. */
export function $isNodeIdentityBlockTarget(node: LexicalNode): boolean {
  return (
    $isNodeIdentityTarget(node) && !$isTextNode(node) && (!$isElementNode(node) || !node.isInline())
  );
}

/** Read the durable identity, never the ephemeral Lexical node key. */
export function $getNodeId(node: LexicalNode): string | undefined {
  const nodeId = $getNodeProperties(node).nodeId;
  return isNodeId(nodeId) ? nodeId : undefined;
}

/**
 * Return the temporary Agent-owned region marker, if one is present on a
 * node. The marker intentionally uses durable IDs only; Lexical keys are
 * never persisted or exposed by the streaming protocol.
 */
export function $getStreamingGenerationRegion(
  node: LexicalNode,
): StreamingGenerationRegion | undefined {
  const properties = $getNodeProperties(node);
  if (
    properties.rewriteRegionStatus !== STREAMING_GENERATION_REGION_STATUS ||
    typeof properties.rewriteGenerationId !== 'string' ||
    properties.rewriteGenerationId.length === 0 ||
    typeof properties.rewriteSessionId !== 'string' ||
    properties.rewriteSessionId.length === 0
  ) {
    return undefined;
  }

  return {
    generationId: properties.rewriteGenerationId,
    ...(typeof properties.rewriteRegionLength === 'number'
      ? { length: properties.rewriteRegionLength }
      : {}),
    ...(typeof properties.rewriteRegionRequestId === 'string'
      ? { requestId: properties.rewriteRegionRequestId }
      : {}),
    sessionId: properties.rewriteSessionId,
    ...(typeof properties.rewriteRegionStart === 'number'
      ? { startOffset: properties.rewriteRegionStart }
      : {}),
    status: STREAMING_GENERATION_REGION_STATUS,
  };
}

/** Mark a node as belonging to a temporary streaming generation region. */
export function $markNodeAsStreamingGenerationRegion(
  node: LexicalNode,
  region: Pick<StreamingGenerationRegion, 'generationId' | 'requestId' | 'sessionId'>,
): void {
  $setNodeProperties(node, (previous) => ({
    ...previous,
    rewriteGenerationId: region.generationId,
    rewriteRegionStatus: STREAMING_GENERATION_REGION_STATUS,
    ...(region.requestId ? { rewriteRegionRequestId: region.requestId } : {}),
    rewriteSessionId: region.sessionId,
  }));
}

/** Set the durable block/offset range currently owned by the stream. */
export function $setStreamingGenerationRegionRange(
  node: LexicalNode,
  range: { length: number; startOffset: number },
): void {
  $setNodeProperties(node, (previous) => ({
    ...previous,
    rewriteRegionLength: range.length,
    rewriteRegionStart: range.startOffset,
  }));
}

/** Remove only the matching temporary region marker and retain AI provenance. */
export function $clearStreamingGenerationRegion(
  node: LexicalNode,
  sessionId?: string,
  generationId?: string,
  requestId?: string,
): void {
  const current = $getStreamingGenerationRegion(node);
  if (
    !current ||
    (sessionId !== undefined && current.sessionId !== sessionId) ||
    (generationId !== undefined && current.generationId !== generationId) ||
    (requestId !== undefined && current.requestId !== requestId)
  ) {
    return;
  }

  $setNodeProperties(node, (previous) => {
    const next = { ...previous };
    delete next.rewriteGenerationId;
    delete next.rewriteRegionLength;
    delete next.rewriteRegionStart;
    delete next.rewriteRegionRequestId;
    delete next.rewriteRegionStatus;
    delete next.rewriteSessionId;
    return next;
  });
}

/** Set a caller-supplied durable identity, rejecting empty values. */
export function $setNodeId(node: LexicalNode, nodeId: string): LexicalNode {
  if (!isNodeId(nodeId)) throw new Error('nodeId must be a non-empty string');
  const normalizedNodeId = nodeId.trim();
  if (node.isAttached()) {
    const conflictingNode = $findNodesById(normalizedNodeId).find(
      (candidate) => candidate !== node,
    );
    if (conflictingNode)
      throw new Error(`nodeId is already used by another node: ${normalizedNodeId}`);
  }
  return $setNodeProperties(node, (previous) => ({ ...previous, nodeId: normalizedNodeId }));
}

const getNodePath = (node: LexicalNode): string => {
  const path: string[] = [];
  let current: LexicalNode | null = node;

  while (current && !$isRootNode(current)) {
    const parent: LexicalNode | null = current.getParent();
    if (!parent || !$isElementNode(parent)) break;
    const index = parent.getChildren().indexOf(current);
    path.unshift(`${Math.max(index, 0)}:${current.getType()}`);
    current = parent;
  }

  return path.join('/');
};

const getDeterministicNodeId = (node: LexicalNode, path?: ReadonlyArray<number>): string =>
  createDeterministicNodeId(
    `legacy-node-id:v1:${path ? path.join('.') : getNodePath(node)}:${node.getType()}`,
  );

/**
 * Ensure one node has a durable identity. Call this from an editor update or
 * a node transform so the generated value is part of the current transaction.
 */
export function $ensureNodeId(node: LexicalNode): string | undefined {
  if (!$isNodeIdentityTarget(node)) return undefined;

  const current = $getNodeId(node);
  if (current) return current;

  // `$ensureNodeId` is also called by node transforms for freshly-created
  // attached nodes. A structural path is not an identity: inserting another
  // block before an existing one gives both nodes the same path seed while
  // the old node still carries its previously assigned ID. Allocate fresh
  // IDs here; legacy/collaborative migrations use `$ensureNodeIdsInTree`,
  // which deliberately keeps the deterministic stable-identity path below.
  const nodeId = createNodeId();
  $setNodeProperties(node, (previous) => ({ ...previous, nodeId }));
  return nodeId;
}

export interface NodeIdentityMigrationResult {
  /** IDs encountered more than once in the input tree. */
  duplicateNodeIds: string[];
  generatedNodeIds: string[];
  nodes: LexicalNode[];
  /** IDs assigned to replace duplicate identities. */
  reassignedNodeIds: string[];
}

export interface NodeIdentityMigrationOptions {
  /** Optional stable document path, primarily useful to deterministic tests. */
  pathPrefix?: ReadonlyArray<number>;
  /** Stable identity from a collaboration binding, when one is available. */
  stableIdentity?: (node: LexicalNode) => string | undefined;
}

/**
 * Idempotently migrate a tree. Unique existing identities are left byte-for-
 * byte intact; missing identities and later occurrences of duplicates receive
 * deterministic replacements. The caller owns the editor transaction and can
 * therefore choose the appropriate history/Yjs tags.
 */
export function $ensureNodeIdsInTree(
  root: LexicalNode = $getRoot(),
  options: NodeIdentityMigrationOptions = {},
): NodeIdentityMigrationResult {
  const generatedNodeIds: string[] = [];
  const duplicateNodeIds: string[] = [];
  const nodes: LexicalNode[] = [];
  const reassignedNodeIds: string[] = [];
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const assignedIds = new Set<string>();

  const visit = (node: LexicalNode, path: number[]): void => {
    if ($isNodeIdentityTarget(node)) {
      const before = $getNodeId(node);
      let after = before;

      if (before && seenIds.has(before)) {
        duplicateIds.add(before);
        let attempt = 0;
        do {
          after = createMigratedNodeId(node, path, attempt, options);
          attempt += 1;
        } while (assignedIds.has(after));
        $setNodeProperties(node, (previous) => ({ ...previous, nodeId: after }));
        reassignedNodeIds.push(after);
      } else if (!before) {
        let attempt = 0;
        do {
          after = createMigratedNodeId(node, path, attempt, options);
          attempt += 1;
        } while (assignedIds.has(after));
        $setNodeProperties(node, (previous) => ({ ...previous, nodeId: after }));
        generatedNodeIds.push(after);
      }

      if (after) {
        nodes.push(node);
        seenIds.add(after);
        assignedIds.add(after);
      }
    }

    if ($isElementNode(node)) {
      node.getChildren().forEach((child, index) => visit(child, [...path, index]));
    }
  };

  visit(root, []);
  duplicateIds.forEach((nodeId) => duplicateNodeIds.push(nodeId));
  return { duplicateNodeIds, generatedNodeIds, nodes, reassignedNodeIds };
}

const createMigratedNodeId = (
  node: LexicalNode,
  path: ReadonlyArray<number>,
  attempt: number,
  options: NodeIdentityMigrationOptions,
): string => {
  const stableIdentity = options.stableIdentity?.(node);
  if (stableIdentity) {
    return createDeterministicNodeId(
      `legacy-node-id:v1:collaboration:${stableIdentity}:${attempt}`,
    );
  }
  return getDeterministicNodeId(node, [...(options.pathPrefix ?? []), ...path, attempt]);
};

/** Alias used by integrations that describe this operation as a migration. */
export const $migrateNodeIds = $ensureNodeIdsInTree;

/** Find the current node by durable ID inside the active editor tree. */
export function $findNodeById(nodeId: string, root: LexicalNode = $getRoot()): LexicalNode | null {
  if (!isNodeIdValue(nodeId)) return null;

  let match: LexicalNode | null = null;
  const visit = (node: LexicalNode): void => {
    if (match) return;
    if ($getNodeId(node) === nodeId) {
      match = node;
      return;
    }
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };
  visit(root);
  return match;
}

/** Publicly named alias for callers that prefer the `$get...` convention. */
export const $getNodeById = $findNodeById;

/** Return all matching nodes, useful for validation of a supposedly unique ID. */
export function $findNodesById(nodeId: string, root: LexicalNode = $getRoot()): LexicalNode[] {
  if (!isNodeIdValue(nodeId)) return [];
  const matches: LexicalNode[] = [];
  const visit = (node: LexicalNode): void => {
    if ($getNodeId(node) === nodeId) matches.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };
  visit(root);
  return matches;
}

/** Copy only durable target metadata across a semantic replacement. */
export function $preserveNodeIdentity(source: LexicalNode, replacement: LexicalNode): LexicalNode {
  const sourceProperties = $getNodeProperties(source);
  const sourceNodeId = $getNodeId(source);
  if (!sourceNodeId) return replacement;

  const replacementProperties = $getNodeProperties(replacement);
  const annotationIds = Array.from(
    new Set([
      ...(sourceProperties.annotationIds ?? []),
      ...(replacementProperties.annotationIds ?? []),
    ]),
  );
  const nextProperties = {
    ...replacementProperties,
    nodeId: sourceNodeId,
  };
  if (annotationIds.length > 0) nextProperties.annotationIds = annotationIds;
  $setNodeProperties(replacement, nextProperties);
  return replacement;
}

export function $getSelectionNodes(selection?: BaseSelection | null): LexicalNode[] {
  const currentSelection = selection ?? $getSelection();
  if (!currentSelection) return [];

  // RangeSelection.extract() splits the boundary TextNodes and is therefore the only safe
  // operation for a character-precise annotation. NodeSelection already returns whole nodes.
  if ($isRangeSelection(currentSelection)) return currentSelection.extract();
  return currentSelection.getNodes();
}

export function $resolveNodeKeys(nodeKeys: ReadonlyArray<string>): LexicalNode[] {
  return nodeKeys
    .map((key) => $getNodeByKey(key))
    .filter((node): node is LexicalNode => node !== null);
}

export function $resolveNodeIds(nodeIds: ReadonlyArray<string>): LexicalNode[] {
  const nodes: LexicalNode[] = [];
  const seen = new Set<LexicalNode>();
  for (const nodeId of nodeIds) {
    const node = $findNodeById(nodeId);
    if (node && !seen.has(node)) {
      seen.add(node);
      nodes.push(node);
    }
  }
  return nodes;
}

export function $applyPropertiesToSelection(
  selectionOrProperties: BaseSelection | NodePropertiesUpdater,
  propertiesOrSelection?: NodePropertiesUpdater | BaseSelection | null,
): LexicalNode[] {
  const selection = isSelection(selectionOrProperties)
    ? selectionOrProperties
    : isSelection(propertiesOrSelection)
      ? propertiesOrSelection
      : null;
  const properties = isSelection(selectionOrProperties)
    ? propertiesOrSelection
    : selectionOrProperties;

  if (!properties || isSelection(properties)) return [];

  const nodes = $getSelectionNodes(selection);
  for (const node of nodes) {
    $setNodeProperties(node, properties);
  }
  return nodes;
}

export function $applyPropertiesToNodeKeys(
  nodeKeys: ReadonlyArray<string>,
  properties: NodePropertiesUpdater,
): LexicalNode[] {
  const nodes = $resolveNodeKeys(nodeKeys);
  for (const node of nodes) $setNodeProperties(node, properties);
  return nodes;
}

export function $applyPropertiesToNodeIds(
  nodeIds: ReadonlyArray<string>,
  properties: NodePropertiesUpdater,
): LexicalNode[] {
  const nodes = $resolveNodeIds(nodeIds);
  for (const node of nodes) $setNodeProperties(node, properties);
  return nodes;
}

export function $getAnnotationIds(node: LexicalNode): string[] {
  return $getNodeProperties(node).annotationIds ?? [];
}

export function $addAnnotationId(node: LexicalNode, annotationId: string): LexicalNode {
  return $setNodeProperties(node, (previous) => ({
    ...previous,
    annotationIds: Array.from(new Set([...(previous.annotationIds ?? []), annotationId])),
  }));
}

export function $removeAnnotationId(node: LexicalNode, annotationId: string): LexicalNode {
  return $setNodeProperties(node, (previous) => {
    const annotationIds = (previous.annotationIds ?? []).filter((id) => id !== annotationId);
    const next = { ...previous };
    if (annotationIds.length > 0) next.annotationIds = annotationIds;
    else delete next.annotationIds;
    return next;
  });
}

export function $stripAnnotationIds(node: LexicalNode): void {
  const properties = $getNodeProperties(node);
  if (properties.annotationIds) {
    $setNodeProperties(node, (previous) => {
      const next = { ...previous };
      delete next.annotationIds;
      return next;
    });
  }
  if ('getChildren' in node && typeof node.getChildren === 'function') {
    for (const child of node.getChildren()) $stripAnnotationIds(child);
  }
}

/**
 * Prepare generated clipboard nodes for insertion into a document. Clipboard
 * payloads are serialized and reconstructed, so Lexical's runtime key is
 * already new; this second identity reset prevents the durable block ID from
 * aliasing the source block. Annotation anchors are intentionally private to
 * the source document and are always removed.
 */
export function $prepareCopiedNode(node: LexicalNode): void {
  const previous = $getNodeProperties(node);
  const isIdentityTarget = $isNodeIdentityTarget(node);
  if (isIdentityTarget || previous.nodeId !== undefined || previous.annotationIds) {
    const { annotationIds: _annotationIds, ...withoutAnnotations } = previous;
    $setNodeProperties(node, {
      ...withoutAnnotations,
      ...(isIdentityTarget || previous.nodeId !== undefined ? { nodeId: createNodeId() } : {}),
    });
  }

  if ($isElementNode(node)) node.getChildren().forEach($prepareCopiedNode);
}

export function $markNodesAsAIGenerated(
  nodes: ReadonlyArray<LexicalNode>,
  provenance: Omit<NodeProvenance, 'source'> & { source?: 'ai' },
): void {
  const value: NodeProvenance = {
    ...provenance,
    createdAt: provenance.createdAt ?? new Date().toISOString(),
    source: 'ai',
  };
  for (const node of nodes) {
    $setNodeProperties(node, (previous) => ({ ...previous, provenance: value }));
    if ('getChildren' in node && typeof node.getChildren === 'function') {
      $markNodesAsAIGenerated(node.getChildren(), {
        createdAt: value.createdAt,
        generationId: value.generationId,
        model: value.model,
        provider: value.provider,
        requestId: value.requestId,
        sessionId: value.sessionId,
        turnIndex: value.turnIndex,
      });
    }
  }
}

/**
 * Adds provenance to a parsed Markdown/Lexical JSON tree before insertion.
 *
 * Injecting the state before Lexical creates the nodes is important: a newly generated text node
 * must not merge with an adjacent human-authored text node while the insertion is normalized.
 */
export function markSerializedNodesAsAIGenerated<T extends { children?: SerializedLexicalNode[] }>(
  root: T,
  provenance: Omit<NodeProvenance, 'source'> & { source?: 'ai' },
): T {
  const value: NodeProvenance = {
    ...provenance,
    createdAt: provenance.createdAt ?? new Date().toISOString(),
    source: 'ai',
  };

  const visit = (node: SerializedLexicalNode): void => {
    const serializableNode = node as SerializedLexicalNode & {
      children?: SerializedLexicalNode[];
    };
    const state = isRecord(node.$) ? node.$ : {};
    const properties = isRecord(state.properties) ? state.properties : {};
    node.$ = {
      ...state,
      properties: {
        ...properties,
        provenance: value,
      },
    };
    if (Array.isArray(serializableNode.children)) {
      for (const child of serializableNode.children) visit(child);
    }
  };

  for (const child of root.children ?? []) visit(child);
  return root;
}

export function $getNodesForSelectionOrKeys(
  selection: BaseSelection | null | undefined,
  nodeKeys?: ReadonlyArray<string>,
): LexicalNode[] {
  if (nodeKeys && nodeKeys.length > 0) return $resolveNodeKeys(nodeKeys);
  return $getSelectionNodes(selection);
}

export function $getNodesForSelectionOrIds(
  selection: BaseSelection | null | undefined,
  nodeIds?: ReadonlyArray<string>,
): LexicalNode[] {
  if (nodeIds && nodeIds.length > 0) return $resolveNodeIds(nodeIds);
  return $getSelectionNodes(selection);
}

function isSelection(value: unknown): value is BaseSelection {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as BaseSelection).getNodes === 'function' &&
    typeof (value as BaseSelection).extract === 'function'
  );
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeIdValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function $getRangeSelection(): RangeSelection | null {
  const selection = $getSelection();
  return $isRangeSelection(selection) ? selection : null;
}

export function $getNodeSelection(): NodeSelection | null {
  const selection = $getSelection();
  return $isNodeSelection(selection) ? selection : null;
}

export function $getSelectedTextNodes(selection?: BaseSelection | null): LexicalNode[] {
  return $getSelectionNodes(selection).filter($isTextNode);
}
