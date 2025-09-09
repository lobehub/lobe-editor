import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createMentionNode } from '../node/MentionNode';

export const INSERT_MENTION_COMMAND = createCommand<{
  label: string;
  metadata?: Record<string, unknown>;
}>('INSERT_MENTION_COMMAND');

export function registerMentionCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_MENTION_COMMAND,
    (payload) => {
      const { metadata, label } = payload;
      editor.update(() => {
        const mentionNode = $createMentionNode(label, metadata);
        $insertNodes([mentionNode]); // Insert a zero-width space to ensure the image is not the last child
        if ($isRootOrShadowRoot(mentionNode.getParentOrThrow())) {
          $wrapNodeInElement(mentionNode, $createParagraphNode).selectEnd();
        }
      });
      return true;
    },
    COMMAND_PRIORITY_HIGH, // Priority
  );
}
