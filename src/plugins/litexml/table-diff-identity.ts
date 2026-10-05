import type { LexicalNode } from 'lexical';

import { $getNodeProperties, $setNodeProperties } from '@/plugins/properties/state';
import { $getNodeId } from '@/plugins/properties/utils';

/** NodeState fields used by review-only table wrappers. */
export const TABLE_DIFF_LOGICAL_NODE_ID = 'logicalNodeId';
export const TABLE_DIFF_LOGICAL_ANNOTATION_IDS = 'logicalAnnotationIds';

const stringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.filter((annotationId): annotationId is string => typeof annotationId === 'string')
    : undefined;

/**
 * Store the logical row/cell identity without making the review wrapper
 * addressable. Wrapper nodeIds would collide across before/after rows and
 * would make a pending Diff look like a real document target.
 */
export function captureTableDiffLogicalIdentity(source: LexicalNode, wrapper: LexicalNode): void {
  const sourceProperties = $getNodeProperties(source);
  const logicalNodeId = $getNodeId(source);
  const annotationIds = sourceProperties.annotationIds;
  if (!logicalNodeId && !annotationIds) return;

  $setNodeProperties(wrapper, (previous) => ({
    ...previous,
    ...(logicalNodeId ? { [TABLE_DIFF_LOGICAL_NODE_ID]: logicalNodeId } : {}),
    ...(annotationIds ? { [TABLE_DIFF_LOGICAL_ANNOTATION_IDS]: annotationIds } : {}),
  }));
}

/** Remove legacy wrapper nodeId state while retaining it as logical metadata. */
export function normalizeTableDiffWrapperIdentity(wrapper: LexicalNode): void {
  const properties = $getNodeProperties(wrapper);
  if (!properties.nodeId && !properties.annotationIds) return;

  $setNodeProperties(wrapper, (previous) => {
    const next = { ...previous };
    if (next.nodeId && !next[TABLE_DIFF_LOGICAL_NODE_ID]) {
      next[TABLE_DIFF_LOGICAL_NODE_ID] = next.nodeId;
    }
    if (next.annotationIds && !next[TABLE_DIFF_LOGICAL_ANNOTATION_IDS]) {
      next[TABLE_DIFF_LOGICAL_ANNOTATION_IDS] = next.annotationIds;
    }
    delete next.nodeId;
    delete next.annotationIds;
    return next;
  });
}

/** Restore logical identity onto the ordinary row/cell created after review. */
export function restoreTableDiffLogicalIdentity(wrapper: LexicalNode, target: LexicalNode): void {
  const wrapperProperties = $getNodeProperties(wrapper);
  const logicalNodeId = wrapperProperties[TABLE_DIFF_LOGICAL_NODE_ID];
  const annotationIds = wrapperProperties[TABLE_DIFF_LOGICAL_ANNOTATION_IDS];
  if (typeof logicalNodeId !== 'string' && !Array.isArray(annotationIds)) return;

  $setNodeProperties(target, (previous) => {
    const next = { ...previous };
    if (typeof logicalNodeId === 'string') next.nodeId = logicalNodeId;
    const normalizedAnnotationIds = stringArray(annotationIds);
    if (normalizedAnnotationIds) next.annotationIds = normalizedAnnotationIds;
    delete next[TABLE_DIFF_LOGICAL_NODE_ID];
    delete next[TABLE_DIFF_LOGICAL_ANNOTATION_IDS];
    return next;
  });
}

/**
 * An accepted add-side wrapper becomes a real document node. Carry only the
 * AI provenance/rewrite metadata that explains that generated content; the
 * logical wrapper fields remain private and are deliberately not copied.
 */
export function copyTableDiffReviewMetadata(wrapper: LexicalNode, target: LexicalNode): void {
  const properties = $getNodeProperties(wrapper);
  if (properties.provenance?.source !== 'ai') return;

  $setNodeProperties(target, (previous) => ({
    ...previous,
    provenance: properties.provenance,
  }));
}
