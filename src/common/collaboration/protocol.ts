/**
 * Engine-neutral collaboration wire contracts.
 *
 * This module intentionally has no CRDT, editor, transport, or runtime
 * dependency.  The descriptor is the discriminator for every persisted or
 * ephemeral collaboration value, so a Yjs value cannot be interpreted as a
 * Loro value (or as a different Lexical binding schema) by accident. The
 * descriptor does not identify a room or document: an outer room envelope
 * must carry and validate its own `roomId`/document namespace.
 */

export const COLLABORATION_ENGINES = ['yjs', 'loro'] as const;
export type CollaborationEngine = (typeof COLLABORATION_ENGINES)[number];

export const COLLABORATION_BINDING_SCHEMAS = [
  'lexical-yjs-v1',
  'lexical-yjs-v2',
  'lexical-loro-v1',
] as const;
export type CollaborationBindingSchema = (typeof COLLABORATION_BINDING_SCHEMAS)[number];

export interface CollaborationDescriptor {
  readonly bindingSchema: CollaborationBindingSchema;
  readonly engine: CollaborationEngine;
  readonly epoch: number;
}

const DESCRIPTOR_KEYS = ['bindingSchema', 'engine', 'epoch'] as const;

const VALID_DESCRIPTOR_PAIRS: ReadonlySet<string> = new Set([
  'yjs\u0000lexical-yjs-v1',
  'yjs\u0000lexical-yjs-v2',
  'loro\u0000lexical-loro-v1',
]);

export type CollaborationProtocolErrorCode =
  | 'invalid-anchor'
  | 'invalid-cas-token'
  | 'invalid-causal-version'
  | 'invalid-descriptor'
  | 'invalid-bound-causal-version'
  | 'invalid-persistence-proof'
  | 'invalid-room-revision'
  | 'invalid-snapshot'
  | 'descriptor-mismatch';

export class CollaborationProtocolError extends Error {
  readonly code: CollaborationProtocolErrorCode;

  constructor(code: CollaborationProtocolErrorCode, message: string) {
    super(message);
    this.name = 'CollaborationProtocolError';
    this.code = code;
  }
}

export interface CrdtCausalVersion {
  readonly kind: 'crdt-causal-version';
  /** Opaque engine-specific encoding (for example a state vector or VV). */
  readonly value: string;
}

export interface RoomRevision {
  readonly kind: 'room-revision';
  /** Monotonic room log position; it is not a CRDT version. */
  readonly value: number;
}

export interface CasToken {
  readonly kind: 'cas-token';
  /** Opaque persistence compare-and-swap token; it is not a room revision. */
  readonly value: string;
}

/** A CRDT causal version that cannot be applied to another binding schema. */
export interface BoundCausalVersion {
  readonly causalVersion: CrdtCausalVersion;
  readonly descriptor: CollaborationDescriptor;
}

/** Server persistence proof; this is separate from a local CRDT causal version. */
export interface PersistenceProof {
  readonly casToken: CasToken;
  readonly descriptor: CollaborationDescriptor;
  readonly roomRevision: RoomRevision;
}

export interface CollaborationSnapshot {
  readonly descriptor: CollaborationDescriptor;
  /** Transport encoding of the engine-owned snapshot bytes. */
  readonly payload: string;
  readonly version: BoundCausalVersion;
}

export interface TextCursorAnchor {
  readonly cursor: string;
  readonly descriptor: CollaborationDescriptor;
  readonly kind: 'text-cursor';
}

export interface NodeBoundaryAnchor {
  readonly descriptor: CollaborationDescriptor;
  readonly kind: 'node-boundary';
  readonly nodeId: string;
  readonly side: 'before' | 'after';
}

export type CollaborationAnchor = TextCursorAnchor | NodeBoundaryAnchor;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: UnknownRecord, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isSafeNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;

const descriptorPairKey = (
  engine: CollaborationEngine,
  bindingSchema: CollaborationBindingSchema,
): string => `${engine}\u0000${bindingSchema}`;

/** Return true only for a complete descriptor with a supported engine/schema pair. */
export const isCollaborationDescriptor = (value: unknown): value is CollaborationDescriptor => {
  if (!isRecord(value) || !hasExactKeys(value, DESCRIPTOR_KEYS)) return false;
  if (value.engine !== 'yjs' && value.engine !== 'loro') return false;
  if (
    value.bindingSchema !== 'lexical-yjs-v1' &&
    value.bindingSchema !== 'lexical-yjs-v2' &&
    value.bindingSchema !== 'lexical-loro-v1'
  ) {
    return false;
  }
  if (!isSafeNonNegativeInteger(value.epoch)) return false;

  return VALID_DESCRIPTOR_PAIRS.has(descriptorPairKey(value.engine, value.bindingSchema));
};

export const sameCollaborationDescriptor = (
  left: CollaborationDescriptor,
  right: CollaborationDescriptor,
): boolean =>
  left.engine === right.engine &&
  left.bindingSchema === right.bindingSchema &&
  left.epoch === right.epoch;

const assertDescriptor = (value: unknown, label: string): CollaborationDescriptor => {
  if (!isCollaborationDescriptor(value)) {
    throw new CollaborationProtocolError(
      'invalid-descriptor',
      `${label} must contain a supported engine/schema pair and a non-negative safe integer epoch`,
    );
  }

  return value;
};

const assertBoundDescriptor = (
  expected: CollaborationDescriptor,
  actual: unknown,
  label: string,
): CollaborationDescriptor => {
  const expectedDescriptor = assertDescriptor(expected, 'expected descriptor');
  const descriptor = assertDescriptor(actual, `${label}.descriptor`);
  if (!sameCollaborationDescriptor(expectedDescriptor, descriptor)) {
    throw new CollaborationProtocolError(
      'descriptor-mismatch',
      `${label}.descriptor does not match the expected collaboration descriptor`,
    );
  }

  return descriptor;
};

/** Validate and return a descriptor at a wire boundary. */
export const parseCollaborationDescriptor = (value: unknown): CollaborationDescriptor =>
  assertDescriptor(value, 'descriptor');

export const isCrdtCausalVersion = (value: unknown): value is CrdtCausalVersion =>
  isRecord(value) &&
  hasExactKeys(value, ['kind', 'value']) &&
  value.kind === 'crdt-causal-version' &&
  isString(value.value);

export const isRoomRevision = (value: unknown): value is RoomRevision =>
  isRecord(value) &&
  hasExactKeys(value, ['kind', 'value']) &&
  value.kind === 'room-revision' &&
  isSafeNonNegativeInteger(value.value);

export const isCasToken = (value: unknown): value is CasToken =>
  isRecord(value) &&
  hasExactKeys(value, ['kind', 'value']) &&
  value.kind === 'cas-token' &&
  isNonEmptyString(value.value);

export const parseCrdtCausalVersion = (value: unknown): CrdtCausalVersion => {
  if (!isCrdtCausalVersion(value)) {
    throw new CollaborationProtocolError(
      'invalid-causal-version',
      'causalVersion must be a tagged opaque string value',
    );
  }

  return value;
};

export const parseRoomRevision = (value: unknown): RoomRevision => {
  if (!isRoomRevision(value)) {
    throw new CollaborationProtocolError(
      'invalid-room-revision',
      'roomRevision must be a tagged non-negative safe integer',
    );
  }

  return value;
};

export const parseCasToken = (value: unknown): CasToken => {
  if (!isCasToken(value)) {
    throw new CollaborationProtocolError(
      'invalid-cas-token',
      'casToken must be a tagged opaque string value',
    );
  }

  return value;
};

const isBoundCausalVersionValue = (value: unknown): value is BoundCausalVersion =>
  isRecord(value) &&
  hasExactKeys(value, ['causalVersion', 'descriptor']) &&
  isCollaborationDescriptor(value.descriptor) &&
  isCrdtCausalVersion(value.causalVersion);

export const isBoundCausalVersion = isBoundCausalVersionValue;

export const parseBoundCausalVersion = (
  value: unknown,
  expectedDescriptor?: CollaborationDescriptor,
): BoundCausalVersion => {
  if (!isBoundCausalVersionValue(value)) {
    throw new CollaborationProtocolError(
      'invalid-bound-causal-version',
      'bound causal version must contain a descriptor and tagged causal version',
    );
  }
  if (expectedDescriptor)
    assertBoundDescriptor(expectedDescriptor, value.descriptor, 'causalVersion');
  return value;
};

const isPersistenceProofValue = (value: unknown): value is PersistenceProof =>
  isRecord(value) &&
  hasExactKeys(value, ['casToken', 'descriptor', 'roomRevision']) &&
  isCollaborationDescriptor(value.descriptor) &&
  isRoomRevision(value.roomRevision) &&
  isCasToken(value.casToken);

export const isPersistenceProof = isPersistenceProofValue;

export const parsePersistenceProof = (
  value: unknown,
  expectedDescriptor?: CollaborationDescriptor,
): PersistenceProof => {
  if (!isPersistenceProofValue(value)) {
    throw new CollaborationProtocolError(
      'invalid-persistence-proof',
      'persistence proof must contain a descriptor, room revision, and CAS token',
    );
  }
  if (expectedDescriptor)
    assertBoundDescriptor(expectedDescriptor, value.descriptor, 'persistenceProof');
  return value;
};

const isTextCursorAnchor = (value: unknown): value is TextCursorAnchor =>
  isRecord(value) &&
  hasExactKeys(value, ['cursor', 'descriptor', 'kind']) &&
  value.kind === 'text-cursor' &&
  isNonEmptyString(value.cursor) &&
  isCollaborationDescriptor(value.descriptor);

const isNodeBoundaryAnchor = (value: unknown): value is NodeBoundaryAnchor =>
  isRecord(value) &&
  hasExactKeys(value, ['descriptor', 'kind', 'nodeId', 'side']) &&
  value.kind === 'node-boundary' &&
  isCollaborationDescriptor(value.descriptor) &&
  isNonEmptyString(value.nodeId) &&
  (value.side === 'before' || value.side === 'after');

const isAnchor = (value: unknown): value is CollaborationAnchor =>
  isTextCursorAnchor(value) || isNodeBoundaryAnchor(value);

export const isCollaborationAnchor = isAnchor;

export const parseCollaborationAnchor = (
  value: unknown,
  expectedDescriptor?: CollaborationDescriptor,
): CollaborationAnchor => {
  if (!isAnchor(value)) {
    throw new CollaborationProtocolError(
      'invalid-anchor',
      'anchor must be a text-cursor or node-boundary value with a descriptor',
    );
  }
  if (expectedDescriptor) assertBoundDescriptor(expectedDescriptor, value.descriptor, 'anchor');
  return value;
};

const isSnapshot = (value: unknown): value is CollaborationSnapshot =>
  isRecord(value) &&
  hasExactKeys(value, ['descriptor', 'payload', 'version']) &&
  isCollaborationDescriptor(value.descriptor) &&
  isString(value.payload) &&
  isBoundCausalVersionValue(value.version) &&
  sameCollaborationDescriptor(value.descriptor, value.version.descriptor);

export const isCollaborationSnapshot = isSnapshot;

export const parseCollaborationSnapshot = (
  value: unknown,
  expectedDescriptor?: CollaborationDescriptor,
): CollaborationSnapshot => {
  if (!isSnapshot(value)) {
    throw new CollaborationProtocolError(
      'invalid-snapshot',
      'snapshot must contain a payload and a bound causal version',
    );
  }
  if (expectedDescriptor) assertBoundDescriptor(expectedDescriptor, value.descriptor, 'snapshot');
  // `isSnapshot` already checks this relationship; keep the assertion close to
  // the parser so future changes cannot accidentally drop the nested binding.
  assertBoundDescriptor(value.descriptor, value.version.descriptor, 'snapshot.version');
  return value;
};

/**
 * Validate a descriptor binding without accepting a structurally similar
 * value from another engine/schema.  This is useful for server-side checks
 * before decoding any engine-owned bytes.
 */
export const assertDescriptorBinding = (
  expected: unknown,
  actual: unknown,
  label = 'value',
): CollaborationDescriptor => {
  const expectedDescriptor = assertDescriptor(expected, 'expected descriptor');
  return assertBoundDescriptor(expectedDescriptor, actual, label);
};
