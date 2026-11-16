import {
  assertDescriptorBinding,
  CollaborationProtocolError,
  isCollaborationAnchor,
  isCollaborationDescriptor,
  isCollaborationSnapshot,
  isBoundCausalVersion,
  isPersistenceProof,
  parseCollaborationAnchor,
  parseCollaborationDescriptor,
  parseCollaborationSnapshot,
  parseBoundCausalVersion,
  parsePersistenceProof,
  type CollaborationAnchor,
  type CollaborationDescriptor,
  type CollaborationSnapshot,
  type BoundCausalVersion,
  type PersistenceProof,
} from './protocol';

const yjsDescriptor: CollaborationDescriptor = {
  bindingSchema: 'lexical-yjs-v2',
  engine: 'yjs',
  epoch: 0,
};

const loroDescriptor: CollaborationDescriptor = {
  bindingSchema: 'lexical-loro-v1',
  engine: 'loro',
  epoch: 0,
};

const causalVersion = (descriptor: CollaborationDescriptor): BoundCausalVersion => ({
  causalVersion: { kind: 'crdt-causal-version', value: '' },
  descriptor,
});

const snapshot = (descriptor: CollaborationDescriptor): CollaborationSnapshot => ({
  descriptor,
  payload: 'AA==',
  version: causalVersion(descriptor),
});

const anchor = (descriptor: CollaborationDescriptor): CollaborationAnchor => ({
  descriptor,
  cursor: 'encoded-cursor',
  kind: 'text-cursor',
});

const nodeBoundary = (descriptor: CollaborationDescriptor): CollaborationAnchor => ({
  descriptor,
  kind: 'node-boundary',
  nodeId: 'node-1',
  side: 'before',
});

const persistenceProof = (descriptor: CollaborationDescriptor): PersistenceProof => ({
  casToken: { kind: 'cas-token', value: 'cas-0' },
  descriptor,
  roomRevision: { kind: 'room-revision', value: 0 },
});

describe('engine-neutral collaboration protocol', () => {
  it('accepts only the frozen engine/schema combinations', () => {
    expect(isCollaborationDescriptor(yjsDescriptor)).toBe(true);
    expect(isCollaborationDescriptor(loroDescriptor)).toBe(true);
    expect(isCollaborationDescriptor({ ...yjsDescriptor, bindingSchema: 'lexical-loro-v1' })).toBe(
      false,
    );
    expect(isCollaborationDescriptor({ ...loroDescriptor, bindingSchema: 'lexical-yjs-v1' })).toBe(
      false,
    );
  });

  it.each([
    ['unknown engine', { ...yjsDescriptor, engine: 'unknown' }],
    ['unknown binding schema', { ...yjsDescriptor, bindingSchema: 'lexical-yjs-v3' }],
    ['negative epoch', { ...yjsDescriptor, epoch: -1 }],
    ['fractional epoch', { ...yjsDescriptor, epoch: 0.5 }],
    ['NaN epoch', { ...yjsDescriptor, epoch: Number.NaN }],
    ['infinite epoch', { ...yjsDescriptor, epoch: Number.POSITIVE_INFINITY }],
    ['unsafe epoch', { ...yjsDescriptor, epoch: Number.MAX_SAFE_INTEGER + 1 }],
    ['string epoch', { ...yjsDescriptor, epoch: '0' }],
    ['unknown descriptor field', { ...yjsDescriptor, unknown: true }],
  ])('rejects %s', (_label, value) => {
    expect(isCollaborationDescriptor(value)).toBe(false);
    expect(() => parseCollaborationDescriptor(value)).toThrow(CollaborationProtocolError);
  });

  it('keeps causal version, room revision, and CAS token distinct', () => {
    const currentVersion = causalVersion(loroDescriptor);
    expect(isBoundCausalVersion(currentVersion)).toBe(true);
    expect(
      isBoundCausalVersion({
        ...currentVersion,
        causalVersion: { kind: 'room-revision', value: 0 },
      }),
    ).toBe(false);
    expect(isPersistenceProof(persistenceProof(loroDescriptor))).toBe(true);
    expect(
      isPersistenceProof({
        ...persistenceProof(loroDescriptor),
        casToken: { kind: 'cas-token', value: '' },
      }),
    ).toBe(false);
    expect(
      isPersistenceProof({
        ...persistenceProof(loroDescriptor),
        roomRevision: { kind: 'room-revision', value: -0 },
      }),
    ).toBe(false);
    expect(
      isBoundCausalVersion({
        ...currentVersion,
        causalVersion: { kind: 'cas-token', value: 'cas-0' },
      }),
    ).toBe(false);
    expect(
      isBoundCausalVersion({
        ...currentVersion,
        causalVersion: { kind: 'unknown', value: '' },
      }),
    ).toBe(false);
    expect(
      isBoundCausalVersion({
        ...currentVersion,
        causalVersion: { kind: 'crdt-causal-version', value: '' },
        unknown: true,
      }),
    ).toBe(false);
  });

  it('requires snapshot, version proof, and anchor descriptors to match', () => {
    expect(parseBoundCausalVersion(causalVersion(loroDescriptor), loroDescriptor)).toEqual(
      causalVersion(loroDescriptor),
    );
    expect(parseCollaborationSnapshot(snapshot(loroDescriptor), loroDescriptor)).toEqual(
      snapshot(loroDescriptor),
    );
    expect(parseCollaborationAnchor(anchor(loroDescriptor), loroDescriptor)).toEqual(
      anchor(loroDescriptor),
    );
    expect(parseCollaborationAnchor(nodeBoundary(loroDescriptor), loroDescriptor)).toEqual(
      nodeBoundary(loroDescriptor),
    );
    expect(parsePersistenceProof(persistenceProof(loroDescriptor), loroDescriptor)).toEqual(
      persistenceProof(loroDescriptor),
    );

    expect(() => parseBoundCausalVersion(causalVersion(yjsDescriptor), loroDescriptor)).toThrow(
      'descriptor does not match',
    );
    expect(() => parseCollaborationSnapshot(snapshot(yjsDescriptor), loroDescriptor)).toThrow(
      'descriptor does not match',
    );
    expect(() => parseCollaborationAnchor(anchor(yjsDescriptor), loroDescriptor)).toThrow(
      'descriptor does not match',
    );
    expect(() => parsePersistenceProof(persistenceProof(yjsDescriptor), loroDescriptor)).toThrow(
      'descriptor does not match',
    );
    expect(
      isCollaborationSnapshot({
        ...snapshot(loroDescriptor),
        version: causalVersion(yjsDescriptor),
      }),
    ).toBe(false);
  });

  it('rejects unknown fields and malformed nested wire values', () => {
    expect(
      isCollaborationSnapshot({
        ...snapshot(loroDescriptor),
        unknown: true,
      }),
    ).toBe(false);
    expect(
      isBoundCausalVersion({
        ...causalVersion(loroDescriptor),
        causalVersion: { kind: 'unknown', value: '' },
      }),
    ).toBe(false);
    expect(isCollaborationAnchor({ ...anchor(loroDescriptor), cursor: '' })).toBe(false);
    expect(() => parseCollaborationAnchor({ ...anchor(loroDescriptor), cursor: '' })).toThrow(
      'anchor must be a text-cursor',
    );
    expect(isCollaborationAnchor({ ...nodeBoundary(loroDescriptor), side: 'middle' })).toBe(false);
    expect(isCollaborationAnchor({ ...anchor(loroDescriptor), kind: 'unknown' })).toBe(false);
  });

  it('provides one explicit descriptor-binding check for server boundaries', () => {
    expect(assertDescriptorBinding(loroDescriptor, loroDescriptor, 'room')).toEqual(loroDescriptor);
    expect(() => assertDescriptorBinding(loroDescriptor, yjsDescriptor, 'room')).toThrow(
      'descriptor does not match',
    );
  });
});
