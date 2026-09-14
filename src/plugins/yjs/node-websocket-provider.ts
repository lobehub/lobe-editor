import type { RelativePosition } from 'yjs';

import {
  type AgentAwarenessData,
  type AgentAwarenessState,
  type AgentAwarenessStatus,
  type AgentCaretAnchor,
  type AgentRewriteRange,
  isAgentCaretAnchor,
  isAgentRewriteRange,
} from './protocol';
import {
  type WebSocketConstructor,
  WebSocketYjsProviderCore,
  type WebSocketYjsProviderOptions,
} from './websocket-provider-core';

export type {
  RefreshTicket,
  WebSocketLike,
  WebSocketMessageEvent,
} from './websocket-provider-core';

export interface NodeWebSocketYjsProviderOptions extends Omit<
  WebSocketYjsProviderOptions,
  'clientKind' | 'legacyProtocol'
> {
  /** Alias kept for callers that name the injected constructor explicitly. */
  websocketConstructor?: WebSocketConstructor;
}

export interface AgentAwarenessInput {
  anchorPos?: null | RelativePosition;
  caret?: AgentCaretAnchor | null;
  color?: string;
  documentId: string;
  focusPos?: null | RelativePosition;
  focusing?: boolean;
  generationId?: string;
  name?: string;
  requestId: string;
  selectionRange?: AgentRewriteRange;
  sessionId?: string;
  status: AgentAwarenessStatus;
  targetNodeIds?: string[];
}

const isFullAgentAwarenessState = (
  state: AgentAwarenessInput | AgentAwarenessState,
): state is AgentAwarenessState =>
  typeof state === 'object' && state !== null && 'awarenessData' in state;

/**
 * A Node-safe lobe-yjs-v1 client for an Agent worker.
 *
 * The provider intentionally implements only the Lexical Provider surface and
 * awareness helpers.  It does not expose a send method or Yjs mutation
 * methods; document edits belong to the Headless Editor command gateway.
 */
export class NodeWebSocketYjsProvider extends WebSocketYjsProviderCore {
  constructor(
    id: string,
    doc: ConstructorParameters<typeof WebSocketYjsProviderCore>[1],
    optionsOrWsBaseUrl: NodeWebSocketYjsProviderOptions | string = {},
  ) {
    const options =
      typeof optionsOrWsBaseUrl === 'string'
        ? { wsBaseUrl: optionsOrWsBaseUrl }
        : optionsOrWsBaseUrl;

    super(id, doc, {
      ...options,
      // Agent tickets are single-use capabilities. Automatic reconnect is only
      // safe when the caller supplies a fresh-ticket callback; otherwise the
      // provider must terminate and let the durable worker create a new session.
      autoReconnect: options.autoReconnect === false ? false : Boolean(options.refreshTicket),
      clientKind: 'agent',
      legacyProtocol: false,
      webSocketConstructor: options.webSocketConstructor ?? options.websocketConstructor,
    });
  }

  setAgentAwareness(input: AgentAwarenessInput | AgentAwarenessState): void {
    if (input.caret !== undefined && input.caret !== null && !isAgentCaretAnchor(input.caret)) {
      throw new Error('Node Agent awareness caret must use a durable nodeId/offset anchor.');
    }
    const selectionRange = isFullAgentAwarenessState(input)
      ? input.awarenessData.selectionRange
      : input.selectionRange;
    if (selectionRange !== undefined && !isAgentRewriteRange(selectionRange)) {
      throw new Error('Node Agent awareness range must use durable block/offset endpoints.');
    }
    if (isFullAgentAwarenessState(input)) {
      if (input.awarenessData.role !== 'agent') {
        throw new Error('Node Agent awareness must use role=agent.');
      }
      this.awareness.setLocalState(input);
      return;
    }

    const awarenessData: AgentAwarenessData = {
      ...(input.caret === undefined ? {} : { caret: input.caret }),
      documentId: input.documentId,
      ...(input.generationId ? { generationId: input.generationId } : {}),
      requestId: input.requestId,
      role: 'agent',
      ...(input.selectionRange ? { selectionRange: { ...input.selectionRange } } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      status: input.status,
      ...(input.targetNodeIds ? { targetNodeIds: [...input.targetNodeIds] } : {}),
    };

    this.awareness.setLocalState({
      anchorPos: input.anchorPos ?? null,
      awarenessData,
      ...(input.caret === undefined ? {} : { caret: input.caret }),
      color: input.color ?? '#7c3aed',
      focusPos: input.focusPos ?? input.anchorPos ?? null,
      focusing: input.focusing ?? (input.status !== 'done' && input.status !== 'error'),
      name: input.name ?? 'AI Agent',
    });
  }

  setAgentSelection(anchorPos: null | RelativePosition, focusPos = anchorPos): void {
    const state = this.awareness.getLocalState();
    if (!state) return;

    this.awareness.setLocalState({
      ...state,
      anchorPos,
      focusPos,
    });
  }

  clearAgentAwareness(): void {
    this.awareness.setLocalState(null);
  }
}

export type AgentYjsProvider = NodeWebSocketYjsProvider;
export type NodeYjsProvider = NodeWebSocketYjsProvider;

export function createNodeWebSocketYjsProvider(
  id: string,
  doc: ConstructorParameters<typeof WebSocketYjsProviderCore>[1],
  options: NodeWebSocketYjsProviderOptions = {},
): NodeWebSocketYjsProvider {
  return new NodeWebSocketYjsProvider(id, doc, options);
}

export const createAgentYjsProvider = createNodeWebSocketYjsProvider;
