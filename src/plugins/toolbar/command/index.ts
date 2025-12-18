import { mergeRegister } from '@lexical/utils';
import { COMMAND_PRIORITY_LOW, LexicalCommand, LexicalEditor, createCommand } from 'lexical';

export const HIDE_TOOLBAR_COMMAND: LexicalCommand<void> = createCommand();
export const SHOW_TOOLBAR_COMMAND: LexicalCommand<void> = createCommand();

export interface ToolbarCommandOptions {
  onHide?: () => void;
  onShow?: () => void;
}

export function registerToolbarCommand(editor: LexicalEditor, options?: ToolbarCommandOptions) {
  const { onHide, onShow } = options || {};

  return mergeRegister(
    editor.registerCommand(
      HIDE_TOOLBAR_COMMAND,
      () => {
        onHide?.();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),

    editor.registerCommand(
      SHOW_TOOLBAR_COMMAND,
      () => {
        onShow?.();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );
}
