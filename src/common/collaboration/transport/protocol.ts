import { type CollaborationDescriptor, isCollaborationDescriptor } from '../protocol';

export type { CollaborationDescriptor } from '../protocol';

export const LOBE_COLLABORATION_PROTOCOL = 'lobe-collaboration-v2' as const;
export const LOBE_COLLABORATION_PROTOCOL_VERSION = 2 as const;

export type CollaborationClientKind = 'agent' | 'browser';
export type CollaborationPeerId = string;
export type CollaborationSenderId = string;

export interface CollaborationWireBase {
  [key: string]: unknown;
  descriptor: CollaborationDescriptor;
  roomId: string;
  version: typeof LOBE_COLLABORATION_PROTOCOL_VERSION;
  protocol: typeof LOBE_COLLABORATION_PROTOCOL;
}

export interface CollaborationHelloMessage {
  [key: string]: unknown;
  nonce: string;
  protocol: typeof LOBE_COLLABORATION_PROTOCOL;
  type: 'hello';
  version: typeof LOBE_COLLABORATION_PROTOCOL_VERSION;
}

export interface CollaborationAuthMessage extends CollaborationWireBase {
  clientKind: CollaborationClientKind;
  documentId?: string;
  nonce: string;
  peerId: CollaborationPeerId;
  requestId?: string;
  ticket: string;
  type: 'auth';
}

export interface CollaborationAuthOkMessage extends CollaborationWireBase {
  peerId: CollaborationPeerId;
  sender: CollaborationSenderId;
  type: 'auth-ok';
}

export interface CollaborationSyncRequestMessage extends CollaborationWireBase {
  causalVersion: string;
  type: 'sync-request';
}

export interface CollaborationPresenceMessage extends CollaborationWireBase {
  sequence: number;
  state: unknown | null;
  type: 'presence';
}

export interface CollaborationPresenceSnapshot {
  [key: string]: unknown;
  peerId: CollaborationPeerId;
  sender: CollaborationSenderId;
  sequence: number;
  state: unknown | null;
}

export interface CollaborationSyncMessage extends CollaborationWireBase {
  causalVersion: string;
  presence: CollaborationPresenceSnapshot[];
  snapshot?: string;
  type: 'sync';
  updates: string[];
}

export interface CollaborationUpdateMessage extends CollaborationWireBase {
  messageId: string;
  sequence?: number;
  type: 'update';
  update: string;
}

export interface CollaborationServerUpdateMessage extends CollaborationUpdateMessage {
  sender: CollaborationSenderId;
}

export interface CollaborationUpdateAckMessage extends CollaborationWireBase {
  /** Accepted room update position; this is not a persistence/CAS proof. */
  acceptedRoomRevision: number;
  causalVersion: string;
  messageId: string;
  type: 'update-ack';
}

export interface CollaborationErrorMessage extends CollaborationWireBase {
  code: string;
  fatal?: boolean;
  message: string;
  type: 'error';
}

export type CollaborationClientMessage =
  | CollaborationAuthMessage
  | CollaborationPresenceMessage
  | CollaborationSyncRequestMessage
  | CollaborationUpdateMessage;

export type CollaborationServerMessage =
  | CollaborationAuthOkMessage
  | CollaborationErrorMessage
  | (CollaborationPresenceMessage & { peerId: CollaborationPeerId; sender: CollaborationSenderId })
  | CollaborationHelloMessage
  | CollaborationServerUpdateMessage
  | CollaborationSyncMessage
  | CollaborationUpdateAckMessage;

export type CollaborationWireMessage = CollaborationClientMessage | CollaborationServerMessage;

type UnknownRecord = Record<string, unknown>;

const MAX_UINT64 = BigInt('18446744073709551615');

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;
const isSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

const isPeerId = (value: unknown): value is CollaborationPeerId => {
  if (!isString(value) || !/^(?:0|[1-9]\d*)$/u.test(value)) return false;
  try {
    return BigInt(value) <= MAX_UINT64;
  } catch {
    return false;
  }
};

const isRoomId = (value: unknown): value is string => isNonEmptyString(value);

const hasExactKeys = (value: UnknownRecord, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isDescriptorBoundBase = (value: UnknownRecord): value is CollaborationWireBase =>
  value.protocol === LOBE_COLLABORATION_PROTOCOL &&
  value.version === LOBE_COLLABORATION_PROTOCOL_VERSION &&
  isRoomId(value.roomId) &&
  isCollaborationDescriptor(value.descriptor);

const isValidSequence = (value: unknown): value is number => isSafeInteger(value) && value >= 0;
const isValidRoomRevision = (value: unknown): value is number => isSafeInteger(value) && value >= 0;

const isHello = (value: UnknownRecord): value is CollaborationHelloMessage =>
  hasExactKeys(value, ['nonce', 'protocol', 'type', 'version']) &&
  value.protocol === LOBE_COLLABORATION_PROTOCOL &&
  value.version === LOBE_COLLABORATION_PROTOCOL_VERSION &&
  value.type === 'hello' &&
  isNonEmptyString(value.nonce);

const isAuth = (value: UnknownRecord): value is CollaborationAuthMessage =>
  hasExactKeys(
    value,
    [
      'clientKind',
      'descriptor',
      'documentId',
      'nonce',
      'peerId',
      'protocol',
      'requestId',
      'roomId',
      'ticket',
      'type',
      'version',
    ].filter((key) => value[key] !== undefined),
  ) &&
  isDescriptorBoundBase(value) &&
  value.type === 'auth' &&
  (value.clientKind === 'agent' || value.clientKind === 'browser') &&
  isNonEmptyString(value.nonce) &&
  isPeerId(value.peerId) &&
  isNonEmptyString(value.ticket) &&
  (value.documentId === undefined || isNonEmptyString(value.documentId)) &&
  (value.requestId === undefined || isNonEmptyString(value.requestId));

const isAuthOk = (value: UnknownRecord): value is CollaborationAuthOkMessage =>
  hasExactKeys(value, [
    'descriptor',
    'peerId',
    'protocol',
    'roomId',
    'sender',
    'type',
    'version',
  ]) &&
  isDescriptorBoundBase(value) &&
  value.type === 'auth-ok' &&
  isPeerId(value.peerId) &&
  isNonEmptyString(value.sender);

const isSyncRequest = (value: UnknownRecord): value is CollaborationSyncRequestMessage =>
  hasExactKeys(value, ['causalVersion', 'descriptor', 'protocol', 'roomId', 'type', 'version']) &&
  isDescriptorBoundBase(value) &&
  value.type === 'sync-request' &&
  isString(value.causalVersion);

const isPresenceSnapshot = (value: unknown): value is CollaborationPresenceSnapshot =>
  isRecord(value) &&
  hasExactKeys(value, ['peerId', 'sender', 'sequence', 'state']) &&
  isPeerId(value.peerId) &&
  isNonEmptyString(value.sender) &&
  isValidSequence(value.sequence) &&
  (value.state === null || value.state !== undefined);

const isClientPresence = (value: UnknownRecord): value is CollaborationPresenceMessage =>
  hasExactKeys(value, [
    'descriptor',
    'protocol',
    'roomId',
    'sequence',
    'state',
    'type',
    'version',
  ]) &&
  isDescriptorBoundBase(value) &&
  value.type === 'presence' &&
  isValidSequence(value.sequence) &&
  (value.state === null || value.state !== undefined);

const isServerPresence = (
  value: UnknownRecord,
): value is CollaborationPresenceMessage & {
  peerId: CollaborationPeerId;
  sender: CollaborationSenderId;
} =>
  hasExactKeys(value, [
    'descriptor',
    'peerId',
    'protocol',
    'roomId',
    'sender',
    'sequence',
    'state',
    'type',
    'version',
  ]) &&
  isDescriptorBoundBase(value) &&
  value.type === 'presence' &&
  isPeerId(value.peerId) &&
  isNonEmptyString(value.sender) &&
  isValidSequence(value.sequence) &&
  (value.state === null || value.state !== undefined);

const isSync = (value: UnknownRecord): value is CollaborationSyncMessage =>
  hasExactKeys(
    value,
    [
      'causalVersion',
      'descriptor',
      'presence',
      'protocol',
      'roomId',
      'snapshot',
      'type',
      'updates',
      'version',
    ].filter((key) => value[key] !== undefined),
  ) &&
  isDescriptorBoundBase(value) &&
  value.type === 'sync' &&
  isString(value.causalVersion) &&
  Array.isArray(value.updates) &&
  value.updates.every(isString) &&
  (value.snapshot === undefined || isString(value.snapshot)) &&
  Array.isArray(value.presence) &&
  value.presence.every(isPresenceSnapshot);

const isUpdate = (value: UnknownRecord): value is CollaborationUpdateMessage =>
  hasExactKeys(
    value,
    [
      'descriptor',
      'messageId',
      'protocol',
      'roomId',
      'sequence',
      'type',
      'update',
      'version',
    ].filter((key) => value[key] !== undefined),
  ) &&
  isDescriptorBoundBase(value) &&
  value.type === 'update' &&
  isNonEmptyString(value.messageId) &&
  isString(value.update) &&
  (value.sequence === undefined || isValidSequence(value.sequence));

const isServerUpdate = (value: UnknownRecord): value is CollaborationServerUpdateMessage =>
  hasExactKeys(
    value,
    [
      'descriptor',
      'messageId',
      'protocol',
      'roomId',
      'sender',
      'sequence',
      'type',
      'update',
      'version',
    ].filter((key) => value[key] !== undefined),
  ) &&
  isDescriptorBoundBase(value) &&
  value.type === 'update' &&
  isNonEmptyString(value.sender) &&
  isNonEmptyString(value.messageId) &&
  isString(value.update) &&
  (value.sequence === undefined || isValidSequence(value.sequence));

const isAck = (value: UnknownRecord): value is CollaborationUpdateAckMessage =>
  hasExactKeys(value, [
    'acceptedRoomRevision',
    'causalVersion',
    'descriptor',
    'messageId',
    'protocol',
    'roomId',
    'type',
    'version',
  ]) &&
  isDescriptorBoundBase(value) &&
  value.type === 'update-ack' &&
  isNonEmptyString(value.messageId) &&
  isString(value.causalVersion) &&
  isValidRoomRevision(value.acceptedRoomRevision);

const isError = (value: UnknownRecord): value is CollaborationErrorMessage =>
  hasExactKeys(
    value,
    ['code', 'descriptor', 'fatal', 'message', 'protocol', 'roomId', 'type', 'version'].filter(
      (key) => value[key] !== undefined,
    ),
  ) &&
  isDescriptorBoundBase(value) &&
  value.type === 'error' &&
  isNonEmptyString(value.code) &&
  isNonEmptyString(value.message) &&
  (value.fatal === undefined || typeof value.fatal === 'boolean');

export const parseCollaborationV2Message = (value: unknown): CollaborationWireMessage | null => {
  let candidate: unknown = value;
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(candidate) || !isString(candidate.type)) return null;
  if (candidate.type === 'hello') return isHello(candidate) ? candidate : null;
  if (candidate.type === 'auth') return isAuth(candidate) ? candidate : null;
  if (candidate.type === 'auth-ok') return isAuthOk(candidate) ? candidate : null;
  if (candidate.type === 'sync-request') return isSyncRequest(candidate) ? candidate : null;
  if (candidate.type === 'presence') {
    return isServerPresence(candidate) || isClientPresence(candidate) ? candidate : null;
  }
  if (candidate.type === 'sync') return isSync(candidate) ? candidate : null;
  if (candidate.type === 'update-ack') return isAck(candidate) ? candidate : null;
  if (candidate.type === 'update')
    return isServerUpdate(candidate) || isUpdate(candidate) ? candidate : null;
  if (candidate.type === 'error') return isError(candidate) ? candidate : null;
  return null;
};

export const parseCollaborationV2ClientMessage = (
  value: unknown,
): CollaborationClientMessage | null => {
  const message = parseCollaborationV2Message(value);
  if (!message) return null;
  if (message.type === 'auth' || message.type === 'sync-request') return message;
  if (message.type === 'presence') {
    return isClientPresence(message as unknown as UnknownRecord) ? message : null;
  }
  if (message.type === 'update') {
    return isUpdate(message as unknown as UnknownRecord) &&
      !('sender' in (message as unknown as UnknownRecord))
      ? message
      : null;
  }
  return null;
};

export const parseCollaborationV2ServerMessage = (
  value: unknown,
): CollaborationServerMessage | null => {
  const message = parseCollaborationV2Message(value);
  if (!message) return null;
  if (
    message.type === 'hello' ||
    message.type === 'auth-ok' ||
    message.type === 'sync' ||
    message.type === 'update-ack' ||
    message.type === 'error'
  )
    return message;
  if (message.type === 'presence') {
    return isServerPresence(message as unknown as UnknownRecord)
      ? (message as CollaborationServerMessage)
      : null;
  }
  if (message.type === 'update') {
    return isServerUpdate(message as unknown as UnknownRecord)
      ? (message as CollaborationServerMessage)
      : null;
  }
  return null;
};

export const encodeCollaborationV2Message = (message: CollaborationWireMessage): string =>
  JSON.stringify(message);
