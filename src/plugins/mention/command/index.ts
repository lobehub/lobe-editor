import { $wrapNodeInElement } from '@lexical/utils';
import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $getRoot,
  $insertNodes,
  $isElementNode,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  createCommand,
} from 'lexical';

import type { IEditorKernel } from '@/types';

import { $createMentionNode, $isMentionNode } from '../node/MentionNode';
import type { MentionDescriptor } from '../type';

export const INSERT_MENTION_COMMAND = createCommand<{
  label: string;
  metadata?: Record<string, unknown>;
}>('INSERT_MENTION_COMMAND');

export const GET_MENTIONS_COMMAND = createCommand<{
  onResult: (mentions: MentionDescriptor[]) => void;
}>('GET_MENTIONS_COMMAND');

export function registerMentionCommand(editor: LexicalEditor, kernel: IEditorKernel) {
  const unregisterInsert = editor.registerCommand(
    INSERT_MENTION_COMMAND,
    (payload) => {
      const { metadata, label } = payload;
      editor.update(() => {
        const mentionNode = $createMentionNode(label, metadata);
        $insertNodes([mentionNode]);
        // Ensure mention is inside a paragraph when inserted at root
        if ($isRootOrShadowRoot(mentionNode.getParentOrThrow())) {
          $wrapNodeInElement(mentionNode, $createParagraphNode).selectEnd();
        }
        kernel.emit('mentionInserted', mentionNode.toDescriptor());
      });
      return true;
    },
    COMMAND_PRIORITY_HIGH, // Priority
  );

  const unregisterGetMentions = editor.registerCommand(
    GET_MENTIONS_COMMAND,
    ({ onResult }) => {
      const mentions: MentionDescriptor[] = [];

      // Command listeners run inside Lexical's active update. Reading $getRoot
      // directly keeps this query consistent with a preceding insert command
      // in the same update, before the state is committed.
      const visit = (node: LexicalNode): void => {
        if ($isMentionNode(node)) {
          mentions.push(node.toDescriptor());
        }
        if ($isElementNode(node)) {
          node.getChildren().forEach(visit);
        }
      };

      visit($getRoot());

      onResult(mentions);
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );

  return () => {
    unregisterInsert();
    unregisterGetMentions();
  };
}
