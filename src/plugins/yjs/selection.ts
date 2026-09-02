import type { Binding, Provider } from '@lexical/yjs';
import type { LexicalNode, PointType, RangeSelection } from 'lexical';
import {
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
} from 'lexical';
import {
  type AbstractType,
  createRelativePositionFromTypeIndex,
  encodeStateVector,
  relativePositionToJSON,
} from 'yjs';

import { hashRewriteText, normalizeRewriteText } from '@/plugins/litexml/command';
import { $getNodeId, $isNodeIdentityBlockTarget } from '@/plugins/properties/utils';
import type { IEditor } from '@/types';

import { encodeYjsBase64, type SerializedRelativePosition } from './protocol';
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

interface CollabNodePosition {
  _parent?: { _xmlText?: AbstractType<unknown> };
  getOffset?: () => number;
  getSharedType?: () => AbstractType<unknown>;
}

const getBlockAncestor = (node: LexicalNode): LexicalNode | null => {
  let current: LexicalNode | null = node;

  while (current) {
    if ($isNodeIdentityBlockTarget(current)) return current;
    current = current.getParent();
  }

  return null;
};

interface LinearTextSegment {
  end: number;
  node: LexicalNode;
  start: number;
}

/** Keep selection offsets aligned with Lexical text, including atomic breaks. */
const getLinearTextSegments = (node: LexicalNode): LinearTextSegment[] => {
  const segments: LinearTextSegment[] = [];
  let cursor = 0;

  const visit = (candidate: LexicalNode): void => {
    if ($isLineBreakNode(candidate)) {
      const length = Math.max(1, candidate.getTextContent().length);
      segments.push({ end: cursor + length, node: candidate, start: cursor });
      cursor += length;
      return;
    }
    if ($isTextNode(candidate)) {
      const length = candidate.getTextContentSize();
      segments.push({ end: cursor + length, node: candidate, start: cursor });
      cursor += length;
      return;
    }
    if ($isDecoratorNode(candidate)) {
      if (candidate.isInline()) {
        const length = candidate.getTextContent().length;
        if (length > 0) {
          segments.push({ end: cursor + length, node: candidate, start: cursor });
          cursor += length;
        }
      }
      return;
    }
    if ($isElementNode(candidate)) candidate.getChildren().forEach(visit);
  };

  visit(node);
  return segments;
};

/** Return the character offset of a point relative to its containing block. */
const getBlockOffset = (point: PointType, block: LexicalNode): number | null => {
  if (!$isElementNode(block) || !Number.isSafeInteger(point.offset) || point.offset < 0) {
    return null;
  }

  const segments = getLinearTextSegments(block);
  if ($isTextNode(point.getNode())) {
    const segment = segments.find((candidate) => candidate.node === point.getNode());
    return segment
      ? segment.start + Math.min(point.offset, point.getNode().getTextContentSize())
      : null;
  }

  if (point.getNode() === block && point.type === 'element') {
    const children = block.getChildren();
    return children
      .slice(0, point.offset)
      .reduce((offset, child) => offset + (getLinearTextSegments(child).at(-1)?.end ?? 0), 0);
  }

  return null;
};

/**
 * Convert a Lexical point to the corresponding v1 Yjs position. This mirrors
 * @lexical/yjs' internal helper because that helper is intentionally not part
 * of its public API. Only the private binding mapping is read; no raw Yjs
 * object leaves this module.
 */
const createRelativePosition = (
  point: PointType,
  binding: Binding,
): ReturnType<typeof createRelativePositionFromTypeIndex> | null => {
  const collabNode = binding.collabNodeMap.get(point.key) as CollabNodePosition | undefined;
  if (!collabNode) return null;

  try {
    let sharedType: AbstractType<unknown> | undefined;
    let offset = point.offset;

    if (point.type === 'text') {
      sharedType = collabNode._parent?._xmlText;
      const currentOffset = collabNode.getOffset?.();
      if (!sharedType || currentOffset === undefined || currentOffset < 0) return null;
      offset = currentOffset + 1 + point.offset;
    } else if (point.type === 'element') {
      sharedType = collabNode.getSharedType?.();
      const parent = point.getNode();
      if (!sharedType || !$isElementNode(parent)) return null;

      let accumulatedOffset = 0;
      let index = 0;
      let child = parent.getFirstChild();
      while (child !== null && index++ < point.offset) {
        accumulatedOffset += $isTextNode(child) ? child.getTextContentSize() + 1 : 1;
        child = child.getNextSibling();
      }
      offset = accumulatedOffset;
    } else {
      return null;
    }

    return createRelativePositionFromTypeIndex(sharedType, offset);
  } catch {
    // A point can briefly be detached while a remote Yjs update is being
    // materialized. Let the caller use the durable block fallback instead.
    return null;
  }
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

    const anchorPosition = createRelativePosition(selection.anchor, state.binding);
    const focusPosition = createRelativePosition(selection.focus, state.binding);
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
