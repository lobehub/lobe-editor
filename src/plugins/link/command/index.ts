import { LinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import {
  $createTextNode,
  $getNodeByKey,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  NodeKey,
  createCommand,
} from 'lexical';

import { $createLinkNode } from '../node/LinkNode';

export const INSERT_LINK_COMMAND = createCommand<{ title?: string; url?: string }>(
  'INSERT_LINK_COMMAND',
);

export const UPDATE_LINK_TEXT_COMMAND = createCommand<{ key: NodeKey; text: string }>(
  'UPDATE_LINK_TEXT_COMMAND',
);

export function registerLinkCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_LINK_COMMAND,
      (payload) => {
        const { url, title = url } = payload;

        editor.update(() => {
          const linkNode = $createLinkNode(url, { title });
          const textNode = $createTextNode(title);
          linkNode.append(textNode);
          $insertNodes([linkNode]);
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      UPDATE_LINK_TEXT_COMMAND,
      (payload) => {
        const { key, text } = payload;

        editor.update(() => {
          const linkNode = $getNodeByKey<LinkNode>(key);
          if (linkNode) {
            const newLinkNode = $createLinkNode(linkNode.getURL(), { title: text });
            const textNode = $createTextNode(text);
            newLinkNode.append(textNode);
            linkNode?.replace(newLinkNode);
            newLinkNode.select(1);
          }
        });

        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
