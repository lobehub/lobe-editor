import type { LexicalEditor } from 'lexical';
import { $getSelection, $insertNodes, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { IHoleService } from '@/plugins/common/service/i-hole-service';

import { $createHorizontalRuleNode } from '../node/HorizontalRuleNode';

export const INSERT_HORIZONTAL_RULE_COMMAND = createCommand<unknown>(
  'INSERT_HORIZONTAL_RULE_COMMAND',
);

export function registerHorizontalRuleCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_HORIZONTAL_RULE_COMMAND,
    () => {
      editor.update(() => {
        const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
        const currentSelection = $getSelection();
        if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
        const hrNode = $createHorizontalRuleNode();
        $insertNodes([hrNode]);
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );
}
