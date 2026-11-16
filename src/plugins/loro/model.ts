import {
  type Container,
  LoroDoc,
  type LoroEventBatch,
  type LoroMap,
  type LoroText,
  type LoroTree,
  type LoroTreeNode,
  type TreeID,
} from 'loro-crdt';

import { parseCollaborationDescriptor } from '@/common/collaboration/protocol';

import type { LoroBindingDescriptor, LoroCommitOptions, LoroNodeData, LoroNodeRole } from './types';
import { createLoroBindingDescriptor } from './types';

export const LORO_LEXICAL_TREE_NAME = 'lobe:lexical:v1';
export const LORO_LEXICAL_META_NAME = 'lobe:lexical:meta';
export const LORO_LEXICAL_SCHEMA = 'lexical-loro-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isContainer = (value: unknown): value is Container =>
  isRecord(value) && typeof (value as { kind?: unknown }).kind === 'function';

const readContainer = (value: unknown): Container | undefined => {
  if (!isContainer(value)) return undefined;
  return value;
};

const readMap = (value: unknown): LoroMap | undefined => {
  const container = readContainer(value);
  return container?.kind?.() === 'Map' ? (container as LoroMap) : undefined;
};

const readText = (value: unknown): LoroText | undefined => {
  const container = readContainer(value);
  return container?.kind?.() === 'Text' ? (container as LoroText) : undefined;
};

const cloneJsonValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall through for values that the platform cannot clone.
    }
  }

  if (value === undefined) return value;
  // Keep a JSON-safe fallback for headless/browser runtimes without structuredClone.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return JSON.parse(JSON.stringify(value)) as T;
};

const readMapValues = (map: LoroMap | undefined): Record<string, unknown> => {
  if (!map) return {};

  const result: Record<string, unknown> = {};
  for (const key of map.keys()) {
    const value = map.get(key);
    result[key] = isContainer(value) ? value : cloneJsonValue(value);
  }
  return result;
};

const setMapPatch = (map: LoroMap, values: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      map.delete(key);
      continue;
    }
    map.set(key, cloneJsonValue(value) as never);
  }
};

const ensurePropertiesMap = (node: LoroTreeNode): LoroMap =>
  node.data.ensureMergeableMap('properties');

const ensureAttrsMap = (node: LoroTreeNode): LoroMap => node.data.ensureMergeableMap('attrs');

const ensureTextContainer = (node: LoroTreeNode, key: 'body' | 'flow'): LoroText =>
  node.data.ensureMergeableText(key);

export interface CreateLoroNodeInput {
  attrs?: Record<string, unknown>;
  body?: string;
  flow?: string;
  nodeId?: string;
  parent?: TreeID;
  properties?: Record<string, unknown>;
  role: LoroNodeRole;
  type: string;
  index?: number;
}

export class LoroCommitError extends Error {
  readonly pendingOps: unknown;

  constructor(message: string, pendingOps: unknown) {
    super(message);
    this.name = 'LoroCommitError';
    this.pendingOps = pendingOps;
  }
}

/**
 * The Loro-side canonical model. It deliberately exposes containers and
 * field-level operations instead of a JSON document replacement API.
 */
export class LoroCanonicalDocument {
  readonly descriptor: LoroBindingDescriptor;
  readonly doc: LoroDoc;
  readonly meta: LoroMap;
  readonly tree: LoroTree;

  private readonly allowUninitialized: boolean;

  constructor(
    doc = new LoroDoc(),
    descriptor = createLoroBindingDescriptor(),
    options: { initialize?: boolean } = {},
  ) {
    this.doc = doc;
    this.descriptor = validateLoroBindingDescriptor(descriptor);
    this.allowUninitialized = options.initialize === false;
    this.meta = doc.getMap(LORO_LEXICAL_META_NAME);
    this.tree = doc.getTree(LORO_LEXICAL_TREE_NAME);

    // Root containers are created without an operation. The schema marker is
    // a small map field and is written only when this model is first used.
    const existingSchema = this.meta.get('schemaVersion');
    if (existingSchema === undefined && !this.allowUninitialized) {
      this.meta.set('schemaVersion', LORO_LEXICAL_SCHEMA);
      this.meta.set('bindingSchema', descriptor.bindingSchema);
      this.meta.set('epoch', descriptor.epoch);
    } else if (existingSchema !== undefined) {
      this.assertMetadata(existingSchema);
    }
  }

  static fromSnapshot(
    snapshot: Uint8Array,
    descriptor = createLoroBindingDescriptor(),
  ): LoroCanonicalDocument {
    return new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot), descriptor, {
      initialize: false,
    });
  }

  subscribe(listener: (event: LoroEventBatch) => void): () => void {
    return this.doc.subscribe(listener);
  }

  commit<T>(callback: () => T, options: LoroCommitOptions = {}): T {
    if (options.origin || options.message) {
      this.doc.setNextCommitOptions({
        ...(options.message ? { message: options.message } : {}),
        ...(options.origin ? { origin: options.origin } : {}),
      });
    }

    try {
      const result = callback();
      this.doc.commit();
      return result;
    } catch {
      this.doc.clearNextCommitOptions();
      const pendingOps = this.doc.getUncommittedOpsAsJson();
      throw new LoroCommitError(
        'Loro commit callback failed; pending operations remain on the document and require explicit recovery.',
        pendingOps,
      );
    }
  }

  exportSnapshot(): Uint8Array {
    return this.doc.export({ mode: 'snapshot' });
  }

  exportUpdate(from = this.doc.version()): Uint8Array {
    return this.doc.export({ mode: 'update', from });
  }

  import(update: Uint8Array, options: { trusted?: boolean } = {}) {
    // The hot path is fed by an already validated engine/schema/epoch
    // envelope and imports directly. Candidate data (for example a server
    // snapshot before room admission) can opt into an isolated probe; that
    // path is intentionally explicit because cloning the full history per
    // keystroke would defeat incremental collaboration.
    if (options.trusted !== false) {
      const status = this.doc.import(update);
      this.assertMetadata(this.meta.get('schemaVersion'));
      return status;
    }

    const probe = LoroDoc.fromSnapshot(this.exportSnapshot());
    try {
      probe.import(update);
      const probeMeta = probe.getMap(LORO_LEXICAL_META_NAME);
      const probeSchema = probeMeta.get('schemaVersion');
      if (probeSchema === undefined && this.allowUninitialized) return this.doc.import(update);
      this.assertMetadata(probeSchema, probeMeta);
      return this.doc.import(update);
    } finally {
      probe.free();
    }
  }

  getNode(treeId: TreeID): LoroTreeNode | undefined {
    return this.tree.getNodeByID(treeId);
  }

  getNodes(withDeleted = false): LoroTreeNode[] {
    return this.tree.getNodes(withDeleted ? { withDeleted: true } : undefined);
  }

  findNodeById(nodeId: string, withDeleted = false): LoroTreeNode | undefined {
    return this.getNodes(withDeleted).find((node) => this.readNodeId(node) === nodeId);
  }

  readNodeId(node: LoroTreeNode): string | undefined {
    const properties = readMap(node.data.get('properties'));
    const nodeId = properties?.get('nodeId');
    return typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : undefined;
  }

  readNode(node: LoroTreeNode): LoroNodeData {
    const properties = readMap(node.data.get('properties'));
    const attrs = readMap(node.data.get('attrs'));
    const flow = readText(node.data.get('flow'));
    const body = readText(node.data.get('body'));
    const role = node.data.get('role');
    const type = node.data.get('type');

    return {
      attrs: readMapValues(attrs),
      ...(body ? { body } : {}),
      containerId: node.data.id,
      ...(flow ? { flow } : {}),
      nodeId: this.readNodeId(node),
      properties: readMapValues(properties),
      role: role === 'atom' || role === 'block-decorator' || role === 'inline' ? role : 'element',
      treeId: node.id,
      type: typeof type === 'string' ? type : 'unknown',
    };
  }

  createNode(input: CreateLoroNodeInput): LoroTreeNode {
    const node = this.tree.createNode(input.parent, input.index);
    this.writeNode(node, input);
    return node;
  }

  private writeNode(
    node: LoroTreeNode,
    input: Omit<CreateLoroNodeInput, 'parent' | 'index'>,
  ): void {
    node.data.set('type', input.type);
    node.data.set('role', input.role);

    const properties = ensurePropertiesMap(node);
    const nextProperties = {
      ...input.properties,
      ...(input.nodeId ? { nodeId: input.nodeId } : {}),
    };
    setMapPatch(properties, nextProperties);

    const attrs = ensureAttrsMap(node);
    setMapPatch(attrs, input.attrs ?? {});

    // Node creation is the only place where initial text is accepted as a
    // value. Existing text must use updateFlow/updateBody, which are explicit
    // content operations and never part of an attrs patch.
    if (input.flow !== undefined) ensureTextContainer(node, 'flow').update(input.flow);
    if (input.body !== undefined) ensureTextContainer(node, 'body').update(input.body);
  }

  updateNodeFields(
    node: LoroTreeNode,
    fields: Partial<Pick<CreateLoroNodeInput, 'attrs' | 'nodeId' | 'properties'>>,
  ): void {
    if (fields.nodeId !== undefined) ensurePropertiesMap(node).set('nodeId', fields.nodeId);
    if (fields.properties) setMapPatch(ensurePropertiesMap(node), fields.properties);
    if (fields.attrs) setMapPatch(ensureAttrsMap(node), fields.attrs);
  }

  updateFlow(node: LoroTreeNode, next: string): void {
    ensureTextContainer(node, 'flow').update(next, { useRefinedDiff: true });
  }

  updateBody(node: LoroTreeNode, next: string): void {
    ensureTextContainer(node, 'body').update(next, { useRefinedDiff: true });
  }

  deleteMapFields(
    node: LoroTreeNode,
    target: 'attrs' | 'properties',
    keys: readonly string[],
  ): void {
    const map = target === 'attrs' ? ensureAttrsMap(node) : ensurePropertiesMap(node);
    keys.forEach((key) => map.delete(key));
  }

  moveNode(treeId: TreeID, parent?: TreeID, index?: number): void {
    this.tree.move(treeId, parent, index);
  }

  deleteNode(treeId: TreeID): void {
    this.tree.delete(treeId);
  }

  private assertMetadata(schemaValue: unknown, sourceMeta: LoroMap = this.meta): void {
    if (schemaValue !== LORO_LEXICAL_SCHEMA) {
      throw new Error(`Unsupported Loro document schema: ${String(schemaValue)}`);
    }

    const bindingSchema = sourceMeta.get('bindingSchema');
    const epoch = sourceMeta.get('epoch');
    if (bindingSchema !== this.descriptor.bindingSchema || epoch !== this.descriptor.epoch) {
      throw new Error(
        `Loro descriptor mismatch: expected ${this.descriptor.bindingSchema}@${this.descriptor.epoch}.`,
      );
    }
  }
}

export function validateLoroBindingDescriptor(
  descriptor: LoroBindingDescriptor,
): LoroBindingDescriptor {
  const parsed = parseCollaborationDescriptor(descriptor);
  if (parsed.engine !== 'loro' || parsed.bindingSchema !== 'lexical-loro-v1') {
    throw new Error('The Lexical Loro binding requires the lexical-loro-v1 descriptor.');
  }
  return parsed as LoroBindingDescriptor;
}

export const getAttachedText = (node: LoroTreeNode, key: 'body' | 'flow'): LoroText | null =>
  readText(node.data.get(key)) ?? null;

export const getAttachedMap = (node: LoroTreeNode, key: 'attrs' | 'properties'): LoroMap | null =>
  readMap(node.data.get(key)) ?? null;
