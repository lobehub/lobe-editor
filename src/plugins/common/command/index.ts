import { $createHeadingNode, $createQuoteNode, HeadingTagType } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  LexicalEditor,
  createCommand,
} from 'lexical';

export const INSERT_QUOTE_COMMAND = createCommand<void>('INSERT_QUOTE_COMMAND');
export const INSERT_HEADING_COMMAND = createCommand<{ tag: HeadingTagType }>(
  'INSERT_HEADING_COMMAND',
);

export function registerCommands(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_QUOTE_COMMAND,
      () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createQuoteNode());
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
    editor.registerCommand(
      INSERT_HEADING_COMMAND,
      (payload) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $setBlocksType(selection, () => $createHeadingNode(payload.tag));
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR, // Priority
    ),
  );
}
