import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  LexicalCommand,
  LexicalEditor,
  createCommand,
} from 'lexical';

import { $createMeta2dNode } from '../node';
import { EMPTY_META2D_DIAGRAM_JSON, EMPTY_META2D_PLACEHOLDER_SVG } from '../utils/meta2dManager';

export interface InsertMeta2dPayload {
  diagram?: string;
  svg?: string;
}

export const INSERT_META2D_COMMAND: LexicalCommand<InsertMeta2dPayload | undefined> =
  createCommand('INSERT_META2D_COMMAND');

export function registerMeta2dCommand(editor: LexicalEditor): () => void {
  return editor.registerCommand(
    INSERT_META2D_COMMAND,
    (payload) => {
      editor.update(() => {
        const diagram = payload?.diagram?.trim() || EMPTY_META2D_DIAGRAM_JSON;
        const svg =
          payload?.svg !== undefined && payload.svg.trim() !== ''
            ? payload.svg
            : EMPTY_META2D_PLACEHOLDER_SVG;
        const node = $createMeta2dNode(diagram, svg);
        $insertNodes([node]);
      });
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );
}
