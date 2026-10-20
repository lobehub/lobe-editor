import { $wrapNodeInElement } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_HIGH,
  createCommand,
} from 'lexical';

import { $createCursorNode, CursorNode } from '@/plugins/common/node/cursor';

import { $createMentionNode } from '../node/MentionNode';
import type { MentionService } from '../service';

export const INSERT_MENTION_COMMAND = createCommand<{
  label: string;
  metadata?: Record<string, unknown>;
}>('INSERT_MENTION_COMMAND');

export function registerMentionCommand(editor: LexicalEditor, service: MentionService) {
  return editor.registerCommand(
    INSERT_MENTION_COMMAND,
    (payload) => {
      const { metadata, label } = payload;
      const hasCursorNode = editor.hasNodes([CursorNode]);
      editor.update(() => {
        const mentionNode = $createMentionNode(label, metadata);
        $insertNodes([mentionNode]);
        // Ensure mention is inside a paragraph when inserted at root
        if ($isRootOrShadowRoot(mentionNode.getParentOrThrow())) {
          const paragraph = $wrapNodeInElement(mentionNode, $createParagraphNode);
          if (!hasCursorNode) {
            paragraph.selectEnd();
          }
        }
        if (hasCursorNode) {
          const cursorNode = $createCursorNode();
          mentionNode.insertAfter(cursorNode);
          cursorNode.selectEnd();
        }
        service.onMentionInserted(mentionNode);
      });
      return true;
    },
    COMMAND_PRIORITY_HIGH, // Priority
  );
}
