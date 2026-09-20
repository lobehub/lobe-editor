import {
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  type LexicalNode,
} from 'lexical';

import {
  type BoundCausalVersion,
  type CollaborationAnchor,
  type CollaborationService,
  ICollaborationService,
} from '@/common/collaboration';
import { getBlockOffset } from '@/editor-kernel/linear-text';
import { $getNodeId, $isNodeIdentityBlockTarget } from '@/plugins/properties/utils';
import type { IEditor } from '@/types';
import { hashRewriteText, normalizeRewriteText } from '@/utils/rewrite-text';

export interface CapturedAnchorRewriteSelection {
  anchor: CollaborationAnchor;
  baseVersion: BoundCausalVersion;
  capturedAt: string;
  descriptor: BoundCausalVersion['descriptor'];
  endNodeId: string;
  endOffset: number;
  focus: CollaborationAnchor;
  kind: 'anchor';
  quotedText: string;
  quotedTextHash: string;
  roomId: string;
  startNodeId: string;
  startOffset: number;
  targetNodeIds: string[];
}

/** Shared wire name used by Page/server/headless DTOs. */
export type CollaborationAnchorRewriteSelection = CapturedAnchorRewriteSelection;

export interface CaptureAnchorRewriteSelectionOptions {
  capturedAt?: Date | string;
  roomId: string;
}

const getBlockAncestor = (node: LexicalNode): LexicalNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isNodeIdentityBlockTarget(current)) return current;
    current = current.getParent();
  }
  return null;
};

const hasInlineDecorator = (node: LexicalNode): boolean => {
  if ($isDecoratorNode(node) && node.isInline()) return true;
  return $isElementNode(node) && node.getChildren().some(hasInlineDecorator);
};

const collectTargetBlocks = (selection: ReturnType<typeof $getSelection>): LexicalNode[] => {
  if (!$isRangeSelection(selection)) return [];
  const selected = new Set<LexicalNode>();
  selection.getNodes().forEach((node) => {
    const block = getBlockAncestor(node);
    if (block) selected.add(block);
  });
  const result: LexicalNode[] = [];
  const visit = (node: LexicalNode): void => {
    if (selected.has(node)) result.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };
  visit($getRoot());
  return result;
};

const capturedAt = (value?: Date | string): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
};

/** Capture a descriptor-bound selection through the registered engine port. */
export const captureAnchorRewriteSelection = (
  editor: IEditor,
  options: CaptureAnchorRewriteSelectionOptions,
): CapturedAnchorRewriteSelection | null => {
  if (!options.roomId) return null;
  const lexicalEditor = editor.getLexicalEditor();
  if (!lexicalEditor) return null;
  let service: CollaborationService | null = null;
  try {
    service = editor.requireService(ICollaborationService);
  } catch {
    return null;
  }
  if (!service) return null;

  return lexicalEditor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return null;
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

    const targetNodeIds = [...new Set(collectTargetBlocks(selection).map($getNodeId))];
    if (targetNodeIds.some((nodeId): nodeId is undefined => nodeId === undefined)) return null;
    const quotedText = normalizeRewriteText(selection.getTextContent());
    if (!quotedText) return null;
    const anchor = service.capturePoint({ nodeId: startNodeId, offset: startOffset });
    const focus = service.capturePoint({ nodeId: endNodeId, offset: endOffset });
    if (!anchor || !focus) return null;
    const baseVersion = service.getVersionProof();
    return {
      anchor,
      baseVersion,
      capturedAt: capturedAt(options.capturedAt),
      descriptor: service.descriptor,
      endNodeId,
      endOffset,
      focus,
      kind: 'anchor',
      quotedText,
      quotedTextHash: hashRewriteText(quotedText),
      roomId: options.roomId,
      startNodeId,
      startOffset,
      targetNodeIds: targetNodeIds as string[],
    };
  });
};
