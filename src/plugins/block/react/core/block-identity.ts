import { $findTableNode } from '@lexical/table';
import { $getNodeByKey } from 'lexical';

import { $resolveLogicalBlockNode, $resolveStructuralBlockNode } from '@/plugins/common/node/hole';

/**
 * Compare block keys from two different DOM/selection projections.
 *
 * A block rendered through a Hole can expose its logical payload key in one
 * place and its structural Hole key in another. Callers must invoke this
 * helper inside a Lexical read/update so both keys are resolved against the
 * same editor state.
 */
export const $areBlockKeysEquivalent = (firstKey: string, secondKey: string): boolean => {
  const firstNode = $getNodeByKey(firstKey);
  const secondNode = $getNodeByKey(secondKey);
  if (!firstNode || !secondNode) return false;

  const firstLogical = $resolveLogicalBlockNode(firstNode);
  const secondLogical = $resolveLogicalBlockNode(secondNode);
  if (firstLogical.is(secondLogical)) return true;

  return $resolveStructuralBlockNode(firstNode).is($resolveStructuralBlockNode(secondNode));
};

/** Whether a block DOM key resolves to the focused table or one of its cells. */
export const $isBlockKeyOwnedByTable = (tableKey: string, blockKey: string): boolean => {
  if ($areBlockKeysEquivalent(tableKey, blockKey)) return true;

  const blockNode = $getNodeByKey(blockKey);
  const tableNode = $getNodeByKey(tableKey);
  if (!blockNode || !tableNode) return false;

  const ownerTable = $findTableNode(blockNode);
  return Boolean(ownerTable && $areBlockKeysEquivalent(tableNode.getKey(), ownerTable.getKey()));
};
