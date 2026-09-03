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

import { $closest, getKernelFromEditor } from '@/editor-kernel';
import { IAnnotationService } from '@/plugins/properties/service';
import { $getNodeProperties, $setNodeProperties, createNodeId } from '@/plugins/properties/state';
import {
  $ensureNodeId,
  $findNodeById,
  $getNodeId,
  $isNodeIdentityTarget,
  $markNodesAsAIGenerated,
  $preserveNodeIdentity,
} from '@/plugins/properties/utils';
import { createDebugLogger } from '@/utils/debug';

import type LitexmlDataSource from '../data-source/litexml-data-source';
import {
  findNewIllegalDiffPaths,
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
import { $cloneNode, $parseSerializedNodeImpl, charToId } from '../utils';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
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
  const toProjectionId = (id: string): string => {
    // Durable NodeState IDs are opaque strings and must not be decoded as
    // legacy base-36 LiteXML IDs. Legacy writers emit at most four
    // alphanumeric characters, so this preserves the existing conversion
    // while allowing stable IDs through the detached preflight.
    if (id === 'root' || !/^[\da-z]{1,4}$/i.test(id)) return id;
    return charToId(id);
  };
  if (operation.action === 'remove') {
    return { ...operation, id: toProjectionId(operation.id) };
  }
  if (operation.action === 'insert') {
    return {
      ...operation,
      ...('beforeId' in operation
        ? { beforeId: toProjectionId(operation.beforeId) }
        : { afterId: toProjectionId(operation.afterId) }),
    };
  }
  return operation;
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
      : typeof node.id === 'string'
        ? node.id
        : undefined;
  if (directId) {
    const stableNode = $findNodeById(directId);
    if (stableNode) return stableNode;
  }

  if (typeof node.id !== 'string' && typeof node.id !== 'number') return null;
  const encodedId = String(node.id);
  const byKey = $getNodeByKey(encodedId);
  if (byKey) return byKey;

  // Legacy LiteXML ids are short base-36 encodings of numeric Lexical keys.
  // This fallback is intentionally one-way: writers never call it.
  if (!/^[\da-z]{1,4}$/i.test(encodedId)) return null;
  try {
    return $getNodeByKey(charToId(encodedId));
  } catch {
    return null;
  }
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
  editor.getEditorState().read(() => {
    found = Boolean(resolveLiteXMLTarget({ id }, editor));
  });
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

/** Keep the before/after sides of a delayed legacy modify logically distinct. */
function assignPendingNodeIdentity(node: LexicalNode): string {
  const nodeId = createNodeId();
  const properties = $getNodeProperties(node);
  $setNodeProperties(node, { ...properties, nodeId });
  return nodeId;
}
function handleReplaceForApplyDelay(
  oldNode: LexicalNode,
  newNode: LexicalNode,
  modifyBlockNodes: Set<string>,
  diffNodeMap: Map<string, DiffNode>,
  editor: LexicalEditor,
  metadata?: LiteXMLRewriteMetadata,
) {
  if ($isTableRowNode(oldNode) || $isTableRowNode(newNode)) {
    if (
      !$isTableRowNode(oldNode) ||
      !$isTableRowNode(newNode) ||
      !$isTableNode(oldNode.getParent()) ||
      !$areTableRowStructuresCompatible(oldNode, newNode)
    ) {
      logger.error(`❌ Invalid table row modification for row ${oldNode.getKey()}.`);
      return;
    }

    const changeId = createOpaqueChangeId();
    const removeRow = $createTableRowDiffFromRow(editor, oldNode, 'remove', changeId);
    const addRow = $createTableRowDiffFromRow(editor, newNode, 'add', changeId);
    applyRewriteMetadata(removeRow, metadata);
    applyRewriteMetadata(addRow, metadata);
    markGeneratedNodes(addRow.getChildren(), metadata);
    oldNode.replace(removeRow, false);
    removeRow.insertAfter(addRow);
    return;
  }

  if ($isTableCellNode(oldNode) && $isTableCellNode(newNode)) {
    const existingDiff = oldNode.getChildren().find($isDiffNode);
    if (existingDiff) {
      if ($isTableCellDiffNode(oldNode)) {
        existingDiff.clear();
        newNode.getChildren().forEach((child) => {
          existingDiff.append($cloneNode(child, editor));
        });
        return;
      }

      const after = existingDiff
        .getChildren()
        .find((child) => $isDiffContentNode(child) && child.side === 'after');
      if (existingDiff.diffType === 'modify' && after && $isDiffContentNode(after)) {
        after.clear();
        newNode.getChildren().forEach((child) => {
          after.append($cloneNode(child, editor));
        });
        return;
      }
    }

    const before = $createDiffContentNode('before');
    const after = $createDiffContentNode('after');
    oldNode.getChildren().forEach((child) => before.append($cloneNode(child, editor)));
    newNode.getChildren().forEach((child) => after.append($cloneNode(child, editor)));

    const diffNode = $createDiffNode('modify');
    diffNode.append(before, after);
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes(after.getChildren(), metadata);
    oldNode.clear();
    oldNode.append(diffNode);
    return;
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
    applyRewriteMetadata(originDiffNode, metadata);
    markGeneratedNodes([newNode], metadata);
    oldNode.replace(newNode, false);
    return;
  }
  if (oldNode === oldBlock) {
    const before = $cloneNode(oldBlock, editor);
    const originalNodeId = $getNodeId(oldBlock);
    if (originalNodeId) {
      assignPendingNodeIdentity(newNode);
    }
    const diffNode = $createDiffNode('modify');
    if (originalNodeId) {
      $setNodeProperties(diffNode, {
        rewriteIdentityMap: [{ afterIndex: 1, beforeIndex: 0, nodeId: originalNodeId }] as any,
      });
    }
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes([newNode], metadata);
    diffNode.append(before, newNode);
    oldNode.replace(diffNode, false);
  } else {
    if (!modifyBlockNodes.has(oldBlock.getKey())) {
      modifyBlockNodes.add(oldBlock.getKey());
      const diffNode = $createDiffNode('modify');
      diffNode.append($cloneNode(oldBlock, editor));
      diffNodeMap.set(oldBlock.getKey(), diffNode);
    }
    oldNode.replace(newNode, false);
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
      } else {
        const after = $cloneNode(blockNode, editor);
        const originalNodeId = $getNodeId(blockNode);
        if (originalNodeId) {
          assignPendingNodeIdentity(after);
          $setNodeProperties(diffNode, {
            rewriteIdentityMap: [{ afterIndex: 1, beforeIndex: 0, nodeId: originalNodeId }] as any,
          });
        }
        applyRewriteMetadata(diffNode, metadata);
        markGeneratedNodes([after], metadata);
        diffNode.append(after);
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
function wrapBlockModify(
  oldBlock: LexicalNode,
  editor: LexicalEditor,
  changeFn: () => void,
  metadata?: LiteXMLRewriteMetadata,
) {
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
    applyRewriteMetadata(diffNode, metadata);
    markGeneratedNodes(pNew.getChildren(), metadata);
    oldBlock.append(diffNode);
    return;
  }
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
    assignPendingNodeIdentity(after);
    $setNodeProperties(diffNode, {
      rewriteIdentityMap: [{ afterIndex: 1, beforeIndex: 0, nodeId: originalNodeId }] as any,
    });
  }
  applyRewriteMetadata(diffNode, metadata);
  markGeneratedNodes([after], metadata);
  diffNode.append(after);
  newBlock.replace(diffNode, false);
}

export function registerLiteXMLCommand(editor: LexicalEditor, dataSource: LitexmlDataSource) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_MODIFY_COMMAND,
      (payload) => {
        const resultPayload = payload.reduce(
          (acc, cur) => {
            if (cur.action === 'insert') {
              acc.unshift(cur);
            } else {
              acc.push(cur);
            }
            return acc;
          },
          [] as typeof payload,
        );
        let projectedDocument = getKernelFromEditor(editor).getDocument(
          'json',
        ) as unknown as SerializedDiffDocument;
        const safePayload = resultPayload.filter((item) => {
          const nextProjection = projectOperation(
            dataSource,
            projectedDocument,
            toProjectionOperation(item),
          );
          if (!nextProjection) return false;
          projectedDocument = nextProjection;
          return true;
        });

        try {
          let handled = false;
          safePayload.forEach((item) => {
            const { action } = item;
            switch (action) {
              case 'modify': {
                const { litexml } = item;
                const arrayXml = toArrayXml(litexml);
                // handle modfy action
                handled =
                  handleModify(editor, dataSource, arrayXml, true, getRewriteMetadata(payload)) ||
                  handled;
                break;
              }
              case 'remove': {
                const { id } = item;
                // handle remove action
                handled = handleRemove(editor, id, true, getRewriteMetadata(payload)) || handled;
                break;
              }
              case 'insert': {
                handled =
                  handleInsert(
                    editor,
                    {
                      ...item,
                      delay: true,
                    },
                    dataSource,
                    getRewriteMetadata(payload),
                  ) || handled;
                break;
              }
              default: {
                logger.warn(`⚠️ Unknown action type: ${action}`);
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
      LITEXML_APPLY_COMMAND,
      (payload) => {
        const { litexml, delay } = payload;
        const arrayXml = toArrayXml(litexml);
        if (!delay) {
          return handleModify(editor, dataSource, arrayXml, delay, getRewriteMetadata(payload));
        }

        const operation = { action: 'modify' as const, litexml };
        const document = getKernelFromEditor(editor).getDocument(
          'json',
        ) as unknown as SerializedDiffDocument;
        if (projectOperation(dataSource, document, toProjectionOperation(operation))) {
          return handleModify(editor, dataSource, arrayXml, delay, getRewriteMetadata(payload));
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
          return handleRemove(editor, id, delay, getRewriteMetadata(payload));
        }

        const operation = { action: 'remove' as const, id };
        const document = getKernelFromEditor(editor).getDocument(
          'json',
        ) as unknown as SerializedDiffDocument;
        if (projectOperation(dataSource, document, toProjectionOperation(operation))) {
          return handleRemove(editor, id, delay, getRewriteMetadata(payload));
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_INSERT_COMMAND,
      (payload) => {
        if (!payload.delay) {
          return handleInsert(editor, payload, dataSource, getRewriteMetadata(payload));
        }

        const document = getKernelFromEditor(editor).getDocument(
          'json',
        ) as unknown as SerializedDiffDocument;
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
          return handleInsert(editor, payload, dataSource, getRewriteMetadata(payload));
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
  if (!hasCurrentTarget(editor, key)) return false;
  editor.update(() => {
    const node = resolveLiteXMLTarget({ id: key }, editor);
    if (!node) return;

    if (!delay) {
      if ($isTableCellNode(node)) {
        const table = $getTableForCell(node);
        const columnIndex = $getTableCellColumnIndex(node);
        const span = node.getColSpan();
        node.remove();
        if (table && columnIndex >= 0) {
          $shrinkTableWidthsAfterCellRemoval(table, columnIndex, span);
        }
        return;
      }
      node.remove();
      return;
    }

    if ($isTableCellNode(node)) {
      const table = $getTableForCell(node);
      const columnIndex = $getTableCellColumnIndex(node);
      if (!table || columnIndex < 0) {
        logger.error(`❌ Table cell ${node.getKey()} is not attached to a valid table row.`);
        return;
      }
      const changeId = createTableColumnChangeId(table, columnIndex);
      const diffCell = $createTableCellDiffFromCell(editor, node, 'remove', changeId);
      applyRewriteMetadata(diffCell, metadata);
      const diff = diffCell.getFirstChild();
      if (diff) applyRewriteMetadata(diff, metadata);
      node.replace(diffCell, false);
      return;
    }

    if ($isTableRowNode(node) && $isTableNode(node.getParent())) {
      const diffRow = $createTableRowDiffFromRow(editor, node, 'remove');
      applyRewriteMetadata(diffRow, metadata);
      node.replace(diffRow, false);
      return;
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
            return;
          }
          case 'modify': {
            const children = originDiffNode.getChildren();
            const newDiff = $createDiffNode('remove');
            newDiff.append(children[0]);
            applyRewriteMetadata(newDiff, metadata);
            originDiffNode.replace(newDiff, false);
            return;
          }
          case 'listItemModify': {
            const children = originDiffNode.getChildren();
            applyRewriteMetadata(originDiffNode, metadata);
            originDiffNode.replace(children[0], false).selectEnd();
            return;
          }
          case 'remove':
          case 'unchanged': {
            // do nothing special
            break;
          }
        }
        return;
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
        return;
      }
      // wrap changes inside a modify diff
      wrapBlockModify(
        oldBlock,
        editor,
        () => {
          node.remove();
        },
        metadata,
      );
    }
  });
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
) {
  const { litexml, delay } = payload;
  const isBefore = 'beforeId' in payload;
  const inode = dataSource.readLiteXMLToInode(litexml);
  const rewriteMetadata = metadata ?? getRewriteMetadata(payload);
  if (!Array.isArray(inode.root?.children) || inode.root.children.length === 0) return false;
  const targetId = isBefore ? payload.beforeId : payload.afterId;
  const hasReference = editor.getEditorState().read(() => {
    if (targetId === 'root') {
      return Boolean(isBefore ? $getRoot().getFirstChild() : $getRoot().getLastChild());
    }
    return Boolean(resolveLiteXMLTarget({ id: targetId }, editor));
  });
  if (!hasReference) return false;

  editor.update(() => {
    try {
      let referenceNode: LexicalNode | null = null;
      if (isBefore) {
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

      if (!referenceNode) {
        throw new Error('Reference node not found for insertion.');
      }

      const newNodes = inode.root.children.map((child: any) =>
        $parseSerializedNodeImpl(child, editor),
      );
      if (newNodes.length === 0) return;
      // An insert creates new logical blocks. Ignore caller-supplied IDs that
      // collide with an existing node and allocate missing IDs before the
      // nodes enter the shared document.
      const stableIdentityEnabled = Boolean(
        getKernelFromEditor(editor)?.requireService(IAnnotationService),
      );
      newNodes.forEach((node: LexicalNode) => ensureInsertedNodeIds(node, stableIdentityEnabled));

      const referencesTableCell = $isTableCellNode(referenceNode);
      const insertsOnlyTableCells = newNodes.length > 0 && newNodes.every($isTableCellNode);
      if (referencesTableCell || insertsOnlyTableCells) {
        if (!referencesTableCell || !insertsOnlyTableCells) {
          logger.error('❌ Table cells can only be inserted next to another cell in the same row.');
          return;
        }
        const cellReference = referenceNode as AnyTableCell;
        const table = $getTableForCell(cellReference);
        const referenceIndex = $getTableCellColumnIndex(cellReference);
        if (!table || referenceIndex < 0) {
          logger.error('❌ Table cell insertion requires a valid table parent.');
          return;
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
        if (isBefore) {
          cells.reverse().forEach((cell: LexicalNode) => {
            referenceNode = referenceNode!.insertBefore(cell);
          });
        } else {
          cells.forEach((cell: LexicalNode) => {
            referenceNode = referenceNode!.insertAfter(cell);
          });
        }
        return;
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
        return;
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
          return;
        }

        if (isBefore) {
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
        return;
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
    } catch (error) {
      logger.error('❌ Error inserting node:', error);
    }
  });
  return hasReference;
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
  hashRewriteText,
  InMemoryRewriteCommandResultChannel,
  IRewriteCommandResultService,
  normalizeRewriteText,
  getRewriteStateVector,
  registerLiteXMLRewriteCommand,
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
export {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
  LITEXML_REVIEW_COMMAND,
  LITEXML_REWRITE_RANGE_COMMAND,
} from './symbols';
/** Alias used by request-layer code that refers to the durable range shape by its SDD name. */
export type { SerializedRewriteCommandSelection as SerializedRewriteSelection } from './rewriteRange';
