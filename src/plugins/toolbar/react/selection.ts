import type { BaseSelection, LexicalNode } from 'lexical';

import { $isArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { $isCursorNode } from '@/plugins/common/node/cursor';
import { $isHoleNode } from '@/plugins/common/node/hole';

const isInsideHole = (node: LexicalNode): boolean => {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isHoleNode(current)) return true;
    current = current.getParent();
  }
  return false;
};

/** Suppress text formatting UI for atomic Artifact/Hole selections. */
export const $shouldSuppressTextToolbar = (selection: BaseSelection | null): boolean => {
  if (!selection) return false;

  return selection
    .getNodes()
    .some(
      (node) =>
        $isArtifactNode(node) ||
        $isHoleNode(node) ||
        isInsideHole(node) ||
        ($isCursorNode(node) && $isHoleNode(node.getParent())),
    );
};
