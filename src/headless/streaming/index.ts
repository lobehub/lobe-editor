import type { LexicalEditor, LexicalNode, TextNode } from 'lexical';
import { $createTextNode, $getRoot, $isElementNode, $isTextNode } from 'lexical';

import {
  $clearStreamingGenerationRegion,
  $findNodeById,
  $findNodesById,
  $getStreamingGenerationRegion,
  $markNodeAsStreamingGenerationRegion,
  $markNodesAsAIGenerated,
  $setStreamingGenerationRegionRange,
  type StreamingGenerationRegion,
} from '@/plugins/properties/utils';
import { getLinearTextSegments } from '@/utils/linear-text';

/** Minimal stream state shape consumed by the private document helpers. */
export interface StreamingStateView {
  caret: { nodeId: string; offset: number };
  generationId: string;
  sessionId: string;
}

export interface StreamingInsertionStateView extends StreamingStateView {
  boundarySeparatorKey?: string;
  generatedText: string;
  regionAnchorPosition?: unknown;
  regionStartOffset: number;
}

export interface StreamingTargetStateView extends StreamingInsertionStateView {
  expectedBlockTexts: ReadonlyMap<string, string>;
  knownMissingTargetNodeIds: ReadonlySet<string>;
  requestId: string;
  selectionTargetNodeIds: ReadonlyArray<string>;
}

export interface StreamingRegionSnapshot {
  generatedContiguous: boolean;
  generatedEndOffset?: number;
  generatedNodeCount: number;
  generatedStartOffset?: number;
  generatedText: string;
  marker?: StreamingGenerationRegion;
}

export interface StreamingTextProvenance {
  createdAt?: string;
  generationId: string;
  model?: string;
  provider?: string;
  requestId: string;
  sessionId?: string;
  turnIndex?: number;
}

const STREAMING_TEXT_CONTAINERS = new Set(['heading', 'paragraph', 'quote', 'tablecell']);

const findStreamingTextContainer = (node: LexicalNode): LexicalNode | null => {
  if (!$isElementNode(node)) return null;
  if (STREAMING_TEXT_CONTAINERS.has(node.getType())) return node;

  for (const child of node.getChildren()) {
    const container = findStreamingTextContainer(child);
    if (container) return container;
  }
  return node;
};

/** Insert one generated chunk as a separate, provenance-bearing text leaf. */
export const insertStreamingTextAtBlockOffset = (
  block: LexicalNode,
  offset: number,
  text: string,
  region: Pick<StreamingStateView, 'generationId' | 'sessionId'>,
  provenance: StreamingTextProvenance,
): boolean => {
  if (!$isElementNode(block) || !text) return false;

  const segments = getLinearTextSegments(block);
  const generated = $createTextNode(text);
  const template = segments.find(
    (segment) => $isTextNode(segment.node) && offset >= segment.start && offset <= segment.end,
  )?.node;

  if ($isTextNode(template)) {
    generated
      .setFormat(template.getFormat())
      .setDetail(template.getDetail())
      .setMode(template.getMode())
      .setStyle(template.getStyle());
  }

  // Mark detached leaves before attaching them so Lexical normalization cannot
  // merge generated output into a human-authored text node.
  $markNodesAsAIGenerated([generated], provenance);
  $markNodeAsStreamingGenerationRegion(generated, region);

  if (!template) {
    const container = findStreamingTextContainer(block);
    if (!$isElementNode(container)) return false;
    container.append(generated);
    return true;
  }

  for (const segment of segments) {
    if (offset <= segment.start) {
      segment.node.insertBefore(generated);
      return true;
    }
    if (offset < segment.end) {
      if (!$isTextNode(segment.node)) return false;
      const split = segment.node.splitText(offset - segment.start);
      const left = split[0];
      if (!left) return false;
      left.insertAfter(generated);
      return true;
    }
    if (offset === segment.end) {
      segment.node.insertAfter(generated);
      return true;
    }
  }

  segments.at(-1)?.node.insertAfter(generated);
  return true;
};

/** Insert a temporary unmergeable separator at a durable block offset. */
export const insertPlainTextAtBlockOffset = (
  block: LexicalNode,
  offset: number,
  text: string,
): TextNode | null => {
  if (!$isElementNode(block) || !text) return null;
  const segments = getLinearTextSegments(block);
  const inserted = $createTextNode(text).setDetail('unmergable');
  const container = findStreamingTextContainer(block);

  if (segments.length === 0) {
    if (!$isElementNode(container)) return null;
    container.append(inserted);
    return inserted;
  }

  for (const segment of segments) {
    if (offset <= segment.start) {
      segment.node.insertBefore(inserted);
      return inserted;
    }
    if (offset < segment.end) {
      if (!$isTextNode(segment.node)) return null;
      const split = segment.node.splitText(offset - segment.start);
      if (!split[0]) return null;
      split[0].insertAfter(inserted);
      return inserted;
    }
    if (offset === segment.end) {
      segment.node.insertAfter(inserted);
      return inserted;
    }
  }

  segments.at(-1)?.node.insertAfter(inserted);
  return inserted;
};

/** Read the durable region marker and generated leaves in one editor read. */
export const readStreamingRegionSnapshot = (
  editor: LexicalEditor | null,
  state: StreamingStateView,
): StreamingRegionSnapshot => {
  const snapshot: StreamingRegionSnapshot = {
    generatedContiguous: true,
    generatedNodeCount: 0,
    generatedText: '',
  };
  if (!editor) return snapshot;

  editor.getEditorState().read(() => {
    const block = $findNodeById(state.caret.nodeId);
    if (!block) return;

    const marker = $getStreamingGenerationRegion(block);
    if (marker) snapshot.marker = marker;

    const generatedSegments = getLinearTextSegments(block).filter((segment) => {
      if (!$isTextNode(segment.node)) return false;
      const region = $getStreamingGenerationRegion(segment.node);
      return (
        region?.sessionId === state.sessionId &&
        region.generationId === state.generationId &&
        region.startOffset === undefined &&
        region.length === undefined
      );
    });
    if (generatedSegments.length === 0) return;

    snapshot.generatedNodeCount = generatedSegments.length;
    snapshot.generatedStartOffset = generatedSegments[0].start;
    snapshot.generatedEndOffset = generatedSegments.at(-1)!.end;
    snapshot.generatedText = generatedSegments
      .map((segment) => segment.node.getTextContent())
      .join('');
    snapshot.generatedContiguous =
      snapshot.generatedEndOffset - snapshot.generatedStartOffset === snapshot.generatedText.length;
  });
  return snapshot;
};

/** Read all durable target texts in one editor read transaction. */
export const readStreamingTargetTexts = (
  editor: LexicalEditor | null,
  targetNodeIds: ReadonlyArray<string>,
): {
  duplicateNodeIds: Set<string>;
  missingNodeIds: Set<string>;
  texts: Map<string, string>;
} => {
  const texts = new Map<string, string>();
  const missingNodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  if (!editor) {
    targetNodeIds.forEach((nodeId) => missingNodeIds.add(nodeId));
    return { duplicateNodeIds, missingNodeIds, texts };
  }

  editor.getEditorState().read(() => {
    for (const nodeId of targetNodeIds) {
      const nodes = $findNodesById(nodeId).filter((node) => node.isAttached());
      if (nodes.length !== 1) {
        if (nodes.length > 1) duplicateNodeIds.add(nodeId);
        else missingNodeIds.add(nodeId);
        continue;
      }
      texts.set(nodeId, nodes[0].getTextContent());
    }
  });
  return { duplicateNodeIds, missingNodeIds, texts };
};

/** Resolve a boundary key to its current linear offset in the streaming block. */
export const readStreamingNodeOffset = (
  editor: LexicalEditor | null,
  state: StreamingStateView,
  nodeKey: string,
): number | null => {
  if (!editor) return null;
  let offset: number | null = null;
  editor.getEditorState().read(() => {
    const block = $findNodeById(state.caret.nodeId);
    if (!block) return;
    const segment = getLinearTextSegments(block).find(
      (candidate) => candidate.node.getKey() === nodeKey,
    );
    if (segment) offset = segment.start;
  });
  return offset;
};

/** Resolve the current insertion boundary after prefix edits and retries. */
export const getStreamingInsertionOffset = (
  editor: LexicalEditor | null,
  state: StreamingInsertionStateView,
  resolveRelativeAnchorOffset: (state: StreamingInsertionStateView) => number | null,
): number | null => {
  const snapshot = readStreamingRegionSnapshot(editor, state);
  if (snapshot.generatedNodeCount > 0) {
    if (!snapshot.generatedContiguous || snapshot.generatedEndOffset === undefined) return null;
    return snapshot.generatedEndOffset;
  }

  if (state.boundarySeparatorKey) {
    const separatorOffset = readStreamingNodeOffset(editor, state, state.boundarySeparatorKey);
    if (separatorOffset !== null) return separatorOffset;
  }

  return resolveRelativeAnchorOffset(state) ?? state.regionStartOffset;
};

/** Validate the live marker/generated projection against the stream checkpoint. */
export const getStreamingTargetIssue = (
  editor: LexicalEditor | null,
  state: StreamingTargetStateView,
): 'generation_conflict' | 'region_missing' | null => {
  const region = readStreamingRegionSnapshot(editor, state);
  if (
    !region.marker ||
    region.marker.sessionId !== state.sessionId ||
    region.marker.generationId !== state.generationId ||
    (region.marker.requestId !== undefined && region.marker.requestId !== state.requestId) ||
    region.marker.length !== state.generatedText.length
  ) {
    return 'region_missing';
  }

  const current = readStreamingTargetTexts(editor, state.selectionTargetNodeIds);
  if (current.duplicateNodeIds.size > 0) return 'generation_conflict';

  const hasGeneratedNodes = region.generatedNodeCount > 0;
  if (state.generatedText.length > 0) {
    if (!hasGeneratedNodes) return 'region_missing';
    if (!region.generatedContiguous || region.generatedText !== state.generatedText) {
      return 'generation_conflict';
    }
  }

  for (const nodeId of state.selectionTargetNodeIds) {
    const wasMissing = state.knownMissingTargetNodeIds.has(nodeId);
    const expected = state.expectedBlockTexts.get(nodeId);
    const actual = current.texts.get(nodeId);
    if (wasMissing) {
      if (actual !== undefined) return 'generation_conflict';
      continue;
    }
    if (actual === undefined) return 'generation_conflict';
    // The host block remains editable outside the generated run. Its marker
    // and generated leaves above are the authoritative proof for that block.
    if (nodeId !== state.caret.nodeId && expected !== actual) {
      return 'generation_conflict';
    }
  }
  return null;
};

/** Remove only this stream's temporary region metadata from the live tree. */
export const clearStreamingRegionMetadata = (
  editor: LexicalEditor | null,
  sessionId: string,
): void => {
  if (!editor) return;
  try {
    editor.update(
      () => {
        const visit = (node: LexicalNode): void => {
          $clearStreamingGenerationRegion(node, sessionId);
          if ($isElementNode(node)) node.getChildren().forEach(visit);
        };
        visit($getRoot());
      },
      { discrete: true },
    );
  } catch {
    // The region may already have been deleted by a structural operation.
  }
};

/** Update a block marker after a generated insertion. */
export const setStreamingRegionRange = (
  block: LexicalNode,
  range: { length: number; startOffset: number },
): void => {
  $setStreamingGenerationRegionRange(block, range);
};
