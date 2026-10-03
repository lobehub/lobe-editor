import { $isListItemNode } from '@lexical/list';
import { $isTableCellNode, $isTableNode, $isTableRowNode } from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $insertNodes,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
} from 'lexical';

import { $closest } from '@/editor-kernel';
import { $ensureUniqueNodeIds, $findNodeById } from '@/plugins/common/node/node-id';
import { exportNodeToJSON } from '@/plugins/common/utils';
import { createDebugLogger } from '@/utils/debug';

import type LitexmlDataSource from '../data-source/litexml-data-source';
import {
  findNewIllegalDiffPaths,
  hasActiveLiteXmlNodeId,
  type LiteXmlProjectionOperation,
  projectLiteXmlOperation,
  type SerializedDiffDocument,
} from '../diff-validation';
import { $createDiffContentNode, $isDiffContentNode } from '../node/DiffContentNode';
import { $createDiffNode, $isDiffNode, DiffNode } from '../node/DiffNode';
import { $isTableCellDiffNode } from '../node/TableCellDiffNode';
import {
  $createTableCellDiffFromCell,
  $getLogicalRowWidth,
  $getTableCellColumnIndex,
  $getTableForCell,
  $shrinkTableWidthsAfterCellRemoval,
  $updateTableWidthsForCellInsertion,
  type AnyTableCell,
} from '../table-cell-diff';
import { $areTableRowStructuresCompatible, $createTableRowDiffFromRow } from '../table-row-diff';
import { $cloneNode, $parseSerializedNodeImpl } from '../utils';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_MODIFY_WITH_RESULTS_COMMAND,
  LITEXML_REMOVE_COMMAND,
  type LiteXmlModifyOperation,
  type LiteXmlOperationResult,
} from './symbols';

const logger = createDebugLogger('plugin', 'litexml');

// Helpers to reduce duplication and improve readability
function toArrayXml(litexml: string | string[]) {
  return Array.isArray(litexml) ? litexml : [litexml];
}

function hasNewIllegalDiffs(
  previous: SerializedDiffDocument,
  projected: SerializedDiffDocument,
): string[] {
  return findNewIllegalDiffPaths(previous, projected);
}

function projectOperation(
  dataSource: LitexmlDataSource,
  document: SerializedDiffDocument,
  operation: LiteXmlProjectionOperation,
): SerializedDiffDocument | null {
  try {
    const projected = projectLiteXmlOperation(document, operation, (xml) =>
      dataSource.readLiteXMLToInode(xml),
    );
    const newIllegalDiffs = hasNewIllegalDiffs(document, projected);
    if (newIllegalDiffs.length > 0) {
      logger.warn('⚠️ Skipping operation with illegal nested diff', newIllegalDiffs);
      return null;
    }
    return projected;
  } catch (error) {
    logger.error('❌ Failed to preflight LiteXML operation:', error);
    return null;
  }
}

function toProjectionOperation(operation: LiteXmlProjectionOperation): LiteXmlProjectionOperation {
  return operation;
}

function getSerializedNodeId(node: any): string | undefined {
  if (typeof node?.id === 'string' && node.id.length > 0) return node.id;
  const nodeId = node?.$?.properties?.nodeId;
  return typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : undefined;
}

function getActiveSerializedDocument(): SerializedDiffDocument {
  return { root: exportNodeToJSON($getRoot()) as SerializedDiffDocument['root'] };
}

function getBatchTargetError(
  document: SerializedDiffDocument,
  operation: LiteXmlModifyOperation,
  dataSource: LitexmlDataSource,
): string | undefined {
  if (operation.action === 'remove') {
    return hasActiveLiteXmlNodeId(document.root, operation.id)
      ? undefined
      : `Node id "${operation.id}" was not found.`;
  }

  if (operation.action === 'insert') {
    try {
      const inode = dataSource.readLiteXMLToInode(operation.litexml);
      if (!inode.root.children?.length) return 'Insert operation contains no LiteXML nodes.';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    const anchorId = 'beforeId' in operation ? operation.beforeId : operation.afterId;
    if (anchorId === 'root') {
      return (document.root.children?.length || 0) > 0
        ? undefined
        : 'The document has no node to use as an insertion anchor.';
    }
    return hasActiveLiteXmlNodeId(document.root, anchorId)
      ? undefined
      : `Insertion anchor "${anchorId}" was not found.`;
  }

  try {
    const xmls = Array.isArray(operation.litexml) ? operation.litexml : [operation.litexml];
    for (const xml of xmls) {
      const inode = dataSource.readLiteXMLToInode(xml);
      for (const node of inode.root.children || []) {
        const nodeId = getSerializedNodeId(node);
        if (!nodeId) return 'Modify operation root is missing its public node id.';
        if (!hasActiveLiteXmlNodeId(document.root, nodeId)) {
          return `Node id "${nodeId}" was not found.`;
        }
      }
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

function applyLiteXMLBatch(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  operations: ReadonlyArray<LiteXmlModifyOperation>,
): LiteXmlOperationResult[] {
  let projectedDocument = getActiveSerializedDocument();
  const afterAnchors = new Map<string, LexicalNode>();
  const results: LiteXmlOperationResult[] = [];

  operations.forEach((operation, index) => {
    const targetError = getBatchTargetError(projectedDocument, operation, dataSource);
    if (targetError) {
      results.push({ action: operation.action, index, reason: targetError, status: 'failed' });
      return;
    }

    const projection = projectOperation(
      dataSource,
      projectedDocument,
      toProjectionOperation(operation),
    );
    if (!projection) {
      results.push({
        action: operation.action,
        index,
        reason: 'The operation would create an invalid nested review diff.',
        status: 'failed',
      });
      return;
    }

    try {
      let applied = false;
      let insertedNode: LexicalNode | null = null;
      switch (operation.action) {
        case 'modify': {
          applied = handleModify(editor, dataSource, toArrayXml(operation.litexml), true);
          break;
        }
        case 'remove': {
          applied = handleRemove(editor, operation.id, true);
          break;
        }
        case 'insert': {
          const override = 'afterId' in operation ? afterAnchors.get(operation.afterId) : undefined;
          insertedNode = handleInsert(editor, { ...operation, delay: true }, dataSource, override);
          applied = insertedNode !== null;
          if ('afterId' in operation && insertedNode) {
            afterAnchors.set(operation.afterId, insertedNode);
          }
          break;
        }
      }

      if (!applied) {
        results.push({
          action: operation.action,
          index,
          reason: 'The editor could not apply the operation.',
          status: 'failed',
        });
        return;
      }

      projectedDocument = getActiveSerializedDocument();
      results.push({ action: operation.action, index, status: 'applied' });
    } catch (error) {
      results.push({
        action: operation.action,
        index,
        reason: error instanceof Error ? error.message : String(error),
        status: 'failed',
      });
    }
  });

  return results;
}

function tryParseChild(child: any, editor: LexicalEditor) {
  try {
    const nodeId = typeof child.id === 'string' ? child.id : child.$?.properties?.nodeId;
    const oldNode = typeof nodeId === 'string' ? $findNodeById(nodeId) : null;
    const newNode = $parseSerializedNodeImpl(child, editor);
    return { newNode, oldNode } as { newNode: LexicalNode; oldNode: LexicalNode | null };
  } catch (error) {
    logger.error('❌ Error parsing child node:', error);
    return { newNode: null, oldNode: null } as any;
  }
}
function handleReplaceForApplyDelay(
  oldNode: LexicalNode,
  newNode: LexicalNode,
  modifyBlockNodes: Set<string>,
  diffNodeMap: Map<string, DiffNode>,
  editor: LexicalEditor,
): boolean {
  if ($isTableRowNode(oldNode) || $isTableRowNode(newNode)) {
    if (
      !$isTableRowNode(oldNode) ||
      !$isTableRowNode(newNode) ||
      !$isTableNode(oldNode.getParent()) ||
      !$areTableRowStructuresCompatible(oldNode, newNode)
    ) {
      logger.error(`❌ Invalid table row modification for row ${oldNode.getKey()}.`);
      return false;
    }

    const changeId = `${oldNode.getKey()}:${newNode.getKey()}`;
    const removeRow = $createTableRowDiffFromRow(editor, oldNode, 'remove', changeId);
    const addRow = $createTableRowDiffFromRow(editor, newNode, 'add', changeId);
    oldNode.replace(removeRow, false);
    removeRow.insertAfter(addRow);
    return true;
  }

  if ($isTableCellNode(oldNode) && $isTableCellNode(newNode)) {
    const existingDiff = oldNode.getChildren().find($isDiffNode);
    if (existingDiff) {
      if ($isTableCellDiffNode(oldNode)) {
        existingDiff.clear();
        newNode.getChildren().forEach((child) => {
          existingDiff.append($cloneNode(child, editor));
        });
        return true;
      }

      const after = existingDiff
        .getChildren()
        .find((child) => $isDiffContentNode(child) && child.side === 'after');
      if (existingDiff.diffType === 'modify' && after && $isDiffContentNode(after)) {
        after.clear();
        newNode.getChildren().forEach((child) => {
          after.append($cloneNode(child, editor));
        });
        return true;
      }
    }

    const before = $createDiffContentNode('before');
    const after = $createDiffContentNode('after');
    oldNode.getChildren().forEach((child) => before.append(child));
    newNode.getChildren().forEach((child) => after.append($cloneNode(child, editor)));

    const diffNode = $createDiffNode('modify');
    diffNode.append(before, after);
    oldNode.clear();
    oldNode.append(diffNode);
    return true;
  }

  const oldBlock = $closest(oldNode, (node) => node.isInline() === false);
  if (!oldBlock) {
    throw new Error('Old block node not found for diffing.');
  }
  const originDiffNode = $closest(
    oldNode,
    (node) => node.getType() === DiffNode.getType(),
  ) as DiffNode;
  if (originDiffNode) {
    oldNode.replace(newNode, false);
    return true;
  }
  if ($isListItemNode(oldNode) && $isListItemNode(newNode)) {
    const existingListDiff = oldNode.getChildren().find($isDiffNode);
    if (existingListDiff?.diffType === 'listItemModify') {
      const after = existingListDiff.getChildAtIndex(1);
      if ($isElementNode(after)) {
        after.clear();
        newNode.getChildren().forEach((child) => after.append($cloneNode(child, editor)));
        return true;
      }
    }
    if (existingListDiff?.diffType === 'listItemAdd') {
      existingListDiff.clear();
      newNode.getChildren().forEach((child) => existingListDiff.append($cloneNode(child, editor)));
      return true;
    }
    const before = $createParagraphNode();
    const after = $createParagraphNode();
    oldNode.getChildren().forEach((child) => before.append(child));
    newNode.getChildren().forEach((child) => after.append(child));
    oldNode.clear();
    oldNode.append($createDiffNode('listItemModify').append(before, after));
    return true;
  }
  if (oldNode === oldBlock) {
    const diffNode = $createDiffNode('modify');
    oldNode.replace(diffNode, false);
    // Adjacent lists merge during normalization unless each side is wrapped.
    diffNode.append(
      $createDiffContentNode('before').append(oldBlock),
      $createDiffContentNode('after').append(newNode),
    );
    return true;
  } else {
    if (!modifyBlockNodes.has(oldBlock.getKey())) {
      modifyBlockNodes.add(oldBlock.getKey());
      const diffNode = $createDiffNode('modify');
      diffNode.append($cloneNode(oldBlock, editor));
      diffNodeMap.set(oldBlock.getKey(), diffNode);
    }
    oldNode.replace(newNode, false);
    return true;
  }
}

function finalizeModifyBlocks(
  modifyBlockNodes: Set<string>,
  diffNodeMap: Map<string, DiffNode>,
  editor: LexicalEditor,
) {
  for (const blockNodeKey of modifyBlockNodes) {
    const blockNode = $getNodeByKey(blockNodeKey);
    const diffNode = diffNodeMap.get(blockNodeKey);
    if (diffNode && blockNode) {
      // 如果是列表项，可能需要特殊处理
      if (blockNode.getType() === 'listitem' && $isElementNode(blockNode)) {
        const newDiffNode = $createDiffNode('listItemModify');
        const firstChild = diffNode.getFirstChild();
        if (firstChild && $isElementNode(firstChild)) {
          newDiffNode.append(firstChild);
        }
        const children = blockNode.getChildren();
        const p = $createParagraphNode();
        children.forEach((child) => {
          child.remove();
          p.append(child);
        });
        newDiffNode.append(p);
        blockNode.append(newDiffNode);
        continue;
      } else if (
        $isTableCellNode(blockNode) &&
        $isTableRowNode(blockNode.getParent()) &&
        $isTableCellNode(diffNode.getFirstChild())
      ) {
        const beforeCell = diffNode.getFirstChild();
        if (!$isTableCellNode(beforeCell)) continue;
        const before = $createDiffContentNode('before');
        const after = $createDiffContentNode('after');
        beforeCell.getChildren().forEach((child) => before.append(child));
        blockNode.getChildren().forEach((child) => after.append($cloneNode(child, editor)));
        blockNode.clear();
        blockNode.append($createDiffNode('modify').append(before, after));
        continue;
      } else {
        diffNode.append($cloneNode(blockNode, editor));
        blockNode.replace(diffNode, false);
      }
    }
  }
}

/**
 * Wrap a block-level change with a `modify` diff: clone the old block, run the
 * provided changeFn (which should mutate nodes inside the block), then clone
 * the new block and replace it with the diff node. Useful for inline->block
 * transitions where we want to show a modify diff.
 */
function wrapBlockModify(oldBlock: LexicalNode, editor: LexicalEditor, changeFn: () => void) {
  if ($isListItemNode(oldBlock)) {
    const diffNode = $createDiffNode('listItemModify');
    const p = $createParagraphNode();
    oldBlock.getChildren().forEach((child) => {
      p.append($cloneNode(child, editor));
    });
    changeFn();
    diffNode.append(p);
    const pNew = $createParagraphNode();
    oldBlock.getChildren().forEach((child) => {
      pNew.append(child);
    });
    diffNode.append(pNew);
    oldBlock.append(diffNode);
    return;
  }
  if (
    $isTableCellNode(oldBlock) &&
    !$isTableCellDiffNode(oldBlock) &&
    $isTableRowNode(oldBlock.getParent())
  ) {
    const before = $createDiffContentNode('before');
    oldBlock.getChildren().forEach((child) => before.append($cloneNode(child, editor)));
    changeFn();
    const newBlock = $getNodeByKey(oldBlock.getKey());
    if (!$isTableCellNode(newBlock)) {
      throw new Error('Updated table cell node not found for modify wrapper.');
    }
    const after = $createDiffContentNode('after');
    newBlock.getChildren().forEach((child) => after.append($cloneNode(child, editor)));
    newBlock.clear();
    newBlock.append($createDiffNode('modify').append(before, after));
    return;
  }
  const diffNode = $createDiffNode('modify');
  diffNode.append($cloneNode(oldBlock, editor));
  changeFn();
  const newBlock = $getNodeByKey(oldBlock.getKey());
  if (!newBlock) {
    throw new Error('New block node not found for modify wrapper.');
  }
  diffNode.append($cloneNode(newBlock, editor));
  newBlock.replace(diffNode, false);
}

export function registerLiteXMLCommand(editor: LexicalEditor, dataSource: LitexmlDataSource) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_MODIFY_COMMAND,
      (operations) => {
        applyLiteXMLBatch(editor, dataSource, operations);
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_MODIFY_WITH_RESULTS_COMMAND,
      ({ operations, onResults }) => {
        onResults(applyLiteXMLBatch(editor, dataSource, operations));
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_APPLY_COMMAND,
      (payload) => {
        const { litexml, delay } = payload;
        const arrayXml = toArrayXml(litexml);
        if (!delay) {
          handleModify(editor, dataSource, arrayXml, delay);
          return false;
        }

        const operation = { action: 'modify' as const, litexml };
        const document = getActiveSerializedDocument();
        if (projectOperation(dataSource, document, toProjectionOperation(operation))) {
          handleModify(editor, dataSource, arrayXml, delay);
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_REMOVE_COMMAND,
      (payload) => {
        const { id, delay } = payload;
        if (!delay) {
          handleRemove(editor, id, delay);
          return false;
        }

        const operation = { action: 'remove' as const, id };
        const document = getActiveSerializedDocument();
        if (projectOperation(dataSource, document, toProjectionOperation(operation))) {
          handleRemove(editor, id, delay);
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_INSERT_COMMAND,
      (payload) => {
        if (!payload.delay) {
          handleInsert(editor, payload, dataSource);
          return false;
        }

        const document = getActiveSerializedDocument();
        if (
          projectOperation(
            dataSource,
            document,
            toProjectionOperation({
              action: 'insert',
              ...payload,
            }),
          )
        ) {
          handleInsert(editor, payload, dataSource);
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
  );
}

function handleModify(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  arrayXml: string[],
  delay?: boolean,
): boolean {
  let applied = false;
  if (delay) {
    const modifyBlockNodes = new Set<string>();
    const diffNodeMap = new Map<string, DiffNode>();
    arrayXml.forEach((xml) => {
      const inode = dataSource.readLiteXMLToInode(xml);
      inode.root.children.forEach((child: any) => {
        try {
          const { oldNode, newNode } = tryParseChild(child, editor);
          if (oldNode && newNode) {
            applied =
              handleReplaceForApplyDelay(oldNode, newNode, modifyBlockNodes, diffNodeMap, editor) ||
              applied;
          } else {
            logger.warn(`⚠️ Node with key ${child.id} not found for diffing.`);
          }
        } catch (error) {
          logger.error('❌ Error replacing node:', error);
        }
      });
    });
    // replace modified block nodes with diff nodes
    finalizeModifyBlocks(modifyBlockNodes, diffNodeMap, editor);
    applied ||= modifyBlockNodes.size > 0;
  } else {
    arrayXml.forEach((xml) => {
      const inode = dataSource.readLiteXMLToInode(xml);
      let prevNode: LexicalNode | null = null;
      inode.root.children.forEach((child: any) => {
        try {
          const { oldNode, newNode } = tryParseChild(child, editor);
          if (oldNode && newNode) {
            prevNode = oldNode.replace(newNode, false);
            applied = true;
          } else if (newNode) {
            if (prevNode) {
              if (!newNode.isInline()) {
                const prevBlock = $closest(prevNode, (node) => node.isInline() === false);
                if (prevBlock) {
                  prevNode = prevBlock.insertAfter(newNode);
                } else {
                  $insertNodes([newNode]);
                  prevNode = newNode;
                }
                applied = true;
              } else {
                prevNode = prevNode.insertAfter(newNode);
                applied = true;
              }
            } else {
              $insertNodes([newNode]);
              applied = true;
            }
          }
        } catch (error) {
          logger.error('❌ Error replacing node:', error);
        }
      });
    });
  }
  return applied;
}

function handleRemove(editor: LexicalEditor, nodeId: string, delay?: boolean): boolean {
  let applied = false;
  const node = $findNodeById(nodeId);
  if (!node) return false;

  if (!delay) {
    if ($isTableCellNode(node)) {
      const table = $getTableForCell(node);
      const columnIndex = $getTableCellColumnIndex(node);
      const span = node.getColSpan();
      node.remove();
      applied = true;
      if (table && columnIndex >= 0) {
        $shrinkTableWidthsAfterCellRemoval(table, columnIndex, span);
      }
      return true;
    }
    node.remove();
    applied = true;
    return true;
  }

  if ($isTableCellNode(node)) {
    const table = $getTableForCell(node);
    const columnIndex = $getTableCellColumnIndex(node);
    if (!table || columnIndex < 0) {
      logger.error(`❌ Table cell ${node.getKey()} is not attached to a valid table row.`);
      return false;
    }
    const changeId = `${table.getKey()}:column:${columnIndex}`;
    node.replace($createTableCellDiffFromCell(editor, node, 'remove', changeId), false);
    applied = true;
    return true;
  }

  if ($isTableRowNode(node) && $isTableNode(node.getParent())) {
    node.replace($createTableRowDiffFromRow(editor, node, 'remove'), false);
    applied = true;
    return true;
  }

  // delay removal: show a diff
  if (node.isInline() === false) {
    const originDiffNode = $closest(
      node,
      (node) => node.getType() === DiffNode.getType(),
    ) as DiffNode;
    if (originDiffNode) {
      switch (originDiffNode.diffType) {
        case 'add': {
          originDiffNode.remove();
          applied = true;
          return true;
        }
        case 'modify': {
          const children = originDiffNode.getChildren();
          const newDiff = $createDiffNode('remove');
          const before = children[0];
          newDiff.append(...($isDiffContentNode(before) ? before.getChildren() : [before]));
          originDiffNode.replace(newDiff, false);
          applied = true;
          return true;
        }
        case 'listItemModify': {
          const children = originDiffNode.getChildren();
          originDiffNode.replace(children[0], false).selectEnd();
          applied = true;
          return true;
        }
        case 'remove':
        case 'unchanged': {
          // do nothing special
          break;
        }
      }
      return false;
    }

    if ($isListItemNode(node)) {
      const diffNode = $createDiffNode('listItemRemove');
      node.getChildren().forEach((child) => {
        diffNode.append($cloneNode(child, editor));
      });
      node.clear();
      node.append(diffNode);
      applied = true;
    } else {
      const diffNode = $createDiffNode('remove');
      diffNode.append($cloneNode(node, editor));
      node.replace(diffNode, false);
      applied = true;
    }
  } else {
    const oldBlock = $closest(node, (node) => node.isInline() === false);
    if (!oldBlock) {
      throw new Error('Old block node not found for removal.');
    }
    const originDiffNode = $closest(
      node,
      (node) => node.getType() === DiffNode.getType(),
    ) as DiffNode;
    if (originDiffNode) {
      node.remove();
      applied = true;
      return true;
    }
    // wrap changes inside a modify diff
    wrapBlockModify(oldBlock, editor, () => {
      node.remove();
    });
    applied = true;
  }
  return applied;
}

function handleInsert(
  editor: LexicalEditor,
  payload:
    | {
        beforeId: string;
        delay?: boolean;
        litexml: string;
      }
    | {
        afterId: string;
        delay?: boolean;
        litexml: string;
      },
  dataSource: LitexmlDataSource,
  referenceNodeOverride?: LexicalNode,
): LexicalNode | null {
  const { litexml, delay } = payload;
  const isBefore = 'beforeId' in payload;
  const inode = dataSource.readLiteXMLToInode(litexml);
  let insertedNode: LexicalNode | null = null;

  try {
    let referenceNode: LexicalNode | null = referenceNodeOverride || null;
    if (!referenceNode) {
      if (isBefore) {
        if (payload.beforeId === 'root') {
          referenceNode = $getRoot().getFirstChild();
        } else {
          referenceNode = $findNodeById(payload.beforeId);
        }
      } else {
        if (payload.afterId === 'root') {
          referenceNode = $getRoot().getLastChild();
        } else {
          referenceNode = $findNodeById(payload.afterId);
        }
      }
    }

    if (!referenceNode) {
      throw new Error('Reference node not found for insertion.');
    }

    const newNodes = inode.root.children.map((child: any) =>
      $parseSerializedNodeImpl(child, editor),
    );
    $ensureUniqueNodeIds(newNodes);

    const referencesTableCell = $isTableCellNode(referenceNode);
    const insertsOnlyTableCells = newNodes.length > 0 && newNodes.every($isTableCellNode);
    if (referencesTableCell || insertsOnlyTableCells) {
      if (!referencesTableCell || !insertsOnlyTableCells) {
        logger.error('❌ Table cells can only be inserted next to another cell in the same row.');
        return null;
      }
      const cellReference = referenceNode as AnyTableCell;
      const table = $getTableForCell(cellReference);
      const referenceIndex = $getTableCellColumnIndex(cellReference);
      if (!table || referenceIndex < 0) {
        logger.error('❌ Table cell insertion requires a valid table parent.');
        return null;
      }
      const rowWidthBefore = $getLogicalRowWidth(cellReference);
      const insertionIndex = isBefore
        ? referenceIndex
        : referenceIndex + cellReference.getColSpan();
      const insertedSpan = newNodes.reduce(
        (total: number, node: LexicalNode) =>
          total + ($isTableCellNode(node) ? node.getColSpan() : 0),
        0,
      );
      $updateTableWidthsForCellInsertion(table, rowWidthBefore, insertionIndex, insertedSpan);

      let spanOffset = 0;
      const cells = (newNodes as AnyTableCell[]).map((node) => {
        const result = delay
          ? $createTableCellDiffFromCell(
              editor,
              node,
              'add',
              `${table.getKey()}:column:${insertionIndex + spanOffset}`,
            )
          : node;
        spanOffset += node.getColSpan();
        return result;
      });
      if (isBefore) {
        cells.reverse().forEach((cell: LexicalNode) => {
          referenceNode = referenceNode!.insertBefore(cell);
        });
      } else {
        cells.forEach((cell: LexicalNode) => {
          referenceNode = referenceNode!.insertAfter(cell);
        });
      }
      insertedNode = referenceNode;
      return insertedNode;
    }

    if (!delay) {
      if (isBefore) {
        newNodes.reverse().forEach((node: LexicalNode) => {
          referenceNode = referenceNode!.insertBefore(node);
        });
      } else {
        newNodes.forEach((node: LexicalNode) => {
          if (referenceNode) {
            referenceNode = referenceNode.insertAfter(node);
          }
        });
      }
      insertedNode = referenceNode;
      return insertedNode;
    }

    const referencesTableRow = $isTableRowNode(referenceNode);
    const insertsOnlyTableRows = newNodes.every($isTableRowNode);
    if (referencesTableRow || insertsOnlyTableRows) {
      if (
        !referencesTableRow ||
        !insertsOnlyTableRows ||
        !$isTableNode(referenceNode.getParent())
      ) {
        logger.error('❌ Table rows can only be inserted next to another row in the same table.');
        return null;
      }

      if (isBefore) {
        newNodes.reverse().forEach((node: LexicalNode) => {
          if (!$isTableRowNode(node)) return;
          const diffRow = $createTableRowDiffFromRow(editor, node, 'add');
          referenceNode = referenceNode!.insertBefore(diffRow);
        });
      } else {
        newNodes.forEach((node: LexicalNode) => {
          if (!$isTableRowNode(node)) return;
          const diffRow = $createTableRowDiffFromRow(editor, node, 'add');
          referenceNode = referenceNode!.insertAfter(diffRow);
        });
      }
      insertedNode = referenceNode;
      return insertedNode;
    }

    // delay insertion: show diffs or wrap block modifications
    if (isBefore) {
      if (referenceNode.isInline() === false) {
        const originDiffNode = $closest(
          referenceNode,
          (node) => node.getType() === DiffNode.getType(),
        );
        if (originDiffNode) {
          referenceNode = originDiffNode;
        }
        const diffNodes = newNodes.map((node: LexicalNode) => {
          if ($isListItemNode(node)) {
            const diffNode = $createDiffNode('listItemAdd');
            node.getChildren().forEach((child) => diffNode.append(child));
            return node.append(diffNode);
          }
          const diffNode = $createDiffNode('add');
          diffNode.append(node);
          return diffNode;
        });
        diffNodes.reverse().forEach((diffNode: LexicalNode) => {
          if (referenceNode) {
            referenceNode = referenceNode.insertBefore(diffNode);
          }
        });
      } else {
        const refBlock = $closest(referenceNode, (node) => node.isInline() === false);
        if (!refBlock) {
          throw new Error('Reference block node not found for insertion.');
        }
        const originDiffNode = $closest(
          referenceNode,
          (node) => node.getType() === DiffNode.getType(),
        );
        if (originDiffNode) {
          // 可能是 modify / add，那么直接修改就好了
          newNodes.forEach((node: LexicalNode) => {
            if (referenceNode) {
              referenceNode = referenceNode.insertBefore(node);
            }
          });
        } else {
          wrapBlockModify(refBlock, editor, () => {
            newNodes.forEach((node: LexicalNode) => {
              if (referenceNode) {
                referenceNode = referenceNode.insertBefore(node);
              }
            });
          });
        }
      }
    } else {
      if (referenceNode.isInline() === false) {
        const originDiffNode = $closest(
          referenceNode,
          (node) => node.getType() === DiffNode.getType(),
        );
        if (originDiffNode) {
          referenceNode = originDiffNode;
        }
        newNodes.forEach((node: LexicalNode) => {
          if (referenceNode) {
            if ($isListItemNode(node)) {
              const diffNode = $createDiffNode('listItemAdd');
              node.getChildren().forEach((child) => {
                diffNode.append(child);
              });
              node.append(diffNode);
              referenceNode = referenceNode.insertAfter(node);
            } else {
              const diffNode = $createDiffNode('add');
              diffNode.append(node);
              referenceNode = referenceNode.insertAfter(diffNode);
            }
          }
        });
      } else {
        const refBlock = $closest(referenceNode, (node) => node.isInline() === false);
        if (!refBlock) {
          throw new Error('Reference block node not found for insertion.');
        }
        const originDiffNode = $closest(
          referenceNode,
          (node) => node.getType() === DiffNode.getType(),
        );
        if (originDiffNode) {
          // 可能是 modify / add，那么直接修改就好了
          newNodes.forEach((node: LexicalNode) => {
            if (referenceNode) {
              referenceNode = referenceNode.insertAfter(node);
            }
          });
        } else {
          wrapBlockModify(refBlock, editor, () => {
            newNodes.forEach((node: LexicalNode) => {
              if (referenceNode) {
                referenceNode = referenceNode.insertAfter(node);
              }
            });
          });
        }
      }
    }
    insertedNode = referenceNode;
  } catch (error) {
    logger.error('❌ Error inserting node:', error);
  }
  return insertedNode;
}

// Command identities live in the side-effect-free `./symbols` module so they
// keep a single runtime identity across the package's browser/node bundles.
export type { LiteXmlModifyOperation, LiteXmlOperationResult } from './symbols';
export {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_MODIFY_WITH_RESULTS_COMMAND,
  LITEXML_REMOVE_COMMAND,
} from './symbols';
