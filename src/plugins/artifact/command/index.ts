import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import {
  $createNodeSelection,
  $getSelection,
  $insertNodes,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';
import { IHoleService } from '@/plugins/common/service/i-hole-service';

import { $createArtifactNode } from '../node/ArtifactNode';

export interface InsertArtifactPayload {
  html?: string;
  title?: string;
}

export const INSERT_ARTIFACT_COMMAND = createCommand<InsertArtifactPayload | undefined>(
  'INSERT_ARTIFACT_COMMAND',
);
export const SELECT_BEFORE_ARTIFACT_COMMAND = createCommand<{ key: string }>(
  'SELECT_BEFORE_ARTIFACT_COMMAND',
);
export const SELECT_AFTER_ARTIFACT_COMMAND = createCommand<{ key: string }>(
  'SELECT_AFTER_ARTIFACT_COMMAND',
);

export function registerArtifactCommand(editor: LexicalEditor): () => void {
  return mergeRegister(
    editor.registerCommand(
      INSERT_ARTIFACT_COMMAND,
      (payload) => {
        editor.update(() => {
          const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
          const currentSelection = $getSelection();
          if (currentSelection) holeService?.prepareBoundaryInsertion(currentSelection);
          const artifact = $createArtifactNode(payload?.html, payload?.title);
          $insertNodes([artifact]);
          const selection = $createNodeSelection();
          selection.add(artifact.getKey());
          $setSelection(selection);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_BEFORE_ARTIFACT_COMMAND,
      ({ key }) => selectOutsideArtifact(editor, key, 'before'),
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      SELECT_AFTER_ARTIFACT_COMMAND,
      ({ key }) => selectOutsideArtifact(editor, key, 'after'),
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

function selectOutsideArtifact(
  editor: LexicalEditor,
  key: string,
  direction: 'after' | 'before',
): boolean {
  const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
  if (!holeService?.selectBoundary(key, direction)) return false;
  queueMicrotask(() => editor.focus());
  return true;
}
