import { $insertNodes, COMMAND_PRIORITY_EDITOR, LexicalEditor, createCommand } from 'lexical';

import { $createHorizontalRuleNode } from '../node/HorizontalRuleNode';

export const INSERT_HORIZONTAL_RULE_COMMAND = createCommand<unknown>(
  'INSERT_HORIZONTAL_RULE_COMMAND',
);

export function registerHorizontalRuleCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_HORIZONTAL_RULE_COMMAND,
    () => {
      editor.update(() => {
        const hrNode = $createHorizontalRuleNode();
        $insertNodes([hrNode]);
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR, // Priority
  );
}
