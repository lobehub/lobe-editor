import type { LexicalNode } from 'lexical';

import {
  BLOCK_REWRITE_MAX_SOURCE_LENGTH,
  BLOCK_REWRITE_MAX_TITLE_LENGTH,
  type BlockRewriteAdapter,
  type BlockRewriteContext,
  type BlockRewriteValidationResult,
  isBlockRewriteSourceOutput,
} from '@/plugins/block/service/rewrite-adapter';
import { $getNodeId } from '@/plugins/properties/utils';
import { hashRewriteText } from '@/utils/rewrite-text';

import { $isArtifactNode, type ArtifactNode } from './node/ArtifactNode';
import { extractArtifactTitle, normalizeArtifactTitle } from './rewrite-utils';

const capabilities = { canEdit: true, canMove: true, canSelect: true } as const;

const hasTag = (source: string, tag: string): boolean =>
  new RegExp(`<${tag}\\b`, 'iu').test(source);

const hasClosingTag = (source: string, tag: string): boolean =>
  new RegExp(`</${tag}\\s*>`, 'iu').test(source);

const countOpeningTags = (source: string, tag: string): number =>
  source.match(new RegExp(`<${tag}\\b`, 'giu'))?.length ?? 0;

/**
 * Artifact HTML is an atomic document, not a text fragment. A model that
 * returns only `<title>...</title>` is syntactically valid HTML but would
 * erase the running artifact when applied. Preserve the source's document
 * envelope (and the number of executable/style blocks) before allowing the
 * adapter-owned transaction to run. Fragment artifacts remain supported when
 * the existing source itself has no document envelope.
 */
const validateArtifactSourceCompleteness = (
  currentSource: string,
  nextSource: string,
): BlockRewriteValidationResult | null => {
  if (nextSource.trim().length === 0) {
    return {
      code: 'BLOCK_REWRITE_SOURCE_INCOMPLETE',
      message: 'Artifact source must contain a complete replacement.',
      ok: false,
    };
  }

  if (hasTag(currentSource, '!doctype') && !hasTag(nextSource, '!doctype')) {
    return {
      code: 'BLOCK_REWRITE_SOURCE_INCOMPLETE',
      message: 'Artifact replacement must preserve the document type declaration.',
      ok: false,
    };
  }

  for (const tag of ['html', 'head', 'body']) {
    const currentHasPair = hasTag(currentSource, tag) && hasClosingTag(currentSource, tag);
    if (currentHasPair && (!hasTag(nextSource, tag) || !hasClosingTag(nextSource, tag))) {
      return {
        code: 'BLOCK_REWRITE_SOURCE_INCOMPLETE',
        message: `Artifact replacement must preserve the complete ${tag} document section.`,
        ok: false,
      };
    }
  }

  for (const tag of ['style', 'script']) {
    if (countOpeningTags(nextSource, tag) < countOpeningTags(currentSource, tag)) {
      return {
        code: 'BLOCK_REWRITE_SOURCE_INCOMPLETE',
        message: `Artifact replacement must preserve existing ${tag} blocks.`,
        ok: false,
      };
    }
  }

  return null;
};

const readArtifactContext = (node: LexicalNode): BlockRewriteContext | null => {
  if (!$isArtifactNode(node)) return null;
  const nodeId = $getNodeId(node);
  if (!nodeId) return null;
  const artifact = node as ArtifactNode;
  const title = artifact.getTitle();
  const source = artifact.getHtml();
  return {
    adapterKey: 'artifact',
    capabilities,
    nodeId,
    nodeType: node.getType(),
    source,
    sourceHash: hashRewriteText(source),
    summary: title || 'Artifact',
    title,
  };
};

const validateArtifactOutput = (
  node: LexicalNode,
  output: unknown,
): BlockRewriteValidationResult => {
  if (!$isArtifactNode(node)) {
    return {
      code: 'BLOCK_REWRITE_NODE_TYPE_MISMATCH',
      message: 'Target is not an Artifact.',
      ok: false,
    };
  }
  if (!isBlockRewriteSourceOutput(output)) {
    return {
      code: 'BLOCK_REWRITE_SOURCE_REQUIRED',
      message: 'Artifact rewrites require source output.',
      ok: false,
    };
  }
  if (output.source.length > BLOCK_REWRITE_MAX_SOURCE_LENGTH) {
    return {
      code: 'BLOCK_REWRITE_SOURCE_TOO_LARGE',
      message: 'Artifact source is too large.',
      ok: false,
    };
  }
  const incomplete = validateArtifactSourceCompleteness(node.getHtml(), output.source);
  if (incomplete) return incomplete;
  if (
    output.title !== undefined &&
    (normalizeArtifactTitle(output.title).length === 0 ||
      normalizeArtifactTitle(output.title).length > BLOCK_REWRITE_MAX_TITLE_LENGTH)
  ) {
    return {
      code: 'BLOCK_REWRITE_TITLE_INVALID',
      message: 'Artifact title is invalid.',
      ok: false,
    };
  }
  const title =
    output.title === undefined
      ? extractArtifactTitle(output.source)
      : normalizeArtifactTitle(output.title);
  if (title && title.length > BLOCK_REWRITE_MAX_TITLE_LENGTH) {
    return {
      code: 'BLOCK_REWRITE_TITLE_INVALID',
      message: 'Artifact title is too long.',
      ok: false,
    };
  }
  return { ok: true, output: title ? { ...output, title } : output };
};

const applyArtifactRewrite = (node: LexicalNode, output: unknown): void => {
  if (!$isArtifactNode(node) || !isBlockRewriteSourceOutput(output)) return;
  node.setHtml(output.source);
  const title =
    output.title === undefined
      ? extractArtifactTitle(output.source)
      : normalizeArtifactTitle(output.title);
  if (title && title.length <= BLOCK_REWRITE_MAX_TITLE_LENGTH) node.setTitle(title);
};

export const artifactBlockRewriteAdapter: BlockRewriteAdapter = {
  apply: applyArtifactRewrite,
  capabilities,
  key: 'artifact',
  outputSchema: 'source',
  readContext: readArtifactContext,
  supports: $isArtifactNode,
  validate: validateArtifactOutput,
};
