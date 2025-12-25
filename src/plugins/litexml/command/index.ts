/* eslint-disable @typescript-eslint/no-use-before-define */
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNodeByKey,
  $insertNodes,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  LexicalNode,
  createCommand,
} from 'lexical';

import { $closest } from '@/editor-kernel';
import { createDebugLogger } from '@/utils/debug';

import type LitexmlDataSource from '../data-source/litexml-data-source';
import { $createDiffNode, DiffNode } from '../node/DiffNode';
import { $cloneNode, $parseSerializedNodeImpl, charToId } from '../utils';

const logger = createDebugLogger('plugin', 'litexml');

// Helpers to reduce duplication and improve readability
function toArrayXml(litexml: string | string[]) {
  return Array.isArray(litexml) ? litexml : [litexml];
}

function tryParseChild(child: any, editor: LexicalEditor) {
  try {
    const oldNode = $getNodeByKey(child.id);
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
) {
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
    return;
  }
  if (oldNode === oldBlock) {
    const diffNode = $createDiffNode('modify');
    diffNode.append($cloneNode(oldBlock, editor), newNode);
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

export const LITEXML_MODIFY_COMMAND = createCommand<
  Array<
    | {
        action: 'insert';
        beforeId: string;
        litexml: string;
      }
    | {
        action: 'insert';
        afterId: string;
        litexml: string;
      }
    | {
        action: 'remove';
        id: string;
      }
    | {
        action: 'modify';
        litexml: string | string[];
      }
  >
>('LITEXML_MODIFY_COMMAND');

export const LITEXML_APPLY_COMMAND = createCommand<{ delay?: boolean; litexml: string | string[] }>(
  'LITEXML_APPLY_COMMAND',
);
export const LITEXML_REMOVE_COMMAND = createCommand<{ delay?: boolean; id: string }>(
  'LITEXML_REMOVE_COMMAND',
);
export const LITEXML_INSERT_COMMAND = createCommand<
  | {
      beforeId: string;
      delay?: boolean;
      litexml: string;
    }
  | {
      afterId: string;
      delay?: boolean;
      litexml: string;
    }
>('LITEXML_INSERT_COMMAND');

export function registerLiteXMLCommand(editor: LexicalEditor, dataSource: LitexmlDataSource) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_MODIFY_COMMAND,
      (payload) => {
        payload.forEach((item) => {
          const { action } = item;
          switch (action) {
            case 'modify': {
              const { litexml } = item;
              const arrayXml = toArrayXml(litexml);
              // handle modfy action
              handleModify(editor, dataSource, arrayXml, true);
              break;
            }
            case 'remove': {
              const { id } = item;
              const key = charToId(id);
              // handle remove action
              handleRemove(editor, key, true);
              break;
            }
            case 'insert': {
              handleInsert(
                editor,
                {
                  ...item,
                  delay: true,
                },
                dataSource,
              );
              break;
            }
            default: {
              logger.warn(`⚠️ Unknown action type: ${action}`);
            }
          }
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      LITEXML_APPLY_COMMAND,
      (payload) => {
        const { litexml, delay } = payload;
        const arrayXml = toArrayXml(litexml);
        handleModify(editor, dataSource, arrayXml, delay);
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_REMOVE_COMMAND,
      (payload) => {
        const { id, delay } = payload;
        const key = charToId(id);
        handleRemove(editor, key, delay);
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_INSERT_COMMAND,
      (payload) => {
        handleInsert(editor, payload, dataSource);
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
) {
  if (delay) {
    editor.update(() => {
      const modifyBlockNodes = new Set<string>();
      const diffNodeMap = new Map<string, DiffNode>();
      arrayXml.forEach((xml) => {
        const inode = dataSource.readLiteXMLToInode(xml);
        inode.root.children.forEach((child: any) => {
          try {
            const { oldNode, newNode } = tryParseChild(child, editor);
            if (oldNode && newNode) {
              handleReplaceForApplyDelay(oldNode, newNode, modifyBlockNodes, diffNodeMap, editor);
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
    });
  } else {
    editor.update(() => {
      arrayXml.forEach((xml) => {
        const inode = dataSource.readLiteXMLToInode(xml);
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
}

function handleRemove(editor: LexicalEditor, key: string, delay?: boolean) {
  editor.update(() => {
    const node = $getNodeByKey(key);
    if (!node) return;

    if (!delay) {
      node.remove();
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
            originDiffNode.replace(newDiff, false);
            return;
          }
          case 'listItemModify': {
            const children = originDiffNode.getChildren();
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
      const diffNode = $createDiffNode('remove');
      diffNode.append($cloneNode(node, editor));
      node.replace(diffNode, false);
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
      wrapBlockModify(oldBlock, editor, () => {
        node.remove();
      });
    }
  });
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
) {
  const { litexml, delay } = payload;
  const isBefore = 'beforeId' in payload;
  const inode = dataSource.readLiteXMLToInode(litexml);

  editor.update(() => {
    try {
      let referenceNode: LexicalNode | null = null;
      if (isBefore) {
        referenceNode = $getNodeByKey(charToId(payload.beforeId));
      } else {
        referenceNode = $getNodeByKey(charToId(payload.afterId));
      }

      if (!referenceNode) {
        throw new Error('Reference node not found for insertion.');
      }

      const newNodes = inode.root.children.map((child: any) =>
        $parseSerializedNodeImpl(child, editor),
      );
      if (!delay) {
        if (isBefore) {
          referenceNode = referenceNode.insertBefore(newNodes);
        } else {
          newNodes.forEach((node: LexicalNode) => {
            if (referenceNode) {
              referenceNode = referenceNode.insertAfter(node);
            }
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
            return diffNode;
          });
          diffNodes.forEach((diffNode: DiffNode) => {
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
              const diffNode = $createDiffNode('add');
              diffNode.append(node);
              referenceNode = referenceNode.insertAfter(diffNode);
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
    } catch (error) {
      logger.error('❌ Error inserting node:', error);
    }
  });
}
