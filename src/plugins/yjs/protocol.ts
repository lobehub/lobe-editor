import type { UserState } from '@lexical/yjs';
import { createRelativePositionFromJSON, type RelativePosition, relativePositionToJSON } from 'yjs';

/**
 * The wire protocol used by browser and headless Node collaboration clients.
 *
 * Keep this value in the shared editor package.  Room servers must reject a
 * different protocol instead of silently interpreting an incompatible Yjs
 * root or message shape.
 */
export const LOBE_YJS_PROTOCOL = 'lobe-yjs-v1' as const;
export const LOBE_YJS_PROTOCOL_VERSION = 1 as const;
export const YJS_PROTOCOL = LOBE_YJS_PROTOCOL;
export const YJS_PROTOCOL_VERSION = LOBE_YJS_PROTOCOL_VERSION;

export type LobeYjsClientKind = 'agent' | 'browser';

export type AgentAwarenessStatus =
  'awaiting-review' | 'connecting' | 'done' | 'error' | 'syncing' | 'thinking' | 'writing';

/**
 * A public Agent caret anchor.  Unlike a Lexical point this contains no
 * runtime node key, and unlike a Yjs RelativePosition it can be inspected by
 * a room consumer without access to the Y.Doc.  The editor keeps the
 * RelativePosition only as an optional rendering aid inside awareness.
 */
export interface AgentCaretAnchor {
  nodeId: string;
  offset: number;
}

/**
 * Durable half-open rewrite range used by Agent awareness.
 *
 * `targetNodeIds` remains a block projection for compatibility, while this
 * range carries the actual endpoints needed to distinguish two selections in
 * the same block. Offsets are character offsets within the containing block.
 */
export interface AgentRewriteRange {
  endNodeId: string;
  endOffset: number;
  startNodeId: string;
  startOffset: number;
}

export interface AgentAwarenessData {
  caret?: AgentCaretAnchor | null;
  documentId: string;
  generationId?: string;
  requestId: string;
  role: 'agent';
  selectionRange?: AgentRewriteRange;
  sessionId?: string;
  status: AgentAwarenessStatus;
  targetNodeIds?: string[];
}

export interface AgentAwarenessState {
  anchorPos: null | RelativePosition;
  awarenessData: AgentAwarenessData;
  caret?: AgentCaretAnchor | null;
  /** Stable Yjs document client identity, distinct from a room sender ID. */
  clientId?: number;
  color: string;
  focusPos: null | RelativePosition;
  focusing: boolean;
  name: string;
  [key: string]: unknown;
}

export interface SerializedRelativePosition {
  assoc?: number;
  item?: {
    client: number;
    clock: number;
  };
  tname?: null | string;
  type?: {
    client: number;
    clock: number;
  };
}

/** The JSON-safe representation of the standard Lexical Yjs user state. */
export interface SerializedUserState {
  anchorPos: null | SerializedRelativePosition;
  awarenessData: object;
  caret?: AgentCaretAnchor | null;
  /** Stable Yjs document client identity, distinct from a room sender ID. */
  clientId?: number;
  color: string;
  focusing: boolean;
  focusPos: null | SerializedRelativePosition;
  name: string;
  [key: string]: unknown;
}

export interface AwarenessSnapshot {
  clientId: number;
  sequence?: number;
  state: null | SerializedUserState;
}

interface ProtocolMessageBase {
  protocol: typeof LOBE_YJS_PROTOCOL;
  version: typeof LOBE_YJS_PROTOCOL_VERSION;
}

export interface LobeYjsHelloMessage extends ProtocolMessageBase {
  nonce: string;
  roomId: string;
  type: 'hello';
}

export interface LobeYjsAuthMessage extends ProtocolMessageBase {
  clientId: number;
  clientKind: LobeYjsClientKind;
  documentId?: string;
  nonce: string;
  requestId?: string;
  ticket: null | string;
  type: 'auth';
}

export interface LobeYjsAuthOkMessage extends ProtocolMessageBase {
  clientId: number;
  roomId: string;
  type: 'auth-ok';
}

export interface LobeYjsErrorMessage extends ProtocolMessageBase {
  code: string;
  fatal?: boolean;
  message: string;
  type: 'error';
}

export interface LobeYjsSyncRequestMessage extends ProtocolMessageBase {
  stateVector: string;
  type: 'sync-request';
}

export interface LobeYjsSyncMessage extends ProtocolMessageBase {
  awareness: AwarenessSnapshot[];
  serverStateVector: string;
  type: 'sync';
  update: string;
}

export interface LobeYjsUpdateMessage extends ProtocolMessageBase {
  messageId: string;
  /** Added by the room server when broadcasting; clients must not author it. */
  sender?: number;
  sequence?: number;
  type: 'update';
  update: string;
}

export interface LobeYjsUpdateAckMessage extends ProtocolMessageBase {
  messageId: string;
  type: 'update-ack';
}

export interface LobeYjsAwarenessMessage extends ProtocolMessageBase {
  sequence: number;
  sender?: number;
  state: null | SerializedUserState;
  type: 'awareness';
}

export type LobeYjsClientMessage =
  LobeYjsAuthMessage | LobeYjsAwarenessMessage | LobeYjsSyncRequestMessage | LobeYjsUpdateMessage;

export type LobeYjsServerMessage =
  | LobeYjsAuthOkMessage
  | LobeYjsAwarenessMessage
  | LobeYjsErrorMessage
  | LobeYjsHelloMessage
  | LobeYjsSyncMessage
  | LobeYjsUpdateAckMessage
  | LobeYjsUpdateMessage;

export type LobeYjsMessage = LobeYjsClientMessage | LobeYjsServerMessage;
export type ClientWebSocketMessage = LobeYjsClientMessage;
export type ServerWebSocketMessage = LobeYjsServerMessage;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

const isPositionPart = (value: unknown): value is { client: number; clock: number } =>
  isRecord(value) && isSafeInteger(value.client) && isSafeInteger(value.clock);

const isSerializedRelativePosition = (value: unknown): value is SerializedRelativePosition => {
  if (!isRecord(value)) return false;

  return (
    (value.assoc === undefined || typeof value.assoc === 'number') &&
    (value.item === undefined || isPositionPart(value.item)) &&
    (value.tname === undefined || value.tname === null || isString(value.tname)) &&
    (value.type === undefined || isPositionPart(value.type))
  );
};

export const isAgentCaretAnchor = (value: unknown): value is AgentCaretAnchor =>
  isRecord(value) &&
  isString(value.nodeId) &&
  value.nodeId.trim().length > 0 &&
  isSafeInteger(value.offset) &&
  value.offset >= 0;

export const isAgentRewriteRange = (value: unknown): value is AgentRewriteRange =>
  isRecord(value) &&
  isString(value.startNodeId) &&
  value.startNodeId.trim().length > 0 &&
  isSafeInteger(value.startOffset) &&
  value.startOffset >= 0 &&
  isString(value.endNodeId) &&
  value.endNodeId.trim().length > 0 &&
  isSafeInteger(value.endOffset) &&
  value.endOffset >= 0;

const isSerializedUserState = (value: unknown): value is SerializedUserState => {
  if (!isRecord(value)) return false;

  return (
    (value.anchorPos === null || isSerializedRelativePosition(value.anchorPos)) &&
    (value.focusPos === null || isSerializedRelativePosition(value.focusPos)) &&
    (value.caret === undefined || value.caret === null || isAgentCaretAnchor(value.caret)) &&
    (value.clientId === undefined || isSafeInteger(value.clientId)) &&
    typeof value.color === 'string' &&
    typeof value.focusing === 'boolean' &&
    typeof value.name === 'string' &&
    isRecord(value.awarenessData)
  );
};

const isProtocolMessageBase = (value: UnknownRecord): boolean =>
  value.protocol === LOBE_YJS_PROTOCOL && value.version === LOBE_YJS_PROTOCOL_VERSION;

const isAwarenessSnapshot = (value: unknown): value is AwarenessSnapshot => {
  if (!isRecord(value) || !isSafeInteger(value.clientId)) return false;

  return (
    (value.sequence === undefined || isSafeInteger(value.sequence)) &&
    (value.state === null || isSerializedUserState(value.state))
  );
};

/**
 * Parse and validate a protocol message at the transport boundary.
 *
 * This deliberately returns null instead of coercing malformed data.  Room
 * servers use the same function as clients so an unsupported message cannot
 * accidentally become a Yjs mutation.
 */
export const parseLobeYjsMessage = (value: unknown): LobeYjsMessage | null => {
  let candidate: unknown = value;

  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(candidate) || !isString(candidate.type) || !isProtocolMessageBase(candidate)) {
    return null;
  }

  switch (candidate.type) {
    case 'auth': {
      if (
        !isSafeInteger(candidate.clientId) ||
        (candidate.clientKind !== 'agent' && candidate.clientKind !== 'browser') ||
        !isString(candidate.nonce) ||
        !(candidate.ticket === null || candidate.ticket === undefined || isString(candidate.ticket))
      ) {
        return null;
      }

      if (candidate.documentId !== undefined && !isString(candidate.documentId)) return null;
      if (candidate.requestId !== undefined && !isString(candidate.requestId)) return null;

      return candidate as unknown as LobeYjsAuthMessage;
    }

    case 'awareness': {
      if (!isSafeInteger(candidate.sequence)) return null;
      if (candidate.sender !== undefined && !isSafeInteger(candidate.sender)) return null;
      if (candidate.state !== null && !isSerializedUserState(candidate.state)) return null;

      return candidate as unknown as LobeYjsAwarenessMessage;
    }

    case 'auth-ok': {
      if (!isSafeInteger(candidate.clientId) || !isString(candidate.roomId)) return null;
      return candidate as unknown as LobeYjsAuthOkMessage;
    }

    case 'error': {
      if (!isString(candidate.code) || !isString(candidate.message)) return null;
      if (candidate.fatal !== undefined && typeof candidate.fatal !== 'boolean') return null;
      return candidate as unknown as LobeYjsErrorMessage;
    }

    case 'hello': {
      if (!isString(candidate.nonce) || !isString(candidate.roomId)) return null;
      return candidate as unknown as LobeYjsHelloMessage;
    }

    case 'sync': {
      if (
        !isString(candidate.serverStateVector) ||
        !isString(candidate.update) ||
        !Array.isArray(candidate.awareness) ||
        !candidate.awareness.every(isAwarenessSnapshot)
      ) {
        return null;
      }

      return candidate as unknown as LobeYjsSyncMessage;
    }

    case 'sync-request': {
      if (!isString(candidate.stateVector)) return null;
      return candidate as unknown as LobeYjsSyncRequestMessage;
    }

    case 'update': {
      if (!isString(candidate.messageId) || !isString(candidate.update)) return null;
      if (candidate.sender !== undefined && !isSafeInteger(candidate.sender)) return null;
      if (candidate.sequence !== undefined && !isSafeInteger(candidate.sequence)) return null;
      return candidate as unknown as LobeYjsUpdateMessage;
    }

    case 'update-ack': {
      if (!isString(candidate.messageId)) return null;
      return candidate as unknown as LobeYjsUpdateAckMessage;
    }

    default: {
      return null;
    }
  }
};

/** Encode a Yjs byte array without depending on a browser global. */
export const encodeYjsBase64 = (bytes: Uint8Array): string => {
  const runtime = globalThis as typeof globalThis & {
    Buffer?: {
      from(value: Uint8Array): { toString(encoding: 'base64'): string };
    };
    btoa?: (value: string) => string;
  };

  if (runtime.Buffer) return runtime.Buffer.from(bytes).toString('base64');
  if (typeof runtime.btoa === 'function') {
    let binary = '';
    const chunkSize = 8192;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }

    return runtime.btoa(binary);
  }

  throw new Error('No base64 encoder is available in this runtime.');
};

/** Decode a Yjs byte array without depending on a browser global. */
export const decodeYjsBase64 = (value: string): Uint8Array => {
  const runtime = globalThis as typeof globalThis & {
    Buffer?: {
      from(value: string, encoding: 'base64'): Uint8Array;
    };
    atob?: (value: string) => string;
  };

  if (runtime.Buffer) return new Uint8Array(runtime.Buffer.from(value, 'base64'));
  if (typeof runtime.atob === 'function') {
    const binary = runtime.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  throw new Error('No base64 decoder is available in this runtime.');
};

export const encodeBase64 = encodeYjsBase64;
export const decodeBase64 = decodeYjsBase64;

export const encodeLobeYjsMessage = (message: LobeYjsMessage): string => JSON.stringify(message);

export const serializeUserState = (state: UserState | null): null | SerializedUserState => {
  if (!state) return null;

  return {
    ...state,
    anchorPos: state.anchorPos
      ? (relativePositionToJSON(state.anchorPos) as SerializedRelativePosition)
      : null,
    focusPos: state.focusPos
      ? (relativePositionToJSON(state.focusPos) as SerializedRelativePosition)
      : null,
  };
};

export const deserializeUserState = (state: null | SerializedUserState): UserState | null => {
  if (!state) return null;

  return {
    ...state,
    anchorPos: state.anchorPos ? createRelativePositionFromJSON(state.anchorPos) : null,
    focusPos: state.focusPos ? createRelativePositionFromJSON(state.focusPos) : null,
  };
};

export const isAgentAwarenessState = (state: UserState | null): state is AgentAwarenessState => {
  const awarenessData = state?.awarenessData;

  return (
    !!state &&
    typeof awarenessData === 'object' &&
    awarenessData !== null &&
    (awarenessData as AgentAwarenessData).role === 'agent' &&
    typeof (awarenessData as AgentAwarenessData).documentId === 'string' &&
    typeof (awarenessData as AgentAwarenessData).requestId === 'string' &&
    typeof (awarenessData as AgentAwarenessData).status === 'string'
  );
};
