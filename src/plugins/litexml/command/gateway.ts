import type { CommandPayloadType, LexicalCommand, LexicalEditor } from 'lexical';

import { MARK_AI_GENERATED_COMMAND } from '@/plugins/properties/command';
import type { MarkAIGeneratedPayload } from '@/plugins/properties/types';

import {
  type RewriteCommandResult,
  type RewriteCommandResultChannel,
  type RewriteRangeCommandPayload,
  validateLiteXMLInput,
} from './rewriteRange';
import {
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
  type LiteXMLRewriteMetadata,
} from './symbols';

/** Commands an Agent may issue through the editor mutation boundary. */
export const COLLABORATIVE_AGENT_COMMAND_ALLOWLIST = Object.freeze([
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
  MARK_AI_GENERATED_COMMAND,
] as const);

export type CollaborativeAgentCommand = (typeof COLLABORATIVE_AGENT_COMMAND_ALLOWLIST)[number];

export interface CollaborativeAgentCommandGateway {
  dispatch(command: LexicalCommand<unknown>, payload: unknown): Promise<RewriteCommandResult>;
  dispatchCommand(
    command: LexicalCommand<unknown>,
    payload: unknown,
  ): Promise<RewriteCommandResult>;
  isAllowed(command: LexicalCommand<unknown>): command is CollaborativeAgentCommand;
}

type PayloadRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is PayloadRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createGatewayCommandId = (): string => {
  const cryptoObject = (
    globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (typeof cryptoObject?.randomUUID === 'function') return cryptoObject.randomUUID();
  return `agent-command-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const result = (
  requestId: string,
  status: RewriteCommandResult['status'],
  error?: string,
  affectedNodeIds: string[] = [],
  commandId = createGatewayCommandId(),
): RewriteCommandResult => ({
  affectedNodeIds,
  commandId,
  ...(error ? { error } : {}),
  requestId,
  status,
});

const metadataField = (payload: unknown, key: string): unknown => {
  if (isRecord(payload)) return payload[key];
  if (!Array.isArray(payload)) return undefined;
  const arrayPayload = payload as unknown as PayloadRecord;
  if (key in arrayPayload) return arrayPayload[key];
  return payload.find(isRecord)?.[key];
};

const requestIdFrom = (payload: unknown): string => {
  const value = metadataField(payload, 'requestId');
  return typeof value === 'string' ? value : '';
};

const commandIdFrom = (payload: unknown): string | undefined => {
  const value = metadataField(payload, 'commandId');
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const rewriteMetadataFrom = (payload: unknown, commandId: string): LiteXMLRewriteMetadata => {
  const requestId = requestIdFrom(payload);
  const generationIdValue = metadataField(payload, 'generationId');
  const modelValue = metadataField(payload, 'model');
  const providerValue = metadataField(payload, 'provider');
  const createdAtValue = metadataField(payload, 'createdAt');
  const attemptValue = metadataField(payload, 'attempt');
  const generationId =
    typeof generationIdValue === 'string' && generationIdValue.length > 0
      ? generationIdValue
      : requestId || undefined;
  const metadata: LiteXMLRewriteMetadata = {
    commandId,
    createdAt:
      typeof createdAtValue === 'string' && createdAtValue.length > 0
        ? createdAtValue
        : new Date().toISOString(),
    ...(generationId ? { generationId } : {}),
    ...(requestId ? { requestId } : {}),
    ...(typeof modelValue === 'string' && modelValue.length > 0 ? { model: modelValue } : {}),
    ...(typeof providerValue === 'string' && providerValue.length > 0
      ? { provider: providerValue }
      : {}),
  };
  if (typeof attemptValue === 'number' && Number.isSafeInteger(attemptValue) && attemptValue > 0) {
    metadata.attempt = attemptValue;
  }
  return metadata;
};

const attachRewriteMetadata = (payload: unknown, metadata: LiteXMLRewriteMetadata): unknown => {
  if (Array.isArray(payload)) {
    const normalized = [...payload];
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined) continue;
      Object.defineProperty(normalized, key, {
        configurable: true,
        enumerable: false,
        value,
      });
    }
    return normalized;
  }
  if (isRecord(payload)) return { ...payload, ...metadata };
  return payload;
};

const hasRuntimeKeyField = (value: unknown, seen = new WeakSet<object>()): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((child) => hasRuntimeKeyField(child, seen));
  if (!isRecord(value)) return false;
  if ('nodeKey' in value || 'nodeKeys' in value || 'targetKey' in value) return true;
  return Object.values(value).some((child) => hasRuntimeKeyField(child, seen));
};

const isStableNodeId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && !/^[\da-z]{1,4}$/i.test(value.trim());

const xmlIds = (xml: string): string[] =>
  Array.from(xml.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi), (match) => match[1]);

const isStableLiteXMLModifyPayload = (payload: unknown): boolean => {
  if (!Array.isArray(payload) || payload.length === 0) return false;
  return payload.every((operation) => {
    if (!isRecord(operation)) return false;
    if (operation.action === 'remove') return isStableNodeId(operation.id);
    if (operation.action === 'modify') {
      const xmls = Array.isArray(operation.litexml) ? operation.litexml : [operation.litexml];
      return (
        xmls.length > 0 &&
        xmls.every(
          (xml): xml is string =>
            typeof xml === 'string' &&
            !validateLiteXMLInput(xml, { allowIds: true }) &&
            xmlIds(xml).length === 1 &&
            xmlIds(xml).every(isStableNodeId),
        )
      );
    }
    if (operation.action === 'insert') {
      const hasBefore = 'beforeId' in operation;
      const hasAfter = 'afterId' in operation;
      if (hasBefore === hasAfter || typeof operation.litexml !== 'string') return false;
      const target = hasBefore ? operation.beforeId : operation.afterId;
      return isStableNodeId(target) && !validateLiteXMLInput(operation.litexml, { allowIds: true });
    }
    return false;
  });
};

const isRewritePayload = (payload: unknown): payload is RewriteRangeCommandPayload => {
  if (!isRecord(payload)) return false;
  const mode = payload.mode;
  const hasValidMode = mode === undefined || mode === 'direct' || mode === 'review';
  const hasValidDelay = mode === 'direct' ? payload.delay !== true : payload.delay === true;
  return (
    typeof payload.requestId === 'string' &&
    typeof payload.generationId === 'string' &&
    typeof payload.expectedTextHash === 'string' &&
    hasValidMode &&
    hasValidDelay &&
    (payload.commandId === undefined ||
      (typeof payload.commandId === 'string' && payload.commandId.length > 0)) &&
    typeof payload.selection === 'object' &&
    payload.selection !== null &&
    !Array.isArray(payload.selection)
  );
};

/**
 * Construct the only mutation gateway exposed to a collaborative Agent.
 *
 * The gateway accepts Lexical command symbols, not arbitrary callbacks or raw
 * Yjs operations. Unknown symbols and payloads containing runtime key fields
 * are rejected before dispatch.
 */
export function createCollaborativeAgentCommandGateway(
  editor: LexicalEditor,
  resultChannel: RewriteCommandResultChannel,
): CollaborativeAgentCommandGateway {
  // The caller owns the channel explicitly. A private Lexical editor config is
  // intentionally never inspected; a bare editor gets an isolated channel.
  const channel = resultChannel;

  const isAllowed = (command: LexicalCommand<unknown>): command is CollaborativeAgentCommand =>
    (COLLABORATIVE_AGENT_COMMAND_ALLOWLIST as readonly LexicalCommand<unknown>[]).includes(command);

  const dispatch = async (
    command: LexicalCommand<unknown>,
    payload: unknown,
  ): Promise<RewriteCommandResult> => {
    const requestId = requestIdFrom(payload);
    const commandId = commandIdFrom(payload) ?? createGatewayCommandId();
    if (!isAllowed(command)) return result(requestId, 'failed', 'command-not-allowlisted');
    if (hasRuntimeKeyField(payload))
      return result(requestId, 'failed', 'runtime-nodeKey-forbidden');

    if (command === LITEXML_REWRITE_RANGE_COMMAND) {
      if (!isRewritePayload(payload)) return result(requestId, 'failed', 'invalid-rewrite-payload');
      const previous = channel.get(payload.requestId);
      if (previous?.status === 'diff-created' || previous?.status === 'applied') return previous;
      channel.clear(payload.requestId);
      const rewritePayload = payload.commandId ? payload : { ...payload, commandId };
      try {
        const handled = editor.dispatchCommand(LITEXML_REWRITE_RANGE_COMMAND, rewritePayload);
        if (!handled) return result(requestId, 'failed', 'command-not-handled', [], commandId);
      } catch (error) {
        return result(
          requestId,
          'failed',
          error instanceof Error ? error.message : 'rewrite-command-dispatch-failed',
          [],
          commandId,
        );
      }
      const dispatched = channel.get(payload.requestId);
      if (dispatched) return dispatched;
      return (
        (await channel.waitForResult(payload.requestId, 10_000)) ||
        result(requestId, 'failed', 'rewrite-command-result-timeout', [], commandId)
      );
    }

    if (command === MARK_AI_GENERATED_COMMAND) {
      if (!isRecord(payload) || typeof payload.generationId !== 'string') {
        return result(requestId, 'failed', 'invalid-provenance-payload');
      }
      if (
        payload.nodeIds !== undefined &&
        (!Array.isArray(payload.nodeIds) ||
          payload.nodeIds.some((nodeId) => !isStableNodeId(nodeId)))
      ) {
        return result(requestId, 'failed', 'stable-nodeId-required');
      }
      const markPayload = payload.commandId ? payload : { ...payload, commandId };
      try {
        const handled = editor.dispatchCommand(
          MARK_AI_GENERATED_COMMAND,
          markPayload as unknown as MarkAIGeneratedPayload,
        );
        if (!handled) return result(requestId, 'failed', 'command-not-handled', [], commandId);
      } catch (error) {
        return result(
          requestId,
          'failed',
          error instanceof Error ? error.message : 'command-failed',
          [],
          commandId,
        );
      }
      return result(
        requestId,
        'diff-created',
        undefined,
        Array.isArray(payload.nodeIds) ? payload.nodeIds.filter(isStableNodeId) : [],
        commandId,
      );
    }

    let dispatchPayload = payload;
    let affectedNodeIds: string[] = [];

    if (command === LITEXML_MODIFY_COMMAND) {
      if (!isStableLiteXMLModifyPayload(payload)) {
        return result(requestId, 'failed', 'stable-modify-target-required');
      }
      // The legacy batch command has no delay field in its public type, but
      // its Agent use must remain review-only. The command handler also
      // forces delayed handling for each operation; keep the normalized value
      // explicit at this boundary for custom listeners and tests.
      const metadata = rewriteMetadataFrom(payload, commandId);
      dispatchPayload = attachRewriteMetadata(
        (payload as Array<Record<string, unknown>>).map((operation) => ({
          ...operation,
          delay: true,
        })),
        metadata,
      );
      affectedNodeIds = collectModifyNodeIds(payload);
    } else {
      if (!isRecord(payload)) return result(requestId, 'failed', 'invalid-litexml-payload');
      if (command === LITEXML_REMOVE_COMMAND) {
        if (!isStableNodeId(payload.id)) {
          return result(requestId, 'failed', 'stable-nodeId-required');
        }
        dispatchPayload = attachRewriteMetadata(
          { ...payload, delay: true },
          rewriteMetadataFrom(payload, commandId),
        );
        affectedNodeIds = [payload.id];
      }
      if (command === LITEXML_INSERT_COMMAND) {
        const hasBefore = 'beforeId' in payload;
        const hasAfter = 'afterId' in payload;
        if (hasBefore === hasAfter) {
          return result(requestId, 'failed', 'exactly-one-insert-target-required');
        }
        const target = hasBefore ? payload.beforeId : payload.afterId;
        if (!isStableNodeId(target) || typeof payload.litexml !== 'string') {
          return result(requestId, 'failed', 'stable-insert-target-required');
        }
        const validationError = validateLiteXMLInput(payload.litexml, { allowIds: true });
        if (validationError) return result(requestId, 'failed', validationError);
        dispatchPayload = attachRewriteMetadata(
          { ...payload, delay: true },
          rewriteMetadataFrom(payload, commandId),
        );
        affectedNodeIds = [target];
      }
    }

    try {
      const handled = editor.dispatchCommand(command as any, dispatchPayload as any);
      if (!handled)
        return result(
          requestId,
          'failed',
          'command-not-handled',
          affectedNodeIds.filter(Boolean),
          commandId,
        );
    } catch (error) {
      return result(
        requestId,
        'failed',
        error instanceof Error ? error.message : 'command-failed',
        [],
        commandId,
      );
    }
    return result(requestId, 'diff-created', undefined, affectedNodeIds.filter(Boolean), commandId);
  };

  return {
    dispatch,
    dispatchCommand: dispatch,
    isAllowed,
  };
}

const collectModifyNodeIds = (payload: unknown): string[] => {
  if (!Array.isArray(payload)) return [];
  const ids = new Set<string>();
  for (const operation of payload) {
    if (!isRecord(operation)) continue;
    if (operation.action === 'remove' && isStableNodeId(operation.id)) ids.add(operation.id);
    if (operation.action === 'modify') {
      const xmls = Array.isArray(operation.litexml) ? operation.litexml : [operation.litexml];
      for (const xml of xmls) {
        if (typeof xml !== 'string') continue;
        xmlIds(xml)
          .filter(isStableNodeId)
          .forEach((id) => ids.add(id));
      }
    }
    if (operation.action === 'insert') {
      const target = 'beforeId' in operation ? operation.beforeId : operation.afterId;
      if (isStableNodeId(target)) ids.add(target);
    }
  }
  return [...ids];
};

export const createAgentCommandGateway = createCollaborativeAgentCommandGateway;

export type AllowedLiteXMLCommandPayload =
  | CommandPayloadType<typeof LITEXML_INSERT_COMMAND>
  | CommandPayloadType<typeof LITEXML_MODIFY_COMMAND>
  | CommandPayloadType<typeof LITEXML_REMOVE_COMMAND>
  | RewriteRangeCommandPayload;
