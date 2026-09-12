import { $isCodeNode } from '@lexical/code-core';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $isTextNode, COMMAND_PRIORITY_HIGH } from 'lexical';

import { ENTER_HOLE_CONTENT_COMMAND, getHoleContentEntrySide } from '@/plugins/common/command';

/**
 * Register the ordinary CodeNode as an editable Hole target. This module is
 * shared by browser and headless codeblock plugins and intentionally imports
 * no renderer, highlighter, or React code.
 */
export const registerCodeblockHoleEntry = (editor: LexicalEditor): (() => void) =>
  editor.registerCommand(
    ENTER_HOLE_CONTENT_COMMAND,
    (payload) => {
      const side = getHoleContentEntrySide(payload);
      if (!side) return false;

      const target = $getNodeByKey(payload.key);
      if (!$isCodeNode(target)) return false;

      const descendant =
        side === 'before' ? target.getFirstDescendant() : target.getLastDescendant();
      if ($isTextNode(descendant)) {
        return Boolean(side === 'before' ? descendant.selectStart() : descendant.selectEnd());
      }

      return Boolean(side === 'before' ? target.selectStart() : target.selectEnd());
    },
    COMMAND_PRIORITY_HIGH,
  );
