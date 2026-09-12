import { $isListItemNode } from '@lexical/list';
import { $isTableCellNode, $isTableNode, $isTableRowNode } from '@lexical/table';
import { DOMParser } from '@xmldom/xmldom';
import type {
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  PointType,
  RangeSelection,
  SerializedLexicalNode,
} from 'lexical';
import {
  $createParagraphNode,
  $createRangeSelection,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  HISTORY_MERGE_TAG,
  HISTORY_PUSH_TAG,
} from 'lexical';
import { encodeStateVector } from 'yjs';

import { genServiceId } from '@/editor-kernel';
import { getBlockOffset, getBlockPoint, getLinearTextLength } from '@/editor-kernel/linear-text';
import { getKernelFromEditor } from '@/editor-kernel/utils';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { $generateNodesFromSerializedNodes, $insertGeneratedNodes } from '@/plugins/markdown/utils';
import { $getNodeProperties, $setNodeProperties, createNodeId } from '@/plugins/properties/state';
import type { JSONValue, NodeProvenance } from '@/plugins/properties/types';
import {
  $ensureNodeId,
  $findNodeById,
  $getNodeId,
  $markNodesAsAIGenerated,
  $preserveNodeIdentity,
  markSerializedNodesAsAIGenerated,
} from '@/plugins/properties/utils';
import { encodeYjsBase64 } from '@/plugins/yjs/protocol';
import { IYjsService } from '@/plugins/yjs/service';
import type { IServiceID } from '@/types';
import { createDebugLogger } from '@/utils/debug';
import { hashRewriteText, normalizeRewriteText } from '@/utils/rewrite-text';

import type LitexmlDataSource from '../data-source/litexml-data-source';
import { findNewIllegalDiffPaths, type SerializedDiffDocument } from '../diff-validation';
import { $createDiffContentNode } from '../node/DiffContentNode';
import { $createDiffNode, $isDiffNode } from '../node/DiffNode';
import { $parseSerializedNodeImpl } from '../utils';
import { LITEXML_REWRITE_RANGE_COMMAND } from './symbols';

const logger = createDebugLogger('plugin', 'litexml-rewrite');

/** A durable selection point. `nodeId` is the containing block identity. */
export interface SerializedRewritePoint {
  nodeId: string;
  offset: number;
  type?: 'element' | 'text';
}

/**
 * Serializable selection shape used by a room/request runtime after it has
 * resolved a Yjs RelativePosition to the containing durable block.
 *
 * The command intentionally does not accept Lexical `nodeKey` values here.
 * A runtime may also pass an already-resolved `RangeSelection` as `selection`.
 */
export interface SerializedRewriteCommandSelection {
  anchor: SerializedRewritePoint;
  focus: SerializedRewritePoint;
  /** Optional capture-time text proof; the command rechecks it against live content. */
  quotedText?: string;
  quotedTextHash?: string;
  /** Optional ordered durable block projection captured with the selection. */
  targetNodeIds?: string[];
  type: 'range';
}

/** Block-id/offset fallback produced after a runtime resolves RelativePosition. */
export interface SerializedBlockRewriteSelection {
  baseStateVector?: string;
  endNodeId: string;
  endOffset: number;
  kind: 'block';
  quotedText?: string;
  quotedTextHash?: string;
  startNodeId: string;
  startOffset: number;
  targetNodeIds?: string[];
}

export type RewriteSelectionInput =
  BaseSelection | SerializedBlockRewriteSelection | SerializedRewriteCommandSelection;

export type RewriteCommandStatus = 'aborted' | 'applied' | 'diff-created' | 'failed' | 'stale';

/**
 * `review` is the historical delayed Diff workflow. `direct` is reserved for
 * the collaborative Agent gateway and applies the validated range in-place.
 */
export type RewriteRangeMode = 'direct' | 'review';

export interface RewriteRangeCommandPayload {
  /** A runtime RangeSelection or a durable block/offset selection snapshot. */
  selection: RewriteSelectionInput;
  expectedTextHash: string;
  /** Exactly one of replacementText and replacementLiteXML must be supplied. */
  replacementLiteXML?: string;
  replacementText?: string;
  /** Explicit execution mode. Omitted mode keeps the legacy delayed review path. */
  mode?: RewriteRangeMode;
  /** Stream finalization belongs to the existing write gesture, not a new undo item. */
  history?: 'merge';
  /** Historical review flag. Review requires `delay: true`; direct may omit it. */
  delay?: boolean;
  requestId: string;
  generationId: string;
  /** Durable request attempt used by the browser review settlement bridge. */
  attempt?: number;
  model?: string;
  provider?: string;
  /** Page-owned stream provenance carried onto newly parsed replacement nodes. */
  provenanceSessionId?: string;
  turnIndex?: number;
  /** Optional caller command identity; generated when absent. */
  commandId?: string;
}

export interface RewriteCommandResult {
  affectedNodeIds: string[];
  commandId: string;
  error?: string;
  requestId: string;
  /** State vector observed after the local Lexical/Yjs transaction commits; it is not a remote ACK. */
  stateVector?: string;
  status: RewriteCommandStatus;
}

/**
 * Editor-owned Promise boundary for targeted rewrites.
 *
 * Lexical command listeners can only return a boolean.  Agent and headless
 * callers need the result from the transaction which actually committed, so
 * they use this service instead of waiting on a result-channel event.
 */
export interface IRewriteService {
  /**
   * Cancel requests which are still queued. Once execution has started, the
   * Lexical commit/error boundary settles the actual result so a committed
   * rewrite is never reported as aborted.
   */
  cancel(requestId?: string, reason?: string): void;
  /**
   * Stop accepting work and release queued waiters. An executing operation is
   * allowed to cross its commit/error boundary; an unavailable boundary is
   * ended by the service's bounded failure fallback.
   */
  destroy(): void;
  rewriteRange(
    payload: RewriteRangeCommandPayload,
    options?: RewriteServiceExecutionOptions,
  ): Promise<RewriteCommandResult>;
}

/** Internal scheduling choice for callers which must cross an outer update boundary. */
export interface RewriteServiceExecutionOptions {
  /** Run the rewrite in a fresh Lexical transaction after the current update settles. */
  schedule?: 'separate';
}

/**
 * Bounds applied to model-produced LiteXML before it is handed to a reader.
 * Keep these limits in the editor package as a second line of defence: the
 * server limits the model output, but a caller can also invoke this command
 * directly in a browser or a headless worker.
 */
export const LITEXML_REWRITE_MAX_BYTES = 1_048_576;
export const LITEXML_REWRITE_MAX_DEPTH = 32;
export const LITEXML_REWRITE_MAX_NODES = 512;
export const LITEXML_REWRITE_MAX_ATTRIBUTES_PER_NODE = 16;
export const LITEXML_REWRITE_MAX_ATTRIBUTE_BYTES = 8_192;

export interface LiteXMLValidationOptions {
  /** Allow stable `id` attributes for legacy modify/insert commands. */
  allowIds?: boolean;
}

type XMLAttribute = {
  name?: string;
  value?: string;
};

type XMLNodeLike = {
  attributes?: ArrayLike<XMLAttribute>;
  childNodes?: ArrayLike<XMLNodeLike>;
  nodeType: number;
  tagName?: string;
};

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const URL_ATTRIBUTES = new Set(['href', 'src']);

const INLINE_ATTRIBUTE_ALLOWLIST: Record<string, ReadonlySet<string>> = {
  a: new Set(['href']),
  b: new Set(),
  codeinline: new Set(),
  emphasis: new Set(),
  i: new Set(),
  ins: new Set(),
  math: new Set(['code']),
  mention: new Set(['label', 'metadata']),
  paragraph: new Set(),
  span: new Set(['bold', 'italic', 'strikethrough', 'subscript', 'superscript', 'underline']),
  strong: new Set(),
  text: new Set(),
  u: new Set(),
};

/** Registered structural nodes are allowed for generic Agent LiteXML commands. */
const STRUCTURAL_ATTRIBUTE_ALLOWLIST: Record<string, ReadonlySet<string>> = {
  blockquote: new Set(),
  h1: new Set(),
  h2: new Set(),
  h3: new Set(),
  h4: new Set(),
  h5: new Set(),
  h6: new Set(),
  li: new Set(['checked', 'value']),
  img: new Set(['alt', 'block', 'max-width', 'src', 'width']),
  ol: new Set(['start']),
  p: new Set(),
  hr: new Set(),
  root: new Set(),
  table: new Set(['colwidths']),
  td: new Set(['backgroundcolor', 'colspan', 'rowspan']),
  th: new Set(['backgroundcolor', 'colspan', 'rowspan']),
  tr: new Set(['height']),
  ul: new Set(),
  code: new Set(['lang']),
  mathblock: new Set(['code']),
  collapsible: new Set(['collapsed', 'title']),
  quote: new Set(),
};

const isSafeURL = (value: string): boolean => {
  const normalized = value.trim();
  if (
    !normalized ||
    Array.from(normalized).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127;
    })
  ) {
    return false;
  }
  if (normalized.startsWith('//')) return false;
  // A predefined entity may legally decode to an ampersand in an XML
  // attribute. Reject any entity spelling that remains after parsing so a
  // later HTML serialization cannot turn `&colon;` into a scheme delimiter.
  if (/&(?:#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/iu.test(normalized)) return false;

  // Relative links are safe for the editor; explicit schemes must be a small
  // allowlist. This rejects javascript:, data:, vbscript:, file:, and blob:.
  if (!/^[a-z][a-z\d+.-]*:/iu.test(normalized)) {
    return normalized.startsWith('/') || normalized.startsWith('#') || !normalized.includes(':');
  }

  try {
    return SAFE_URL_PROTOCOLS.has(new URL(normalized).protocol.toLowerCase());
  } catch {
    return false;
  }
};

const utf8ByteLength = (value: string): number => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).byteLength;
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 127 ? 1 : code <= 2047 ? 2 : code <= 65535 ? 3 : 4;
  }
  return bytes;
};

const attributeAllowlistFor = (tagName: string, allowIds: boolean): ReadonlySet<string> | null => {
  const key = tagName.toLowerCase();
  const base = INLINE_ATTRIBUTE_ALLOWLIST[key] ?? STRUCTURAL_ATTRIBUTE_ALLOWLIST[key];
  if (!base) return null;
  if (!allowIds) return base;
  return new Set([...base, 'id']);
};

/**
 * Validate model-produced LiteXML without mutating an editor. Returning an
 * error code instead of throwing lets command results remain request-scoped.
 */
export function validateLiteXMLInput(
  xml: string,
  options: LiteXMLValidationOptions = {},
): string | null {
  if (typeof xml !== 'string') return 'replacement-litexml-invalid';
  if (utf8ByteLength(xml) > LITEXML_REWRITE_MAX_BYTES) {
    return 'replacement-litexml-too-large';
  }

  // Do not allow declarations, comments, CDATA, entity declarations, or
  // processing instructions to reach the XML reader. Normal &amp; escaping is
  // still accepted by the parser; only markup-level entity mechanisms are
  // rejected here.
  const declaration = /^\s*<\?xml\b[\s\S]*?\?>/iu;
  const withoutDeclaration = xml.replace(declaration, '');
  if (/<[!?]/u.test(withoutDeclaration)) return 'replacement-litexml-entity-forbidden';
  // Only the five XML predefined entities are useful to a text-bearing
  // editor node. Numeric and custom entities are rejected as well: accepting
  // them would make the validation contract depend on parser expansion rules.
  if (/&(?!(?:amp|apos|gt|lt|quot);)/iu.test(xml)) {
    return 'replacement-litexml-entity-forbidden';
  }

  let document: ReturnType<DOMParser['parseFromString']>;
  try {
    document = new DOMParser({
      onError: (_level, message) => {
        throw new Error(message);
      },
    }).parseFromString(xml, 'text/xml');
  } catch {
    return 'replacement-litexml-invalid';
  }

  const root = document.documentElement as unknown as XMLNodeLike;
  if (!root) return 'replacement-litexml-invalid';

  let nodeCount = 0;
  const visit = (node: XMLNodeLike, depth: number): string | null => {
    nodeCount += 1;
    if (nodeCount > LITEXML_REWRITE_MAX_NODES) return 'replacement-litexml-too-many-nodes';
    if (depth > LITEXML_REWRITE_MAX_DEPTH) return 'replacement-litexml-too-deep';

    if (node.nodeType === 1) {
      const element = node;
      const tagName = element.tagName?.toLowerCase() ?? '';
      const allowedAttributes = attributeAllowlistFor(tagName, options.allowIds === true);
      if (!allowedAttributes) return 'replacement-litexml-unknown-node';

      const attributes = element.attributes;
      const attributeCount = attributes?.length ?? 0;
      if (attributeCount > LITEXML_REWRITE_MAX_ATTRIBUTES_PER_NODE) {
        return 'replacement-litexml-too-many-attributes';
      }
      for (let index = 0; index < attributeCount; index += 1) {
        const attribute = attributes?.[index];
        const name = attribute?.name?.toLowerCase();
        const value = attribute?.value ?? '';
        if (!name || !allowedAttributes.has(name)) {
          return 'replacement-litexml-attribute-not-allowed';
        }
        if (utf8ByteLength(value) > LITEXML_REWRITE_MAX_ATTRIBUTE_BYTES) {
          return 'replacement-litexml-attribute-too-large';
        }
        if (URL_ATTRIBUTES.has(name) && !isSafeURL(value)) {
          return 'replacement-litexml-unsafe-url';
        }
        if (name === 'id' && !value.trim()) return 'replacement-litexml-invalid-id';
      }
    } else if (node.nodeType !== 3 && node.nodeType !== 9) {
      return 'replacement-litexml-node-not-allowed';
    }

    for (const child of Array.from(node.childNodes ?? [])) {
      const error = visit(child, node.nodeType === 1 ? depth + 1 : depth);
      if (error) return error;
    }
    return null;
  };

  return visit(root, 1);
}

/** Emitted after a pending rewrite Diff is accepted or rejected locally. */
export interface RewriteReviewEvent {
  action: 'applied' | 'rejected';
  attempt?: number;
  commandId: string;
  requestId: string;
}

export type RewriteReviewListener = (event: RewriteReviewEvent) => void;

export type RewriteCommandResultListener = (result: RewriteCommandResult) => void;

/** Result channel used because Lexical dispatchCommand only returns boolean. */
export interface RewriteCommandResultChannel {
  clear(requestId?: string): void;
  get(requestId: string): RewriteCommandResult | undefined;
  publish(result: RewriteCommandResult): void;
  /** Optional for channels that do not own a browser review lifecycle. */
  publishReview?: (event: RewriteReviewEvent) => void;
  subscribe(listener: RewriteCommandResultListener): () => void;
  /** Optional for channels that do not own a browser review lifecycle. */
  subscribeReview?: (listener: RewriteReviewListener) => () => void;
  waitForResult(requestId: string, timeoutMs?: number): Promise<RewriteCommandResult | undefined>;
}

export class InMemoryRewriteCommandResultChannel implements RewriteCommandResultChannel {
  private readonly listeners = new Set<RewriteCommandResultListener>();
  private readonly reviewListeners = new Set<RewriteReviewListener>();
  private readonly results = new Map<string, RewriteCommandResult>();

  publish(result: RewriteCommandResult): void {
    this.results.set(result.requestId, result);
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (error) {
        logger.warn('Rewrite result listener failed:', error);
      }
    }
  }

  get(requestId: string): RewriteCommandResult | undefined {
    return this.results.get(requestId);
  }

  publishReview(event: RewriteReviewEvent): void {
    for (const listener of this.reviewListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.warn('Rewrite review listener failed:', error);
      }
    }
  }

  clear(requestId?: string): void {
    if (requestId) this.results.delete(requestId);
    else this.results.clear();
  }

  subscribe(listener: RewriteCommandResultListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeReview(listener: RewriteReviewListener): () => void {
    this.reviewListeners.add(listener);
    return () => this.reviewListeners.delete(listener);
  }

  waitForResult(requestId: string, timeoutMs = 10_000): Promise<RewriteCommandResult | undefined> {
    const existing = this.get(requestId);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(undefined);
      }, timeoutMs);
      const unsubscribe = this.subscribe((result) => {
        if (result.requestId !== requestId) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(result);
      });
    });
  }
}

/** Service ID for the result channel installed by LitexmlPlugin. */
export const IRewriteCommandResultService: IServiceID<RewriteCommandResultChannel> = genServiceId(
  'RewriteCommandResultChannel',
);

/** Service ID for the editor-owned Promise rewrite boundary. */
export const IRewriteService: IServiceID<IRewriteService> = genServiceId('RewriteService');

interface PendingRewriteOperation {
  beforeState?: ReturnType<LexicalEditor['getEditorState']>;
  error?: string;
  executionResult?: RewriteCommandResult;
  executionTimer?: ReturnType<typeof setTimeout>;
  fallbackTimer?: ReturnType<typeof setTimeout>;
  phase: 'queued' | 'executing' | 'committing' | 'settled';
  promise: Promise<RewriteCommandResult>;
  resolve: (result: RewriteCommandResult) => void;
  settled: boolean;
  payload: RewriteRangeCommandPayload;
}

const isRewriteCommitResult = (result: RewriteCommandResult): boolean =>
  result.status === 'applied' || result.status === 'diff-created';

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

/**
 * Own the asynchronous boundary for one targeted rewrite.
 *
 * A command listener runs inside Lexical's implicit update and can only return
 * a boolean. Calling `editor.update` here is therefore allowed to enqueue a
 * nested update. The per-update `onUpdate` callback is the commit boundary:
 * Lexical invokes it after all update listeners (including the Yjs bridge) and
 * after a failed update has restored the previous editor state. Kernel error
 * events are tracked while the operation's update is being processed so a
 * swallowed Lexical error cannot be mistaken for a successful commit.
 */
export class RewriteService implements IRewriteService {
  private readonly pending = new Map<string, PendingRewriteOperation>();
  private readonly activeOperations = new Set<PendingRewriteOperation>();
  private readonly kernel: ReturnType<typeof getKernelFromEditor> | undefined;
  private destroyed = false;
  private readonly onKernelError = (error: Error): void => {
    const message = errorMessage(error, 'rewrite-range-failed');
    for (const operation of this.activeOperations) {
      if (!operation.settled) operation.error = message;
    }
  };

  constructor(
    private readonly editor: LexicalEditor,
    private readonly dataSource: LitexmlDataSource,
    private readonly resultChannel: RewriteCommandResultChannel,
  ) {
    const kernel = getKernelFromEditor(editor);
    this.kernel = kernel;
    kernel?.on('error', this.onKernelError);
    rewriteServicesByEditor.set(editor, this);
  }

  rewriteRange(
    payload: RewriteRangeCommandPayload,
    options: RewriteServiceExecutionOptions = {},
  ): Promise<RewriteCommandResult> {
    const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
    if (this.destroyed) {
      const result = failedResult(payload ?? {}, 'rewrite-range-destroyed', 'aborted');
      this.publishImmediate(result);
      return Promise.resolve(result);
    }
    if (!requestId) {
      const result = failedResult(payload ?? {}, 'requestId-required');
      this.publishImmediate(result);
      return Promise.resolve(result);
    }

    const existing = this.pending.get(requestId);
    if (existing) return existing.promise;

    const previous = this.resultChannel.get(requestId);
    if (previous && (isRewriteCommitResult(previous) || previous.status === 'aborted')) {
      return Promise.resolve(previous);
    }
    if (previous) this.resultChannel.clear(requestId);

    let resolve!: (result: RewriteCommandResult) => void;
    const promise = new Promise<RewriteCommandResult>((resolvePromise) => {
      resolve = resolvePromise;
    });
    const operation: PendingRewriteOperation = {
      payload,
      phase: 'queued' as const,
      promise,
      resolve,
      settled: false,
    };
    this.pending.set(requestId, operation);
    if (options.schedule === 'separate') {
      // The command listener itself runs inside Lexical's implicit update. A
      // next-task timer starts the rewrite after that update has committed,
      // preserving the legacy independent undo step. The operation is already
      // reserved above so duplicate requests and cancel/destroy remain
      // service-owned while it is waiting.
      operation.executionTimer = setTimeout(() => {
        operation.executionTimer = undefined;
        this.start(operation);
      }, 0);
    } else {
      this.start(operation);
    }
    return promise;
  }

  cancel(requestId?: string, reason = 'rewrite-range-cancelled'): void {
    const operations = requestId
      ? [this.pending.get(requestId)].filter((operation): operation is PendingRewriteOperation =>
          Boolean(operation),
        )
      : [...this.pending.values()];
    for (const operation of operations) {
      if (operation.phase === 'queued') {
        this.finish(operation, failedResult(operation.payload, reason, 'aborted'));
      } else if (operation.phase === 'executing') {
        // The Lexical transaction is already executing. Its commit boundary
        // owns the outcome; claiming cancellation here could report `aborted`
        // after this transaction is committed.
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const operation of this.pending.values()) {
      // A committing operation has already crossed Lexical's local commit
      // boundary; let its synchronous settlement finish. Queued/executing
      // operations are released when their owner is torn down. An executing
      // operation is allowed to cross its real commit callback first; the
      // bounded fallback armed by start() handles an onError that aborts
      // before Lexical can invoke that callback.
      if (operation.phase === 'queued') {
        this.finish(
          operation,
          failedResult(operation.payload, 'rewrite-range-destroyed', 'aborted'),
        );
      }
    }
    if (this.activeOperations.size === 0) this.kernel?.off('error', this.onKernelError);
    if (rewriteServicesByEditor.get(this.editor) === this) {
      rewriteServicesByEditor.delete(this.editor);
    }
  }

  private start(operation: PendingRewriteOperation): void {
    if (operation.settled) return;
    // This timer is a bounded failure fallback for bare editors whose onError
    // throws before Lexical can invoke onUpdate. It never proves success; only
    // the corresponding onUpdate callback can do that.
    operation.fallbackTimer = setTimeout(() => this.fallback(operation), 0);
    try {
      this.editor.update(
        () => {
          if (operation.settled) return;
          operation.phase = 'executing';
          operation.beforeState = this.editor.getEditorState();
          this.activeOperations.add(operation);
          try {
            operation.executionResult = executeRewriteRange(
              this.editor,
              this.dataSource,
              operation.payload,
            );
          } catch (error) {
            operation.error = errorMessage(error, 'rewrite-range-failed');
            operation.executionResult = failedResult(operation.payload, operation.error);
            // Let Lexical restore the pre-update state. Swallowing here would
            // allow a parser/transform exception after a partial mutation to
            // publish a failed result while still committing that mutation.
            throw error;
          }
        },
        {
          discrete: true,
          tag: operation.payload.history === 'merge' ? HISTORY_MERGE_TAG : HISTORY_PUSH_TAG,
          onUpdate: () => this.commit(operation),
        },
      );
    } catch (error) {
      this.activeOperations.delete(operation);
      this.finish(
        operation,
        failedResult(operation.payload, errorMessage(error, 'rewrite-range-failed')),
      );
    }
  }

  private commit(operation: PendingRewriteOperation): void {
    if (operation.settled) return;
    operation.phase = 'committing';
    this.activeOperations.delete(operation);

    if (operation.error) {
      this.finish(operation, failedResult(operation.payload, operation.error));
      return;
    }
    // Lexical's default onError reports and restores the current state without
    // throwing. Identity is stable for that rollback, while every update that
    // reaches this deferred callback receives a committed editor state.
    if (operation.beforeState && this.editor.getEditorState() === operation.beforeState) {
      this.finish(operation, failedResult(operation.payload, 'rewrite-range-not-committed'));
      return;
    }
    const result =
      operation.executionResult ?? failedResult(operation.payload, 'rewrite-range-did-not-run');
    if (!isRewriteCommitResult(result)) {
      this.finish(operation, result);
      return;
    }
    const stateVector = getRewriteStateVector(this.editor);
    this.finish(operation, {
      ...result,
      ...(stateVector ? { stateVector } : {}),
    });
  }

  /**
   * A custom bare Lexical editor may throw from `onError` before Lexical can
   * invoke the per-update callback. Bound the wait; only the corresponding
   * per-update callback is allowed to prove a successful commit.
   */
  private fallback(operation: PendingRewriteOperation): void {
    if (operation.settled) return;
    operation.fallbackTimer = undefined;
    if (this.destroyed) {
      this.finish(operation, failedResult(operation.payload, 'rewrite-range-destroyed', 'aborted'));
      return;
    }
    if (operation.error) {
      this.finish(operation, failedResult(operation.payload, operation.error));
      return;
    }
    this.finish(operation, failedResult(operation.payload, 'rewrite-range-commit-not-observed'));
  }

  private finish(operation: PendingRewriteOperation, result: RewriteCommandResult): void {
    if (operation.settled) return;
    operation.settled = true;
    operation.phase = 'settled';
    if (operation.executionTimer !== undefined) {
      clearTimeout(operation.executionTimer);
      operation.executionTimer = undefined;
    }
    if (operation.fallbackTimer !== undefined) {
      clearTimeout(operation.fallbackTimer);
      operation.fallbackTimer = undefined;
    }
    this.pending.delete(operation.payload.requestId);
    this.activeOperations.delete(operation);
    if (this.destroyed && this.activeOperations.size === 0) {
      this.kernel?.off('error', this.onKernelError);
    }
    try {
      this.resultChannel.publish(result);
    } catch (error) {
      logger.warn('Rewrite result channel publish failed:', error);
    } finally {
      operation.resolve(result);
    }
  }

  private publishImmediate(result: RewriteCommandResult): void {
    try {
      this.resultChannel.publish(result);
    } catch (error) {
      logger.warn('Rewrite result channel publish failed:', error);
    }
  }
}

const rewriteServicesByEditor = new WeakMap<LexicalEditor, RewriteService>();

/** Resolve the service installed by a Litexml plugin or bare command setup. */
export const getRewriteService = (editor: LexicalEditor): IRewriteService | undefined =>
  rewriteServicesByEditor.get(editor);

export { hashRewriteText, normalizeRewriteText };

type SerializedNode = SerializedLexicalNode & {
  children?: SerializedNode[];
  [key: string]: unknown;
};

interface ResolvedSelection {
  end: PointType;
  selection: RangeSelection;
  start: PointType;
}

interface RewriteValidation {
  blocks: LexicalNode[];
  endOffset: number;
  endPoint: PointType;
  firstBlock: LexicalNode;
  startOffset: number;
  startPoint: PointType;
}

interface RewriteIdentityTransfer {
  afterIndex: number;
  beforeIndex: number;
  nodeId: string;
}

interface RewriteReviewMetadata {
  attempt?: number;
  commandId: string;
  requestId: string;
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneSerialized = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // JSON is sufficient for Lexical's serialized node shape.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

function createCommandId(): string {
  const cryptoObject = (
    globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }
  ).crypto;
  if (typeof cryptoObject?.randomUUID === 'function') return cryptoObject.randomUUID();
  return `rewrite-command-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function failedResult(
  payload: Partial<RewriteRangeCommandPayload>,
  error: string,
  status: RewriteCommandStatus = 'failed',
): RewriteCommandResult {
  return {
    affectedNodeIds: [],
    commandId: payload.commandId || createCommandId(),
    error,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : '',
    status,
  };
}

function getNodeAncestors(node: LexicalNode): LexicalNode[] {
  const ancestors: LexicalNode[] = [];
  let current: LexicalNode | null = node;
  while (current) {
    ancestors.push(current);
    current = current.getParent();
  }
  return ancestors;
}

function hasAncestor(node: LexicalNode, predicate: (candidate: LexicalNode) => boolean): boolean {
  return getNodeAncestors(node).some(predicate);
}

function isAllowedBlock(node: LexicalNode): boolean {
  return node.getType() === 'paragraph' || node.getType() === 'heading' || $isListItemNode(node);
}

function findRewriteBlock(node: LexicalNode): LexicalNode | null {
  let candidate: LexicalNode | null = null;
  let current: LexicalNode | null = node;
  while (current && current.getType() !== 'root') {
    if ($isTableNode(current) || $isTableRowNode(current) || $isTableCellNode(current)) {
      return null;
    }
    if ($isListItemNode(current)) candidate = current;
    else if (!candidate && isAllowedBlock(current)) candidate = current;
    current = current.getParent();
  }
  return candidate;
}

/** Keep command-side point validation while sharing the editor-kernel offset math. */
function getValidatedBlockOffset(point: PointType, block: LexicalNode): number | null {
  let node: LexicalNode;
  try {
    node = point.getNode();
  } catch {
    return null;
  }
  if (!node.isAttached() || (!node.is(block) && !block.isParentOf(node))) return null;
  if (point.type === 'text' && !$isTextNode(node)) return null;
  if (point.type === 'element' && !$isElementNode(node)) return null;
  if (point.offset < 0) return null;
  if (point.type === 'text' && point.offset > node.getTextContentSize()) return null;
  if (point.type === 'element' && $isElementNode(node) && point.offset > node.getChildrenSize()) {
    return null;
  }
  return getBlockOffset(point, block);
}

function collectRewriteBlocks(root: LexicalNode): LexicalNode[] {
  const blocks: LexicalNode[] = [];
  const visit = (node: LexicalNode, insideListItem: boolean): void => {
    if ($isTableNode(node) || $isTableRowNode(node) || $isTableCellNode(node)) return;
    const isListItem = $isListItemNode(node);
    if (isListItem) {
      blocks.push(node);
      // List item content is handled as one logical block; nested list items
      // are rejected by validation rather than flattened into this range.
      node.getChildren().forEach((child) => {
        if ($isListItemNode(child)) visit(child, true);
      });
      return;
    }
    if (isAllowedBlock(node) && !insideListItem) blocks.push(node);
    if ($isElementNode(node)) node.getChildren().forEach((child) => visit(child, insideListItem));
  };
  if ($isElementNode(root)) root.getChildren().forEach((child) => visit(child, false));
  return blocks;
}

interface SerializedSelectionProof {
  quotedText?: string;
  quotedTextHash?: string;
  targetNodeIds?: string[];
}

const isDurableNodeId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Read optional capture proofs without accepting any runtime Lexical key.
 * These fields are copied from a browser/Yjs selection capture and are
 * rechecked against the live editor immediately before applying a rewrite.
 */
function getSerializedSelectionProof(input: RewriteSelectionInput): SerializedSelectionProof {
  if (!isRecord(input)) return {};
  const serializable = input as unknown as {
    quotedText?: unknown;
    quotedTextHash?: unknown;
    targetNodeIds?: unknown;
  };
  const targetNodeIds = serializable.targetNodeIds;
  return {
    ...(typeof serializable.quotedText === 'string' ? { quotedText: serializable.quotedText } : {}),
    ...(typeof serializable.quotedTextHash === 'string'
      ? { quotedTextHash: serializable.quotedTextHash }
      : {}),
    ...(Array.isArray(targetNodeIds) ? { targetNodeIds } : {}),
  };
}

function resolveSerializedSelection(
  selection: SerializedRewriteCommandSelection,
): ResolvedSelection | null {
  if (
    !selection ||
    selection.type !== 'range' ||
    !selection.anchor ||
    !selection.focus ||
    !isDurableNodeId(selection.anchor.nodeId) ||
    !isDurableNodeId(selection.focus.nodeId) ||
    (selection.anchor.type !== undefined &&
      selection.anchor.type !== 'element' &&
      selection.anchor.type !== 'text') ||
    (selection.focus.type !== undefined &&
      selection.focus.type !== 'element' &&
      selection.focus.type !== 'text')
  ) {
    return null;
  }
  const anchorBlock = $findNodeById(selection.anchor.nodeId);
  const focusBlock = $findNodeById(selection.focus.nodeId);
  if (!anchorBlock || !focusBlock) return null;

  const anchorPoint = getBlockPoint(anchorBlock, selection.anchor.offset, 'start');
  const focusPoint = getBlockPoint(focusBlock, selection.focus.offset, 'end');
  if (!anchorPoint || !focusPoint) return null;
  if (selection.anchor.type && selection.anchor.type !== anchorPoint.type) return null;
  if (selection.focus.type && selection.focus.type !== focusPoint.type) return null;

  const range = $createRangeSelection();
  range.anchor.set(anchorPoint.key, anchorPoint.offset, anchorPoint.type);
  range.focus.set(focusPoint.key, focusPoint.offset, focusPoint.type);
  return {
    end: range.focus,
    selection: range,
    start: range.anchor,
  };
}

function resolveSelection(input: RewriteSelectionInput): ResolvedSelection | null {
  if ($isRangeSelection(input)) {
    const selection = input.clone();
    return {
      end: selection.focus,
      selection,
      start: selection.anchor,
    };
  }
  if (isRecord(input) && (input as { type?: unknown }).type === 'range') {
    return resolveSerializedSelection(input as SerializedRewriteCommandSelection);
  }
  if (isRecord(input) && (input as { kind?: unknown }).kind === 'block') {
    const blockSelection = input as SerializedBlockRewriteSelection;
    return resolveSerializedSelection({
      anchor: {
        nodeId: blockSelection.startNodeId,
        offset: blockSelection.startOffset,
      },
      focus: {
        nodeId: blockSelection.endNodeId,
        offset: blockSelection.endOffset,
      },
      type: 'range',
    });
  }
  return null;
}

/**
 * AI-session ranges are the canonical rewrite proof. Their serialized text
 * leaves out invisible cursor sentinels and structural list separators, while
 * Lexical's generic RangeSelection text includes both. Keep the historical
 * selection text for human ranges; only an entirely one-session AI range uses
 * the generated-text projection used by Page and the durable continuation
 * validator.
 */
function getRewriteSelectionText(selection: RangeSelection): string {
  const selectedTextNodes = selection.getNodes().filter($isTextNode);
  const firstPoint = selection.isBackward() ? selection.focus : selection.anchor;
  const lastPoint = selection.isBackward() ? selection.anchor : selection.focus;
  const firstNode = firstPoint.getNode();
  const lastNode = lastPoint.getNode();
  const sessionIds = new Set(
    selectedTextNodes
      .map((node) => $getNodeProperties(node).provenance)
      .filter(
        (provenance): provenance is NonNullable<typeof provenance> =>
          provenance?.source === 'ai' && typeof provenance.sessionId === 'string',
      )
      .map((provenance) => provenance.sessionId),
  );
  if (
    selectedTextNodes.length === 0 ||
    sessionIds.size !== 1 ||
    selectedTextNodes.some(
      (node) => node.getType() !== 'cursor' && $getNodeProperties(node).provenance?.source !== 'ai',
    )
  ) {
    return selection.getTextContent();
  }

  let previousBlock: LexicalNode | null = null;
  let result = '';
  for (const node of selectedTextNodes) {
    if (node.getType() === 'cursor') continue;
    const block = findRewriteBlock(node);
    if (result && block && block !== previousBlock) result += ' ';
    let text = node.getTextContent();
    if (node === firstNode && node === lastNode) {
      text = text.slice(firstPoint.offset, lastPoint.offset);
    } else {
      if (node === firstNode) text = text.slice(firstPoint.offset);
      if (node === lastNode) text = text.slice(0, lastPoint.offset);
    }
    result += text;
    previousBlock = block;
  }
  return result;
}

function validateSelection(
  input: RewriteSelectionInput,
  expectedTextHash: string,
): RewriteValidation | RewriteCommandResult {
  const resolved = resolveSelection(input);
  if (!resolved) return failedResult({}, 'selection-not-range-or-unresolvable', 'stale');

  const { selection } = resolved;
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return failedResult({}, 'selection-must-be-non-collapsed-range', 'stale');
  }

  let startPoint = selection.anchor;
  let endPoint = selection.focus;
  if (selection.isBackward()) [startPoint, endPoint] = [selection.focus, selection.anchor];

  let startNode: LexicalNode;
  let endNode: LexicalNode;
  try {
    startNode = startPoint.getNode();
    endNode = endPoint.getNode();
  } catch {
    return failedResult({}, 'selection-point-detached', 'stale');
  }
  if (!startNode.isAttached() || !endNode.isAttached()) {
    return failedResult({}, 'selection-point-detached', 'stale');
  }

  if (
    hasAncestor(
      startNode,
      (node) => $isTableNode(node) || $isTableRowNode(node) || $isTableCellNode(node),
    ) ||
    hasAncestor(
      endNode,
      (node) => $isTableNode(node) || $isTableRowNode(node) || $isTableCellNode(node),
    )
  ) {
    return failedResult({}, 'table-selection-not-supported');
  }

  const startBlock = findRewriteBlock(startNode);
  const endBlock = findRewriteBlock(endNode);
  if (!startBlock || !endBlock) return failedResult({}, 'unsupported-selection-container');
  if (hasAncestor(startNode, $isDiffNode) || hasAncestor(endNode, $isDiffNode)) {
    return failedResult({}, 'selection-inside-existing-diff', 'stale');
  }
  const startOffset = getValidatedBlockOffset(startPoint, startBlock);
  const endOffset = getValidatedBlockOffset(endPoint, endBlock);
  if (startOffset === null || endOffset === null || startOffset > getLinearTextLength(startBlock)) {
    return failedResult({}, 'selection-offset-invalid', 'stale');
  }
  if (endOffset === null || endOffset > getLinearTextLength(endBlock)) {
    return failedResult({}, 'selection-offset-invalid', 'stale');
  }

  const rawSelectedText = selection.getTextContent();
  const canonicalSelectedText = getRewriteSelectionText(selection);
  const selectedText =
    hashRewriteText(rawSelectedText) === expectedTextHash ? rawSelectedText : canonicalSelectedText;
  if (!selectedText || hashRewriteText(selectedText) !== expectedTextHash) {
    return failedResult({}, 'expected-text-hash-mismatch', 'stale');
  }
  const selectionProof = getSerializedSelectionProof(input);
  if (
    (selectionProof.quotedText !== undefined &&
      normalizeRewriteText(selectionProof.quotedText) !== normalizeRewriteText(selectedText)) ||
    (selectionProof.quotedTextHash !== undefined &&
      hashRewriteText(selectedText) !== selectionProof.quotedTextHash)
  ) {
    return failedResult({}, 'selection-proof-mismatch', 'stale');
  }
  if (
    selectionProof.targetNodeIds !== undefined &&
    (!selectionProof.targetNodeIds.every(isDurableNodeId) ||
      new Set(selectionProof.targetNodeIds).size !== selectionProof.targetNodeIds.length ||
      selectionProof.targetNodeIds.length === 0)
  ) {
    return failedResult({}, 'selection-targets-invalid', 'stale');
  }

  const selectedNodes = selection.getNodes();
  for (const node of selectedNodes) {
    if ($isDecoratorNode(node) || $isLineBreakNode(node)) {
      return failedResult({}, 'decorator-or-linebreak-selection-not-supported');
    }
    if (
      $isElementNode(node) &&
      !node.isInline() &&
      !isAllowedBlock(node) &&
      !$isListItemNode(node)
    ) {
      return failedResult({}, 'unsupported-selection-block');
    }
  }

  const allBlocks = collectRewriteBlocks($getRoot());
  const firstIndex = allBlocks.findIndex((block) => block.is(startBlock));
  const lastIndex = allBlocks.findIndex((block) => block.is(endBlock));
  if (firstIndex < 0 || lastIndex < 0 || firstIndex > lastIndex) {
    return failedResult({}, 'selection-order-invalid', 'stale');
  }
  const blocks = allBlocks.slice(firstIndex, lastIndex + 1);
  if (blocks.length === 0) return failedResult({}, 'selection-has-no-blocks', 'stale');

  if (selectionProof.targetNodeIds !== undefined) {
    const currentTargetNodeIds = blocks.map($getNodeId);
    if (
      currentTargetNodeIds.some((nodeId): nodeId is undefined => !nodeId) ||
      currentTargetNodeIds.length !== selectionProof.targetNodeIds.length ||
      currentTargetNodeIds.some((nodeId, index) => nodeId !== selectionProof.targetNodeIds?.[index])
    ) {
      return failedResult({}, 'selection-targets-stale', 'stale');
    }
  }

  const commonParent = startBlock.getParent();
  if (!commonParent || endBlock.getParent() !== commonParent) {
    return failedResult({}, 'cross-container-selection-not-supported');
  }
  const isListItemRange =
    commonParent.getType() === 'list' && blocks.every((block) => $isListItemNode(block));
  if (blocks.length > 1 && commonParent.getType() !== 'root' && !isListItemRange) {
    return failedResult({}, 'cross-nested-container-selection-not-supported');
  }

  for (const block of blocks) {
    if (!isAllowedBlock(block)) return failedResult({}, 'unsupported-selection-block');
    if (!block.isAttached()) return failedResult({}, 'selection-block-detached', 'stale');
    if ($isListItemNode(block)) {
      const children = block.getChildren();
      if (
        children.some(
          (child) =>
            child.getType() === 'list' ||
            $isListItemNode(child) ||
            $isTableNode(child) ||
            $isTableRowNode(child) ||
            $isTableCellNode(child),
        )
      ) {
        return failedResult({}, 'nested-list-item-structure-not-supported');
      }
    }
    if (hasAncestor(block, $isDiffNode))
      return failedResult({}, 'selection-inside-existing-diff', 'stale');
    if (serializeTextLength(block) !== getLinearTextLength(block)) {
      return failedResult({}, 'unsupported-non-text-inline-content');
    }
  }

  return {
    blocks,
    endOffset,
    endPoint,
    firstBlock: startBlock,
    startOffset,
    startPoint,
  };
}

/** Return serialized text length and reject unknown decorator atoms later. */
function serializeTextLength(node: LexicalNode): number {
  if ($isTextNode(node)) return node.getTextContentSize();
  if ($isLineBreakNode(node)) return node.getTextContent().length;
  if ($isDecoratorNode(node)) return node.getTextContent().length;
  if ($isElementNode(node)) {
    return node.getChildren().reduce((total, child) => total + serializeTextLength(child), 0);
  }
  return node.getTextContent().length;
}

function serializeNode(node: LexicalNode): SerializedNode {
  const serialized = cloneSerialized(node.exportJSON()) as SerializedNode;
  if ($isElementNode(node)) serialized.children = node.getChildren().map(serializeNode);
  return serialized;
}

function getSerializedTextLength(node: SerializedNode): number {
  if (typeof node.text === 'string') return node.text.length;
  if (node.type === 'linebreak' || node.type === 'tab') return 1;
  if (Array.isArray(node.children)) {
    return node.children.reduce((total, child) => total + getSerializedTextLength(child), 0);
  }
  if (typeof node.label === 'string') return node.label.length;
  return 0;
}

function isUnsupportedSerializedAtom(node: SerializedNode): boolean {
  if (node.type === 'linebreak' || node.type === 'tab') return true;
  if (typeof node.text === 'string') return false;
  if (Array.isArray(node.children)) return false;
  // Decorator nodes cannot be split at character offsets in this MVP.
  return getSerializedTextLength(node) > 0;
}

function getReplacementFormatting(block: LexicalNode, offset: number): SerializedNode {
  let fallback: SerializedNode = {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text: '',
    type: 'text',
    version: 1,
  } as SerializedNode;
  const visit = (node: LexicalNode, cursor: { value: number }): SerializedNode | null => {
    if ($isTextNode(node)) {
      const serialized = serializeNode(node);
      fallback = serialized;
      const end = cursor.value + node.getTextContentSize();
      if (offset <= end) return serialized;
      cursor.value = end;
      return null;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        const result = visit(child, cursor);
        if (result) return result;
      }
    }
    return null;
  };
  return visit(block, { value: 0 }) || fallback;
}

function createTextReplacement(text: string, formatting: SerializedNode): SerializedNode[] {
  if (!text) return [];
  const base = {
    detail: formatting.detail ?? 0,
    format: formatting.format ?? 0,
    mode: formatting.mode ?? 'normal',
    style: formatting.style ?? '',
    type: 'text',
    version: 1,
  } as Record<string, unknown>;
  const parts = text.split(/(\r?\n|\t)/);
  return parts.flatMap((part) => {
    if (part === '\n' || part === '\r\n')
      return [{ type: 'linebreak', version: 1 } as SerializedNode];
    if (part === '\t') return [{ type: 'tab', version: 1 } as SerializedNode];
    if (!part) return [];
    return [{ ...base, text: part } as unknown as SerializedNode];
  });
}

interface ParsedMarkdownReplacement {
  blocks?: SerializedNode[];
  inline: SerializedNode[];
}

/** Parse Agent text through the editor's configured Markdown readers. */
function parseMarkdownReplacement(
  editor: LexicalEditor,
  text: string,
  formatting: SerializedNode,
  replaceWholeBlock = false,
): ParsedMarkdownReplacement | null {
  if (!text) return { inline: [] };
  const markdownService = getKernelFromEditor(editor)?.requireService(IMarkdownShortCutService);
  if (!markdownService) return null;

  const root = markdownService.parseMarkdownToLexical(text) as unknown as {
    children?: SerializedNode[];
  };
  const children = Array.isArray(root.children) ? root.children.map(cloneSerialized) : [];
  // A complete block rewrite takes its structure and presentation from the
  // parsed output. Only a partial text edit inherits its surrounding block.
  if (replaceWholeBlock) return { blocks: children, inline: [] };
  if (children.length === 1 && children[0]?.type === 'paragraph') {
    const inline = children[0].children?.map(cloneSerialized) ?? [];
    const hasExplicitFormatting = inline.some((node) => {
      if (node.type === 'codeInline') return true;
      if (typeof node.text === 'string' && typeof node.format === 'number') {
        return node.format !== 0;
      }
      return (
        Array.isArray(node.children) &&
        node.children.some((child) => {
          const childFormat = (child as { format?: unknown }).format;
          return typeof childFormat === 'number' && childFormat !== 0;
        })
      );
    });
    const formattingDetail = typeof formatting.detail === 'number' ? formatting.detail : 0;
    const formattingFormat = typeof formatting.format === 'number' ? formatting.format : 0;
    const formattingMode = typeof formatting.mode === 'string' ? formatting.mode : 'normal';
    const formattingStyle = typeof formatting.style === 'string' ? formatting.style : '';
    if (
      !hasExplicitFormatting &&
      (formattingDetail !== 0 ||
        formattingFormat !== 0 ||
        formattingMode !== 'normal' ||
        formattingStyle)
    ) {
      return {
        inline: inline.map((node) =>
          typeof node.text === 'string'
            ? {
                ...node,
                detail: formattingDetail,
                format: (typeof node.format === 'number' ? node.format : 0) | formattingFormat,
                mode: formattingMode,
                style: formattingStyle,
              }
            : node,
        ),
      };
    }
    return { inline };
  }

  // A list (or multiple block paragraphs) must replace whole selected blocks;
  // nesting it under the existing paragraph would silently turn list syntax
  // back into plain text or produce an invalid Lexical tree.
  return { blocks: children, inline: [] };
}

function stripInsertedIdentity(node: SerializedNode): SerializedNode {
  const result = cloneSerialized(node);
  if (isRecord(result.$) && isRecord(result.$.properties)) {
    const properties = { ...result.$.properties };
    delete properties.nodeId;
    delete properties.annotationIds;
    result.$ = { ...result.$, properties };
    if (Object.keys(properties).length === 0) delete result.$;
  }
  if (Array.isArray(result.children)) result.children = result.children.map(stripInsertedIdentity);
  return result;
}

/** Give a pending after-side block a private identity until review resolves. */
function assignPendingIdentity(node: SerializedNode): string {
  const nodeId = createNodeId();
  const state = isRecord(node.$) ? node.$ : {};
  const properties = isRecord(state.properties) ? state.properties : {};
  delete properties.annotationIds;
  node.$ = {
    ...state,
    properties: {
      ...properties,
      nodeId,
    },
  };
  return nodeId;
}

function parseReplacementLiteXML(
  dataSource: LitexmlDataSource,
  xml: string,
): { nodes: SerializedNode[]; error?: string } {
  const validationError = validateLiteXMLInput(xml);
  if (validationError) return { error: validationError, nodes: [] };

  try {
    const inode = dataSource.readLiteXMLToInode(xml) as { root?: { children?: SerializedNode[] } };
    const children = (inode.root?.children || []).map(stripInsertedIdentity);
    if (children.length === 1 && ['paragraph', 'heading'].includes(children[0].type || '')) {
      return { nodes: children[0].children || [] };
    }
    if (
      children.some((node) =>
        ['paragraph', 'heading', 'listitem', 'list', 'table', 'tablerow', 'tablecell'].includes(
          node.type || '',
        ),
      )
    ) {
      return { error: 'replacement-litexml-must-contain-inline-content', nodes: [] };
    }
    return { nodes: children };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'replacement-litexml-invalid',
      nodes: [],
    };
  }
}

interface TransformState {
  inserted: boolean;
  replacement: SerializedNode[];
}

function transformChildren(
  children: SerializedNode[],
  startOffset: number,
  endOffset: number,
  state: TransformState,
  cursor: { value: number },
): SerializedNode[] {
  const output: SerializedNode[] = [];

  const insertReplacement = () => {
    if (state.inserted) return;
    output.push(...state.replacement.map(cloneSerialized));
    state.inserted = true;
  };

  for (const child of children) {
    const childStart = cursor.value;
    const childLength = getSerializedTextLength(child);
    const childEnd = childStart + childLength;
    const overlaps = childLength > 0 && childStart < endOffset && childEnd > startOffset;

    if (!overlaps) {
      if (!state.inserted && childStart >= startOffset) insertReplacement();
      output.push(cloneSerialized(child));
      cursor.value = childEnd;
      continue;
    }

    if (isUnsupportedSerializedAtom(child)) {
      throw new Error('replacement-range-crosses-unsupported-atom');
    }

    if (typeof child.text === 'string') {
      const localStart = Math.max(0, startOffset - childStart);
      const localEnd = Math.min(child.text.length, endOffset - childStart);
      if (!state.inserted && startOffset >= childStart && startOffset <= childEnd) {
        if (localStart > 0)
          output.push({ ...cloneSerialized(child), text: child.text.slice(0, localStart) });
        insertReplacement();
      } else if (localStart > 0) {
        output.push({ ...cloneSerialized(child), text: child.text.slice(0, localStart) });
      }
      if (localEnd < child.text.length) {
        output.push({ ...cloneSerialized(child), text: child.text.slice(localEnd) });
      }
      cursor.value = childEnd;
      continue;
    }

    if (Array.isArray(child.children)) {
      const nestedCursor = { value: childStart };
      const nestedChildren = transformChildren(
        child.children,
        startOffset,
        endOffset,
        state,
        nestedCursor,
      );
      const nextChild = cloneSerialized(child);
      nextChild.children = nestedChildren;
      if (nestedChildren.length > 0 || childStart < startOffset || childEnd > endOffset) {
        output.push(nextChild);
      }
      cursor.value = childEnd;
      continue;
    }

    cursor.value = childEnd;
  }

  if (!state.inserted && cursor.value >= startOffset) insertReplacement();
  return output;
}

function rewriteSerializedBlock(
  block: LexicalNode,
  startOffset: number,
  endOffset: number,
  replacement: SerializedNode[],
  insertReplacement: boolean,
): SerializedNode {
  const serialized = serializeNode(block);
  const state: TransformState = {
    inserted: !insertReplacement,
    replacement,
  };
  const textLength = getSerializedTextLength(serialized);
  const transformed = transformChildren(serialized.children || [], startOffset, endOffset, state, {
    value: 0,
  });
  if (insertReplacement && !state.inserted) transformed.push(...replacement.map(cloneSerialized));
  serialized.children = transformed;
  if (
    getSerializedTextLength(serialized) >
    textLength -
      (endOffset - startOffset) +
      replacement.reduce((n, child) => n + getSerializedTextLength(child), 0)
  ) {
    throw new Error('rewrite-serialization-length-invariant-failed');
  }
  return serialized;
}

function findSerializedNodeByNodeId(
  root: SerializedNode,
  nodeId: string,
): { node: SerializedNode; parent: SerializedNode | null; index: number } | null {
  const visit = (
    node: SerializedNode,
    parent: SerializedNode | null,
    index: number,
  ): { node: SerializedNode; parent: SerializedNode | null; index: number } | null => {
    const properties = isRecord(node.$?.properties) ? node.$.properties : null;
    if (properties?.nodeId === nodeId) return { index, node, parent };
    for (const [childIndex, child] of (node.children || []).entries()) {
      const found = visit(child, node, childIndex);
      if (found) return found;
    }
    return null;
  };
  return visit(root, null, -1);
}

function projectRewrite(
  currentRoot: SerializedNode,
  firstBlockId: string,
  blockIds: string[],
  diff: SerializedNode,
  listItem: boolean,
): SerializedDiffDocument | null {
  const projected = cloneSerialized(currentRoot);
  const location = findSerializedNodeByNodeId(projected, firstBlockId);
  if (!location) return null;

  if (listItem) {
    location.node.children = [diff];
    return { root: projected };
  }

  if (!location.parent || !Array.isArray(location.parent.children)) return null;
  const removeIds = new Set(blockIds.slice(1));
  const siblings = location.parent.children;
  siblings.splice(location.index, 1, diff);
  for (let index = siblings.length - 1; index >= 0; index--) {
    const candidate = siblings[index];
    const properties = isRecord(candidate.$?.properties) ? candidate.$.properties : null;
    if (properties?.nodeId && removeIds.has(String(properties.nodeId))) siblings.splice(index, 1);
  }
  return { root: projected };
}

/**
 * Project the direct result onto a detached JSON tree for the same nested-Diff
 * preflight used by review mode. This keeps validation isolated: malformed
 * output never enters Lexical/Yjs, and the live transaction only runs after
 * the projected tree has passed the result-based nested-diff check.
 */
function projectDirectRewrite(
  currentRoot: SerializedNode,
  firstBlockId: string,
  blockIds: string[],
  replacements: SerializedNode[],
  listItem: boolean,
): SerializedDiffDocument | null {
  const projected = cloneSerialized(currentRoot);
  const location = findSerializedNodeByNodeId(projected, firstBlockId);
  if (!location) return null;

  if (listItem) {
    const replacement = replacements[0];
    if (!replacement) return null;
    location.node.children = (replacement.children || []).map(cloneSerialized);
    return { root: projected };
  }

  if (!location.parent || !Array.isArray(location.parent.children)) return null;
  const selectedIds = new Set(blockIds);
  const nextChildren: SerializedNode[] = [];
  let foundFirst = false;
  let replacementIndex = 0;

  for (const child of location.parent.children) {
    const childProperties = isRecord(child.$?.properties) ? child.$.properties : null;
    const childId = typeof childProperties?.nodeId === 'string' ? childProperties.nodeId : null;
    if (!childId || !selectedIds.has(childId)) {
      nextChildren.push(child);
      continue;
    }

    if (childId === firstBlockId) {
      foundFirst = true;
      nextChildren.push(...replacements.map(cloneSerialized));
      replacementIndex = replacements.length;
    }
  }

  if (!foundFirst || replacementIndex !== replacements.length) return null;
  location.parent.children = nextChildren;
  return { root: projected };
}

interface DirectRewriteEntry {
  node: LexicalNode;
  replacement: LexicalNode;
  serialized: SerializedNode;
}

/** Parse all direct replacements before mutating an attached node. */
function parseDirectRewriteEntries(
  editor: LexicalEditor,
  entries: Array<{ node: LexicalNode; serialized: SerializedNode }>,
): DirectRewriteEntry[] {
  return entries.map((entry) => ({
    node: entry.node,
    replacement: $parseSerializedNodeImpl(entry.serialized, editor),
    serialized: entry.serialized,
  }));
}

/** Apply direct replacements in one caller-owned Lexical update transaction. */
function applyDirectRewrite(
  firstBlock: LexicalNode,
  blocks: LexicalNode[],
  entries: DirectRewriteEntry[],
  listItem: boolean,
): void {
  if (listItem) {
    const entry = entries[0];
    if (!entry || !entry.replacement || !$isElementNode(entry.replacement)) {
      throw new Error('direct-rewrite-list-item-replacement-invalid');
    }
    const children = entry.replacement.getChildren();
    if (!$isElementNode(firstBlock)) throw new Error('direct-rewrite-list-item-target-invalid');
    firstBlock.clear();
    firstBlock.append(...children);
    return;
  }

  const entriesByKey = new Map(entries.map((entry) => [entry.node.getKey(), entry]));
  for (const block of blocks) {
    const entry = entriesByKey.get(block.getKey());
    if (!entry) {
      block.remove();
      continue;
    }

    $preserveNodeIdentity(block, entry.replacement);
    block.replace(entry.replacement, false);
  }
}

function applyDirectBlockRewrite(
  firstBlock: LexicalNode,
  blocks: LexicalNode[],
  replacements: LexicalNode[],
): void {
  const firstReplacement = replacements[0];
  if (!firstReplacement) {
    blocks.forEach((block) => block.remove());
    return;
  }

  blocks.slice(1).forEach((block) => block.remove());
  $preserveNodeIdentity(firstBlock, firstReplacement);
  firstBlock.replace(firstReplacement, false);
  let previous = firstReplacement;
  for (const replacement of replacements.slice(1)) {
    previous.insertAfter(replacement);
    previous = replacement;
  }
}

function applyDirectMarkdownSelection(
  editor: LexicalEditor,
  validation: RewriteValidation,
  replacement: SerializedNode[],
): void {
  const selection = $createRangeSelection();
  selection.anchor.set(
    validation.startPoint.key,
    validation.startPoint.offset,
    validation.startPoint.type,
  );
  selection.focus.set(
    validation.endPoint.key,
    validation.endPoint.offset,
    validation.endPoint.type,
  );
  const nodes = $generateNodesFromSerializedNodes(replacement);
  $setSelection(selection);
  $insertGeneratedNodes(editor, nodes, selection);
}

function buildDiff(
  editor: LexicalEditor,
  beforeNodes: SerializedNode[],
  afterNodes: SerializedNode[],
  listItem: boolean,
  provenance: Omit<NodeProvenance, 'source'> & { source?: 'ai' },
  identityTransfers: RewriteIdentityTransfer[],
  review: RewriteReviewMetadata,
): { diff: LexicalNode; before: LexicalNode[]; after: LexicalNode[] } {
  const before = beforeNodes.map((node) => $parseSerializedNodeImpl(node, editor));
  const after = afterNodes.map((node) => $parseSerializedNodeImpl(node, editor));

  if (listItem) {
    const beforeBody = $createParagraphNode();
    const afterBody = $createParagraphNode();
    const beforeChildren = before.flatMap((node) =>
      $isElementNode(node) ? node.getChildren() : [node],
    );
    const afterChildren = after.flatMap((node) =>
      $isElementNode(node) ? node.getChildren() : [node],
    );
    $markNodesAsAIGenerated(afterChildren, provenance);
    beforeBody.append(...beforeChildren);
    afterBody.append(...afterChildren);
    const diffNode = $createDiffNode('listItemModify');
    diffNode.append(beforeBody, afterBody);
    $setNodeProperties(diffNode, {
      ...(review.attempt === undefined ? {} : { rewriteAttempt: review.attempt }),
      rewriteIdentityMap: identityTransfers as unknown as JSONValue,
      rewriteCommandId: review.commandId,
      rewriteRequestId: review.requestId,
    });
    return { after: afterChildren, before: beforeChildren, diff: diffNode };
  }

  $markNodesAsAIGenerated(after, provenance);

  const beforeContent = $createDiffContentNode('before');
  const afterContent = $createDiffContentNode('after');
  before.forEach((node) => beforeContent.append(node));
  after.forEach((node) => afterContent.append(node));
  const diffNode = $createDiffNode('modify');
  diffNode.append(beforeContent, afterContent);
  $setNodeProperties(diffNode, {
    ...(review.attempt === undefined ? {} : { rewriteAttempt: review.attempt }),
    rewriteIdentityMap: identityTransfers as unknown as JSONValue,
    rewriteCommandId: review.commandId,
    rewriteRequestId: review.requestId,
  });
  return { after, before, diff: diffNode };
}

function markProvenance(
  nodes: ReadonlyArray<LexicalNode>,
  payload: RewriteRangeCommandPayload,
): void {
  $markNodesAsAIGenerated(nodes, {
    createdAt: new Date().toISOString(),
    generationId: payload.generationId,
    model: payload.model,
    provider: payload.provider,
    // NodeProvenance is extended by the properties plugin with requestId at
    // runtime; keeping it on the after side makes audits survive JSON/Yjs.
    requestId: payload.requestId,
  } as Omit<NodeProvenance, 'source'> & { source?: 'ai' });
}

/** Read the Yjs state vector only after the Lexical update has committed. */
export function getRewriteStateVector(editor: LexicalEditor): string | undefined {
  try {
    const state = getKernelFromEditor(editor)?.requireService(IYjsService)?.getState();
    const doc = state?.doc ?? state?.binding.doc;
    return doc ? encodeYjsBase64(encodeStateVector(doc)) : undefined;
  } catch {
    // A non-collaborative editor has no Yjs state vector; the direct command
    // remains valid and the result simply omits this optional proof.
    return undefined;
  }
}

/** Register the targeted range rewrite command on a Lexical editor. */
export function registerLiteXMLRewriteCommand(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  resultChannel: RewriteCommandResultChannel,
  rewriteService?: IRewriteService,
): () => void {
  const registeredService = rewriteServicesByEditor.get(editor);
  const ownsService = !rewriteService && !registeredService;
  const service =
    rewriteService ?? registeredService ?? new RewriteService(editor, dataSource, resultChannel);
  rewriteServicesByEditor.set(editor, service as RewriteService);

  const unregisterCommand = editor.registerCommand(
    LITEXML_REWRITE_RANGE_COMMAND,
    (payload) => {
      const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
      const previous = requestId ? resultChannel.get(requestId) : undefined;
      if (
        previous?.status === 'diff-created' ||
        previous?.status === 'applied' ||
        previous?.status === 'aborted'
      )
        return true;
      void service.rewriteRange(payload, { schedule: 'separate' });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  return () => {
    unregisterCommand();
    if (ownsService) service.destroy();
  };
}

export function executeRewriteRange(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  payload: RewriteRangeCommandPayload,
): RewriteCommandResult {
  const commandId = payload.commandId || createCommandId();
  if (!payload.requestId || !payload.generationId) {
    return failedResult(payload, 'requestId-and-generationId-required');
  }
  if (payload.mode !== undefined && payload.mode !== 'direct' && payload.mode !== 'review') {
    return failedResult(payload, 'rewrite-range-mode-invalid');
  }
  if (payload.history !== undefined && payload.history !== 'merge') {
    return failedResult(payload, 'rewrite-range-history-invalid');
  }
  const mode = payload.mode ?? 'review';
  if (mode === 'review' && payload.delay !== true) {
    return failedResult(payload, 'rewrite-range-requires-delay-true');
  }
  if (mode === 'direct' && payload.delay === true) {
    return failedResult(payload, 'direct-rewrite-cannot-be-delayed');
  }
  const hasText = typeof payload.replacementText === 'string';
  const hasLiteXML = typeof payload.replacementLiteXML === 'string';
  if (hasText === hasLiteXML) return failedResult(payload, 'replacement-must-be-exactly-one-kind');
  if (hasText && utf8ByteLength(payload.replacementText!) > LITEXML_REWRITE_MAX_BYTES) {
    return failedResult(payload, 'replacement-text-too-large');
  }
  if (typeof payload.expectedTextHash !== 'string' || !payload.expectedTextHash) {
    return failedResult(payload, 'expectedTextHash-required');
  }

  const validation = validateSelection(payload.selection, payload.expectedTextHash);
  if ('status' in validation) return { ...validation, commandId, requestId: payload.requestId };
  const { blocks, endOffset, firstBlock, startOffset } = validation;
  const formatting = getReplacementFormatting(firstBlock, startOffset);
  const fullBlockSelection = startOffset === 0 && endOffset === getLinearTextLength(blocks.at(-1)!);
  const parsedMarkdown =
    hasText && mode === 'direct'
      ? parseMarkdownReplacement(
          editor,
          payload.replacementText!,
          formatting,
          fullBlockSelection && !$isListItemNode(firstBlock),
        )
      : null;
  // Production targets always carry a durable block identity. Migration is
  // deliberately done before serialization so the identity is present on
  // both diff sides; no Lexical key enters the request/result contract.
  for (const block of blocks) {
    if (!$getNodeId(block)) $ensureNodeId(block);
  }
  const blockIds = blocks
    .map((block) => $getNodeId(block))
    .filter((id): id is string => Boolean(id));
  if (blockIds.length !== blocks.length)
    return failedResult(payload, 'affected-block-nodeId-missing');
  if (new Set(blockIds).size !== blockIds.length) {
    return failedResult(payload, 'affected-block-nodeId-duplicate', 'stale');
  }

  let replacement: SerializedNode[];
  let markdownBlockReplacement: SerializedNode[] | undefined = parsedMarkdown?.blocks;
  if (hasText) {
    if (mode === 'direct') {
      if (parsedMarkdown?.blocks) {
        markdownBlockReplacement = parsedMarkdown.blocks;
        replacement = [];
      } else {
        replacement =
          parsedMarkdown?.inline ?? createTextReplacement(payload.replacementText!, formatting);
      }
    } else {
      replacement = createTextReplacement(payload.replacementText!, formatting);
    }
  } else {
    const parsed = parseReplacementLiteXML(dataSource, payload.replacementLiteXML!);
    if (parsed.error) return failedResult(payload, parsed.error);
    replacement = parsed.nodes;
  }

  // Mark only the newly generated replacement payload. Prefix/suffix nodes
  // copied from the current document retain their existing provenance, while
  // the inserted text survives JSON and Yjs round trips as AI-authored data.
  if (mode === 'direct') {
    replacement = replacement.map(cloneSerialized);
    markdownBlockReplacement = markdownBlockReplacement?.map(cloneSerialized);
    markSerializedNodesAsAIGenerated(
      { children: markdownBlockReplacement ?? replacement },
      {
        createdAt: new Date().toISOString(),
        generationId: payload.generationId,
        model: payload.model,
        provider: payload.provider,
        requestId: payload.requestId,
        sessionId: payload.provenanceSessionId,
        turnIndex: payload.turnIndex,
      },
    );
  }

  const currentRoot = serializeNode($getRoot());

  if (
    mode === 'direct' &&
    markdownBlockReplacement &&
    markdownBlockReplacement.length > 0 &&
    (!fullBlockSelection || $isListItemNode(firstBlock))
  ) {
    try {
      applyDirectMarkdownSelection(editor, validation, markdownBlockReplacement);
      return {
        affectedNodeIds: blockIds,
        commandId,
        requestId: payload.requestId,
        status: 'applied',
      };
    } catch (error) {
      return failedResult(
        payload,
        error instanceof Error ? error.message : 'direct-markdown-selection-failed',
      );
    }
  }

  if (
    mode === 'direct' &&
    markdownBlockReplacement &&
    markdownBlockReplacement.length > 0 &&
    fullBlockSelection &&
    !$isListItemNode(firstBlock)
  ) {
    let directBlockReplacements: LexicalNode[];
    try {
      directBlockReplacements = markdownBlockReplacement.map((serialized) =>
        $parseSerializedNodeImpl(serialized, editor),
      );
    } catch (error) {
      return failedResult(
        payload,
        error instanceof Error ? error.message : 'direct-rewrite-parse-failed',
      );
    }

    const projected = projectDirectRewrite(
      currentRoot,
      blockIds[0],
      blockIds,
      markdownBlockReplacement,
      false,
    );
    if (!projected) return failedResult(payload, 'rewrite-preflight-target-not-found', 'stale');
    const newIllegalDiffs = findNewIllegalDiffPaths(
      { root: currentRoot } as SerializedDiffDocument,
      projected,
    );
    if (newIllegalDiffs.length > 0) {
      logger.warn(
        'Rejected direct rewrite due to newly-created illegal nested diff',
        newIllegalDiffs,
      );
      return failedResult(payload, 'rewrite-preflight-illegal-nested-diff');
    }

    $setSelection(null);
    applyDirectBlockRewrite(firstBlock, blocks, directBlockReplacements);
    return {
      affectedNodeIds: blockIds,
      commandId,
      requestId: payload.requestId,
      status: 'applied',
    };
  }

  const beforeNodes = blocks.map(serializeNode);
  const afterEntries: Array<{ node: LexicalNode; serialized: SerializedNode }> = [];
  blocks.forEach((block, index) => {
    const isFirst = index === 0;
    const isLast = index === blocks.length - 1;
    const blockStart = isFirst ? startOffset : 0;
    const blockEnd = isLast ? endOffset : getLinearTextLength(block);
    const transformed = rewriteSerializedBlock(
      block,
      blockStart,
      blockEnd,
      isFirst ? replacement : [],
      isFirst,
    );
    const transformedLength = getSerializedTextLength(transformed);
    const keep = blocks.length === 1 || isFirst || transformedLength > 0;
    if (keep) {
      // Pending review must never expose the same durable id on both sides of
      // a diff. The before side retains the original id/annotation anchors;
      // Accept transfers them to this temporary after-side id, while Reject
      // simply discards this side.
      if (mode !== 'direct' && !$isListItemNode(firstBlock)) assignPendingIdentity(transformed);
      afterEntries.push({ node: block, serialized: transformed });
    }
  });
  const afterNodes = afterEntries.map((entry) => entry.serialized);
  const identityTransfers: RewriteIdentityTransfer[] = $isListItemNode(firstBlock)
    ? []
    : afterEntries.map((entry, afterIndex) => ({
        afterIndex,
        beforeIndex: blocks.findIndex((block) => block.is(entry.node)),
        nodeId: $getNodeId(entry.node)!,
      }));

  if (mode === 'direct') {
    let directEntries: DirectRewriteEntry[];
    try {
      // Parse every replacement while detached so a parser failure cannot
      // leave a partially-mutated Lexical/Yjs tree behind.
      directEntries = parseDirectRewriteEntries(editor, afterEntries);
    } catch (error) {
      return failedResult(
        payload,
        error instanceof Error ? error.message : 'direct-rewrite-parse-failed',
      );
    }

    const projected = projectDirectRewrite(
      currentRoot,
      blockIds[0],
      blockIds,
      afterNodes,
      $isListItemNode(firstBlock),
    );
    if (!projected) return failedResult(payload, 'rewrite-preflight-target-not-found', 'stale');
    const newIllegalDiffs = findNewIllegalDiffPaths(
      { root: currentRoot } as SerializedDiffDocument,
      projected,
    );
    if (newIllegalDiffs.length > 0) {
      logger.warn(
        'Rejected direct rewrite due to newly-created illegal nested diff',
        newIllegalDiffs,
      );
      return failedResult(payload, 'rewrite-preflight-illegal-nested-diff');
    }

    // This is the one and only live mutation for direct mode. The enclosing
    // command listener owns one explicit Lexical update, which the Yjs bridge
    // mirrors as one shared transaction.
    $setSelection(null);
    applyDirectRewrite(firstBlock, blocks, directEntries, $isListItemNode(firstBlock));
    return {
      affectedNodeIds: blockIds,
      commandId,
      requestId: payload.requestId,
      status: 'applied',
    };
  }

  // Build detached diff nodes before touching any attached node. This is the
  // isolated preflight phase required by LiteXML; malformed nested diffs never
  // enter the live/Yjs tree and therefore never need rollback.
  const diffParts = buildDiff(
    editor,
    beforeNodes,
    afterNodes,
    $isListItemNode(firstBlock),
    {
      createdAt: new Date().toISOString(),
      generationId: payload.generationId,
      model: payload.model,
      provider: payload.provider,
      requestId: payload.requestId,
    } as Omit<NodeProvenance, 'source'> & { source?: 'ai' },
    identityTransfers,
    {
      attempt: payload.attempt,
      commandId,
      requestId: payload.requestId,
    },
  );
  const diffSerialized = serializeNode(diffParts.diff);
  const projected = projectRewrite(
    currentRoot,
    blockIds[0],
    blockIds,
    diffSerialized,
    $isListItemNode(firstBlock),
  );
  if (!projected) return failedResult(payload, 'rewrite-preflight-target-not-found', 'stale');
  const newIllegalDiffs = findNewIllegalDiffPaths(
    { root: currentRoot } as SerializedDiffDocument,
    projected,
  );
  if (newIllegalDiffs.length > 0) {
    logger.warn('Rejected rewrite due to newly-created illegal nested diff', newIllegalDiffs);
    return failedResult(payload, 'rewrite-preflight-illegal-nested-diff');
  }

  // The only live mutation happens after all validation/preflight succeeds.
  // A command payload may carry a frozen snapshot of the Agent's range. It is
  // not the browser's active selection and must not be auto-moved through the
  // DiffNode replacement; clearing it also avoids stale selection restoration
  // during Lexical's reconciliation.
  $setSelection(null);
  if ($isListItemNode(firstBlock)) {
    firstBlock.clear();
    firstBlock.append(diffParts.diff);
  } else {
    for (const block of blocks.slice(1)) block.remove();
    firstBlock.replace(diffParts.diff, false);
  }

  // `buildDiff` already marks the detached after clones. Keep this explicit
  // call as the provenance invariant if a future builder changes that path.
  markProvenance(diffParts.after, payload);
  return {
    affectedNodeIds: blockIds,
    commandId,
    requestId: payload.requestId,
    status: 'diff-created',
  };
}
