import type { Provider } from '@lexical/yjs';
import type { LexicalNode, RangeSelection } from 'lexical';
import {
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
} from 'lexical';
import { encodeStateVector, relativePositionToJSON } from 'yjs';

import { hashRewriteText, normalizeRewriteText } from '@/plugins/litexml/command';
import { $getNodeId, $isNodeIdentityBlockTarget } from '@/plugins/properties/utils';
import type { IEditor } from '@/types';
import { getBlockOffset } from '@/utils/linear-text';

import { encodeYjsBase64, type SerializedRelativePosition } from './protocol';
import { createRelativePositionForLexicalPoint } from './relative-position';
import { IYjsService, type YjsPluginState } from './service';

/**
 * A browser-safe, durable selection snapshot for targeted Page rewrites.
 *
 * The shape deliberately contains no Lexical node keys and no Y.Doc. Lexical
 * keys are runtime-only and a Y.Doc must remain owned by the collaboration
 * provider. The relative positions are JSON representations of the standard
 * v1 Yjs binding positions.
 */
export interface CapturedRelativeRewriteSelection {
  anchorPos: SerializedRelativePosition;
  baseStateVector: string;
  capturedAt: string;
  endNodeId: string;
  endOffset: number;
  focusPos: SerializedRelativePosition;
  kind: 'relative';
  quotedText: string;
  quotedTextHash: string;
  roomId: string;
  startNodeId: string;
  startOffset: number;
  targetNodeIds: string[];
}

/**
 * Block-id fallback used when the editor is not attached to a Yjs binding.
 * Offsets are character offsets within their containing durable block.
 */
export interface CapturedBlockRewriteSelection {
  endNodeId: string;
  endOffset: number;
  kind: 'block';
  quotedText: string;
  quotedTextHash: string;
  startNodeId: string;
  startOffset: number;
  targetNodeIds: string[];
}

export type CapturedCollaborativeRewriteSelection =
  CapturedBlockRewriteSelection | CapturedRelativeRewriteSelection;

export interface CaptureCollaborativeRewriteSelectionOptions {
  /** Override the room id only when the host has an explicit room namespace. */
  roomId?: string;
  /** Primarily useful for deterministic tests; defaults to the current time. */
  capturedAt?: Date | string;
}

const getBlockAncestor = (node: LexicalNode): LexicalNode | null => {
  let current: LexicalNode | null = node;

  while (current) {
    if ($isNodeIdentityBlockTarget(current)) return current;
    current = current.getParent();
  }

  return null;
};

const getStateVector = (state: YjsPluginState): string | null => {
  try {
    const doc = state.doc ?? state.binding.doc;
    if (doc) return encodeYjsBase64(encodeStateVector(doc));

    const provider = state.provider as Provider & { getStateVector?: () => string };
    const stateVector = provider.getStateVector?.();
    return typeof stateVector === 'string' && stateVector.length > 0 ? stateVector : null;
  } catch {
    return null;
  }
};

const normalizeCapturedAt = (capturedAt?: Date | string): string => {
  if (capturedAt instanceof Date) return capturedAt.toISOString();
  if (typeof capturedAt === 'string' && capturedAt.length > 0) return capturedAt;
  return new Date().toISOString();
};

const collectTargetBlocks = (selection: RangeSelection): LexicalNode[] => {
  const selectedBlocks = new Set<LexicalNode>();
  for (const node of selection.getNodes()) {
    const block = getBlockAncestor(node);
    if (block) selectedBlocks.add(block);
  }

  // Do not sort the candidates with `LexicalNode.isBefore` (or a comparator
  // derived from object identity). Cmd/Ctrl+A and some normalized element
  // ranges can return candidates in reverse traversal order, and detached or
  // equivalent root objects make those comparators unstable. Walking the
  // current root is the editor's authoritative document order and naturally
  // handles nested list/table descendants while the set removes duplicates.
  const blocks: LexicalNode[] = [];
  const visit = (node: LexicalNode): void => {
    if (selectedBlocks.has(node)) blocks.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };
  visit($getRoot());
  return blocks;
};

const getTargetNodeIds = (selection: RangeSelection): string[] | null => {
  const targetNodeIds = collectTargetBlocks(selection).map($getNodeId);
  if (!targetNodeIds.every((nodeId): nodeId is string => typeof nodeId === 'string')) return null;
  return new Set(targetNodeIds).size === targetNodeIds.length && targetNodeIds.length > 0
    ? targetNodeIds
    : null;
};

const hasInlineDecorator = (node: LexicalNode): boolean => {
  if ($isDecoratorNode(node) && node.isInline()) return true;
  return $isElementNode(node) && node.getChildren().some(hasInlineDecorator);
};

const makeBlockFallback = (selection: RangeSelection): CapturedBlockRewriteSelection | null => {
  if (selection.isCollapsed()) return null;
  if (selection.getNodes().some(hasInlineDecorator)) return null;

  const startPoint = selection.isBackward() ? selection.focus : selection.anchor;
  const endPoint = selection.isBackward() ? selection.anchor : selection.focus;
  const startBlock = getBlockAncestor(startPoint.getNode());
  const endBlock = getBlockAncestor(endPoint.getNode());
  if (!startBlock || !endBlock) return null;

  const startNodeId = $getNodeId(startBlock);
  const endNodeId = $getNodeId(endBlock);
  if (!startNodeId || !endNodeId) return null;

  const startOffset = getBlockOffset(startPoint, startBlock);
  const endOffset = getBlockOffset(endPoint, endBlock);
  if (startOffset === null || endOffset === null) return null;

  const targetNodeIds = getTargetNodeIds(selection);
  if (!targetNodeIds) return null;

  const quotedText = normalizeRewriteText(selection.getTextContent());
  if (!quotedText) return null;

  return {
    endNodeId,
    endOffset,
    kind: 'block',
    quotedText,
    quotedTextHash: hashRewriteText(quotedText),
    startNodeId,
    startOffset,
    targetNodeIds,
  };
};

/**
 * Capture the current text range as a durable rewrite target.
 *
 * This is read-only: it never creates node IDs, changes the Lexical
 * selection, or writes to Yjs. Callers should treat a null result as a
 * transient/unusable selection (for example, a detached point or a legacy
 * node that has not completed its node-id migration) and ask the user to
 * select the text again.
 */
export const captureCollaborativeRewriteSelection = (
  editor: IEditor,
  options: CaptureCollaborativeRewriteSelectionOptions = {},
): CapturedCollaborativeRewriteSelection | null => {
  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) return null;

  return lexicalEditor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return null;

    const fallback = makeBlockFallback(selection);
    if (!fallback) return null;

    const state = editor.requireService(IYjsService)?.getState();
    if (!state) return fallback;

    const roomId = options.roomId ?? state.id;
    const baseStateVector = getStateVector(state);
    if (!roomId || !baseStateVector) return fallback;

    const anchorPosition = createRelativePositionForLexicalPoint(selection.anchor, state.binding);
    const focusPosition = createRelativePositionForLexicalPoint(selection.focus, state.binding);
    if (!anchorPosition || !focusPosition) return fallback;

    return {
      anchorPos: relativePositionToJSON(anchorPosition) as SerializedRelativePosition,
      baseStateVector,
      capturedAt: normalizeCapturedAt(options.capturedAt),
      endNodeId: fallback.endNodeId,
      endOffset: fallback.endOffset,
      focusPos: relativePositionToJSON(focusPosition) as SerializedRelativePosition,
      kind: 'relative',
      quotedText: fallback.quotedText,
      quotedTextHash: fallback.quotedTextHash,
      roomId,
      startNodeId: fallback.startNodeId,
      startOffset: fallback.startOffset,
      targetNodeIds: fallback.targetNodeIds,
    };
  });
};
