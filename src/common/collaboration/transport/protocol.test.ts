import { describe, expect, it } from 'vitest';

import {
  encodeCollaborationV2Message,
  LOBE_COLLABORATION_PROTOCOL,
  LOBE_COLLABORATION_PROTOCOL_VERSION,
  parseCollaborationV2ClientMessage,
  parseCollaborationV2Message,
  parseCollaborationV2ServerMessage,
  type CollaborationDescriptor,
} from './protocol';

const descriptor: CollaborationDescriptor = {
  bindingSchema: 'lexical-loro-v1',
  engine: 'loro',
  epoch: 0,
};

const base = {
  descriptor,
  protocol: LOBE_COLLABORATION_PROTOCOL,
  roomId: 'room-a',
  version: LOBE_COLLABORATION_PROTOCOL_VERSION,
};

describe('lobe-collaboration-v2 wire protocol', () => {
  it('keeps hello unauthenticated and descriptor-free', () => {
    const hello = {
      nonce: 'challenge',
      protocol: LOBE_COLLABORATION_PROTOCOL,
      type: 'hello' as const,
      version: LOBE_COLLABORATION_PROTOCOL_VERSION,
    };
    expect(parseCollaborationV2Message(encodeCollaborationV2Message(hello))).toEqual(hello);
    expect(
      parseCollaborationV2Message({
        ...hello,
        descriptor,
      }),
    ).toBeNull();
  });

  it('requires a non-empty ticket and uint64 decimal peer id on auth', () => {
    const auth = {
      ...base,
      clientKind: 'browser' as const,
      nonce: 'challenge',
      peerId: '18446744073709551615',
      ticket: 'ticket',
      type: 'auth' as const,
    };
    expect(parseCollaborationV2Message(auth)).toEqual(auth);
    expect(parseCollaborationV2Message({ ...auth, ticket: null })).toBeNull();
    expect(parseCollaborationV2Message({ ...auth, peerId: '18446744073709551616' })).toBeNull();
    expect(parseCollaborationV2Message({ ...auth, peerId: 42 })).toBeNull();
  });

  it('rejects wrong engine/schema/epoch and unknown envelope fields', () => {
    const syncRequest = {
      ...base,
      causalVersion: '',
      type: 'sync-request' as const,
    };
    expect(parseCollaborationV2Message(syncRequest)).toEqual(syncRequest);
    expect(
      parseCollaborationV2Message({
        ...syncRequest,
        descriptor: { ...descriptor, engine: 'yjs' },
      }),
    ).toBeNull();
    expect(
      parseCollaborationV2Message({
        ...syncRequest,
        descriptor: { ...descriptor, bindingSchema: 'lexical-yjs-v1' },
      }),
    ).toBeNull();
    expect(
      parseCollaborationV2Message({
        ...syncRequest,
        descriptor: { ...descriptor, epoch: Number.MAX_SAFE_INTEGER + 1 },
      }),
    ).toBeNull();
    expect(parseCollaborationV2Message({ ...syncRequest, unknown: true })).toBeNull();
  });

  it('does not accept client-authored sender or peerId on presence', () => {
    const clientPresence = {
      ...base,
      sequence: 1,
      state: { cursor: 'opaque' },
      type: 'presence' as const,
    };
    expect(parseCollaborationV2ClientMessage(clientPresence)).toEqual(clientPresence);
    expect(
      parseCollaborationV2ClientMessage({
        ...clientPresence,
        peerId: '1',
        sender: 'forged',
      }),
    ).toBeNull();
  });

  it('requires server presence and ack fields to be stamped', () => {
    const presence = {
      ...base,
      peerId: '42',
      sender: 'connection-1',
      sequence: 1,
      state: null,
      type: 'presence' as const,
    };
    const ack = {
      ...base,
      acceptedRoomRevision: 4,
      causalVersion: 'vv-1',
      messageId: 'm-1',
      type: 'update-ack' as const,
    };
    expect(parseCollaborationV2ServerMessage(presence)).toEqual(presence);
    expect(parseCollaborationV2ServerMessage(ack)).toEqual(ack);
    expect(parseCollaborationV2ServerMessage({ ...ack, acceptedRoomRevision: -1 })).toBeNull();
    expect(parseCollaborationV2ServerMessage({ ...ack, descriptor: undefined })).toBeNull();
  });

  it('keeps sync snapshot and causal update streams separate', () => {
    const sync = {
      ...base,
      causalVersion: 'vv-2',
      presence: [],
      snapshot: 'snapshot-bytes',
      type: 'sync' as const,
      updates: ['update-1', 'update-2'],
    };
    expect(parseCollaborationV2Message(sync)).toEqual(sync);
    expect(parseCollaborationV2Message({ ...sync, updates: [1] })).toBeNull();
  });
});
