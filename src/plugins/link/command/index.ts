import { LinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
import {
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  NodeKey,
  createCommand,
} from 'lexical';

import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '../node/LinkNode';

export const INSERT_LINK_COMMAND = createCommand<{ title?: string; url?: string }>(
  'INSERT_LINK_COMMAND',
);

export const UPDATE_LINK_TEXT_COMMAND = createCommand<{ key: NodeKey; text: string }>(
  'UPDATE_LINK_TEXT_COMMAND',
);

export const UNLINK_LINK_COMMAND = createCommand<{ key: NodeKey }>('UNLINK_LINK_COMMAND');

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
    editor.registerCommand(
      UNLINK_LINK_COMMAND,
      ({ key }) => {
        editor.update(() => {
          const node = $getNodeByKey(key);
          if (!$isLinkNode(node)) return;

          let selection = $getSelection();
          if (!selection || !$isRangeSelection(selection)) {
            $setSelection($createRangeSelection());
            selection = $getSelection();
          }

          const first = node.getFirstDescendant();
          const last = node.getLastDescendant();

          if (
            selection &&
            $isRangeSelection(selection) &&
            $isTextNode(first) &&
            $isTextNode(last)
          ) {
            selection.anchor.set(first.getKey(), 0, 'text');
            selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
            return;
          }

          const children = node.getChildren();
          for (const child of children) {
            node.insertBefore(child);
          }
          node.remove();
        });

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
