import { $getClipboardDataFromSelection, type LexicalClipboardData } from '@lexical/clipboard';
import {
  $createNodeSelection,
  $getNodeByKey,
  $setSelection,
  type LexicalNode,
  type NodeKey,
} from 'lexical';

import { $isBlockImageNode, type BlockImageNode } from '../node/block-image-node';
import { $isImageNode, type ImageNode } from '../node/image-node';

export function $isAnyImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode | BlockImageNode {
  return !!node && ($isImageNode(node) || $isBlockImageNode(node));
}

/**
 * Remove an image the same way Backspace removes a selected image: select it,
 * then delete the node selection so the caret lands next to where it was.
 */
export function $deleteImageByKey(key: NodeKey): boolean {
  const node = $getNodeByKey(key);
  if (!$isAnyImageNode(node)) return false;

  const selection = $createNodeSelection();
  selection.add(key);
  $setSelection(selection);
  selection.deleteNodes();
  return true;
}

/**
 * Clipboard payload for a single image: Lexical JSON (pasting back into the
 * editor recreates the same image without re-uploading), HTML and plain text.
 */
export function $getImageClipboardData(key: NodeKey): LexicalClipboardData | null {
  const node = $getNodeByKey(key);
  if (!$isAnyImageNode(node)) return null;

  const selection = $createNodeSelection();
  selection.add(key);
  return $getClipboardDataFromSelection(selection);
}
