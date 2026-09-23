import type { LexicalNode } from 'lexical';

import {
  BLOCK_REWRITE_MAX_LANGUAGE_LENGTH,
  BLOCK_REWRITE_MAX_SOURCE_LENGTH,
  type BlockRewriteAdapter,
  type BlockRewriteContext,
  type BlockRewriteValidationResult,
  isBlockRewriteSourceOutput,
} from '@/plugins/block/service/rewrite-adapter';
import { $getNodeId } from '@/plugins/properties/utils';
import { hashRewriteText } from '@/utils/rewrite-text';

import { getCodeMirrorLanguageAliases, normalizeCodeMirrorLanguage } from './lib/mode';
import { CodeMirrorNode } from './node/CodeMirrorNode';

const capabilities = { canEdit: true, canMove: true, canSelect: true } as const;

const isCodeMirrorNode = (node: LexicalNode): node is CodeMirrorNode => {
  if (node instanceof CodeMirrorNode) return true;
  if (node.getType() !== CodeMirrorNode.getType()) return false;
  const candidate = node as CodeMirrorNode;
  return typeof candidate.code === 'string' && typeof candidate.setCode === 'function';
};

const readCodeMirrorContext = (node: LexicalNode): BlockRewriteContext | null => {
  if (!isCodeMirrorNode(node)) return null;
  const nodeId = $getNodeId(node);
  if (!nodeId) return null;
  const source = node.code;
  const language = normalizeCodeMirrorLanguage(node.lang) || 'plain';
  const title = language ? `Code (${language})` : 'Code';
  return {
    adapterKey: 'codemirror',
    capabilities,
    language,
    languageAliases: getCodeMirrorLanguageAliases(language),
    nodeId,
    nodeType: node.getType(),
    source,
    sourceHash: hashRewriteText(source),
    summary: title,
    title,
  };
};

const validateCodeMirrorOutput = (
  node: LexicalNode,
  output: unknown,
): BlockRewriteValidationResult => {
  if (!isCodeMirrorNode(node)) {
    return {
      code: 'BLOCK_REWRITE_NODE_TYPE_MISMATCH',
      message: 'Target is not a CodeMirror block.',
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
        message: 'CodeMirror language is invalid.',
        ok: false,
      };
    }
    const language = normalizeCodeMirrorLanguage(output.language);
    if (!language) {
      return {
        code: 'BLOCK_REWRITE_LANGUAGE_INVALID',
        message: 'CodeMirror language is unsupported.',
        ok: false,
      };
    }
    return { ok: true, output: { ...output, language } };
  }
  return { ok: true, output };
};

const applyCodeMirrorRewrite = (node: LexicalNode, output: unknown): void => {
  if (isCodeMirrorNode(node) && isBlockRewriteSourceOutput(output)) {
    node.setCode(output.source);
    if (output.language !== undefined) {
      const language = normalizeCodeMirrorLanguage(output.language);
      if (language) node.setLang(language);
    }
  }
};

export const codeMirrorBlockRewriteAdapter: BlockRewriteAdapter = {
  apply: applyCodeMirrorRewrite,
  capabilities,
  key: 'codemirror',
  outputSchema: 'source',
  readContext: readCodeMirrorContext,
  supports: isCodeMirrorNode,
  validate: validateCodeMirrorOutput,
};
