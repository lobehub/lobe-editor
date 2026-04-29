import { COMMAND_PRIORITY_EDITOR, LexicalCommand, LexicalEditor, createCommand } from 'lexical';

import { $createMeta2dNode } from '../node';
import { DEFAULT_META2D_DIAGRAM_JSON } from '../utils/meta2dManager';

export interface InsertMeta2dPayload {
  diagram?: string;
  svg?: string;
}

export const INSERT_META2D_COMMAND: LexicalCommand<InsertMeta2dPayload | undefined> =
  createCommand('INSERT_META2D_COMMAND');

function lexicalWrap() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { $insertNodes } = require('lexical');
  return { $insertNodes };
}

export function registerMeta2dCommand(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    INSERT_META2D_COMMAND,
    (payload) => {
      const { $insertNodes } = lexicalWrap();
      editor.update(() => {
        const diagram =
          payload?.diagram?.trim() && payload.diagram
            ? payload.diagram
            : DEFAULT_META2D_DIAGRAM_JSON;
        const node = $createMeta2dNode(diagram, payload?.svg ?? '');
        $insertNodes([node]);
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );
}
