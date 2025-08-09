import {
  $createTextNode,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createLinkNode } from '../node/LinkNode';

export const INSERT_LINK_COMMAND = createCommand<{ title?: string; url?: string }>(
  'INSERT_LINK_COMMAND',
);

export function registerLinkCommand(editor: LexicalEditor) {
  return editor.registerCommand(
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
  );
}
