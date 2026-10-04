import { $isListItemNode, $isListNode } from '@lexical/list';
import { $isTableCellNode, $isTableNode, $isTableRowNode } from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isNodeSelection,
  COMMAND_PRIORITY_EDITOR,
} from 'lexical';

import { $closest, getKernelFromEditor } from '@/editor-kernel';
import { $ensureUniqueNodeIds, $findNodeById, $getNodeId } from '@/plugins/common/node/node-id';
import { exportNodeToJSON } from '@/plugins/common/utils';
import { IAnnotationService } from '@/plugins/properties/service';
import { $getNodeProperties, $setNodeProperties, createNodeId } from '@/plugins/properties/state';
import {
  $ensureNodeId,
  $isNodeIdentityTarget,
  $markNodesAsAIGenerated,
  $preserveNodeIdentity,
} from '@/plugins/properties/utils';
import { createDebugLogger } from '@/utils/debug';

import type LitexmlDataSource from '../data-source/litexml-data-source';
import {
  findNewIllegalDiffPaths,
  hasActiveLiteXmlNodeId,
  type LiteXmlProjectionOperation,
  projectLiteXmlOperation,
  type SerializedDiffDocument,
  type SerializedDiffTreeNode,
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
  type LiteXMLRewriteMetadata,
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
  readXml: (xml: string) => { root?: { children?: SerializedDiffTreeNode[] } } = (xml) =>
    dataSource.readLiteXMLToInode(xml),
): SerializedDiffDocument | null {
  try {
    const projected = projectLiteXmlOperation(document, operation, readXml);
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
  const nodeId = node?.$?.properties?.nodeId;
  if (typeof nodeId === 'string' && nodeId.length > 0) return nodeId;
  if (typeof node?.id === 'string' && node.id.length > 0) return node.id;
  return typeof node?.id === 'number' ? String(node.id) : undefined;
}

function getActiveSerializedDocument(): SerializedDiffDocument {
  return { root: exportNodeToJSON($getRoot()) as SerializedDiffDocument['root'] };
}

interface PreparedModify {
  pairs: Array<{ newNode: LexicalNode; oldNode: LexicalNode }>;
  readXml: (xml: string) => { root?: { children?: SerializedDiffTreeNode[] } };
}

/** Resolve every target before staging any part of one modify operation. */
function prepareModify(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  xmls: string[],
): PreparedModify {
  const pairs: PreparedModify['pairs'] = [];
  const parsed = new Map<string, { root?: { children?: SerializedDiffTreeNode[] } }>();
  const targetIds = new Set<string>();

  for (const xml of xmls) {
    const inode = dataSource.readLiteXMLToInode(xml);
    parsed.set(xml, inode);
    const children = inode.root?.children as SerializedDiffTreeNode[] | undefined;
    if (!children?.length) throw new Error('Modify operation contains no LiteXML nodes.');

    for (const child of children) {
      const nodeId = getSerializedNodeId(child);
      if (!nodeId) throw new Error('Modify operation root is missing its public node id.');
      if (targetIds.has(nodeId)) throw new Error(`Node id "${nodeId}" is targeted more than once.`);
      targetIds.add(nodeId);

      const oldNode = resolveLiteXMLTarget({ id: nodeId }, editor);
      if (!oldNode) throw new Error(`Node id "${nodeId}" was not found.`);
      const newNode = $parseSerializedNodeImpl(child, editor);
      preserveTargetIdentity(oldNode, newNode);
      if (oldNode.isInline() !== newNode.isInline()) {
        throw new Error(`Node id "${nodeId}" cannot change between inline and block structure.`);
      }
      const parent = oldNode.getParent();
      if (
        ($isListNode(parent) || $isListItemNode(oldNode) || $isListItemNode(newNode)) &&
        (!$isListNode(parent) || !$isListItemNode(oldNode) || !$isListItemNode(newNode))
      ) {
        throw new Error(`Node id "${nodeId}" has an incompatible list-item structure.`);
      }
      if (
        ($isTableNode(parent) && (!$isTableRowNode(oldNode) || !$isTableRowNode(newNode))) ||
        ($isTableRowNode(parent) && (!$isTableCellNode(oldNode) || !$isTableCellNode(newNode))) ||
        ($isTableRowNode(newNode) && !$isTableNode(parent)) ||
        ($isTableCellNode(newNode) && !$isTableRowNode(parent))
      ) {
        throw new Error(`Node id "${nodeId}" has an incompatible table structure.`);
      }
      if (
        ($isTableRowNode(oldNode) || $isTableRowNode(newNode)) &&
        (!$isTableRowNode(oldNode) ||
          !$isTableRowNode(newNode) ||
          !$isTableNode(parent) ||
          !$areTableRowStructuresCompatible(oldNode, newNode))
      ) {
        throw new Error(`Node id "${nodeId}" has an incompatible table row structure.`);
      }
      pairs.push({ newNode, oldNode });
    }
  }

  const targetKeys = new Set(pairs.map(({ oldNode }) => oldNode.getKey()));
  for (const { oldNode } of pairs) {
    for (let parent = oldNode.getParent(); parent; parent = parent.getParent()) {
      if (targetKeys.has(parent.getKey())) {
        throw new Error('Modify operation targets overlapping ancestor and descendant nodes.');
      }
    }
  }

  return { pairs, readXml: (xml) => parsed.get(xml)! };
}

function getBatchTargetError(
  editor: LexicalEditor,
  document: SerializedDiffDocument,
  operation: LiteXmlModifyOperation,
  dataSource: LitexmlDataSource,
): string | undefined {
  if (operation.action === 'remove') {
    return hasActiveLiteXmlNodeId(document.root, operation.id) ||
      hasCurrentTarget(editor, operation.id)
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
    return hasActiveLiteXmlNodeId(document.root, anchorId) || hasCurrentTarget(editor, anchorId)
      ? undefined
      : `Insertion anchor "${anchorId}" was not found.`;
  }

  return undefined;
}

function applyLiteXMLBatch(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  operations: ReadonlyArray<LiteXmlModifyOperation>,
  batchMetadata?: LiteXMLRewriteMetadata,
): LiteXmlOperationResult[] {
  let projectedDocument = getActiveSerializedDocument();
  const afterAnchors = new Map<string, string[]>();
  const results: LiteXmlOperationResult[] = [];

  operations.forEach((operation, index) => {
    const metadata = getRewriteMetadata(operation) ?? batchMetadata;
    const targetError = getBatchTargetError(editor, projectedDocument, operation, dataSource);
    if (targetError) {
      results.push({ action: operation.action, index, reason: targetError, status: 'failed' });
      return;
    }

    let preparedModify: PreparedModify | undefined;
    if (operation.action === 'modify') {
      try {
        preparedModify = prepareModify(editor, dataSource, toArrayXml(operation.litexml));
      } catch (error) {
        results.push({
          action: operation.action,
          index,
          reason: error instanceof Error ? error.message : String(error),
          status: 'failed',
        });
        return;
      }
    }

    const projection = projectOperation(
      dataSource,
      projectedDocument,
      toProjectionOperation(operation),
      preparedModify?.readXml,
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
      switch (operation.action) {
        case 'modify': {
          applied = applyPreparedModify(editor, preparedModify!, metadata);
          break;
        }
        case 'remove': {
          applied = handleRemove(editor, operation.id, true, metadata);
          break;
        }
        case 'insert': {
          const cursorIds =
            'afterId' in operation ? afterAnchors.get(operation.afterId) : undefined;
          let override: LexicalNode | undefined;
          if (cursorIds) {
            for (let cursorIndex = cursorIds.length - 1; cursorIndex >= 0; cursorIndex--) {
              const cursor = $findNodeById(cursorIds[cursorIndex]);
              if (cursor) {
                override = cursor;
                break;
              }
            }
          }
          const insertedNodeId = handleInsert(
            editor,
            { ...operation, delay: true },
            dataSource,
            metadata,
            override,
          );
          applied = insertedNodeId !== null;
          if ('afterId' in operation && insertedNodeId) {
            const nextCursors = afterAnchors.get(operation.afterId) || [];
            nextCursors.push(insertedNodeId);
            afterAnchors.set(operation.afterId, nextCursors);
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
    const oldNode = resolveLiteXMLTarget(child, editor);
    const newNode = $parseSerializedNodeImpl(child, editor);
    if (oldNode && newNode) preserveTargetIdentity(oldNode, newNode);
    return { newNode, oldNode } as { newNode: LexicalNode; oldNode: LexicalNode | null };
  } catch (error) {
    logger.error('❌ Error parsing child node:', error);
    return { newNode: null, oldNode: null } as any;
  }
}

/** Resolve a production LiteXML target by NodeState identity first. */
function resolveLiteXMLTarget(serializedNode: unknown, _editor: LexicalEditor): LexicalNode | null {
  const node = serializedNode as {
    id?: unknown;
    $?: { properties?: { nodeId?: unknown } };
  };
  const stableId = node.$?.properties?.nodeId;
  const directId =
    typeof stableId === 'string' && stableId.length > 0
      ? stableId
      : typeof node.id === 'string' || typeof node.id === 'number'
        ? String(node.id)
        : undefined;
  return directId ? $findNodeById(directId) : null;
}

const getSerializedTargetId = (serializedNode: unknown): string | number | undefined => {
  const node = serializedNode as {
    id?: unknown;
    $?: { properties?: { nodeId?: unknown } };
  };
  const nodeId = node.$?.properties?.nodeId;
  if (typeof nodeId === 'string' && nodeId.length > 0) return nodeId;
  if (typeof node.id === 'string' || typeof node.id === 'number') return node.id;
  return undefined;
};

/** Resolve a command target in a read transaction before scheduling an update. */
function hasCurrentTarget(editor: LexicalEditor, id: string | number): boolean {
  let found = false;
  editor.getEditorState().read(
    () => {
      found = Boolean(resolveLiteXMLTarget({ id }, editor));
    },
    { editor },
  );
  return found;
}

/** Preserve the identity (and existing comment anchors) across replacements. */
function preserveTargetIdentity(source: LexicalNode, replacement: LexicalNode): void {
  $preserveNodeIdentity(source, replacement);
}

/** Ensure inserted XML cannot alias a node already present in the document. */
function ensureInsertedNodeIds(node: LexicalNode, enabled: boolean): void {
  if (enabled && $isNodeIdentityTarget(node)) {
    const current = $getNodeId(node);
    if (!current || $findNodeById(current)) {
      const properties = $getNodeProperties(node);
      $setNodeProperties(node, { ...properties, nodeId: createNodeId() });
    }
  }
  if ($isElementNode(node)) {
    node.getChildren().forEach((child) => ensureInsertedNodeIds(child, enabled));
  }
}

const getRewriteMetadata = (payload: unknown): LiteXMLRewriteMetadata | undefined => {
  if (!payload || (typeof payload !== 'object' && typeof payload !== 'function')) return undefined;
  const value = payload as Record<string, unknown>;
  const metadata: LiteXMLRewriteMetadata = {};
  if (typeof value.requestId === 'string' && value.requestId.length > 0) {
    metadata.requestId = value.requestId;
  }
  if (typeof value.commandId === 'string' && value.commandId.length > 0) {
    metadata.commandId = value.commandId;
  }
  if (typeof value.createdAt === 'string' && value.createdAt.length > 0) {
    metadata.createdAt = value.createdAt;
  }
  if (typeof value.generationId === 'string' && value.generationId.length > 0) {
    metadata.generationId = value.generationId;
  }
  if (typeof value.model === 'string' && value.model.length > 0) metadata.model = value.model;
  if (typeof value.provider === 'string' && value.provider.length > 0) {
    metadata.provider = value.provider;
  }
  if (
    typeof value.attempt === 'number' &&
    Number.isSafeInteger(value.attempt) &&
    value.attempt > 0
  ) {
    metadata.attempt = value.attempt;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

/** Apply the request/review metadata to a persisted Diff wrapper. */
function applyRewriteMetadata(
  node: LexicalNode,
  metadata: LiteXMLRewriteMetadata | undefined,
): void {
  if (!metadata) return;
  const rewriteProperties = {
    ...(metadata.requestId ? { rewriteRequestId: metadata.requestId } : {}),
    ...(metadata.commandId ? { rewriteCommandId: metadata.commandId } : {}),
    ...(metadata.attempt === undefined ? {} : { rewriteAttempt: metadata.attempt }),
  };
  const generationId = metadata.generationId ?? metadata.requestId;
  const provenance = generationId
    ? {
        createdAt: metadata.createdAt ?? new Date().toISOString(),
        generationId,
        ...(metadata.model ? { model: metadata.model } : {}),
        ...(metadata.provider ? { provider: metadata.provider } : {}),
        ...(metadata.requestId ? { requestId: metadata.requestId } : {}),
        source: 'ai' as const,
      }
    : undefined;
  $setNodeProperties(node, (previous) => ({
    ...previous,
    ...rewriteProperties,
    ...(provenance ? { provenance } : {}),
  }));
}

function markGeneratedNodes(
  nodes: ReadonlyArray<LexicalNode>,
  metadata: LiteXMLRewriteMetadata | undefined,
): void {
  const generationId = metadata?.generationId ?? metadata?.requestId;
  if (!generationId) return;
  $markNodesAsAIGenerated(nodes, {
    createdAt: metadata?.createdAt,
    generationId,
    model: metadata?.model,
    provider: metadata?.provider,
    requestId: metadata?.requestId,
  });
}

/** Pairing tokens are persisted, so they must be opaque and key-independent. */
function createOpaqueChangeId(): string {
  // A pair only needs an opaque durable token. Keep the row ID out of the
  // token so even a legacy/non-durable row cannot smuggle a runtime key into
  // persisted JSON/Yjs metadata.
  return createNodeId();
}

function createTableColumnChangeId(table: LexicalNode, columnIndex: number): string {
  const tableId = $getNodeId(table) ?? $ensureNodeId(table) ?? createNodeId();
  return `table:${tableId}:column:${columnIndex}`;
}

/** Keep pending review-only before nodes private; the active after node owns the durable ID. */
function assignPendingNodeIdentity(node: LexicalNode): string {
  const nodeId = createNodeId();
  const properties = $getNodeProperties(node);
  $setNodeProperties(node, { ...properties, nodeId });
  return nodeId;
}

/** Detect a caret/selection anchored inside a subtree before replacing it. */
function selectionIsWithinNode(node: LexicalNode): boolean {
  const selection = $getSelection();
  if (!selection) return false;

  const selectedNodes = $isNodeSelection(selection)
    ? selection.getNodes()
    : (selection.getStartEndPoints()?.map((point) => point.getNode()) ?? []);
  return selectedNodes.some((selectedNode) => {
    for (let current: LexicalNode | null = selectedNode; current; current = current.getParent()) {
      if (current.is(node)) return true;
    }
    return false;
  });
}

function handleReplaceForApplyDelay(
  oldNode: LexicalNode,
  newNode: LexicalNode,
  modifyBlockNodes: Set<string>,
  diffNodeMap: Map<string, DiffNode>,
  editor: LexicalEditor,
  metadata?: LiteXMLRewriteMetadata,
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

    const restoreSelection = selectionIsWithinNode(oldNode);
    const changeId = createOpaqueChangeId();
    const removeRow = $createTableRowDiffFromRow(editor, oldNode, 'remove', changeId);
    const addRow = $createTableRowDiffFromRow(editor, newNode, 'add', changeId);
    applyRewriteMetadata(removeRow, metadata);
    applyRewriteMetadata(addRow, metadata);
    markGeneratedNodes(addRow.getChildren(), metadata);
    oldNode.replace(removeRow, false);
    removeRow.insertAfter(addRow);
    if (restoreSelection) addRow.selectEnd();
    return true;
  }

  if ($isTableCellNode(oldNode) && $isTableCellNode(newNode)) {
    const restoreSelection = selectionIsWithinNode(oldNode);
    const existingDiff = oldNode.getChildren().find($isDiffNode);
    if (existingDiff) {
      if ($isTableCellDiffNode(oldNode)) {
        existingDiff.clear();
        newNode.getChildren().forEach((child) => {
          existingDiff.append($cloneNode(child, editor));
        });
        if (restoreSelection) existingDiff.selectEnd();
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
        if (restoreSelection) after.selectEnd();
        return true;
      }
    }

    const before = $createDiffContentNode('before');
    const after = $createDiffContentNode('after');
    oldNode.getChildren().forEach((child) => before.append(child));
    newNode.getChildren().forEach((child) => after.append($cloneNode(child, editor)));

    const diffNode = $createDiffNode('modify');
    diffNode.append(before, after);
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes(after.getChildren(), metadata);
    oldNode.clear();
    oldNode.append(diffNode);
    if (restoreSelection) diffNode.selectEnd();
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
    const restoreSelection = selectionIsWithinNode(oldNode);
    applyRewriteMetadata(originDiffNode, metadata);
    markGeneratedNodes([newNode], metadata);
    oldNode.replace(newNode, false);
    if (restoreSelection) newNode.selectEnd();
    return true;
  }
  if ($isListItemNode(oldNode) && $isListItemNode(newNode)) {
    const existingListDiff = oldNode.getChildren().find($isDiffNode);
    if (existingListDiff?.diffType === 'listItemModify') {
      const after = existingListDiff.getChildAtIndex(1);
      if ($isElementNode(after)) {
        const restoreSelection = selectionIsWithinNode(after);
        after.clear();
        newNode.getChildren().forEach((child) => after.append($cloneNode(child, editor)));
        applyRewriteMetadata(existingListDiff, metadata);
        markGeneratedNodes(after.getChildren(), metadata);
        if (restoreSelection) after.selectEnd();
        return true;
      }
    }
    if (existingListDiff?.diffType === 'listItemAdd') {
      const restoreSelection = selectionIsWithinNode(existingListDiff);
      existingListDiff.clear();
      newNode.getChildren().forEach((child) => existingListDiff.append($cloneNode(child, editor)));
      applyRewriteMetadata(existingListDiff, metadata);
      markGeneratedNodes(existingListDiff.getChildren(), metadata);
      if (restoreSelection) existingListDiff.selectEnd();
      return true;
    }
    const before = $createParagraphNode();
    const after = $createParagraphNode();
    const restoreSelection = selectionIsWithinNode(oldNode);
    oldNode.getChildren().forEach((child) => before.append(child));
    newNode.getChildren().forEach((child) => after.append(child));
    oldNode.clear();
    const diffNode = $createDiffNode('listItemModify').append(before, after);
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes(after.getChildren(), metadata);
    oldNode.append(diffNode);
    if (restoreSelection) diffNode.selectEnd();
    return true;
  }
  if (oldNode === oldBlock) {
    const restoreSelection = selectionIsWithinNode(oldNode);
    const before = $cloneNode(oldBlock, editor);
    const originalNodeId = $getNodeId(oldBlock);
    if (originalNodeId) assignPendingNodeIdentity(before);
    const diffNode = $createDiffNode('modify');
    if (originalNodeId) {
      $setNodeProperties(diffNode, {
        rewriteIdentityMap: [{ afterIndex: 1, beforeIndex: 0, nodeId: originalNodeId }] as any,
      });
    }
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes([newNode], metadata);
    diffNode.append(
      $createDiffContentNode('before').append(before),
      $createDiffContentNode('after').append(newNode),
    );
    oldNode.replace(diffNode, false);
    if (restoreSelection) diffNode.selectEnd();
    return true;
  } else {
    if (!modifyBlockNodes.has(oldBlock.getKey())) {
      modifyBlockNodes.add(oldBlock.getKey());
      const diffNode = $createDiffNode('modify');
      diffNode.append($cloneNode(oldBlock, editor));
      diffNodeMap.set(oldBlock.getKey(), diffNode);
    }
    const restoreSelection = selectionIsWithinNode(oldNode);
    oldNode.replace(newNode, false);
    if (restoreSelection) newNode.selectEnd();
    return true;
  }
}

function finalizeModifyBlocks(
  modifyBlockNodes: Set<string>,
  diffNodeMap: Map<string, DiffNode>,
  editor: LexicalEditor,
  metadata?: LiteXMLRewriteMetadata,
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
        applyRewriteMetadata(newDiffNode, metadata);
        markGeneratedNodes(p.getChildren(), metadata);
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
        const restoreSelection = selectionIsWithinNode(blockNode);
        blockNode.clear();
        const cellDiff = $createDiffNode('modify').append(before, after);
        applyRewriteMetadata(cellDiff, metadata);
        markGeneratedNodes(after.getChildren(), metadata);
        blockNode.append(cellDiff);
        if (restoreSelection) cellDiff.selectEnd();
        continue;
      } else {
        const after = $cloneNode(blockNode, editor);
        const originalNodeId = $getNodeId(blockNode);
        const before = diffNode.getFirstChild();
        const restoreSelection = selectionIsWithinNode(blockNode);
        if (originalNodeId) {
          if (before) assignPendingNodeIdentity(before);
          $setNodeProperties(diffNode, {
            rewriteIdentityMap: [{ afterIndex: 1, beforeIndex: 0, nodeId: originalNodeId }] as any,
          });
        }
        applyRewriteMetadata(diffNode, metadata);
        markGeneratedNodes([after], metadata);
        diffNode.append(after);
        blockNode.replace(diffNode, false);
        if (restoreSelection) diffNode.selectEnd();
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
function wrapBlockModify(
  oldBlock: LexicalNode,
  editor: LexicalEditor,
  changeFn: () => void,
  metadata?: LiteXMLRewriteMetadata,
) {
  if ($isListItemNode(oldBlock)) {
    const restoreSelection = selectionIsWithinNode(oldBlock);
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
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes(pNew.getChildren(), metadata);
    oldBlock.append(diffNode);
    if (restoreSelection) diffNode.selectEnd();
    return;
  }
  if (
    $isTableCellNode(oldBlock) &&
    !$isTableCellDiffNode(oldBlock) &&
    $isTableRowNode(oldBlock.getParent())
  ) {
    const restoreSelection = selectionIsWithinNode(oldBlock);
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
    const diffNode = $createDiffNode('modify').append(before, after);
    newBlock.append(diffNode);
    if (restoreSelection) diffNode.selectEnd();
    return;
  }
  const restoreSelection = selectionIsWithinNode(oldBlock);
  const diffNode = $createDiffNode('modify');
  const before = $cloneNode(oldBlock, editor);
  diffNode.append(before);
  changeFn();
  const newBlock = $getNodeByKey(oldBlock.getKey());
  if (!newBlock) {
    throw new Error('New block node not found for modify wrapper.');
  }
  const after = $cloneNode(newBlock, editor);
  const originalNodeId = $getNodeId(oldBlock);
  if (originalNodeId) {
    assignPendingNodeIdentity(before);
    $setNodeProperties(diffNode, {
      rewriteIdentityMap: [{ afterIndex: 1, beforeIndex: 0, nodeId: originalNodeId }] as any,
    });
  }
  applyRewriteMetadata(diffNode, metadata);
  markGeneratedNodes([after], metadata);
  diffNode.append(after);
  newBlock.replace(diffNode, false);
  if (restoreSelection) diffNode.selectEnd();
}

export function registerLiteXMLCommand(editor: LexicalEditor, dataSource: LitexmlDataSource) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_MODIFY_COMMAND,
      (payload) => {
        const resultPayload = [
          ...payload.filter((operation) => operation.action === 'insert'),
          ...payload.filter((operation) => operation.action !== 'insert'),
        ];
        let projectedDocument = getActiveSerializedDocument();
        const preparedByOperation = new Map<LiteXmlModifyOperation, PreparedModify>();
        const safePayload = resultPayload.filter((item) => {
          try {
            const prepared =
              item.action === 'modify'
                ? prepareModify(editor, dataSource, toArrayXml(item.litexml))
                : undefined;
            const nextProjection = projectOperation(
              dataSource,
              projectedDocument,
              toProjectionOperation(item),
              prepared?.readXml,
            );
            if (!nextProjection) return false;
            if (prepared) preparedByOperation.set(item, prepared);
            projectedDocument = nextProjection;
            return true;
          } catch (error) {
            logger.warn('⚠️ Skipping LiteXML operation that failed preflight:', error);
            return false;
          }
        });

        try {
          let handled = false;
          const afterAnchors = new Map<string, string[]>();
          safePayload.forEach((item) => {
            switch (item.action) {
              case 'modify': {
                const prepared = preparedByOperation.get(item);
                handled =
                  (prepared
                    ? applyPreparedModify(editor, prepared, getRewriteMetadata(payload))
                    : false) || handled;
                break;
              }
              case 'remove': {
                handled =
                  handleRemove(editor, item.id, true, getRewriteMetadata(payload)) || handled;
                break;
              }
              case 'insert': {
                const cursorIds = 'afterId' in item ? afterAnchors.get(item.afterId) : undefined;
                let override: LexicalNode | undefined;
                if (cursorIds) {
                  for (let cursorIndex = cursorIds.length - 1; cursorIndex >= 0; cursorIndex--) {
                    const cursor = $findNodeById(cursorIds[cursorIndex]);
                    if (cursor) {
                      override = cursor;
                      break;
                    }
                  }
                }
                const insertedNodeId = handleInsert(
                  editor,
                  { ...item, delay: true },
                  dataSource,
                  getRewriteMetadata(payload),
                  override,
                );
                handled = insertedNodeId !== null || handled;
                if ('afterId' in item && insertedNodeId) {
                  const nextCursors = afterAnchors.get(item.afterId) || [];
                  nextCursors.push(insertedNodeId);
                  afterAnchors.set(item.afterId, nextCursors);
                }
                break;
              }
            }
          });
          return handled;
        } catch (error) {
          logger.error('❌ Error processing LITEXML_MODIFY_COMMAND:', error);
          return false;
        }
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_MODIFY_WITH_RESULTS_COMMAND,
      (payload) => {
        const metadata = getRewriteMetadata(payload) ?? getRewriteMetadata(payload.operations);
        const results = applyLiteXMLBatch(editor, dataSource, payload.operations, metadata);
        payload.onResults(results);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_APPLY_COMMAND,
      (payload) => {
        const { litexml, delay } = payload;
        const arrayXml = toArrayXml(litexml);
        const metadata = getRewriteMetadata(payload);
        if (!delay) {
          return handleModify(editor, dataSource, arrayXml, delay, metadata);
        }

        const operation = { action: 'modify' as const, litexml };
        const document = getActiveSerializedDocument();
        try {
          const prepared = prepareModify(editor, dataSource, arrayXml);
          if (
            projectOperation(
              dataSource,
              document,
              toProjectionOperation(operation),
              prepared.readXml,
            )
          ) {
            return applyPreparedModify(editor, prepared, metadata);
          }
        } catch (error) {
          logger.error('❌ Failed to apply LiteXML modification:', error);
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_REMOVE_COMMAND,
      (payload) => {
        const { id, delay } = payload;
        const metadata = getRewriteMetadata(payload);
        if (!delay) return handleRemove(editor, id, delay, metadata);

        const operation = { action: 'remove' as const, id };
        const document = getActiveSerializedDocument();
        if (projectOperation(dataSource, document, toProjectionOperation(operation))) {
          return handleRemove(editor, id, delay, metadata);
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_INSERT_COMMAND,
      (payload) => {
        const metadata = getRewriteMetadata(payload);
        if (!payload.delay) {
          return handleInsert(editor, payload, dataSource, metadata) !== null;
        }

        const document = getActiveSerializedDocument();
        const operation = { action: 'insert' as const, ...payload };
        if (projectOperation(dataSource, document, toProjectionOperation(operation))) {
          return handleInsert(editor, payload, dataSource, metadata) !== null;
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

function applyPreparedModify(
  editor: LexicalEditor,
  prepared: PreparedModify,
  metadata?: LiteXMLRewriteMetadata,
): boolean {
  const modifyBlockNodes = new Set<string>();
  const diffNodeMap = new Map<string, DiffNode>();
  for (const { oldNode, newNode } of prepared.pairs) {
    if (
      !handleReplaceForApplyDelay(oldNode, newNode, modifyBlockNodes, diffNodeMap, editor, metadata)
    ) {
      throw new Error(`Node id "${$getNodeId(oldNode)}" could not be modified.`);
    }
  }
  finalizeModifyBlocks(modifyBlockNodes, diffNodeMap, editor, metadata);
  return prepared.pairs.length > 0;
}

function handleModify(
  editor: LexicalEditor,
  dataSource: LitexmlDataSource,
  arrayXml: string[],
  delay?: boolean,
  metadata?: LiteXMLRewriteMetadata,
): boolean {
  const parsedInputs = arrayXml.map((xml) => dataSource.readLiteXMLToInode(xml));
  const hasTarget = parsedInputs.some((inode) =>
    (inode.root?.children ?? []).some((child: unknown) => {
      const id = getSerializedTargetId(child);
      return id !== undefined && hasCurrentTarget(editor, id);
    }),
  );
  if (!hasTarget) return false;

  if (delay) {
    editor.update(() => {
      const modifyBlockNodes = new Set<string>();
      const diffNodeMap = new Map<string, DiffNode>();
      parsedInputs.forEach((inode) => {
        inode.root.children.forEach((child: any) => {
          try {
            const { oldNode, newNode } = tryParseChild(child, editor);
            if (oldNode && newNode) {
              handleReplaceForApplyDelay(
                oldNode,
                newNode,
                modifyBlockNodes,
                diffNodeMap,
                editor,
                metadata,
              );
            } else {
              logger.warn(`⚠️ Node with key ${child.id} not found for diffing.`);
            }
          } catch (error) {
            logger.error('❌ Error replacing node:', error);
          }
        });
      });
      // replace modified block nodes with diff nodes
      finalizeModifyBlocks(modifyBlockNodes, diffNodeMap, editor, metadata);
    });
  } else {
    editor.update(() => {
      parsedInputs.forEach((inode) => {
        let prevNode: LexicalNode | null = null;
        inode.root.children.forEach((child: any) => {
          try {
            const { oldNode, newNode } = tryParseChild(child, editor);
            if (oldNode && newNode) {
              prevNode = oldNode.replace(newNode, false);
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
                } else {
                  prevNode = prevNode.insertAfter(newNode);
                }
              } else {
                $insertNodes([newNode]);
              }
            }
          } catch (error) {
            logger.error('❌ Error replacing node:', error);
          }
        });
      });
    });
  }
  return hasTarget;
}

function handleRemove(
  editor: LexicalEditor,
  key: string,
  delay?: boolean,
  metadata?: LiteXMLRewriteMetadata,
): boolean {
  const node = resolveLiteXMLTarget({ id: key }, editor);
  if (!node) return false;

  if (!delay) {
    if ($isTableCellNode(node)) {
      const table = $getTableForCell(node);
      const columnIndex = $getTableCellColumnIndex(node);
      const span = node.getColSpan();
      node.remove();
      if (table && columnIndex >= 0) {
        $shrinkTableWidthsAfterCellRemoval(table, columnIndex, span);
      }
      return true;
    }
    node.remove();
    return true;
  }

  if ($isTableCellNode(node)) {
    const table = $getTableForCell(node);
    const columnIndex = $getTableCellColumnIndex(node);
    if (!table || columnIndex < 0) {
      logger.error(`❌ Table cell ${node.getKey()} is not attached to a valid table row.`);
      return false;
    }
    const changeId = createTableColumnChangeId(table, columnIndex);
    const diffCell = $createTableCellDiffFromCell(editor, node, 'remove', changeId);
    applyRewriteMetadata(diffCell, metadata);
    const diff = diffCell.getFirstChild();
    if (diff) applyRewriteMetadata(diff, metadata);
    node.replace(diffCell, false);
    return true;
  }

  if ($isTableRowNode(node) && $isTableNode(node.getParent())) {
    const diffRow = $createTableRowDiffFromRow(editor, node, 'remove');
    applyRewriteMetadata(diffRow, metadata);
    node.replace(diffRow, false);
    return true;
  }

  // Delay removal: show a diff.
  if (node.isInline() === false) {
    const originDiffNode = $closest(
      node,
      (candidate) => candidate.getType() === DiffNode.getType(),
    ) as DiffNode | null;
    if (originDiffNode) {
      switch (originDiffNode.diffType) {
        case 'add': {
          originDiffNode.remove();
          return true;
        }
        case 'modify': {
          const children = originDiffNode.getChildren();
          const newDiff = $createDiffNode('remove');
          newDiff.append(children[0]);
          applyRewriteMetadata(newDiff, metadata);
          originDiffNode.replace(newDiff, false);
          return true;
        }
        case 'listItemModify': {
          const children = originDiffNode.getChildren();
          applyRewriteMetadata(originDiffNode, metadata);
          originDiffNode.replace(children[0], false).selectEnd();
          return true;
        }
        case 'remove':
        case 'unchanged': {
          return true;
        }
      }
    }

    if ($isListItemNode(node)) {
      const diffNode = $createDiffNode('listItemRemove');
      node.getChildren().forEach((child) => {
        diffNode.append($cloneNode(child, editor));
      });
      applyRewriteMetadata(diffNode, metadata);
      node.clear();
      node.append(diffNode);
    } else {
      const diffNode = $createDiffNode('remove');
      diffNode.append($cloneNode(node, editor));
      applyRewriteMetadata(diffNode, metadata);
      node.replace(diffNode, false);
    }
    return true;
  }

  const oldBlock = $closest(node, (candidate) => candidate.isInline() === false);
  if (!oldBlock) throw new Error('Old block node not found for removal.');
  const originDiffNode = $closest(
    node,
    (candidate) => candidate.getType() === DiffNode.getType(),
  ) as DiffNode | null;
  if (originDiffNode) {
    node.remove();
    return true;
  }

  wrapBlockModify(
    oldBlock,
    editor,
    () => {
      node.remove();
    },
    metadata,
  );
  return true;
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
  metadata?: LiteXMLRewriteMetadata,
  referenceNodeOverride?: LexicalNode,
): string | null {
  const { litexml, delay } = payload;
  const inode = dataSource.readLiteXMLToInode(litexml);
  const rewriteMetadata = metadata ?? getRewriteMetadata(payload);
  if (!Array.isArray(inode.root?.children) || inode.root.children.length === 0) return null;
  const targetId = 'beforeId' in payload ? payload.beforeId : payload.afterId;
  const hasReference = editor.getEditorState().read(
    () => {
      if (referenceNodeOverride) return true;
      if (targetId === 'root') {
        return Boolean(
          'beforeId' in payload ? $getRoot().getFirstChild() : $getRoot().getLastChild(),
        );
      }
      return Boolean(resolveLiteXMLTarget({ id: targetId }, editor));
    },
    { editor },
  );
  if (!hasReference) return null;

  let insertedNodeId: string | null = null;
  try {
    let referenceNode: LexicalNode | null = referenceNodeOverride ?? null;
    if (!referenceNode) {
      if ('beforeId' in payload) {
        if (payload.beforeId === 'root') {
          referenceNode = $getRoot().getFirstChild();
        } else {
          referenceNode = resolveLiteXMLTarget({ id: payload.beforeId }, editor);
        }
      } else {
        if (payload.afterId === 'root') {
          referenceNode = $getRoot().getLastChild();
        } else {
          referenceNode = resolveLiteXMLTarget({ id: payload.afterId }, editor);
        }
      }
    }

    if (!referenceNode) {
      throw new Error('Reference node not found for insertion.');
    }

    const newNodes = inode.root.children.map((child: any) =>
      $parseSerializedNodeImpl(child, editor),
    );
    if (newNodes.length === 0) return null;
    // An insert creates new logical blocks. Ignore caller-supplied IDs that
    // collide with an existing node and allocate missing IDs before the
    // nodes enter the shared document.
    $ensureUniqueNodeIds(newNodes);
    const stableIdentityEnabled = Boolean(
      getKernelFromEditor(editor)?.requireService(IAnnotationService),
    );
    newNodes.forEach((node: LexicalNode) => ensureInsertedNodeIds(node, stableIdentityEnabled));
    const candidateNodeId = $getNodeId(newNodes.at(-1)!) ?? null;

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
      const insertionIndex =
        'beforeId' in payload ? referenceIndex : referenceIndex + cellReference.getColSpan();
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
              createTableColumnChangeId(table, insertionIndex + spanOffset),
            )
          : node;
        if (delay && $isTableCellDiffNode(result)) {
          applyRewriteMetadata(result, rewriteMetadata);
          markGeneratedNodes(result.getChildren(), rewriteMetadata);
          const diff = result.getFirstChild();
          if (diff) applyRewriteMetadata(diff, rewriteMetadata);
        }
        spanOffset += node.getColSpan();
        return result;
      });
      if ('beforeId' in payload) {
        cells.reverse().forEach((cell: LexicalNode) => {
          referenceNode = referenceNode!.insertBefore(cell);
        });
      } else {
        cells.forEach((cell: LexicalNode) => {
          referenceNode = referenceNode!.insertAfter(cell);
        });
      }
      insertedNodeId = candidateNodeId;
      return insertedNodeId;
    }

    if (!delay) {
      if ('beforeId' in payload) {
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
      insertedNodeId = candidateNodeId;
      return insertedNodeId;
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

      if ('beforeId' in payload) {
        newNodes.reverse().forEach((node: LexicalNode) => {
          if (!$isTableRowNode(node)) return;
          const diffRow = $createTableRowDiffFromRow(editor, node, 'add');
          applyRewriteMetadata(diffRow, rewriteMetadata);
          markGeneratedNodes(diffRow.getChildren(), rewriteMetadata);
          referenceNode = referenceNode!.insertBefore(diffRow);
        });
      } else {
        newNodes.forEach((node: LexicalNode) => {
          if (!$isTableRowNode(node)) return;
          const diffRow = $createTableRowDiffFromRow(editor, node, 'add');
          applyRewriteMetadata(diffRow, rewriteMetadata);
          markGeneratedNodes(diffRow.getChildren(), rewriteMetadata);
          referenceNode = referenceNode!.insertAfter(diffRow);
        });
      }
      insertedNodeId = candidateNodeId;
      return insertedNodeId;
    }

    // delay insertion: show diffs or wrap block modifications
    if ('beforeId' in payload) {
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
            applyRewriteMetadata(diffNode, rewriteMetadata);
            markGeneratedNodes(diffNode.getChildren(), rewriteMetadata);
            node.append(diffNode);
            return node;
          }
          const diffNode = $createDiffNode('add');
          diffNode.append(node);
          applyRewriteMetadata(diffNode, rewriteMetadata);
          markGeneratedNodes([node], rewriteMetadata);
          return diffNode;
        });
        diffNodes.reverse().forEach((diffNode: DiffNode) => {
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
          applyRewriteMetadata(originDiffNode, rewriteMetadata);
          markGeneratedNodes(newNodes, rewriteMetadata);
          newNodes.forEach((node: LexicalNode) => {
            if (referenceNode) {
              referenceNode = referenceNode.insertBefore(node);
            }
          });
        } else {
          wrapBlockModify(
            refBlock,
            editor,
            () => {
              newNodes.forEach((node: LexicalNode) => {
                if (referenceNode) {
                  referenceNode = referenceNode.insertBefore(node);
                }
              });
            },
            rewriteMetadata,
          );
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
              applyRewriteMetadata(diffNode, rewriteMetadata);
              markGeneratedNodes(diffNode.getChildren(), rewriteMetadata);
              node.append(diffNode);
              referenceNode = referenceNode.insertAfter(node);
            } else {
              const diffNode = $createDiffNode('add');
              diffNode.append(node);
              applyRewriteMetadata(diffNode, rewriteMetadata);
              markGeneratedNodes([node], rewriteMetadata);
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
          applyRewriteMetadata(originDiffNode, rewriteMetadata);
          markGeneratedNodes(newNodes, rewriteMetadata);
          newNodes.forEach((node: LexicalNode) => {
            if (referenceNode) {
              referenceNode = referenceNode.insertAfter(node);
            }
          });
        } else {
          wrapBlockModify(
            refBlock,
            editor,
            () => {
              newNodes.forEach((node: LexicalNode) => {
                if (referenceNode) {
                  referenceNode = referenceNode.insertAfter(node);
                }
              });
            },
            rewriteMetadata,
          );
        }
      }
    }
    insertedNodeId = candidateNodeId;
  } catch (error) {
    logger.error('❌ Error inserting node:', error);
    insertedNodeId = null;
  }
  return insertedNodeId;
}

// Command identities live in the side-effect-free `./symbols` module so they
// keep a single runtime identity across the package's browser/node bundles.
export type {
  PendingRewriteReview,
  RewriteReviewSettlementInput,
  RewriteReviewSettlementResult,
} from './diffCommand';
export { IRewriteReviewService, RewriteReviewService } from './diffCommand';
export type {
  AllowedLiteXMLCommandPayload,
  CollaborativeAgentCommand,
  CollaborativeAgentCommandGateway,
} from './gateway';
export {
  COLLABORATIVE_AGENT_COMMAND_ALLOWLIST,
  createAgentCommandGateway,
  createCollaborativeAgentCommandGateway,
} from './gateway';
export type {
  LiteXMLValidationOptions,
  RewriteCommandResult,
  RewriteCommandResultChannel,
  RewriteCommandStatus,
  RewriteRangeCommandPayload,
  RewriteRangeMode,
  RewriteReviewEvent,
  RewriteReviewListener,
  RewriteSelectionInput,
  SerializedBlockRewriteSelection,
  SerializedRewriteCommandSelection,
  SerializedRewritePoint,
} from './rewriteRange';
export {
  executeRewriteRange,
  getRewriteService,
  getRewriteStateVector,
  hashRewriteText,
  InMemoryRewriteCommandResultChannel,
  IRewriteCommandResultService,
  IRewriteService,
  normalizeRewriteText,
  registerLiteXMLRewriteCommand,
  RewriteService,
  validateLiteXMLInput,
} from './rewriteRange';
export type {
  LiteXMLInsertCommandPayload,
  LiteXMLModifyCommandOperation,
  LiteXMLModifyCommandPayload,
  LiteXMLRemoveCommandPayload,
  LiteXMLReviewCommandPayload,
  LiteXMLRewriteMetadata,
} from './symbols';
export type { LiteXmlModifyOperation, LiteXmlOperationResult } from './symbols';
export {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_MODIFY_WITH_RESULTS_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REVIEW_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
} from './symbols';
/** Alias used by request-layer code that refers to the durable range shape by its SDD name. */
export type { SerializedRewriteCommandSelection as SerializedRewriteSelection } from './rewriteRange';
