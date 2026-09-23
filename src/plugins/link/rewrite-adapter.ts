import type { LexicalNode } from 'lexical';

import {
  BLOCK_REWRITE_MAX_SOURCE_LENGTH,
  BLOCK_REWRITE_MAX_TITLE_LENGTH,
  type BlockRewriteAdapter,
  type BlockRewriteContext,
  type BlockRewritePatchOutput,
  type BlockRewriteValidationResult,
  isBlockRewritePatchOutput,
} from '@/plugins/block/service/rewrite-adapter';
import { $getNodeId } from '@/plugins/properties/utils';
import { hashRewriteText } from '@/utils/rewrite-text';

import { $isLinkBlockCardNode, type LinkBlockCardNode } from './node/LinkBlockCardNode';
import { sanitizeUrl, validateUrl } from './utils';

const capabilities = { canEdit: true, canMove: true, canSelect: true } as const;

const isValidPatchString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length <= maxLength;

const isSafeUrl = (value: string): boolean => validateUrl(value) && sanitizeUrl(value) === value;

const readLinkBlockCardContext = (node: LexicalNode): BlockRewriteContext | null => {
  if (!$isLinkBlockCardNode(node)) return null;
  const nodeId = $getNodeId(node);
  if (!nodeId) return null;
  const card = node as LinkBlockCardNode;
  const source = card.getURL();
  const title = card.getTitle();
  const persistedSource = JSON.stringify({
    description: card.getDescription(),
    title,
    url: source,
  });
  return {
    adapterKey: 'link-block-card',
    capabilities,
    nodeId,
    nodeType: node.getType(),
    source: persistedSource,
    sourceHash: hashRewriteText(persistedSource),
    summary: card.getDescription() || title,
    title,
  };
};

const validateLinkBlockCardOutput = (
  node: LexicalNode,
  output: unknown,
): BlockRewriteValidationResult => {
  if (!$isLinkBlockCardNode(node)) {
    return {
      code: 'BLOCK_REWRITE_NODE_TYPE_MISMATCH',
      message: 'Target is not a block link card.',
      ok: false,
    };
  }
  if (!isBlockRewritePatchOutput(output)) {
    return {
      code: 'BLOCK_REWRITE_PATCH_REQUIRED',
      message: 'Link card rewrites require patch output.',
      ok: false,
    };
  }
  const patch = output.patch;
  const hasField = ['description', 'title', 'url'].some((key) => key in patch);
  if (!hasField) {
    return { code: 'BLOCK_REWRITE_PATCH_EMPTY', message: 'Link card patch is empty.', ok: false };
  }
  if (
    (patch.description !== undefined &&
      !isValidPatchString(patch.description, BLOCK_REWRITE_MAX_SOURCE_LENGTH)) ||
    (patch.title !== undefined &&
      !isValidPatchString(patch.title, BLOCK_REWRITE_MAX_TITLE_LENGTH)) ||
    (patch.url !== undefined &&
      (!isValidPatchString(patch.url, BLOCK_REWRITE_MAX_SOURCE_LENGTH) || !isSafeUrl(patch.url)))
  ) {
    return {
      code: 'BLOCK_REWRITE_PATCH_INVALID',
      message: 'Link card patch is invalid.',
      ok: false,
    };
  }
  return { ok: true, output };
};

const applyLinkBlockCardRewrite = (node: LexicalNode, output: unknown): void => {
  if (!$isLinkBlockCardNode(node) || !isBlockRewritePatchOutput(output)) return;
  const patch = output.patch as BlockRewritePatchOutput['patch'];
  const card = node as LinkBlockCardNode;
  if (typeof patch.url === 'string') card.setURL(patch.url);
  if (typeof patch.title === 'string') card.setTitle(patch.title);
  if (typeof patch.description === 'string') card.setDescription(patch.description);
};

export const linkBlockCardRewriteAdapter: BlockRewriteAdapter = {
  apply: applyLinkBlockCardRewrite,
  capabilities,
  key: 'link-block-card',
  outputSchema: 'patch',
  readContext: readLinkBlockCardContext,
  supports: $isLinkBlockCardNode,
  validate: validateLinkBlockCardOutput,
};
