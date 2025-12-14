import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  $insertNodes,
  $isElementNode,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  LexicalNode,
  createCommand,
} from 'lexical';

import { $closest } from '@/editor-kernel';

import type LitexmlDataSource from '../data-source/litexml-data-source';
import { $createDiffNode, DiffNode } from '../node/DiffNode';
import { $cloneNode, $parseSerializedNodeImpl, charToId } from '../utils';

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
      LITEXML_APPLY_COMMAND,
      (payload) => {
        const { litexml, delay } = payload;
        const arrayXml = Array.isArray(litexml) ? litexml : [litexml];

        if (delay) {
          editor.update(() => {
            const modifyBlockNodes = new Set<string>();
            const diffNodeMap = new Map<string, DiffNode>();
            arrayXml.forEach((xml) => {
              const inode = dataSource.readLiteXMLToInode(xml);
              inode.root.children.forEach((child: any) => {
                try {
                  const oldNode = $getNodeByKey(child.id);
                  const newNode = $parseSerializedNodeImpl(child, editor);
                  if (oldNode) {
                    const oldBlock = $closest(oldNode, (node) => node.isInline() === false);
                    if (!oldBlock) {
                      throw new Error('Old block node not found for diffing.');
                    }
                    if (oldNode === oldBlock) {
                      const diffNode = $createDiffNode('modify');
                      diffNode.append($cloneNode(oldBlock, editor), newNode);
                      oldNode.replace(diffNode, false);
                    } else {
                      // record modified block nodes
                      if (!modifyBlockNodes.has(oldBlock.getKey())) {
                        modifyBlockNodes.add(oldBlock.getKey());
                        const diffNode = $createDiffNode('modify');
                        diffNode.append($cloneNode(oldBlock, editor));
                        diffNodeMap.set(oldBlock.getKey(), diffNode);
                      }
                      oldNode.replace(newNode, false);
                    }
                  } else {
                    console.warn(`Node with key ${child.id} not found for diffing.`);
                  }
                } catch (error) {
                  console.error('Error replacing node:', error);
                }
              });
            });
            // replace modified block nodes with diff nodes
            for (const blockNodeKey of modifyBlockNodes) {
              const blockNode = $getNodeByKey(blockNodeKey);
              const diffNode = diffNodeMap.get(blockNodeKey);
              if (diffNode && blockNode) {
                diffNode.append($cloneNode(blockNode, editor));
                blockNode.replace(diffNode, false);
              }
            }
          });
        } else {
          editor.update(() => {
            arrayXml.forEach((xml) => {
              const inode = dataSource.readLiteXMLToInode(xml);
              let prevNode: LexicalNode | null = null;
              inode.root.children.forEach((child: any) => {
                try {
                  const oldNode = $getNodeByKey(child.id);
                  const newNode = $parseSerializedNodeImpl(child, editor);
                  if (oldNode) {
                    prevNode = oldNode.replace(newNode, $isElementNode(newNode));
                  } else {
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
                  console.error('Error replacing node:', error);
                }
              });
            });
          });
        }
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_REMOVE_COMMAND,
      (payload) => {
        const { id, delay } = payload;
        const key = charToId(id);
        editor.update(() => {
          const node = $getNodeByKey(key);
          if (node) {
            if (delay) {
              if (node.isInline() === false) {
                const diffNode = $createDiffNode('remove');
                diffNode.append($cloneNode(node, editor));
                node.replace(diffNode, false);
              } else {
                const oldBlock = $closest(node, (node) => node.isInline() === false);
                if (!oldBlock) {
                  throw new Error('Old block node not found for removal.');
                }
                const diffNode = $createDiffNode('modify');
                diffNode.append($cloneNode(oldBlock, editor));
                node.remove();
                const newBlock = $getNodeByKey(oldBlock.getKey());
                if (!newBlock) {
                  throw new Error('New block node not found for removal.');
                }
                diffNode.append($cloneNode(newBlock, editor));
                newBlock.replace(diffNode, false);
              }
            } else {
              node.remove();
            }
          }
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_INSERT_COMMAND,
      (payload) => {
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

            if (delay) {
              if (isBefore) {
                if (referenceNode.isInline() === false) {
                  const diffNodes = newNodes.map((node: LexicalNode) => {
                    const diffNode = $createDiffNode('add');
                    diffNode.append(node);
                    return diffNode;
                  });
                  referenceNode.insertBefore(diffNodes);
                } else {
                  const refBlock = $closest(referenceNode, (node) => node.isInline() === false);
                  if (!refBlock) {
                    throw new Error('Reference block node not found for insertion.');
                  }
                  const diffNode = $createDiffNode('modify');
                  diffNode.append($cloneNode(refBlock, editor));
                  referenceNode = referenceNode.insertBefore(newNodes);
                  const newBlock = $getNodeByKey(refBlock.getKey());
                  if (!newBlock) {
                    throw new Error('New block node not found for insertion.');
                  }
                  diffNode.append($cloneNode(newBlock, editor));
                  newBlock.replace(diffNode, false);
                }
              } else {
                if (referenceNode.isInline() === false) {
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
                  const diffNode = $createDiffNode('modify');
                  diffNode.append($cloneNode(refBlock, editor));
                  referenceNode = referenceNode.insertAfter(newNodes);
                  const newBlock = $getNodeByKey(refBlock.getKey());
                  if (!newBlock) {
                    throw new Error('New block node not found for insertion.');
                  }
                  diffNode.append($cloneNode(newBlock, editor));
                  newBlock.replace(diffNode, false);
                }
              }
            } else {
              if (isBefore) {
                referenceNode = referenceNode.insertBefore(newNodes);
              } else {
                newNodes.forEach((node: LexicalNode) => {
                  if (referenceNode) {
                    referenceNode = referenceNode.insertAfter(node);
                  }
                });
              }
            }
          } catch (error) {
            console.error('Error inserting node:', error);
          }
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
  );
}
