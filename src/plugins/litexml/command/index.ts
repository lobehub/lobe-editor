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

import type LitexmlDataSource from '../data-source/litexml-data-source';
import { $parseSerializedNodeImpl } from '../utils';

export const LITEXML_APPLY_COMMAND = createCommand<{ litexml: string }>('LITEXML_APPLY_COMMAND');

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
                  if ($isElementNode(newNode) && !$isElementNode(prevNode)) {
                    prevNode = prevNode.getParentOrThrow().insertAfter(newNode);
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

        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
  );
}
