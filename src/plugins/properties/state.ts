import type { LexicalNode } from 'lexical';
import { $getState, $setState, createState } from 'lexical';

import { createNodeId } from '@/plugins/common/node/create-node-id';

import type { NodeProperties, NodePropertiesUpdater } from './types';

const EMPTY_PROPERTIES: NodeProperties = {};

/**
 * Generate a compact 10-character base-36 identity for newly created nodes.
 * The shared implementation uses crypto entropy when available and also runs
 * in headless and Node environments.
 */
export { createNodeId };

/**
 * Create a UUID-shaped durable identity from a stable document-local seed.
 * Legacy migrations use this instead of random UUIDs so simultaneous clients
 * converge on the same identity for the same logical block. The hash is not a
 * security primitive; it only provides deterministic, collision-resistant
 * addressing within one document tree.
 */
export function createDeterministicNodeId(seed: string): string {
  const hash = (value: string, initial: number): number => {
    let result = initial >>> 0;
    for (let index = 0; index < value.length; index++) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16_777_619);
    }
    return result >>> 0;
  };

  const words = [
    hash(seed, 2_166_136_261),
    hash(`${seed}:1`, 2_166_136_261),
    hash(`${seed}:2`, 2_166_136_261),
    hash(`${seed}:3`, 2_166_136_261),
  ];
  let hex = words.map((word) => word.toString(16).padStart(8, '0')).join('');
  hex = `${hex.slice(0, 12)}4${hex.slice(13, 16)}${'89ab'[Number.parseInt(hex[16], 16) % 4]}${hex.slice(17)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Accept imported legacy IDs; newly generated IDs use the compact base-36 format. */
export function isNodeId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to a JSON clone for older browsers or values that structuredClone rejects.
    }
  }
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
};

const isEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => isEqual(value, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => isEqual(left[key], right[key]));
};

const parseProperties = (value: unknown): NodeProperties => {
  if (!isPlainObject(value)) return EMPTY_PROPERTIES;

  const properties = cloneValue(value) as NodeProperties;

  if (properties.nodeId !== undefined) {
    if (!isNodeId(properties.nodeId) || properties.nodeId.trim() === 'root') {
      delete properties.nodeId;
    } else properties.nodeId = properties.nodeId.trim();
  }

  if (Array.isArray(properties.annotationIds)) {
    properties.annotationIds = Array.from(
      new Set(properties.annotationIds.filter((id): id is string => typeof id === 'string')),
    );
    if (properties.annotationIds.length === 0) delete properties.annotationIds;
  } else {
    delete properties.annotationIds;
  }

  if (!isPlainObject(properties.provenance)) {
    delete properties.provenance;
  } else if (properties.provenance.source !== 'ai' && properties.provenance.source !== 'human') {
    delete properties.provenance;
  } else {
    if (
      properties.provenance.sessionId !== undefined &&
      !isNodeId(properties.provenance.sessionId)
    ) {
      delete properties.provenance.sessionId;
    }
    if (
      properties.provenance.turnIndex !== undefined &&
      (!Number.isSafeInteger(properties.provenance.turnIndex) ||
        properties.provenance.turnIndex < 0)
    ) {
      delete properties.provenance.turnIndex;
    }
  }

  return properties;
};

/** Shared Lexical NodeState used by every node type. */
export const propertiesState = createState('properties', {
  isEqual,
  parse: parseProperties,
  // Keep exported JSON detached from the mutable metadata object stored on the
  // Lexical node. This also preserves the `properties` state contract used by
  // the shared identity API.
  unparse: cloneValue,
});

export function $getNodeProperties(node: LexicalNode): NodeProperties {
  return $getState(node, propertiesState);
}

export function $setNodeProperties(
  node: LexicalNode,
  propertiesOrUpdater: NodePropertiesUpdater,
): LexicalNode {
  return $setState(node, propertiesState, (previous) => {
    const next =
      typeof propertiesOrUpdater === 'function'
        ? propertiesOrUpdater(previous, node)
        : propertiesOrUpdater;
    return parseProperties(next);
  });
}

export function $mergeNodeProperties(
  node: LexicalNode,
  properties: Partial<NodeProperties>,
): LexicalNode {
  return $setNodeProperties(node, (previous) => parseProperties({ ...previous, ...properties }));
}

export function $removeNodeProperties(node: LexicalNode, keys: ReadonlyArray<string>): LexicalNode {
  return $setNodeProperties(node, (previous) => {
    const next = { ...previous };
    for (const key of keys) delete next[key];
    return next;
  });
}

export function cloneNodeProperties(properties: NodeProperties): NodeProperties {
  return parseProperties(properties);
}
