import type { LexicalNode } from 'lexical';

import {
  BLOCK_REWRITE_MAX_SOURCE_LENGTH,
  BLOCK_REWRITE_MAX_TITLE_LENGTH,
  type BlockRewriteAdapter,
  type BlockRewriteContext,
  type BlockRewriteImageContext,
  type BlockRewriteValidationResult,
  isBlockRewritePatchOutput,
} from '@/plugins/block/service/rewrite-adapter';
import { $getNodeId } from '@/plugins/properties/utils';
import { hashRewriteText } from '@/utils/rewrite-text';

import { $isBlockImageNode, type BlockImageNode } from './node/block-image-node';

const capabilities = { canEdit: true, canMove: true, canSelect: true } as const;
const MAX_IMAGE_SOURCE_LENGTH = BLOCK_REWRITE_MAX_SOURCE_LENGTH;
const MAX_IMAGE_DIMENSION = 100_000;

type BlockImagePatch = {
  altText?: unknown;
  height?: unknown;
  maxWidth?: unknown;
  src?: unknown;
  width?: unknown;
};

const toImageContext = (node: BlockImageNode): BlockRewriteImageContext => ({
  altText: node.altText,
  height: typeof node.height === 'number' ? node.height : null,
  maxWidth: node.maxWidth,
  placeholder: node.src.trim().length === 0 && ['error', 'loading'].includes(node.status),
  src: node.src,
  status: node.status,
  width: typeof node.width === 'number' ? node.width : null,
});

const serializeImageContext = (image: BlockRewriteImageContext): string =>
  JSON.stringify({
    altText: image.altText,
    height: image.height,
    maxWidth: image.maxWidth,
    placeholder: image.placeholder,
    src: image.src,
    width: image.width,
  });

const isDimension = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_IMAGE_DIMENSION;

const isImageSource = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  if (
    source.length === 0 ||
    source.length > MAX_IMAGE_SOURCE_LENGTH ||
    [...source].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7F || character === '\\';
    })
  ) {
    return false;
  }
  if (source.startsWith('/')) return !source.startsWith('//');
  try {
    const url = new URL(source);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
};

const validateBlockImagePatch = (
  node: LexicalNode,
  output: unknown,
): BlockRewriteValidationResult => {
  if (!$isBlockImageNode(node)) {
    return {
      code: 'BLOCK_REWRITE_NODE_TYPE_MISMATCH',
      message: 'Target is not a block image.',
      ok: false,
    };
  }
  if (node.status === 'uploaded' && node.src.trim().length === 0) {
    return {
      code: 'BLOCK_REWRITE_IMAGE_NOT_READY',
      message: 'Uploaded block image has no source.',
      ok: false,
    };
  }
  const isGeneratedPlaceholder =
    node.src.trim().length === 0 && ['error', 'loading'].includes(node.status);
  if (node.status !== 'uploaded' && !isGeneratedPlaceholder) {
    return {
      code: 'BLOCK_REWRITE_IMAGE_NOT_READY',
      message: 'Block image is not ready for rewriting.',
      ok: false,
    };
  }
  if (!isBlockRewritePatchOutput(output)) {
    return {
      code: 'BLOCK_REWRITE_PATCH_REQUIRED',
      message: 'Block image rewrites require patch output.',
      ok: false,
    };
  }

  const patch = output.patch as BlockImagePatch;
  const knownFields = ['altText', 'height', 'maxWidth', 'src', 'width'] as const;
  if (
    Object.keys(patch).some((field) => !knownFields.includes(field as (typeof knownFields)[number]))
  ) {
    return {
      code: 'BLOCK_REWRITE_PATCH_FIELD_INVALID',
      message: 'Block image patch contains an unsupported field.',
      ok: false,
    };
  }
  if (!knownFields.some((field) => field in patch)) {
    return {
      code: 'BLOCK_REWRITE_PATCH_EMPTY',
      message: 'Block image patch is empty.',
      ok: false,
    };
  }
  if (patch.src !== undefined && !isImageSource(patch.src)) {
    return {
      code: 'BLOCK_REWRITE_IMAGE_SRC_INVALID',
      message: 'Block image source is invalid.',
      ok: false,
    };
  }
  if (isGeneratedPlaceholder && !isImageSource(patch.src)) {
    return {
      code: 'BLOCK_REWRITE_IMAGE_SRC_REQUIRED',
      message: 'Generated block image rewrite requires a stored image source.',
      ok: false,
    };
  }
  if (
    patch.altText !== undefined &&
    (typeof patch.altText !== 'string' || patch.altText.length > BLOCK_REWRITE_MAX_TITLE_LENGTH)
  ) {
    return {
      code: 'BLOCK_REWRITE_IMAGE_ALT_INVALID',
      message: 'Block image alt text is invalid.',
      ok: false,
    };
  }
  if (
    (patch.width !== undefined && patch.width !== null && !isDimension(patch.width)) ||
    (patch.height !== undefined && patch.height !== null && !isDimension(patch.height)) ||
    (patch.maxWidth !== undefined && !isDimension(patch.maxWidth))
  ) {
    return {
      code: 'BLOCK_REWRITE_IMAGE_DIMENSION_INVALID',
      message: 'Block image dimensions are invalid.',
      ok: false,
    };
  }

  return { ok: true, output };
};

const applyBlockImageRewrite = (node: LexicalNode, output: unknown): void => {
  if (!$isBlockImageNode(node) || !isBlockRewritePatchOutput(output)) return;
  const image = node as BlockImageNode;
  const patch = output.patch as BlockImagePatch;

  if (typeof patch.src === 'string') image.setUploaded(patch.src.trim());
  if (typeof patch.altText === 'string') image.setAltText(patch.altText);
  if (patch.width !== undefined)
    image.setWidth(patch.width === null ? 'inherit' : (patch.width as number));
  if (patch.height !== undefined)
    image.setHeight(patch.height === null ? 'inherit' : (patch.height as number));
  if (typeof patch.maxWidth === 'number') image.setMaxWidth(patch.maxWidth);
};

const readBlockImageContext = (node: LexicalNode): BlockRewriteContext | null => {
  if (!$isBlockImageNode(node)) return null;
  const nodeId = $getNodeId(node);
  if (!nodeId) return null;
  const image = toImageContext(node);
  const source = serializeImageContext(image);
  return {
    adapterKey: 'block-image',
    capabilities,
    image,
    nodeId,
    nodeType: node.getType(),
    source,
    sourceHash: hashRewriteText(source),
    summary: image.altText || 'Block image',
    title: 'Block image',
  };
};

export const blockImageRewriteAdapter: BlockRewriteAdapter = {
  apply: applyBlockImageRewrite,
  capabilities,
  key: 'block-image',
  outputSchema: 'patch',
  readContext: readBlockImageContext,
  supports: $isBlockImageNode,
  validate: validateBlockImagePatch,
};
