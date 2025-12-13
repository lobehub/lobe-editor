import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, COMMAND_PRIORITY_EDITOR, LexicalEditor, createCommand } from 'lexical';

import { DiffNode } from '../node/DiffNode';

export enum DiffAction {
  Reject,
  Accept,
}

export const LITEXML_DIFFNODE_COMMAND = createCommand<{ action: DiffAction; nodeKey: string }>(
  'LITEXML_DIFFNODE_COMMAND',
);

export function registerLiteXMLDiffCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      LITEXML_DIFFNODE_COMMAND,
      (payload) => {
        const { action, nodeKey } = payload;
        const node = editor.read(() => {
          return $getNodeByKey(nodeKey) as DiffNode | null;
        });
        if (!node) {
          return false;
        }
        editor.update(() => {
          const children = node.getChildren();
          if (action === DiffAction.Accept) {
            node.replace(children[1], false).selectEnd();
          } else if (action === DiffAction.Reject) {
            node.replace(children[0], false).selectEnd();
          }
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
