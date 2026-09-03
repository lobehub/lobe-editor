import type { HeadingTagType } from '@lexical/rich-text';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical';

export const INSERT_QUOTE_COMMAND = createCommand<unknown>('INSERT_QUOTE_COMMAND');
export const INSERT_HEADING_COMMAND = createCommand<{ tag: HeadingTagType }>(
  'INSERT_HEADING_COMMAND',
);
/** Requests that a Hole's payload editor take focus at one of its edges. */
export const ENTER_HOLE_CONTENT_COMMAND = createCommand<{
  edge: 'end' | 'start';
  key: string;
}>('ENTER_HOLE_CONTENT_COMMAND');

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
