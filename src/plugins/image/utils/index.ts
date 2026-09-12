import { $getNodeByKey } from 'lexical';

import type { IEditorAsyncScope } from '@/plugins/common/service/editor-async-scope';

import { $isBlockImageNode, type BlockImageNode } from '../node/block-image-node';
import { $isImageNode, type ImageNode } from '../node/image-node';

type ImageNodeLike = ImageNode | BlockImageNode;

const getAttachedImageNode = (key: string, type: string): ImageNodeLike | null => {
  const node = $getNodeByKey(key);
  if (!node || node.getType() !== type || !node.isAttached()) return null;
  if ($isImageNode(node) || $isBlockImageNode(node)) return node;
  return null;
};

export const settleImageNode = (
  scope: IEditorAsyncScope,
  key: string,
  type: string,
  settle: (node: ImageNodeLike) => void,
): void => {
  scope.update(() => {
    const node = getAttachedImageNode(key, type);
    if (node) settle(node);
  });
};
