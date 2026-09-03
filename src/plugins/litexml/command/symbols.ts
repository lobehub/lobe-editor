import { createCommand } from 'lexical';

import type { RewriteRangeCommandPayload } from './rewriteRange';
import type { RewriteSelectionInput } from './rewriteRange';

/**
 * LiteXML command identities.
 *
 * These symbols are intentionally isolated in a side-effect-free module so they
 * keep a SINGLE runtime identity across every entry of this package.
 *
 * Lexical's `dispatchCommand` matches command listeners by object reference, not
 * by the string label. The package ships two independently-bundled entries — the
 * browser build (`index` / `react` / `renderer`) and the node build (`headless`)
 * — and if each entry inlined its own `createCommand(...)` call, dispatching a
 * command obtained from one entry onto an editor registered by the other would
 * silently no-op (different object identities, same label).
 *
 * By keeping every command in this one module — exposed verbatim through
 * `@lobehub/editor/litexml-commands` and emitted as a shared chunk by both
 * builds — a single object backs the command in any runtime, and the module is
 * pure enough to be imported on the server without pulling in the DOM-dependent
 * editor bundle.
 */

export enum DiffAction {
  Reject,
  Accept,
}

/**
 * Review a pending Agent rewrite by its durable request metadata.
 *
 * The payload deliberately has no Lexical `nodeKey`: a review can be
 * initiated by a different client after the original editor instance has
 * been recreated. `commandId` scopes the action to one generated attempt;
 * `attempt` is an additional guard for request retries.
 */
export interface LiteXMLReviewCommandPayload {
  action: DiffAction;
  attempt?: number;
  commandId: string;
  requestId: string;
}

/** Request metadata carried by Agent-facing delayed LiteXML commands. */
export interface LiteXMLRewriteMetadata {
  attempt?: number;
  commandId?: string;
  createdAt?: string;
  generationId?: string;
  model?: string;
  provider?: string;
  requestId?: string;
}

/** Streaming rewrite lifecycle operations for a trusted collaborative Agent. */
export type RewriteStreamAction = 'abort' | 'append' | 'finalize' | 'start';

export interface RewriteStreamStartPayload {
  action: 'start';
  commandId?: string;
  expectedTextHash: string;
  generationId: string;
  initialLiteXML?: string;
  initialText?: string;
  model?: string;
  provider?: string;
  requestId: string;
  selection: RewriteSelectionInput;
  sessionId: string;
  targetNodeIds?: string[];
}

export interface RewriteStreamAppendPayload {
  action: 'append';
  chunk?: string;
  chunkId?: string;
  commandId?: string;
  requestId: string;
  sequence?: number;
  sessionId: string;
}

export interface RewriteStreamFinalizePayload {
  action: 'finalize';
  commandId?: string;
  requestId: string;
  sessionId: string;
}

export interface RewriteStreamAbortPayload {
  action: 'abort';
  commandId?: string;
  requestId: string;
  sessionId: string;
}

export type RewriteStreamCommandPayload =
  | RewriteStreamAbortPayload
  | RewriteStreamAppendPayload
  | RewriteStreamFinalizePayload
  | RewriteStreamStartPayload;

export type LiteXMLModifyCommandOperation =
  | {
      action: 'insert';
      beforeId: string;
      litexml: string;
    }
  | {
      action: 'insert';
      afterId: string;
      litexml: string;
    }
  | {
      action: 'remove';
      id: string;
    }
  | {
      action: 'modify';
      litexml: string | string[];
    };

export type LiteXMLModifyCommandPayload = Array<LiteXMLModifyCommandOperation> &
  Partial<LiteXMLRewriteMetadata>;

export type LiteXMLRemoveCommandPayload = {
  delay?: boolean;
  id: string;
} & Partial<LiteXMLRewriteMetadata>;

export type LiteXMLInsertCommandPayload =
  | ({
      beforeId: string;
      delay?: boolean;
      litexml: string;
    } & Partial<LiteXMLRewriteMetadata>)
  | ({
      afterId: string;
      delay?: boolean;
      litexml: string;
    } & Partial<LiteXMLRewriteMetadata>);

export const LITEXML_MODIFY_COMMAND =
  createCommand<LiteXMLModifyCommandPayload>('LITEXML_MODIFY_COMMAND');

export const LITEXML_APPLY_COMMAND = createCommand<{ delay?: boolean; litexml: string | string[] }>(
  'LITEXML_APPLY_COMMAND',
);

export const LITEXML_REMOVE_COMMAND =
  createCommand<LiteXMLRemoveCommandPayload>('LITEXML_REMOVE_COMMAND');

export const LITEXML_INSERT_COMMAND =
  createCommand<LiteXMLInsertCommandPayload>('LITEXML_INSERT_COMMAND');

export const LITEXML_DIFFNODE_COMMAND = createCommand<{ action: DiffAction; nodeKey: string }>(
  'LITEXML_DIFFNODE_COMMAND',
);

export const LITEXML_DIFFNODE_ALL_COMMAND = createCommand<{ action: DiffAction }>(
  'LITEXML_DIFFNODE_ALL_COMMAND',
);

/** Accept or reject all pending diff nodes for one durable rewrite command. */
export const LITEXML_REVIEW_COMMAND =
  createCommand<LiteXMLReviewCommandPayload>('LITEXML_REVIEW_COMMAND');

/**
 * Targeted rewrite command. The payload is intentionally typed as a durable
 * selection/request contract; runtime Lexical keys are not part of the
 * production input. `mode: 'direct'` is the trusted collaborative-Agent path;
 * omitted mode retains the historical delayed review behavior.
 */
export const LITEXML_REWRITE_RANGE_COMMAND = createCommand<RewriteRangeCommandPayload>(
  'LITEXML_REWRITE_RANGE_COMMAND',
);

/** One command identity keeps the lifecycle atomic across package entrypoints. */
export const LITEXML_REWRITE_STREAM_COMMAND = createCommand<RewriteStreamCommandPayload>(
  'LITEXML_REWRITE_STREAM_COMMAND',
);

// Named aliases make the lifecycle self-documenting at call sites while all
// phases still share one Lexical listener and one runtime command identity.
export const LITEXML_REWRITE_STREAM_START_COMMAND = LITEXML_REWRITE_STREAM_COMMAND;
export const LITEXML_REWRITE_STREAM_APPEND_COMMAND = LITEXML_REWRITE_STREAM_COMMAND;
export const LITEXML_REWRITE_STREAM_FINALIZE_COMMAND = LITEXML_REWRITE_STREAM_COMMAND;
export const LITEXML_REWRITE_STREAM_ABORT_COMMAND = LITEXML_REWRITE_STREAM_COMMAND;
/** Backwards-compatible session naming for integrations that prefer "session". */
export const LITEXML_REWRITE_SESSION_COMMAND = LITEXML_REWRITE_STREAM_COMMAND;
