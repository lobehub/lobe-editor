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
import { $parseSerializedNodeImpl } from '../utils';

export const LITEXML_APPLY_COMMAND = createCommand<{ litexml: string }>('LITEXML_APPLY_COMMAND');
export const LITEXML_REMOVE_COMMAND = createCommand<{ id: string }>('LITEXML_REMOVE_COMMAND');
export const LITEXML_INSERT_COMMAND = createCommand<
  | {
      beforeId: string;
      litexml: string;
    }
  | {
      afterId: string;
      litexml: string;
    }
>('LITEXML_INSERT_COMMAND');

export function registerLiteXMLCommand(editor: LexicalEditor, dataSource: LitexmlDataSource) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_APPLY_COMMAND,
      (payload) => {
        const { litexml } = payload;
        const inode = dataSource.readLiteXMLToInode(litexml);
        console.info('Applying LiteXML Inode:', inode);

        editor.update(() => {
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
                  prevNode = newNode;
                }
              }
            } catch (error) {
              console.error('Error replacing node:', error);
            }
          });
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_REMOVE_COMMAND,
      (payload) => {
        const { id } = payload;
        editor.update(() => {
          const node = $getNodeByKey(id);
          if (node) {
            node.remove();
          }
        });
        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      LITEXML_INSERT_COMMAND,
      (payload) => {
        const { litexml } = payload;
        const isBefore = 'beforeId' in payload;
        const inode = dataSource.readLiteXMLToInode(litexml);

        editor.update(() => {
          try {
            let referenceNode: LexicalNode | null = null;
            if (isBefore) {
              referenceNode = $getNodeByKey(payload.beforeId);
            } else {
              referenceNode = $getNodeByKey(payload.afterId);
            }

            if (!referenceNode) {
              throw new Error('Reference node not found for insertion.');
            }

            const newNodes = inode.root.children.map((child: any) =>
              $parseSerializedNodeImpl(child, editor),
            );

            if (isBefore) {
              referenceNode = referenceNode.insertBefore(newNodes);
            } else {
              newNodes.forEach((node: LexicalNode) => {
                if (referenceNode) {
                  referenceNode = referenceNode.insertAfter(node);
                }
              });
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
