import { createCommand } from 'lexical';

import type { BlockRewriteApplyMetadata, BlockRewriteOutput } from '../service/rewrite-adapter';

/** Shared runtime command identity for browser/headless adapter rewrites. */
export interface ApplyBlockRewritePayload extends BlockRewriteApplyMetadata {
  expectedSourceHash?: string;
  nodeId: string;
  output: BlockRewriteOutput;
}

export const APPLY_BLOCK_REWRITE_COMMAND = createCommand<ApplyBlockRewritePayload>(
  'APPLY_BLOCK_REWRITE_COMMAND',
);
