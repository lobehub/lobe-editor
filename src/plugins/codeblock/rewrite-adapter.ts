import { $createCodeHighlightNode, $isCodeNode, CodeNode } from '@lexical/code-core';
import type { LexicalNode } from 'lexical';
import { $createLineBreakNode } from 'lexical';

import {
  BLOCK_REWRITE_MAX_SOURCE_LENGTH,
  BLOCK_REWRITE_MAX_LANGUAGE_LENGTH,
  type BlockRewriteAdapter,
  type BlockRewriteContext,
  type BlockRewriteValidationResult,
  isBlockRewriteSourceOutput,
} from '@/plugins/block/service/rewrite-adapter';
import { $getNodeId } from '@/plugins/properties/utils';
import { hashRewriteText } from '@/utils/rewrite-text';

import { getCodeLanguageAliases, normalizeCodeLanguage } from './utils/language';

const capabilities = { canEdit: true, canMove: true, canSelect: true } as const;

const readCodeBlockContext = (node: LexicalNode): BlockRewriteContext | null => {
  if (!$isCodeNode(node)) return null;
  const nodeId = $getNodeId(node);
  if (!nodeId) return null;
  const source = node.getTextContent();
  const language = normalizeCodeLanguage(node.getLanguage() || 'plaintext') || 'plaintext';
  const title = language ? `Code block (${language})` : 'Code block';
  return {
    adapterKey: 'codeblock',
    capabilities,
    language,
    languageAliases: getCodeLanguageAliases(language),
    nodeId,
    nodeType: CodeNode.getType(),
    source,
    sourceHash: hashRewriteText(source),
    summary: title,
    title,
  };
};

const validateCodeBlockOutput = (
  node: LexicalNode,
  output: unknown,
): BlockRewriteValidationResult => {
  if (!$isCodeNode(node)) {
    return {
      code: 'BLOCK_REWRITE_NODE_TYPE_MISMATCH',
      message: 'Target is not a code block.',
      ok: false,
    };
  }
  if (!isBlockRewriteSourceOutput(output)) {
    return {
      code: 'BLOCK_REWRITE_SOURCE_REQUIRED',
      message: 'Code rewrites require source output.',
      ok: false,
    };
  }
  if (output.source.length > BLOCK_REWRITE_MAX_SOURCE_LENGTH) {
    return {
      code: 'BLOCK_REWRITE_SOURCE_TOO_LARGE',
      message: 'Code source is too large.',
      ok: false,
    };
  }
  if (output.language !== undefined) {
    if (
      output.language.trim().length === 0 ||
      output.language.length > BLOCK_REWRITE_MAX_LANGUAGE_LENGTH
    ) {
      return {
        code: 'BLOCK_REWRITE_LANGUAGE_INVALID',
        message: 'Code block language is invalid.',
        ok: false,
      };
    }
    const language = normalizeCodeLanguage(output.language);
    if (!language) {
      return {
        code: 'BLOCK_REWRITE_LANGUAGE_INVALID',
        message: 'Code block language is unsupported.',
        ok: false,
      };
    }
    return { ok: true, output: { ...output, language } };
  }
  return { ok: true, output };
};

const applyCodeBlockRewrite = (node: LexicalNode, output: unknown): void => {
  if (!$isCodeNode(node) || !isBlockRewriteSourceOutput(output)) return;
  const children = output.source
    .split('\n')
    .flatMap((line, index, lines) => [
      $createCodeHighlightNode(line),
      ...(index === lines.length - 1 ? [] : [$createLineBreakNode()]),
    ]);
  node.getChildren().forEach((child) => child.remove());
  node.append(...children);
  if (isBlockRewriteSourceOutput(output) && output.language !== undefined) {
    const language = normalizeCodeLanguage(output.language);
    if (language) node.setLanguage(language);
  }
};

export const codeBlockRewriteAdapter: BlockRewriteAdapter = {
  apply: applyCodeBlockRewrite,
  capabilities,
  key: 'codeblock',
  outputSchema: 'source',
  readContext: readCodeBlockContext,
  supports: $isCodeNode,
  validate: validateCodeBlockOutput,
};
